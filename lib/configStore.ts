import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

export interface ProtocolConfig {
  devLnAddress: string;
  infraIncentiveTreasuryLightningAddress: string;
  baseFeeRatePcm: number;
  feeUpdatedAt: number | null;
  feeUpdatedBy: string | null;
  feeAuditNostrEventId: string;
  configAuditNostrEventId: string;
  updatedAt: number;
  updatedBy: string;
}

export const DEFAULT_PROTOCOL_CONFIG: ProtocolConfig = {
  devLnAddress: "cypherguide@zaps.lol",
  infraIncentiveTreasuryLightningAddress: "peevishtender468@walletofsatoshi.com",
  baseFeeRatePcm: 20,
  feeUpdatedAt: null,
  feeUpdatedBy: null,
  feeAuditNostrEventId: "",
  configAuditNostrEventId: "",
  updatedAt: Date.now(),
  updatedBy: "system"
};

const REDIS_CONFIG_KEY = "cg:protocol_config";

function getConfigFilePath(): string {
  if (process.env.PROTOCOL_CONFIG_PATH) {
    return process.env.PROTOCOL_CONFIG_PATH;
  }
  return path.join(process.cwd(), "data", "protocol_config.json");
}

function readConfigFromFile(): ProtocolConfig {
  try {
    const filePath = getConfigFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PROTOCOL_CONFIG,
        ...parsed,
        baseFeeRatePcm: typeof parsed.baseFeeRatePcm === "number" ? parsed.baseFeeRatePcm : DEFAULT_PROTOCOL_CONFIG.baseFeeRatePcm
      };
    }
  } catch (err) {
    console.error("[ConfigStore] Error reading config from disk:", err);
  }
  return { ...DEFAULT_PROTOCOL_CONFIG };
}

function writeConfigToFile(config: ProtocolConfig): boolean {
  try {
    const filePath = getConfigFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (err) {
    // In read-only serverless filesystems (e.g. Vercel), this may fail
    console.warn("[ConfigStore] Could not write to disk file (expected in serverless read-only environment):", err);
    return false;
  }
}

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      redisClient = new Redis({ url, token });
      return redisClient;
    } catch (e) {
      console.error("[ConfigStore] Failed to initialize Redis client:", e);
    }
  }
  return null;
}

/**
 * Retrieves the protocol configuration.
 * Prioritizes Upstash Redis if configured; seeds Redis with initial disk config on first run.
 * Gracefully falls back to local disk storage.
 */
export async function getProtocolConfig(): Promise<ProtocolConfig> {
  const redis = getRedis();

  if (redis) {
    try {
      const data = await redis.get<any>(REDIS_CONFIG_KEY);
      if (data) {
        const config = typeof data === "string" ? JSON.parse(data) : data;
        return {
          ...DEFAULT_PROTOCOL_CONFIG,
          ...config,
          baseFeeRatePcm: typeof config.baseFeeRatePcm === "number" ? config.baseFeeRatePcm : DEFAULT_PROTOCOL_CONFIG.baseFeeRatePcm
        };
      }

      // Redis is currently empty -> seed it with current disk/default config
      const initial = readConfigFromFile();
      await redis.set(REDIS_CONFIG_KEY, JSON.stringify(initial));
      return initial;
    } catch (err) {
      console.error("[ConfigStore] Redis read failed, falling back to disk:", err);
    }
  }

  // Fallback to disk file
  return readConfigFromFile();
}

/**
 * Synchronous disk-only fallback (for legacy sync reads)
 */
export function getProtocolConfigSync(): ProtocolConfig {
  return readConfigFromFile();
}

/**
 * Persists the protocol configuration.
 * Writes to Upstash Redis if available, and also attempts disk storage.
 */
export async function saveProtocolConfig(config: ProtocolConfig): Promise<boolean> {
  const redis = getRedis();
  let redisSuccess = false;

  if (redis) {
    try {
      await redis.set(REDIS_CONFIG_KEY, JSON.stringify(config));
      redisSuccess = true;
    } catch (err) {
      console.error("[ConfigStore] Redis write failed, falling back to disk:", err);
    }
  }

  const diskSuccess = writeConfigToFile(config);

  // If Redis was configured and succeeded, return true even if disk is read-only (serverless)
  if (redis) {
    return redisSuccess;
  }

  return diskSuccess;
}

/**
 * Validates baseFeeRatePcm according to protocol governance rules (RFC-0002/RFC-0016):
 * Must be an integer between 0 and 5000 (0.00% to 50.00%).
 */
export function validateBaseFeeRatePcm(val: any): { valid: boolean; error?: string; pcm?: number } {
  if (val === undefined || val === null) {
    return { valid: false, error: "baseFeeRatePcm is required." };
  }
  const num = typeof val === "number" ? val : parseInt(val, 10);
  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, error: "baseFeeRatePcm must be an integer." };
  }
  if (num < 0 || num > 5000) {
    return { valid: false, error: "baseFeeRatePcm must be between 0 and 5000 (0.00% - 50.00%)." };
  }
  return { valid: true, pcm: num };
}
