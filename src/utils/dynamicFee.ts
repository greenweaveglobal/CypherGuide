/**
 * Cypher Protocol - Dynamic Protocol Fee Module (RFC-0002 / RFC-0016)
 * Tinh toan phi giao dich dong dua tren luu luong mang luoi,
 * cap do bao mat va chuong trinh uu dai host tien phong (Early Host Incentive).
 */

export interface EarlyHostEnrollment {
  npub: string;
  enrolledAt: number; // timestamp in ms
  enrolledBy: string; // admin npub or hex pubkey
  auditEventId?: string;
  notes?: string;
}

export interface FeeStructure {
  baseFeeRatePcm: number; // Parts per ten-thousand (e.g. 200 = 2.0%)
  earlyHostFeeRatePcm?: number; // Parts per ten-thousand (e.g. 100 = 1.0%)
  earlyHosts?: EarlyHostEnrollment[];
  minFeeSats: number;
  maxFeeSats: number;
  congestionMultiplier: number;
}

export const EARLY_HOST_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 12 months in milliseconds
export const MAX_EARLY_HOSTS = 20;

export const DEFAULT_FEE_STRUCTURE: FeeStructure = {
  baseFeeRatePcm: 200, // 2.0%
  earlyHostFeeRatePcm: 100, // 1.0%
  earlyHosts: [],
  minFeeSats: 10,
  maxFeeSats: 10000,
  congestionMultiplier: 1.0,
};

export function createFeeStructureFromPcm(
  baseFeeRatePcm: number = 200,
  earlyHostFeeRatePcm: number = 100,
  earlyHosts: EarlyHostEnrollment[] = []
): FeeStructure {
  return {
    ...DEFAULT_FEE_STRUCTURE,
    baseFeeRatePcm,
    earlyHostFeeRatePcm,
    earlyHosts
  };
}

/**
 * Trich xuat npub cua chu nha dai dien tu listing (coOwners co share cao nhat, neu hoa chon nguoi dau tien theo RFC-0002).
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
 * Kiem tra xem host npub co nam trong danh sach uu dai chu nha dau tien va con trong thoi han 12 thang hay khong.
 */
export function isEarlyHostEligible(
  npub: string | null | undefined,
  earlyHosts: EarlyHostEnrollment[] | undefined,
  now: number = Date.now()
): boolean {
  if (!npub || !earlyHosts || !Array.isArray(earlyHosts)) return false;
  const enrollment = earlyHosts.find(h => h.npub === npub);
  if (!enrollment) return false;
  return (now >= enrollment.enrolledAt) && ((now - enrollment.enrolledAt) <= EARLY_HOST_DURATION_MS);
}

/**
 * Tinh toan phi giao dich dong cho Booking dua tren Security Level, Congestion va uu dai Early Host.
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

  // Dieu chinh he so theo Security Level
  const securityMultiplier = securityLevel === 'paranoid' ? 1.5 : securityLevel === 'relaxed' ? 0.8 : 1.0;

  const rawFee = (amountSats * baseRatePcm) / 10000;
  const adjustedFee = rawFee * feeStructure.congestionMultiplier * networkCongestionScore * securityMultiplier;
  
  const protocolFeeSats = Math.max(
    feeStructure.minFeeSats,
    Math.min(feeStructure.maxFeeSats, Math.round(adjustedFee))
  );

  // Phi routing Lightning LNURL/NWC uoc tinh (0.1% + 1 sat)
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
