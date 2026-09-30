import crypto from "crypto";
import { verifyEvent } from "nostr-tools";
import { Redis } from "@upstash/redis";
import { AUTHORIZED_ADMIN_PUBKEYS } from "../src/constants/adminPubkeys";

// In-memory seen events fallback: eventId -> expiry timestamp (ms)
const inMemorySeenEvents = new Map<string, number>();

// Periodic cleanup of expired replay records
if (typeof setInterval !== "undefined") {
  const replayCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, exp] of inMemorySeenEvents.entries()) {
      if (now > exp) {
        inMemorySeenEvents.delete(id);
      }
    }
  }, 60 * 1000);
  if (replayCleanupTimer.unref) {
    replayCleanupTimer.unref();
  }
}

let redisClient: Redis | null = null;
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      redisClient = new Redis({ url, token });
      return redisClient;
    } catch (e) {
      console.error("[NIP-98] Error initializing Redis client for replay cache:", e);
    }
  }
  return null;
}

/**
 * Checks and records a NIP-98 event ID to prevent replay attacks within a 120-second window.
 * Returns true if the event is NEW and successfully recorded.
 * Returns false if the event has ALREADY BEEN SEEN (replay attack).
 */
async function checkAndRecordEventId(eventId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    try {
      // SET key value EX 120 NX -> returns "OK" if set, null if key already existed
      const res = await redis.set(`cg:nip98_seen:${eventId}`, "1", { ex: 120, nx: true });
      return res === "OK";
    } catch (e) {
      console.warn("[NIP-98] Redis replay check failed, using memory fallback:", e);
    }
  }

  // In-memory fallback
  const now = Date.now();
  const existingExp = inMemorySeenEvents.get(eventId);
  if (existingExp && now <= existingExp) {
    return false; // Replay detected
  }

  inMemorySeenEvents.set(eventId, now + 120 * 1000);
  return true;
}

export function clearSeenEventsForTesting() {
  inMemorySeenEvents.clear();
}

/**
 * Returns the set of authorized admin pubkeys.
 * TEST_ADMIN_PUBKEY is only accepted in non-production environments.
 */
export function getAuthorizedAdminPubkeys(): Set<string> {
  const pubkeys = new Set<string>(AUTHORIZED_ADMIN_PUBKEYS.map(pk => pk.toLowerCase()));

  if (process.env.TEST_ADMIN_PUBKEY) {
    if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
      console.warn("[SECURITY ALERT] TEST_ADMIN_PUBKEY environment variable is strictly IGNORED in production.");
    } else {
      pubkeys.add(process.env.TEST_ADMIN_PUBKEY.trim().toLowerCase());
    }
  }

  return pubkeys;
}

export interface Nip98AuthResult {
  authorized: boolean;
  pubkey?: string;
  error?: string;
  status: number;
}

/**
 * Validates NIP-98 HTTP Authentication (Kind 27235)
 * 
 * Enforces:
 * - Scheme: "Nostr <base64>"
 * - Kind: 27235
 * - BIP-340 Schnorr signature
 * - Timestamp within +/- 60s tolerance
 * - Exact URL matching on tag 'u' (scheme + host + path)
 * - Exact method matching on tag 'method'
 * - Payload hash verification on tag 'payload' (SHA-256 of body) if tag is present
 * - 120-second event ID replay prevention (via Redis or in-memory fallback)
 * - Admin authorization against whitelist
 */
export async function verifyNip98Auth(
  req: any,
  targetUrlPath: string,
  targetMethod: string,
  rawBody?: any
): Promise<Nip98AuthResult> {
  const authHeader = req.headers?.["authorization"] || req.headers?.["Authorization"];
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

  // 2. Cryptographic signature verification (BIP-340 Schnorr over Secp256k1)
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

  // 4. Unique event ID anti-replay check (120-second cache window)
  if (!event.id || typeof event.id !== "string") {
    return {
      authorized: false,
      status: 401,
      error: "NIP-98 event is missing required 'id' field."
    };
  }
  const isNewEvent = await checkAndRecordEventId(event.id);
  if (!isNewEvent) {
    return {
      authorized: false,
      status: 401,
      error: "NIP-98 event replay detected. Event ID has already been consumed."
    };
  }

  // 5. Tags validation: u, method, payload
  const tags: string[][] = Array.isArray(event.tags) ? event.tags : [];
  const uTag = tags.find(t => t[0] === "u")?.[1];
  const methodTag = tags.find(t => t[0] === "method")?.[1];
  const payloadTag = tags.find(t => t[0] === "payload")?.[1];

  // Method check
  if (!methodTag || methodTag.toUpperCase() !== targetMethod.toUpperCase()) {
    return {
      authorized: false,
      status: 401,
      error: `NIP-98 method tag mismatch. Expected '${targetMethod.toUpperCase()}'.`
    };
  }

  // URL check: build list of acceptable exact absolute URLs
  if (!uTag) {
    return {
      authorized: false,
      status: 401,
      error: "NIP-98 missing required 'u' tag."
    };
  }

  const validUrls = new Set<string>();

  // If explicit PUBLIC_BASE_URL configured
  if (process.env.PUBLIC_BASE_URL) {
    const base = process.env.PUBLIC_BASE_URL.replace(/\/+$/, "");
    validUrls.add(`${base}${targetUrlPath}`);
  }

  // Standard production canonical hostnames
  validUrls.add(`https://cypherguide.org${targetUrlPath}`);
  validUrls.add(`https://www.cypherguide.org${targetUrlPath}`);

  // In non-production only: allow building URL from request headers and localhost origins for local dev/testing
  if (process.env.NODE_ENV !== "production") {
    const proto = (req.headers?.["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers?.["x-forwarded-host"] as string) || (req.headers?.host as string) || "";
    if (host) {
      validUrls.add(`${proto}://${host}${targetUrlPath}`);
    }

    validUrls.add(`http://localhost:3000${targetUrlPath}`);
    validUrls.add(`http://localhost:5173${targetUrlPath}`);
    validUrls.add(`http://localhost${targetUrlPath}`);
    validUrls.add(`http://127.0.0.1:3000${targetUrlPath}`);
    validUrls.add(`http://127.0.0.1${targetUrlPath}`);
    // Also accept relative targetUrlPath in unit test mocks if request has no host
    if (!host) {
      validUrls.add(targetUrlPath);
    }
  }

  if (!validUrls.has(uTag)) {
    return {
      authorized: false,
      status: 401,
      error: `NIP-98 URL tag mismatch. Tag 'u' (${uTag}) does not match endpoint '${targetUrlPath}'.`
    };
  }

  // 6. Optional payload tag verification (SHA-256 hash of body)
  if (payloadTag) {
    const bodyToHash = rawBody !== undefined ? rawBody : req.body;
    let bodyString = "";
    if (typeof bodyToHash === "string") {
      bodyString = bodyToHash;
    } else if (bodyToHash && typeof bodyToHash === "object") {
      bodyString = JSON.stringify(bodyToHash);
    }
    const computedHash = crypto.createHash("sha256").update(bodyString, "utf8").digest("hex");
    if (payloadTag.toLowerCase() !== computedHash.toLowerCase()) {
      return {
        authorized: false,
        status: 401,
        error: `NIP-98 payload tag hash mismatch. Expected '${computedHash}', received '${payloadTag}'.`
      };
    }
  }

  // 7. Admin Authorization Whitelist Check
  const authorizedPubkeys = getAuthorizedAdminPubkeys();
  if (!authorizedPubkeys.has(event.pubkey?.toLowerCase())) {
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

// Alias for backwards compatibility
export const validateNip98Auth = verifyNip98Auth;
