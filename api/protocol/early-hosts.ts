import { verifyEvent } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import { applyCorsHeaders } from "../../lib/cors.js";
import { verifyNip98Auth } from "../../lib/adminAuth.js";
import {
  getProtocolConfig,
  saveProtocolConfig,
  validateEarlyHostEnrollment,
  type EarlyHostEnrollment
} from "../../lib/configStore.js";

const PROTOCOL_RELAYS = [
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
  "wss://offchain.pub"
];

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBodyAndParsedJson(req: any): Promise<{ rawBody: string; body: any }> {
  if (typeof (req as any).rawBody === "string") {
    const raw = (req as any).rawBody;
    const body = req.body || (raw ? JSON.parse(raw) : {});
    return { rawBody: raw, body };
  }
  if (Buffer.isBuffer((req as any).rawBody)) {
    const raw = (req as any).rawBody.toString("utf8");
    const body = req.body || (raw ? JSON.parse(raw) : {});
    return { rawBody: raw, body };
  }

  if (typeof req[Symbol.asyncIterator] === "function" && !req.readableEnded) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body = {};
        if (raw) {
          try { body = JSON.parse(raw); } catch {}
        }
        return { rawBody: raw, body };
      }
    } catch {
      // Fall through
    }
  }

  if (typeof req.body === "string") {
    let body = {};
    try { body = JSON.parse(req.body); } catch {}
    return { rawBody: req.body, body };
  }

  if (req.body && typeof req.body === "object") {
    const raw = JSON.stringify(req.body);
    return { rawBody: raw, body: req.body };
  }

  return { rawBody: "", body: {} };
}

export default async function handler(req: any, res: any) {
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, POST, DELETE, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  if (req.method === "GET") {
    const configData = await getProtocolConfig();
    return res.status(200).json({
      success: true,
      earlyHosts: Array.isArray(configData.earlyHosts) ? configData.earlyHosts : [],
      earlyHostFeeRatePcm: typeof configData.earlyHostFeeRatePcm === "number" ? configData.earlyHostFeeRatePcm : 100,
      maxEarlyHosts: 20
    });
  }

  if (req.method === "POST") {
    try {
      const { rawBody, body } = await getRawBodyAndParsedJson(req);
      req.body = body;
      (req as any).rawBody = rawBody;

      const auth = await verifyNip98Auth(req, "/api/protocol/early-hosts", "POST", rawBody);
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { npub, auditEvent, notes } = req.body || {};
      const currentConfig = await getProtocolConfig();
      const currentHosts = Array.isArray(currentConfig.earlyHosts) ? currentConfig.earlyHosts : [];

      const validation = validateEarlyHostEnrollment(npub, currentHosts);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      let auditEventId = "";
      if (auditEvent && typeof auditEvent === "object") {
        try {
          const isValidAuditSig = verifyEvent(auditEvent);
          if (isValidAuditSig && auditEvent.pubkey === auth.pubkey) {
            auditEventId = auditEvent.id;
            const pool = new SimplePool();
            try {
              const pubPromises = pool.publish(PROTOCOL_RELAYS, auditEvent);
              Promise.allSettled(pubPromises).then(() => {
                pool.close(PROTOCOL_RELAYS);
              }).catch(() => {});
            } catch (pErr) {
              console.warn("Failed to broadcast audit event to relays:", pErr);
            }
          }
        } catch (vErr) {
          console.warn("Failed to verify audit event:", vErr);
        }
      }

      const newEnrollment: EarlyHostEnrollment = {
        npub: validation.cleanNpub!,
        enrolledAt: Date.now(),
        enrolledBy: auth.pubkey || "admin",
        auditEventId: auditEventId || "",
        notes: typeof notes === "string" ? notes.slice(0, 200) : undefined
      };

      const updatedHosts = [...currentHosts, newEnrollment];
      const now = Date.now();
      const updatedConfig = {
        ...currentConfig,
        earlyHosts: updatedHosts,
        updatedAt: now,
        updatedBy: auth.pubkey || "admin"
      };

      const saved = await saveProtocolConfig(updatedConfig);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist early host enrollment." });
      }

      return res.status(200).json({
        success: true,
        enrollment: newEnrollment,
        earlyHosts: updatedHosts
      });
    } catch (e: any) {
      console.error("Error enrolling early host:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { rawBody, body } = await getRawBodyAndParsedJson(req);
      req.body = body;
      (req as any).rawBody = rawBody;

      const auth = await verifyNip98Auth(req, "/api/protocol/early-hosts", "DELETE", rawBody);
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { npub, auditEvent } = req.body || {};
      if (!npub || typeof npub !== "string") {
        return res.status(400).json({ success: false, error: "Host npub is required for removal." });
      }

      const currentConfig = await getProtocolConfig();
      const currentHosts = Array.isArray(currentConfig.earlyHosts) ? currentConfig.earlyHosts : [];
      const trimmedNpub = npub.trim();

      const exists = currentHosts.some(h => h.npub === trimmedNpub);
      if (!exists) {
        return res.status(404).json({ success: false, error: "Early host not found in enrolled list." });
      }

      if (auditEvent && typeof auditEvent === "object") {
        try {
          const isValidAuditSig = verifyEvent(auditEvent);
          if (isValidAuditSig && auditEvent.pubkey === auth.pubkey) {
            const pool = new SimplePool();
            try {
              const pubPromises = pool.publish(PROTOCOL_RELAYS, auditEvent);
              Promise.allSettled(pubPromises).then(() => {
                pool.close(PROTOCOL_RELAYS);
              }).catch(() => {});
            } catch (pErr) {
              console.warn("Failed to broadcast audit event to relays:", pErr);
            }
          }
        } catch (vErr) {
          console.warn("Failed to verify audit event:", vErr);
        }
      }

      const updatedHosts = currentHosts.filter(h => h.npub !== trimmedNpub);
      const now = Date.now();
      const updatedConfig = {
        ...currentConfig,
        earlyHosts: updatedHosts,
        updatedAt: now,
        updatedBy: auth.pubkey || "admin"
      };

      const saved = await saveProtocolConfig(updatedConfig);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist early host removal." });
      }

      return res.status(200).json({
        success: true,
        removedNpub: trimmedNpub,
        earlyHosts: updatedHosts
      });
    } catch (e: any) {
      console.error("Error removing early host:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
