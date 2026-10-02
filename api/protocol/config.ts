import { verifyEvent, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import { applyCorsHeaders } from "../../lib/cors.js";
import { verifyNip98Auth } from "../../lib/adminAuth.js";
import { getProtocolConfig, saveProtocolConfig } from "../../lib/configStore.js";

const PROTOCOL_RELAYS = [
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
  "wss://offchain.pub"
];

// Disable Vercel automatic body parsing to allow authentic raw byte stream capture for NIP-98 payload hash
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

  // If req is an unconsumed stream (e.g. Vercel Node runtime with bodyParser: false)
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
      // Fall through if stream read fails
    }
  }

  if (typeof req.body === "string") {
    let body = {};
    try { body = JSON.parse(req.body); } catch {}
    return { rawBody: req.body, body };
  }

  // Fallback if runtime pre-parsed req.body (documented assumption: client uses compact JSON.stringify)
  if (req.body && typeof req.body === "object") {
    const raw = JSON.stringify(req.body);
    return { rawBody: raw, body: req.body };
  }

  return { rawBody: "", body: {} };
}

export default async function handler(req: any, res: any) {
  // Strict CORS enforcement
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, POST, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  if (req.method === "GET") {
    const configData = await getProtocolConfig();
    return res.status(200).json({
      ...configData,
      baseFeeRatePcm: typeof configData.baseFeeRatePcm === "number" ? configData.baseFeeRatePcm : 20,
      configAuditNostrEventId: configData.configAuditNostrEventId || ""
    });
  }

  if (req.method === "POST") {
    try {
      // 1. Extract raw body stream and parse JSON
      const { rawBody, body } = await getRawBodyAndParsedJson(req);
      req.body = body;
      (req as any).rawBody = rawBody;

      // 2. STRICT NIP-98 Authentication check with raw payload verification
      const auth = await verifyNip98Auth(req, "/api/protocol/config", "POST", rawBody);
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { devLnAddress, infraIncentiveTreasuryLightningAddress, auditEvent } = req.body || {};

      if (!devLnAddress && !infraIncentiveTreasuryLightningAddress) {
        return res.status(400).json({
          success: false,
          error: "At least one address must be provided (devLnAddress or infraIncentiveTreasuryLightningAddress)"
        });
      }

      const lnRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
      let trimmedDevAddress: string | undefined = undefined;
      let trimmedTreasuryAddress: string | undefined = undefined;

      if (devLnAddress) {
        if (typeof devLnAddress !== "string") {
          return res.status(400).json({ success: false, error: "Invalid devLnAddress format" });
        }
        trimmedDevAddress = devLnAddress.trim().toLowerCase();
        if (!lnRegex.test(trimmedDevAddress) && !trimmedDevAddress.startsWith("lnurl")) {
          return res.status(400).json({ success: false, error: "Invalid devLnAddress format. Example: user@domain.com" });
        }
      }

      if (infraIncentiveTreasuryLightningAddress) {
        if (typeof infraIncentiveTreasuryLightningAddress !== "string") {
          return res.status(400).json({ success: false, error: "Invalid infraIncentiveTreasuryLightningAddress format" });
        }
        trimmedTreasuryAddress = infraIncentiveTreasuryLightningAddress.trim().toLowerCase();
        if (!lnRegex.test(trimmedTreasuryAddress) && !trimmedTreasuryAddress.startsWith("lnurl")) {
          return res.status(400).json({ success: false, error: "Invalid infraIncentiveTreasuryLightningAddress format. Example: user@domain.com" });
        }
      }

      // Validate and broadcast audit Nostr event if provided (best-effort)
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
              console.warn("Failed to broadcast config audit event to relays:", pErr);
            }
          } else {
            console.warn("Config audit event signature invalid or pubkey mismatch with NIP-98 event.");
          }
        } catch (vErr) {
          console.warn("Failed to verify config audit event:", vErr);
        }
      }

      const current = await getProtocolConfig();
      const updated = {
        ...current,
        ...(trimmedDevAddress ? { devLnAddress: trimmedDevAddress } : {}),
        ...(trimmedTreasuryAddress ? { infraIncentiveTreasuryLightningAddress: trimmedTreasuryAddress } : {}),
        configAuditNostrEventId: auditEventId || current.configAuditNostrEventId || "",
        updatedAt: Date.now(),
        updatedBy: auth.pubkey ? nip19.npubEncode(auth.pubkey) : "admin"
      };

      const saved = await saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist config to storage." });
      }

      return res.status(200).json({
        success: true,
        ...updated
      });
    } catch (e: any) {
      console.error("Error updating protocol config:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
