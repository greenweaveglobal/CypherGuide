import fs from "fs";
import path from "path";
import { verifyEvent, nip19 } from "nostr-tools";

// Authorized Admin Public Keys (Hex representation)
const AUTHORIZED_ADMIN_PUBKEYS = new Set([
  // npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh
  "96dfc17448bdc132c22623c7febf89c587a8be269d41d9572a90f8b105b73c79",
  // npub17nldrj8qkk2hj6cn5xu3st256wknp2sad7g2mv70a3nv2kv9l9qs5l4cc6
  "f4fed1c8e0b595796b13a1b9182d54d3ad30aa1d6f90adb3cfec66c55985f941"
]);

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

  if (!uTag || (!uTag.endsWith(targetUrlPath) && !uTag.includes("/api/protocol/config"))) {
    return {
      authorized: false,
      status: 401,
      error: "NIP-98 URL tag does not match target endpoint."
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

export default async function handler(req: any, res: any) {
  // CORS configuration
  const origin = req.headers.origin || "";
  const isAllowedOrigin = origin.endsWith("cypherguide.org") || origin.includes("localhost");
  res.setHeader("Access-Control-Allow-Origin", isAllowedOrigin ? origin : "https://cypherguide.org");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const config = getProtocolConfig();
    return res.status(200).json(config);
  }

  if (req.method === "POST") {
    try {
      // STRICT NIP-98 Authentication check
      const auth = verifyNip98Auth(req, "/api/protocol/config", "POST");
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { devLnAddress, infraIncentiveTreasuryLightningAddress } = req.body || {};

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

      const current = getProtocolConfig();
      const updated = {
        ...current,
        ...(trimmedDevAddress ? { devLnAddress: trimmedDevAddress } : {}),
        ...(trimmedTreasuryAddress ? { infraIncentiveTreasuryLightningAddress: trimmedTreasuryAddress } : {}),
        updatedAt: Date.now(),
        updatedBy: auth.pubkey ? nip19.npubEncode(auth.pubkey) : "admin"
      };

      const saved = saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist config to disk." });
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
