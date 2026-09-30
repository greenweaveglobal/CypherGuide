import { verifyEvent, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import { applyCorsHeaders } from "../../lib/cors";
import { verifyNip98Auth } from "../../lib/adminAuth";
import { getProtocolConfig, saveProtocolConfig } from "../../lib/configStore";

const PROTOCOL_RELAYS = [
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
  "wss://offchain.pub"
];

export default async function handler(req: any, res: any) {
  // Strict CORS enforcement
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, POST, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  if (req.method === "GET") {
    const config = await getProtocolConfig();
    return res.status(200).json({
      ...config,
      baseFeeRatePcm: typeof config.baseFeeRatePcm === "number" ? config.baseFeeRatePcm : 20,
      configAuditNostrEventId: config.configAuditNostrEventId || ""
    });
  }

  if (req.method === "POST") {
    try {
      // STRICT NIP-98 Authentication check with raw payload verification
      const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : "");
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
