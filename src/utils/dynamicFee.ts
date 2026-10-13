/**
 * Cypher Protocol - Dynamic Protocol Fee Module (RFC-0002 / RFC-0016 / RFC-0019)
 * Tính toán phí giao dịch động dựa trên lưu lượng mạng lưới,
 * cấp độ bảo mật và chương trình ưu đãi chủ nhà tiên phong (Early Host Incentive).
 */

import { nip19, verifyEvent } from 'nostr-tools';

export interface EarlyHostEnrollment {
  npub: string; // Có thể lưu hex 64 ký tự hoặc npub1 (chuẩn hóa sang hex khi so sánh)
  enrolledAt: number; // Dấu thời gian tính bằng ms
  enrolledBy: string; // Admin npub hoặc hex pubkey
  auditEventId?: string;
  notes?: string;
}

export interface FeeStructure {
  baseFeeRatePcm: number; // Phần mười nghìn (ví dụ 200 = 2.0%)
  earlyHostFeeRatePcm?: number; // Phần mười nghìn (ví dụ 100 = 1.0%)
  earlyHosts?: EarlyHostEnrollment[];
  minFeeSats: number;
  maxFeeSats: number;
  congestionMultiplier: number;
  durationDays?: number; // Số ngày hiệu lực ưu đãi (mặc định 365)
  maxEnrolled?: number; // Số lượng chủ nhà tối đa được ghi danh (mặc định 20)
}

export const DEFAULT_EARLY_HOST_DURATION_DAYS = 365;
export const DEFAULT_MAX_EARLY_HOSTS = 20;

export const EARLY_HOST_DURATION_MS = DEFAULT_EARLY_HOST_DURATION_DAYS * 24 * 60 * 60 * 1000; // 365 ngày tính bằng ms
export const MAX_EARLY_HOSTS = DEFAULT_MAX_EARLY_HOSTS;

export const DEFAULT_FEE_STRUCTURE: FeeStructure = {
  baseFeeRatePcm: 200, // 2.0%
  earlyHostFeeRatePcm: 100, // 1.0%
  earlyHosts: [],
  minFeeSats: 10,
  maxFeeSats: 10000,
  congestionMultiplier: 1.0,
  durationDays: DEFAULT_EARLY_HOST_DURATION_DAYS,
  maxEnrolled: DEFAULT_MAX_EARLY_HOSTS
};

export function createFeeStructureFromPcm(
  baseFeeRatePcm: number = 200,
  earlyHostFeeRatePcm: number = 100,
  earlyHosts: EarlyHostEnrollment[] = [],
  durationDays: number = DEFAULT_EARLY_HOST_DURATION_DAYS,
  maxEnrolled: number = DEFAULT_MAX_EARLY_HOSTS
): FeeStructure {
  return {
    ...DEFAULT_FEE_STRUCTURE,
    baseFeeRatePcm,
    earlyHostFeeRatePcm,
    earlyHosts,
    durationDays,
    maxEnrolled
  };
}

/**
 * Chuẩn hóa npub hoặc chuỗi hex 64 ký tự về dạng hex pubkey chữ thường (lowercase 64-char hex).
 * Trả về null nếu sai định dạng hoặc sai checksum bech32.
 */
export function normalizeToHexPubkey(input: string | null | undefined): string | null {
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
 * Chuyển đổi pubkey (dạng hex hoặc npub) sang dạng npub bech32 để hiển thị trên giao diện.
 */
export function formatToNpub(input: string | null | undefined): string {
  if (!input) return '';
  const hex = normalizeToHexPubkey(input);
  if (!hex) return input;
  try {
    return nip19.npubEncode(hex);
  } catch {
    return input;
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
 * Xác thực chữ ký listing của chủ nhà (RFC-0019).
 * Payload chuẩn hóa: `register_${id}_${title}_${priceSats}_${coOwnersSummary}`
 */
export function verifyListingHostSignature(listing: {
  id?: string;
  title?: string;
  priceSats?: number;
  coOwners?: Array<{ npub: string; share: number; [key: string]: any }>;
  hostPubkey?: string;
  listingSignature?: string;
} | null | undefined): { valid: boolean; hostHex?: string; error?: string } {
  if (!listing) return { valid: false, error: 'Listing is null or undefined' };
  if (!listing.hostPubkey || !listing.listingSignature) {
    return { valid: false, error: 'Listing lacks hostPubkey or listingSignature' };
  }

  const expectedHex = normalizeToHexPubkey(listing.hostPubkey);
  if (!expectedHex) {
    return { valid: false, error: 'Invalid hostPubkey format' };
  }

  try {
    const sig = listing.listingSignature;
    if (sig.startsWith('{')) {
      const event = JSON.parse(sig);
      if (event.pubkey !== expectedHex) {
        return { valid: false, error: 'Event pubkey does not match hostPubkey' };
      }
      if (!verifyEvent(event)) {
        return { valid: false, error: 'Invalid Schnorr signature on Nostr event' };
      }

      // Kiểm tra nội dung ký có chứa listing ID, title, priceSats và coOwners
      const content = String(event.content || '');
      const coOwnersDigest = (listing.coOwners || []).map(o => `${normalizeToHexPubkey(o.npub) || o.npub}:${o.share}`).join('|');
      const expectedPrefix = `register_${listing.id}_${listing.title}_${listing.priceSats}`;
      
      if (!content.startsWith(expectedPrefix)) {
        return { valid: false, error: 'Signature content does not match listing metadata' };
      }
      if (content.includes('coOwners:') && !content.includes(`coOwners:${coOwnersDigest}`)) {
        return { valid: false, error: 'Co-owners have been modified after signing' };
      }

      return { valid: true, hostHex: expectedHex };
    }

    return { valid: false, error: 'Unsupported signature format' };
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
