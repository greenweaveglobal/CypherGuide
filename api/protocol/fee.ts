import { verifyEvent } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import { applyCorsHeaders } from "../../lib/cors";
import { verifyNip98Auth, validateNip98Auth } from "../../lib/adminAuth";
import { getProtocolConfig, saveProtocolConfig, validateBaseFeeRatePcm } from "../../lib/configStore";

const PROTOCOL_RELAYS = [
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
  "wss://offchain.pub"
];

export { validateNip98Auth };

export default async function handler(req: any, res: any) {
  // Strict CORS enforcement
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, PATCH, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  if (req.method === "GET") {
    const config = await getProtocolConfig();
    return res.status(200).json({
      ...config,
      baseFeeRatePcm: typeof config.baseFeeRatePcm === "number" ? config.baseFeeRatePcm : 20
    });
  }

  if (req.method === "PATCH") {
    try {
      // 1. Strict NIP-98 Auth check with raw payload verification
      const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : "");
      const auth = await verifyNip98Auth(req, "/api/protocol/fee", "PATCH", rawBody);
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { baseFeeRatePcm, auditEvent } = req.body || {};

      const validation = validateBaseFeeRatePcm(baseFeeRatePcm);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error || "baseFeeRatePcm must be an integer between 0 and 5000 (0.0% - 50.0%)."
        });
      }

      const current = await getProtocolConfig();
      const now = Date.now();
      const feeUpdatedBy = auth.pubkey || "";

      // 2. Validate and broadcast audit Nostr event if provided
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
          } else {
            console.warn("Audit event signature invalid or pubkey mismatch with NIP-98 event.");
          }
        } catch (vErr) {
          console.warn("Failed to verify audit event:", vErr);
        }
      }

      const updated = {
        ...current,
        baseFeeRatePcm: validation.pcm!,
        feeUpdatedAt: now,
        feeUpdatedBy,
        feeAuditNostrEventId: auditEventId || current.feeAuditNostrEventId || "",
        updatedAt: now,
        updatedBy: feeUpdatedBy
      };

      const saved = await saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist protocol fee configuration to storage." });
      }

      return res.status(200).json({
        success: true,
        ...updated
      });
    } catch (e: any) {
      console.error("Error updating protocol fee:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
