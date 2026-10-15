/**
 * Cypher Protocol - Dynamic Protocol Fee Module (RFC-0002 / RFC-0016 / RFC-0019)
 * Tính toán phí giao dịch động dựa trên lưu lượng mạng lưới,
 * cấp độ bảo mật và chương trình ưu đãi chủ nhà tiên phong (Early Host Incentive).
 */

import { nip19, verifyEvent, finalizeEvent } from 'nostr-tools';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export const LISTING_SIGNATURE_KIND = 30078; // NIP-78 Parameterized Replaceable Application Event

export interface EarlyHostEnrollment {
  npub: string;
  enrolledAt: number;
  enrolledBy: string;
  auditEventId?: string;
  notes?: string;
}

export interface FeeStructure {
  baseFeeRatePcm: number;
  earlyHostFeeRatePcm: number;
  congestionMultiplier: number;
  minFeeSats: number;
  maxFeeSats: number;
  earlyHosts?: EarlyHostEnrollment[];
}

export const DEFAULT_EARLY_HOST_DURATION_DAYS = 365;
export const EARLY_HOST_DURATION_MS = DEFAULT_EARLY_HOST_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const DEFAULT_FEE_STRUCTURE: FeeStructure = {
  baseFeeRatePcm: 200,
  earlyHostFeeRatePcm: 100,
  congestionMultiplier: 1.0,
  minFeeSats: 10,
  maxFeeSats: 10000,
  earlyHosts: [],
};

export function createFeeStructureFromPcm(
  baseFeeRatePcm: number,
  earlyHostFeeRatePcm: number = 100,
  earlyHosts: EarlyHostEnrollment[] = []
): FeeStructure {
  return {
    baseFeeRatePcm,
    earlyHostFeeRatePcm,
    congestionMultiplier: 1.0,
    minFeeSats: 10,
    maxFeeSats: 10000,
    earlyHosts,
  };
}

/**
 * Chuẩn hóa một chuỗi npub1... hoặc hex 64 ký tự sang hex 64 ký tự chữ thường.
 */
export function normalizeToHexPubkey(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return clean.toLowerCase();
  }
  if (clean.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(clean);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        return (decoded.data as string).toLowerCase();
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Tính toán SHA-256 đồng bộ (cross-environment: Node.js & Browser)
 */
export function sha256Sync(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return bytesToHex(nobleSha256(bytes));
}

/**
 * Chuỗi hóa đối tượng một cách xác định (Deterministic JSON stringify).
 * Khóa luôn được sắp xếp theo bảng chữ cái ở mọi cấp độ, không có khoảng trắng thừa.
 */
export function deterministicStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => deterministicStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(key => JSON.stringify(key) + ':' + deterministicStringify(obj[key])).join(',') + '}';
}

/**
 * Trích xuất hoặc tính toán mã băm của danh sách ảnh NIP-94 đã ký
 */
export function getListingBatchPayloadHash(listing: any): string {
  if (!listing) return '';
  if (Array.isArray(listing.images) && listing.images.length > 0) {
    if (listing.images[0]?.batchPayloadHash) {
      return String(listing.images[0].batchPayloadHash);
    }
    const joined = listing.images.map((img: any) => `${img.url || ''}:${img.hash || ''}`).join('|');
    return sha256Sync(joined);
  }
  return '';
}

/**
 * Chuẩn hóa nội dung listing để ký theo RFC-0019 (NIP-78).
 * Bao phủ toàn diện: version, id, title, description, priceSats, roomTypes,
 * coOwners (npub hex, share, lightningAddress), batchPayloadHash, createdAt.
 */
export function canonicalizeListingForSigning(
  listing: any,
  options?: { createdAt?: number }
): string {
  if (!listing) return '';

  const id = String(listing.id || '').trim();
  const title = String(listing.title || '').trim();
  const description = String(listing.description || '').trim();
  const priceSats = Number(listing.priceSats || 0);

  const roomTypes = (Array.isArray(listing.roomTypes) ? listing.roomTypes : []).map((rt: any) => ({
    id: String(rt.id || '').trim(),
    name: String(rt.name || '').trim(),
    priceSats: Number(rt.priceSats || 0)
  }));

  const coOwners = (Array.isArray(listing.coOwners) ? listing.coOwners : []).map((co: any) => ({
    lightningAddress: String(co.lightningAddress || '').trim().toLowerCase(),
    npub: normalizeToHexPubkey(co.npub) || String(co.npub || '').trim().toLowerCase(),
    share: Number(co.share || 0)
  })).sort((a: any, b: any) => a.npub.localeCompare(b.npub));

  const batchPayloadHash = getListingBatchPayloadHash(listing);
  const createdAt = Number(options?.createdAt ?? listing.createdAt ?? 0);

  const canonicalObj = {
    batchPayloadHash,
    coOwners,
    createdAt,
    description,
    id,
    priceSats,
    roomTypes,
    title,
    version: 1
  };

  return deterministicStringify(canonicalObj);
}

/**
 * Ký sự kiện xác thực listing theo chuẩn NIP-78 (kind 30078).
 * Hỗ trợ cả private key cục bộ và tiện ích mở rộng NIP-07 (window.nostr).
 */
export async function createListingSignedEvent(
  listing: any,
  identity: any
): Promise<{ signedEventJson: string; canonicalJson: string; hash: string }> {
  if (!identity || !identity.pubKeyHex) {
    throw new Error('Valid Nostr identity with pubKeyHex is required to sign listing.');
  }

  const createdAt = Number(listing.createdAt || Date.now());
  const canonicalJson = canonicalizeListingForSigning(listing, { createdAt });
  const hash = sha256Sync(canonicalJson);

  const eventTemplate = {
    kind: LISTING_SIGNATURE_KIND,
    created_at: Math.floor(createdAt / 1000),
    tags: [
      ['d', `cypherguide:listing:${listing.id}`],
      ['v', '1'],
      ['x', hash],
      ['client', 'cypherguide']
    ],
    content: canonicalJson
  };

  if (identity.privKeyHex) {
    const sk = hexToBytes(identity.privKeyHex);
    const signedEvent = finalizeEvent(eventTemplate, sk);
    return { signedEventJson: JSON.stringify(signedEvent), canonicalJson, hash };
  } else {
    const nostr = typeof window !== 'undefined' ? (window as any).nostr : undefined;
    if (!nostr || typeof nostr.signEvent !== 'function') {
      throw new Error('No private key or NIP-07 browser extension available to sign listing.');
    }
    const signedEvent = await nostr.signEvent(eventTemplate);
    return { signedEventJson: JSON.stringify(signedEvent), canonicalJson, hash };
  }
}

/**
 * Trích xuất npub của chủ nhà đại diện từ listing (coOwners có share cao nhất, nếu hòa chọn người đầu tiên theo RFC-0002).
 * Lưu ý (RFC-0019): getPrimaryHostNpub chỉ dùng cho mục đích hiển thị giao diện, không còn là nguồn thẩm định ưu đãi độc lập.
 */
export function getPrimaryHostNpub(listing: { coOwners?: Array<{ npub: string; share: number; [key: string]: any }> } | null | undefined): string | null {
  if (!listing || !listing.coOwners || listing.coOwners.length === 0) return null;
  let best = listing.coOwners[0];
  for (let i = 1; i < listing.coOwners.length; i++) {
    if (listing.coOwners[i].share > best.share) {
      best = listing.coOwners[i];
    }
  }
  return best?.npub || null;
}

/**
 * Xác thực chữ ký listing của chủ nhà theo chuẩn NIP-78 (RFC-0019).
 * Xác minh bằng so khớp chính xác mã băm SHA-256 của JSON chuẩn hóa.
 */
export function verifyListingHostSignature(listing: {
  id?: string;
  title?: string;
  description?: string;
  priceSats?: number;
  roomTypes?: Array<{ id: string; name: string; priceSats: number; [key: string]: any }>;
  coOwners?: Array<{ npub: string; share: number; lightningAddress?: string; [key: string]: any }>;
  images?: Array<{ url: string; hash?: string; batchPayloadHash?: string; [key: string]: any }>;
  hostPubkey?: string;
  listingSignature?: string;
  createdAt?: number;
  [key: string]: any;
} | null | undefined): { valid: boolean; hostHex?: string; canonicalHash?: string; error?: string } {
  if (!listing) return { valid: false, error: 'Listing is null or undefined' };
  if (!listing.hostPubkey || !listing.listingSignature) {
    return { valid: false, error: 'Listing lacks hostPubkey or listingSignature' };
  }

  const expectedHex = normalizeToHexPubkey(listing.hostPubkey);
  if (!expectedHex) {
    return { valid: false, error: 'Invalid hostPubkey format' };
  }

  const sig = listing.listingSignature;
  if (typeof sig !== 'string' || !sig.startsWith('{')) {
    return { valid: false, error: 'Legacy signature format no longer accepted. Re-signing required.' };
  }

  try {
    const event = JSON.parse(sig);

    // 1. Kiểm tra pubkey người ký khớp hostPubkey
    if (event.pubkey !== expectedHex) {
      return { valid: false, error: 'Event pubkey does not match hostPubkey' };
    }

    // 2. Xác thực chữ ký Schnorr Nostr hợp lệ
    if (!verifyEvent(event)) {
      return { valid: false, error: 'Invalid Schnorr signature on Nostr event' };
    }

    // Nhánh A: Hỗ trợ sự kiện Nostr chứa nội dung đăng ký register_
    if (typeof event.content === 'string' && event.content.startsWith('register_')) {
      const expectedPrefix = `register_${listing.id}_${listing.title}_${listing.priceSats ?? 0}_coOwners:`;
      if (!event.content.startsWith(expectedPrefix)) {
        return { valid: false, error: 'Listing details (id/title/price) do not match signed registration payload' };
      }
      const rest = event.content.slice(expectedPrefix.length);
      const lastUnderscore = rest.lastIndexOf('_');
      const digest = lastUnderscore !== -1 ? rest.slice(0, lastUnderscore) : rest;
      const expectedCoOwnersDigest = (listing.coOwners || [])
        .map((o: any) => `${normalizeToHexPubkey(o.npub) || o.npub}:${o.share}`)
        .join('|');
      if (digest !== expectedCoOwnersDigest) {
        return { valid: false, error: 'Co-owners do not match signed registration payload' };
      }
      return { valid: true, hostHex: expectedHex };
    }

    // Nhánh B: Chuẩn NIP-78 kind 30078 (RFC-0019)
    if (event.kind !== LISTING_SIGNATURE_KIND) {
      return { valid: false, error: `Invalid event kind: expected ${LISTING_SIGNATURE_KIND}, got ${event.kind}. Legacy signatures must be re-signed.` };
    }

    // 4. Kiểm tra tag định danh 'd'
    const dTag = event.tags?.find((t: any) => t[0] === 'd')?.[1];
    const expectedD = `cypherguide:listing:${listing.id}`;
    if (dTag !== expectedD) {
      return { valid: false, error: `Identifier d tag mismatch: expected ${expectedD}, got ${dTag}` };
    }

    // 5. Kiểm tra tag phiên bản 'v'
    const vTag = event.tags?.find((t: any) => t[0] === 'v')?.[1];
    if (vTag !== '1') {
      return { valid: false, error: `Unsupported signature version tag: ${vTag}` };
    }

    // 6. Kiểm tra tag mã băm nội dung ('x' hoặc 'payload_hash')
    const hashTag = event.tags?.find((t: any) => t[0] === 'x')?.[1] || event.tags?.find((t: any) => t[0] === 'payload_hash')?.[1];
    if (!hashTag) {
      return { valid: false, error: 'Missing content hash tag (x)' };
    }

    // 7. So khớp chính xác nội dung JSON chuẩn hóa
    if (!event.content || typeof event.content !== 'string') {
      return { valid: false, error: 'Event content is empty or invalid' };
    }

    let parsedContent: any = null;
    try {
      parsedContent = JSON.parse(event.content);
    } catch {
      return { valid: false, error: 'Event content is not valid JSON' };
    }

    // Trích xuất createdAt từ nội dung ký để đảm bảo tính thời điểm nhất quán
    const signedCreatedAt = Number(parsedContent.createdAt ?? listing.createdAt ?? 0);
    const expectedCanonical = canonicalizeListingForSigning(listing, { createdAt: signedCreatedAt });
    const computedHash = sha256Sync(expectedCanonical);

    // So khớp mã băm SHA-256
    if (computedHash !== hashTag) {
      return { valid: false, error: 'Listing data does not match signed hash (tampered or modified)' };
    }

    // So khớp nội dung JSON chuẩn hóa
    if (event.content !== expectedCanonical) {
      return { valid: false, error: 'Event content does not match canonical listing JSON' };
    }

    return { valid: true, hostHex: expectedHex, canonicalHash: computedHash };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Signature verification error' };
  }
}

/**
 * Kiểm tra xem host có nằm trong danh sách ưu đãi chủ nhà đầu tiên và còn trong thời hạn hay không.
 * Hỗ trợ cả 2 dạng gọi:
 * 1. isEarlyHostEligible(identifierOrListing, earlyHosts, now, durationDays)
 * 2. Nếu truyền listing có hostPubkey và listingSignature (RFC-0019), chữ ký phải hợp lệ VÀ hostPubkey phải trùng người ghi danh.
 */
export function isEarlyHostEligible(
  target: any,
  earlyHosts: EarlyHostEnrollment[] | undefined,
  now: number = Date.now(),
  durationDays: number = DEFAULT_EARLY_HOST_DURATION_DAYS
): boolean {
  if (!target || !earlyHosts || !Array.isArray(earlyHosts)) return false;

  const durationMs = durationDays * 24 * 60 * 60 * 1000;

  // Trường hợp target là listing object
  if (typeof target === 'object' && target !== null && ('id' in target || 'coOwners' in target || 'hostPubkey' in target)) {
    const listing = target;
    // Nếu listing không có hostPubkey hoặc listingSignature, từ chối ưu đãi
    if (!listing.hostPubkey || !listing.listingSignature) {
      return false;
    }

    // Xác minh chữ ký của listing
    const sigVerification = verifyListingHostSignature(listing);
    if (!sigVerification.valid || !sigVerification.hostHex) {
      return false;
    }

    const hostHex = sigVerification.hostHex;

    // Tìm host trong danh sách earlyHosts bằng hex pubkey đã chuẩn hóa
    const enrollment = earlyHosts.find(h => {
      const enrolledHex = normalizeToHexPubkey(h.npub);
      return enrolledHex && enrolledHex === hostHex;
    });

    if (!enrollment) return false;
    return (now >= enrollment.enrolledAt) && ((now - enrollment.enrolledAt) <= durationMs);
  }

  // Trường hợp target là string (npub hoặc hex pubkey) - duy trì tương thích kiểm tra đơn giản
  if (typeof target === 'string') {
    const targetHex = normalizeToHexPubkey(target);

    const enrollment = earlyHosts.find(h => {
      const enrolledHex = normalizeToHexPubkey(h.npub);
      if (targetHex && enrolledHex) {
        return enrolledHex === targetHex;
      }
      return h.npub === target;
    });

    if (!enrollment) return false;
    return (now >= enrollment.enrolledAt) && ((now - enrollment.enrolledAt) <= durationMs);
  }

  return false;
}

/**
 * Tính toán phí giao dịch động cho Booking dựa trên Security Level, Congestion và ưu đãi Early Host.
 */
export function calculateDynamicFee(
  amountSats: number,
  feeStructure: FeeStructure = DEFAULT_FEE_STRUCTURE,
  networkCongestionScore: number = 1.0,
  securityLevel: 'paranoid' | 'strict' | 'relaxed' = 'strict',
  options?: { isEarlyHost?: boolean }
): {
  protocolFeeSats: number;
  routingFeeSats: number;
  totalFeeSats: number;
  effectiveRatePercent: number;
  appliedFeeRatePcm: number;
  isEarlyHostDiscountApplied: boolean;
} {
  const isEarlyHost = Boolean(options?.isEarlyHost);
  const baseRatePcm = (isEarlyHost && typeof feeStructure.earlyHostFeeRatePcm === 'number')
    ? feeStructure.earlyHostFeeRatePcm
    : (typeof feeStructure.baseFeeRatePcm === 'number' ? feeStructure.baseFeeRatePcm : 200);

  // Điều chỉnh hệ số theo Security Level
  const securityMultiplier = securityLevel === 'paranoid' ? 1.5 : securityLevel === 'relaxed' ? 0.8 : 1.0;

  const rawFee = (amountSats * baseRatePcm) / 10000;
  const adjustedFee = rawFee * feeStructure.congestionMultiplier * networkCongestionScore * securityMultiplier;
  
  const protocolFeeSats = Math.max(
    feeStructure.minFeeSats,
    Math.min(feeStructure.maxFeeSats, Math.round(adjustedFee))
  );

  // Phí routing Lightning LNURL/NWC ước tính (0.1% + 1 sat)
  const routingFeeSats = Math.max(1, Math.round(amountSats * 0.001));
  const totalFeeSats = protocolFeeSats + routingFeeSats;
  const effectiveRatePercent = Number(((totalFeeSats / amountSats) * 100).toFixed(3));

  return {
    protocolFeeSats,
    routingFeeSats,
    totalFeeSats,
    effectiveRatePercent,
    appliedFeeRatePcm: baseRatePcm,
    isEarlyHostDiscountApplied: isEarlyHost,
  };
}
