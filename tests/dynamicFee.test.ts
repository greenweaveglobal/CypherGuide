import { describe, it, expect } from 'vitest';
import { calculateDynamicFee, DEFAULT_FEE_STRUCTURE } from '../src/utils/dynamicFee';

describe('Dynamic Fee Module', () => {
  it('calculates base fee correctly for standard booking', () => {
    const amountSats = 100000; // 100k sats
    const fee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'strict');

    // baseFeeRatePcm = 20 (0.2%) => 200 sats protocol fee
    expect(fee.protocolFeeSats).toBe(200);
    // routing fee = max(1, 100) = 100 sats
    expect(fee.routingFeeSats).toBe(100);
    expect(fee.totalFeeSats).toBe(300);
    expect(fee.effectiveRatePercent).toBe(0.3);
  });

  it('adjusts fee according to security level multiplier', () => {
    const amountSats = 100000;
    const strictFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'strict');
    const paranoidFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'paranoid');
    const relaxedFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'relaxed');

    // Paranoid should be 1.5x protocol fee
    expect(paranoidFee.protocolFeeSats).toBe(Math.round(strictFee.protocolFeeSats * 1.5));
    // Relaxed should be 0.8x protocol fee
    expect(relaxedFee.protocolFeeSats).toBe(Math.round(strictFee.protocolFeeSats * 0.8));
  });

  it('respects minFeeSats and maxFeeSats bounds', () => {
    // Very small booking
    const smallFee = calculateDynamicFee(100, DEFAULT_FEE_STRUCTURE);
    expect(smallFee.protocolFeeSats).toBeGreaterThanOrEqual(DEFAULT_FEE_STRUCTURE.minFeeSats);

    // Huge booking exceeding max cap
    const hugeFee = calculateDynamicFee(100000000, DEFAULT_FEE_STRUCTURE);
    expect(hugeFee.protocolFeeSats).toBeLessThanOrEqual(DEFAULT_FEE_STRUCTURE.maxFeeSats);
  });
});
