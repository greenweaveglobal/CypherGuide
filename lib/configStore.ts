import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { nip19 } from "nostr-tools";

export interface EarlyHostEnrollment {
  npub: string; // Lưu pubkey hex 64 ký tự (chuẩn hóa); API hiển thị chuyển sang npub khi cần
  enrolledAt: number; // timestamp in ms
  enrolledBy: string; // admin npub or hex pubkey
  auditEventId?: string;
  notes?: string;
}

export interface ProtocolConfig {
  devLnAddress: string;
  infraIncentiveTreasuryLightningAddress: string;
  baseFeeRatePcm: number;
  earlyHostFeeRatePcm: number;
  earlyHosts: EarlyHostEnrollment[];
  earlyHostDurationDays?: number; // Mặc định 365 (1..1095)
  maxEarlyHosts?: number; // Mặc định 20 (0..1000)
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
  baseFeeRatePcm: 200,
  earlyHostFeeRatePcm: 100,
  earlyHosts: [],
  earlyHostDurationDays: 365,
  maxEarlyHosts: 20,
  feeUpdatedAt: null,
  feeUpdatedBy: null,
  feeAuditNostrEventId: "",
  configAuditNostrEventId: "",
  updatedAt: Date.now(),
  updatedBy: "system"
};

const REDIS_CONFIG_KEY = "cg:protocol_config";

/**
 * Chuẩn hóa một chuỗi npub1... hoặc hex 64 ký tự sang hex 64 ký tự chữ thường.
 * Dùng nip19.decode để kiểm tra tính hợp lệ của bech32 và checksum.
 */
export function normalizePubkeyToHex(input: any): string | null {
  if (!input || typeof input !== "string") return null;
  const clean = input.trim();
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return clean.toLowerCase();
  }
  if (clean.startsWith("npub1")) {
    try {
      const decoded = nip19.decode(clean);
      if (decoded.type === "npub" && typeof decoded.data === "string") {
        return (decoded.data as string).toLowerCase();
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Chuyển đổi hex pubkey sang npub1 bech32.
 */
export function hexToNpub(hex: string): string {
  try {
    const clean = hex.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(clean)) {
      return nip19.npubEncode(clean);
    }
    return hex;
  } catch {
    return hex;
  }
}

/**
 * Di chuyển mảng earlyHosts: nếu phần tử nào lưu dưới dạng npub1..., tự động chuyển sang hex 64 ký tự khi nạp.
 */
function migrateEarlyHostsToHex(hosts: any[]): EarlyHostEnrollment[] {
  if (!Array.isArray(hosts)) return [];
  return hosts.map((h) => {
    const hex = normalizePubkeyToHex(h.npub) || h.npub;
    return {
      ...h,
      npub: hex
    };
  });
}

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
        baseFeeRatePcm: typeof parsed.baseFeeRatePcm === "number" ? parsed.baseFeeRatePcm : DEFAULT_PROTOCOL_CONFIG.baseFeeRatePcm,
        earlyHostFeeRatePcm: typeof parsed.earlyHostFeeRatePcm === "number" ? parsed.earlyHostFeeRatePcm : DEFAULT_PROTOCOL_CONFIG.earlyHostFeeRatePcm,
        earlyHostDurationDays: typeof parsed.earlyHostDurationDays === "number" ? parsed.earlyHostDurationDays : DEFAULT_PROTOCOL_CONFIG.earlyHostDurationDays,
        maxEarlyHosts: typeof parsed.maxEarlyHosts === "number" ? parsed.maxEarlyHosts : DEFAULT_PROTOCOL_CONFIG.maxEarlyHosts,
        earlyHosts: migrateEarlyHostsToHex(Array.isArray(parsed.earlyHosts) ? parsed.earlyHosts : DEFAULT_PROTOCOL_CONFIG.earlyHosts)
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
  if (process.env.NODE_ENV === "test" && !process.env.ENABLE_REDIS_IN_TESTS) {
    return null;
  }
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
          baseFeeRatePcm: typeof config.baseFeeRatePcm === "number" ? config.baseFeeRatePcm : DEFAULT_PROTOCOL_CONFIG.baseFeeRatePcm,
          earlyHostFeeRatePcm: typeof config.earlyHostFeeRatePcm === "number" ? config.earlyHostFeeRatePcm : DEFAULT_PROTOCOL_CONFIG.earlyHostFeeRatePcm,
          earlyHostDurationDays: typeof config.earlyHostDurationDays === "number" ? config.earlyHostDurationDays : DEFAULT_PROTOCOL_CONFIG.earlyHostDurationDays,
          maxEarlyHosts: typeof config.maxEarlyHosts === "number" ? config.maxEarlyHosts : DEFAULT_PROTOCOL_CONFIG.maxEarlyHosts,
          earlyHosts: migrateEarlyHostsToHex(Array.isArray(config.earlyHosts) ? config.earlyHosts : DEFAULT_PROTOCOL_CONFIG.earlyHosts)
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

/**
 * Thẩm định các tham số cấu hình ưu đãi chủ nhà:
 * - durationDays: 1 .. 1095 ngày (tối đa 3 năm)
 * - maxEarlyHosts / maxEnrolled: 0 .. 1000
 */
export function validateEarlyHostParameters(params: {
  durationDays?: any;
  maxEnrolled?: any;
}): { valid: boolean; error?: string; durationDays?: number; maxEnrolled?: number } {
  let validatedDuration = DEFAULT_PROTOCOL_CONFIG.earlyHostDurationDays!;
  let validatedMax = DEFAULT_PROTOCOL_CONFIG.maxEarlyHosts!;

  if (params.durationDays !== undefined && params.durationDays !== null) {
    const d = typeof params.durationDays === "number" ? params.durationDays : parseInt(params.durationDays, 10);
    if (isNaN(d) || !Number.isInteger(d) || d < 1 || d > 1095) {
      return { valid: false, error: "durationDays must be an integer between 1 and 1095." };
    }
    validatedDuration = d;
  }

  if (params.maxEnrolled !== undefined && params.maxEnrolled !== null) {
    const m = typeof params.maxEnrolled === "number" ? params.maxEnrolled : parseInt(params.maxEnrolled, 10);
    if (isNaN(m) || !Number.isInteger(m) || m < 0 || m > 1000) {
      return { valid: false, error: "maxEnrolled must be an integer between 0 and 1000." };
    }
    validatedMax = m;
  }

  return { valid: true, durationDays: validatedDuration, maxEnrolled: validatedMax };
}

/**
 * Validates early host enrollment according to RFC-0002 / Round 13 rules:
 * - Chấp nhận npub1... (giải mã bech32 và kiểm tra checksum) hoặc chuỗi hex 64 ký tự.
 * - Lưu và so sánh bằng hex pubkey ở mọi nơi.
 * - Giới hạn số lượng chỉ tính các suất CÒN HIỆU LỰC (không tính suất đã hết hạn quá durationDays).
 * - maxEnrolled và durationDays lấy từ cấu hình protocol (hoặc giá trị mặc định).
 */
export function validateEarlyHostEnrollment(
  npubOrHex: any,
  currentEarlyHosts: EarlyHostEnrollment[] = [],
  options?: {
    maxEnrolled?: number;
    durationDays?: number;
    now?: number;
  }
): { valid: boolean; error?: string; cleanHex?: string; cleanNpub?: string } {
  if (!npubOrHex || typeof npubOrHex !== "string") {
    return { valid: false, error: "Host npub or hex pubkey is required." };
  }

  const hex = normalizePubkeyToHex(npubOrHex);
  if (!hex) {
    return { valid: false, error: "Invalid npub or hex pubkey format or failed bech32 checksum." };
  }

  const durationDays = options?.durationDays ?? DEFAULT_PROTOCOL_CONFIG.earlyHostDurationDays ?? 365;
  const maxLimit = options?.maxEnrolled ?? DEFAULT_PROTOCOL_CONFIG.maxEarlyHosts ?? 20;
  const now = options?.now ?? Date.now();
  const durationMs = durationDays * 24 * 60 * 60 * 1000;

  // Kiểm tra trùng lặp: cùng một chủ nhà dù viết dạng npub hay hex đều bị coi là trùng
  const isDuplicate = currentEarlyHosts.some((h) => {
    const existingHex = normalizePubkeyToHex(h.npub);
    return existingHex === hex;
  });

  if (isDuplicate) {
    return { valid: false, error: "This host is already enrolled in the early host program." };
  }

  // Giới hạn số lượng CHỈ TÍNH các suất CÒN HIỆU LỰC (suất hết hạn không chiếm chỗ)
  const activeCount = currentEarlyHosts.filter((h) => {
    return (now >= h.enrolledAt) && ((now - h.enrolledAt) <= durationMs);
  }).length;

  if (activeCount >= maxLimit) {
    return { valid: false, error: `Early host program is full (maximum ${maxLimit} active hosts).` };
  }

  return {
    valid: true,
    cleanHex: hex,
    cleanNpub: hexToNpub(hex)
  };
}
