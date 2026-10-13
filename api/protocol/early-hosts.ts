import { verifyEvent } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import { applyCorsHeaders } from "../../lib/cors.js";
import { verifyNip98Auth } from "../../lib/adminAuth.js";
import {
  getProtocolConfig,
  saveProtocolConfig,
  validateEarlyHostEnrollment,
  validateEarlyHostParameters,
  normalizePubkeyToHex,
  hexToNpub,
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
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, POST, DELETE, PATCH, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  if (req.method === "GET") {
    const configData = await getProtocolConfig();
    const rawHosts = Array.isArray(configData.earlyHosts) ? configData.earlyHosts : [];
    // Hiển thị: trả về danh sách host kèm npub định dạng bech32 và pubkeyHex
    const formattedHosts = rawHosts.map(h => ({
      ...h,
      pubkeyHex: normalizePubkeyToHex(h.npub) || h.npub,
      npub: hexToNpub(normalizePubkeyToHex(h.npub) || h.npub)
    }));

    return res.status(200).json({
      success: true,
      earlyHosts: formattedHosts,
      earlyHostFeeRatePcm: typeof configData.earlyHostFeeRatePcm === "number" ? configData.earlyHostFeeRatePcm : 100,
      maxEarlyHosts: typeof configData.maxEarlyHosts === "number" ? configData.maxEarlyHosts : 20,
      earlyHostDurationDays: typeof configData.earlyHostDurationDays === "number" ? configData.earlyHostDurationDays : 365
    });
  }

  // PATCH: Quản trị viên cập nhật durationDays (1..1095) hoặc maxEnrolled (0..1000)
  if (req.method === "PATCH") {
    try {
      const { rawBody, body } = await getRawBodyAndParsedJson(req);
      req.body = body;
      (req as any).rawBody = rawBody;

      const auth = await verifyNip98Auth(req, "/api/protocol/early-hosts", "PATCH", rawBody);
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { durationDays, maxEnrolled } = req.body || {};
      const val = validateEarlyHostParameters({ durationDays, maxEnrolled });
      if (!val.valid) {
        return res.status(400).json({ success: false, error: val.error });
      }

      const currentConfig = await getProtocolConfig();
      const updatedConfig = {
        ...currentConfig,
        ...(durationDays !== undefined ? { earlyHostDurationDays: val.durationDays } : {}),
        ...(maxEnrolled !== undefined ? { maxEarlyHosts: val.maxEnrolled } : {}),
        updatedAt: Date.now(),
        updatedBy: auth.pubkey || "admin"
      };

      const saved = await saveProtocolConfig(updatedConfig);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist early host parameters." });
      }

      return res.status(200).json({
        success: true,
        earlyHostDurationDays: updatedConfig.earlyHostDurationDays,
        maxEarlyHosts: updatedConfig.maxEarlyHosts
      });
    } catch (e: any) {
      console.error("Error updating early host parameters:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
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

      const durationDays = typeof currentConfig.earlyHostDurationDays === "number" ? currentConfig.earlyHostDurationDays : 365;
      const maxEnrolled = typeof currentConfig.maxEarlyHosts === "number" ? currentConfig.maxEarlyHosts : 20;

      const validation = validateEarlyHostEnrollment(npub, currentHosts, {
        durationDays,
        maxEnrolled,
        now: Date.now()
      });
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
            if (process.env.NODE_ENV !== "test") {
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
          }
        } catch (vErr) {
          console.warn("Failed to verify audit event:", vErr);
        }
      }

      // Lưu trữ dạng hex pubkey 64 ký tự ở mọi nơi trong database
      const newEnrollment: EarlyHostEnrollment = {
        npub: validation.cleanHex!,
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
        enrollment: {
          ...newEnrollment,
          npub: validation.cleanNpub!
        },
        earlyHosts: updatedHosts.map(h => ({
          ...h,
          npub: hexToNpub(h.npub)
        }))
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
        return res.status(400).json({ success: false, error: "Host npub or pubkey is required for removal." });
      }

      const hexToRemove = normalizePubkeyToHex(npub);
      if (!hexToRemove) {
        return res.status(400).json({ success: false, error: "Invalid host npub or pubkey format." });
      }

      const currentConfig = await getProtocolConfig();
      const currentHosts = Array.isArray(currentConfig.earlyHosts) ? currentConfig.earlyHosts : [];

      const exists = currentHosts.some(h => {
        const hHex = normalizePubkeyToHex(h.npub);
        return hHex === hexToRemove;
      });

      if (!exists) {
        return res.status(404).json({ success: false, error: "Early host not found in enrolled list." });
      }

      if (auditEvent && typeof auditEvent === "object") {
        try {
          const isValidAuditSig = verifyEvent(auditEvent);
          if (isValidAuditSig && auditEvent.pubkey === auth.pubkey) {
            if (process.env.NODE_ENV !== "test") {
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
          }
        } catch (vErr) {
          console.warn("Failed to verify audit event:", vErr);
        }
      }

      const updatedHosts = currentHosts.filter(h => {
        const hHex = normalizePubkeyToHex(h.npub);
        return hHex !== hexToRemove;
      });

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
        removedHex: hexToRemove,
        removedNpub: hexToNpub(hexToRemove),
        earlyHosts: updatedHosts.map(h => ({
          ...h,
          npub: hexToNpub(h.npub)
        }))
      });
    } catch (e: any) {
      console.error("Error removing early host:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
