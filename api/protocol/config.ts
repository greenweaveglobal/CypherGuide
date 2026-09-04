import fs from "fs";
import path from "path";

const MARKETING_NPUB = "npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh";

function getConfigFilePath(): string {
  // Try /tmp in serverless environment if process.cwd() is read-only
  const primaryPath = path.join(process.cwd(), "data", "protocol_config.json");
  return primaryPath;
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

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
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
      const { devLnAddress, npub } = req.body || {};

      if (!devLnAddress || typeof devLnAddress !== "string") {
        return res.status(400).json({ success: false, error: "Invalid devLnAddress" });
      }

      const trimmedAddress = devLnAddress.trim().toLowerCase();
      const lnRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
      if (!lnRegex.test(trimmedAddress) && !trimmedAddress.startsWith("lnurl")) {
        return res.status(400).json({ success: false, error: "Invalid Lightning Address format. Example: user@domain.com" });
      }

      const isAuthorized = npub === MARKETING_NPUB || 
        npub === "npub17nldrj8qkk2hj6cn5xu3st256wknp2sad7g2mv70a3nv2kv9l9qs5l4cc6";

      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: "Unauthorized: Only official admin/guardians can update network donation wallet." });
      }

      const current = getProtocolConfig();
      const updated = {
        ...current,
        devLnAddress: trimmedAddress,
        updatedAt: Date.now(),
        updatedBy: npub || "admin"
      };

      saveProtocolConfig(updated);

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
