import fs from "fs";
import path from "path";
import { verifyEvent, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";

// Authorized Admin Public Keys (Hex representation)
const AUTHORIZED_ADMIN_PUBKEYS = new Set([
  // npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh
  "96dfc17448bdc132c22623c7febf89c587a8be269d41d9572a90f8b105b73c79",
  // npub17nldrj8qkk2hj6cn5xu3st256wknp2sad7g2mv70a3nv2kv9l9qs5l4cc6
  "f4fed1c8e0b595796b13a1b9182d54d3ad30aa1d6f90adb3cfec66c55985f941"
]);

if (process.env.TEST_ADMIN_PUBKEY) {
  AUTHORIZED_ADMIN_PUBKEYS.add(process.env.TEST_ADMIN_PUBKEY);
}

function getConfigFilePath(): string {
  return path.join(process.cwd(), "data", "protocol_config.json");
}

function getProtocolConfig() {
  try {
    const configFilePath = getConfigFilePath();
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading protocol config:", e);
  }
  return {
    devLnAddress: "cypherguide@zaps.lol",
    infraIncentiveTreasuryLightningAddress: "peevishtender468@walletofsatoshi.com",
    baseFeeRatePcm: 20,
    feeUpdatedAt: null,
    feeUpdatedBy: null,
    feeAuditNostrEventId: "",
    updatedAt: Date.now(),
    updatedBy: "system"
  };
}

function saveProtocolConfig(config: any): boolean {
  try {
    const configFilePath = getConfigFilePath();
    const dir = path.dirname(configFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Error saving protocol config:", e);
    return false;
  }
}

/**
 * Validates NIP-98 HTTP Authentication (Kind 27235)
 */
function verifyNip98Auth(req: any, targetUrlPath: string, targetMethod: string): { authorized: boolean; pubkey?: string; error?: string; status: number } {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return {
      authorized: false,
      status: 401,
      error: "Missing Authorization header. NIP-98 authentication (Kind 27235) is strictly required."
    };
  }

  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith("nostr ")) {
    return {
      authorized: false,
      status: 401,
      error: "Invalid Authorization scheme. Expected 'Nostr <base64_kind_27235_event>'."
    };
  }

  const base64Payload = trimmed.slice(6).trim();
  let event: any;
  try {
    const decodedStr = Buffer.from(base64Payload, "base64").toString("utf-8");
    event = JSON.parse(decodedStr);
  } catch (err) {
    return {
      authorized: false,
      status: 400,
      error: "Malformed base64 or JSON in NIP-98 Authorization header."
    };
  }

  // 1. Kind must be 27235
  if (event.kind !== 27235) {
    return {
      authorized: false,
      status: 401,
      error: "Invalid event kind. NIP-98 requires kind 27235."
    };
  }

  // 2. Cryptographic signature verification (Schnorr over Secp256k1)
  try {
    const isValidSig = verifyEvent(event);
    if (!isValidSig) {
      return {
        authorized: false,
        status: 401,
        error: "Invalid Nostr Schnorr signature on NIP-98 authentication event."
      };
    }
  } catch (sigErr) {
    return {
      authorized: false,
      status: 401,
      error: "Signature verification failed."
    };
  }

  // 3. Timestamp anti-replay check (within +/- 60 seconds)
  const now = Math.floor(Date.now() / 1000);
  const timeDelta = Math.abs(now - (event.created_at || 0));
  if (timeDelta > 60) {
    return {
      authorized: false,
      status: 401,
      error: `NIP-98 timestamp expired or outside +/- 60s tolerance (delta: ${timeDelta}s).`
    };
  }

  // 4. Tags validation: u and method
  const tags: string[][] = Array.isArray(event.tags) ? event.tags : [];
  const uTag = tags.find(t => t[0] === "u")?.[1];
  const methodTag = tags.find(t => t[0] === "method")?.[1];

  if (!methodTag || methodTag.toUpperCase() !== targetMethod.toUpperCase()) {
    return {
      authorized: false,
      status: 401,
      error: `NIP-98 method tag mismatch. Expected '${targetMethod.toUpperCase()}'.`
    };
  }

  if (!uTag || (!uTag.endsWith(targetUrlPath) && !uTag.includes(targetUrlPath))) {
    return {
      authorized: false,
      status: 401,
      error: `NIP-98 URL tag does not match target endpoint '${targetUrlPath}'.`
    };
  }

  // 5. Admin Authorization Check
  if (!AUTHORIZED_ADMIN_PUBKEYS.has(event.pubkey)) {
    return {
      authorized: false,
      status: 403,
      error: `Forbidden: Nostr pubkey '${event.pubkey}' is not an authorized protocol admin.`
    };
  }

  return {
    authorized: true,
    pubkey: event.pubkey,
    status: 200
  };
}

const validateNip98Auth = verifyNip98Auth;

export default async function handler(req: any, res: any) {
  // CORS configuration
  const origin = req.headers.origin || "";
  const isAllowedOrigin = origin.endsWith("cypherguide.org") || origin.includes("localhost") || origin.includes("127.0.0.1");
  res.setHeader("Access-Control-Allow-Origin", isAllowedOrigin ? origin : "https://cypherguide.org");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const config = getProtocolConfig();
    return res.status(200).json({
      ...config,
      baseFeeRatePcm: typeof config.baseFeeRatePcm === "number" ? config.baseFeeRatePcm : 20
    });
  }

  if (req.method === "PATCH") {
    try {
      // 1. Strict NIP-98 Auth check
      const auth = validateNip98Auth(req, "/api/protocol/fee", "PATCH");
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { baseFeeRatePcm, auditEvent } = req.body || {};

      if (typeof baseFeeRatePcm !== "number" || !Number.isInteger(baseFeeRatePcm) || baseFeeRatePcm < 0 || baseFeeRatePcm > 5000) {
        return res.status(400).json({
          success: false,
          error: "baseFeeRatePcm must be an integer between 0 and 5000 (0.0% - 50.0%)."
        });
      }

      const current = getProtocolConfig();
      const oldFeeRatePcm = typeof current.baseFeeRatePcm === "number" ? current.baseFeeRatePcm : 20;
      const now = Date.now();
      const feeUpdatedBy = auth.pubkey || "";

      // 2. Validate and broadcast audit Nostr event if provided
      let auditEventId = "";
      if (auditEvent && typeof auditEvent === "object") {
        try {
          const isValidAuditSig = verifyEvent(auditEvent);
          if (isValidAuditSig && auditEvent.pubkey === auth.pubkey) {
            auditEventId = auditEvent.id;
            // Broadcast to Nostr protocol relays asynchronously (best-effort)
            const PROTOCOL_RELAYS = [
              "wss://relay.snort.social",
              "wss://nostr.wine",
              "wss://relay.nostr.band",
              "wss://offchain.pub"
            ];
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

      const updated = {
        ...current,
        baseFeeRatePcm,
        feeUpdatedAt: now,
        feeUpdatedBy,
        feeAuditNostrEventId: auditEventId || current.feeAuditNostrEventId || "",
        updatedAt: now,
        updatedBy: feeUpdatedBy
      };

      const saved = saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist protocol fee configuration to disk." });
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
