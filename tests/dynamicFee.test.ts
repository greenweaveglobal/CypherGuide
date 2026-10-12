import { describe, it, expect } from 'vitest';
import {
  calculateDynamicFee,
  DEFAULT_FEE_STRUCTURE,
  getPrimaryHostNpub,
  isEarlyHostEligible,
  createFeeStructureFromPcm,
  EARLY_HOST_DURATION_MS
} from '../src/utils/dynamicFee';

describe('Dynamic Fee Module (RFC-0002 / RFC-0016)', () => {
  it('calculates base fee correctly for standard booking at 2.0% (200 pcm)', () => {
    const amountSats = 100000; // 100k sats
    const fee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'strict');

    // baseFeeRatePcm = 200 (2.0%) => 2000 sats protocol fee
    expect(fee.protocolFeeSats).toBe(2000);
    // routing fee = max(1, 100) = 100 sats
    expect(fee.routingFeeSats).toBe(100);
    expect(fee.totalFeeSats).toBe(2100);
    expect(fee.effectiveRatePercent).toBe(2.1);
    expect(fee.appliedFeeRatePcm).toBe(200);
    expect(fee.isEarlyHostDiscountApplied).toBe(false);
  });

  it('adjusts fee according to security level multiplier', () => {
    const amountSats = 100000;
    const strictFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'strict');
    const paranoidFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'paranoid');
    const relaxedFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'relaxed');

    // Paranoid should be 1.5x protocol fee (2000 * 1.5 = 3000)
    expect(paranoidFee.protocolFeeSats).toBe(Math.round(strictFee.protocolFeeSats * 1.5));
    expect(paranoidFee.protocolFeeSats).toBe(3000);
    // Relaxed should be 0.8x protocol fee (2000 * 0.8 = 1600)
    expect(relaxedFee.protocolFeeSats).toBe(Math.round(strictFee.protocolFeeSats * 0.8));
    expect(relaxedFee.protocolFeeSats).toBe(1600);
  });

  it('applies Early Host Incentive rate (1.0% / 100 pcm) for eligible hosts', () => {
    const amountSats = 100000;
    const earlyFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'strict', { isEarlyHost: true });

    // Early host fee = 100 pcm (1.0%) => 1000 sats
    expect(earlyFee.protocolFeeSats).toBe(1000);
    expect(earlyFee.routingFeeSats).toBe(100);
    expect(earlyFee.totalFeeSats).toBe(1100);
    expect(earlyFee.effectiveRatePercent).toBe(1.1);
    expect(earlyFee.appliedFeeRatePcm).toBe(100);
    expect(earlyFee.isEarlyHostDiscountApplied).toBe(true);

    // Multipliers also apply to early host rate
    const relaxedEarlyFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'relaxed', { isEarlyHost: true });
    expect(relaxedEarlyFee.protocolFeeSats).toBe(800); // 1000 * 0.8 = 800 sats (0.8%)

    const paranoidEarlyFee = calculateDynamicFee(amountSats, DEFAULT_FEE_STRUCTURE, 1.0, 'paranoid', { isEarlyHost: true });
    expect(paranoidEarlyFee.protocolFeeSats).toBe(1500); // 1000 * 1.5 = 1500 sats (1.5%)
  });

  it('respects minFeeSats and maxFeeSats bounds', () => {
    // Very small booking
    const smallFee = calculateDynamicFee(100, DEFAULT_FEE_STRUCTURE);
    expect(smallFee.protocolFeeSats).toBeGreaterThanOrEqual(DEFAULT_FEE_STRUCTURE.minFeeSats);

    // Huge booking exceeding max cap (10k sats cap)
    const hugeFee = calculateDynamicFee(100000000, DEFAULT_FEE_STRUCTURE);
    expect(hugeFee.protocolFeeSats).toBeLessThanOrEqual(DEFAULT_FEE_STRUCTURE.maxFeeSats);
    expect(hugeFee.protocolFeeSats).toBe(10000);
  });

  it('correctly isolates protocolFeeSats from lnRoutingFeeSats for RFC-0016 Treasury split', () => {
    const roomPriceSats = 50000;
    const feeResult = calculateDynamicFee(roomPriceSats, DEFAULT_FEE_STRUCTURE, 1.0, 'strict');

    // Protocol fee is collected separately for Treasury (2.0% = 1000 sats)
    expect(feeResult.protocolFeeSats).toBe(1000);
    // Routing fee is only an estimate of LN network fee, NOT collected by protocol
    expect(feeResult.routingFeeSats).toBe(50);

    // Sum of 2 invoices: Host invoice (roomPrice) + Treasury invoice (protocolFee)
    const hostInvoiceSats = roomPriceSats;
    const treasuryInvoiceSats = feeResult.protocolFeeSats;
    const totalCollectedSats = hostInvoiceSats + treasuryInvoiceSats;

    expect(totalCollectedSats).toBe(51000);
    expect(totalCollectedSats).toBe(roomPriceSats + feeResult.protocolFeeSats);
  });

  it('determines primary host npub per RFC-0002 tie-breaking rules', () => {
    // Single co-owner
    expect(getPrimaryHostNpub({ coOwners: [{ npub: 'npub1aaa', name: 'A', share: 100, lightningAddress: 'a@zaps.lol' }] })).toBe('npub1aaa');

    // Multiple co-owners: highest share wins
    expect(getPrimaryHostNpub({
      coOwners: [
        { npub: 'npub1aaa', name: 'A', share: 30, lightningAddress: 'a@zaps.lol' },
        { npub: 'npub1bbb', name: 'B', share: 70, lightningAddress: 'b@zaps.lol' }
      ]
    })).toBe('npub1bbb');

    // Tie: first in list wins
    expect(getPrimaryHostNpub({
      coOwners: [
        { npub: 'npub1first', name: 'First', share: 50, lightningAddress: 'f@zaps.lol' },
        { npub: 'npub1second', name: 'Second', share: 50, lightningAddress: 's@zaps.lol' }
      ]
    })).toBe('npub1first');

    // Empty or null
    expect(getPrimaryHostNpub(null)).toBeNull();
    expect(getPrimaryHostNpub({ coOwners: [] })).toBeNull();
  });

  it('verifies early host eligibility within 12 months', () => {
    const now = 1770000000000;
    const earlyHosts = [
      { npub: 'npub1active', enrolledAt: now - 30 * 24 * 60 * 60 * 1000, enrolledBy: 'admin' }, // 1 month ago
      { npub: 'npub1expired', enrolledAt: now - 400 * 24 * 60 * 60 * 1000, enrolledBy: 'admin' } // > 12 months ago
    ];

    expect(isEarlyHostEligible('npub1active', earlyHosts, now)).toBe(true);
    expect(isEarlyHostEligible('npub1expired', earlyHosts, now)).toBe(false);
    expect(isEarlyHostEligible('npub1unknown', earlyHosts, now)).toBe(false);
    expect(isEarlyHostEligible(null, earlyHosts, now)).toBe(false);
  });
});
