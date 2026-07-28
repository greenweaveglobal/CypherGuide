/**
 * Cypher Protocol - Dynamic Protocol Fee Module
 * Tính toán phí giao dịch động dựa trên lưu lượng mạng lưới (Sats Volume),
 * cấp độ bảo mật (Security Level) và loại hợp đồng escrow.
 */

export interface FeeStructure {
  baseFeeRatePcm: number; // Parts per ten-thousand (e.g. 20 = 0.2%)
  minFeeSats: number;
  maxFeeSats: number;
  congestionMultiplier: number;
}

export const DEFAULT_FEE_STRUCTURE: FeeStructure = {
  baseFeeRatePcm: 20, // 0.2%
  minFeeSats: 10,
  maxFeeSats: 10000,
  congestionMultiplier: 1.0,
};

/**
 * Tính toán phí giao dịch động cho Booking dựa trên Security Level và Congestion.
 */
export function calculateDynamicFee(
  amountSats: number,
  feeStructure: FeeStructure = DEFAULT_FEE_STRUCTURE,
  networkCongestionScore: number = 1.0,
  securityLevel: 'paranoid' | 'strict' | 'relaxed' = 'strict'
): { protocolFeeSats: number; routingFeeSats: number; totalFeeSats: number; effectiveRatePercent: number } {
  // Điều chỉnh hệ số theo Security Level
  const securityMultiplier = securityLevel === 'paranoid' ? 1.5 : securityLevel === 'relaxed' ? 0.8 : 1.0;

  const rawFee = (amountSats * feeStructure.baseFeeRatePcm) / 10000;
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
  };
}
