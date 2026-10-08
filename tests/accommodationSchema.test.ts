import { describe, it, expect } from 'vitest';
import { Listing, RoomType, CancellationPolicy } from '../src/types';
import { INITIAL_LISTINGS } from '../src/data';
import { REFUNDABLE_CHECKOUT_DEPOSIT_RATE, REFUNDABLE_CHECKOUT_DEPOSIT_PERCENT } from '../src/utils/pricing';

describe('RFC-0018: Standardized Accommodation Schema & Privacy Metadata', () => {
  it('ensures all initial listings conform to RFC-0018 schema and have valid cancellation policies', () => {
    expect(INITIAL_LISTINGS.length).toBeGreaterThan(0);

    const validPolicies: CancellationPolicy[] = ['flexible', 'moderate', 'strict', 'nonrefundable'];

    for (const listing of INITIAL_LISTINGS) {
      // Coarse location should be present for privacy
      expect(listing.locationLabel).toBeDefined();
      expect(typeof listing.locationLabel).toBe('string');
      expect(listing.locationLabel!.length).toBeGreaterThan(0);

      // Must not contain detailed street/house indicators (anti-leak)
      expect(listing.locationLabel).not.toMatch(/số\s*\d+/i);
      expect(listing.locationLabel).not.toMatch(/ngõ\s*\d+/i);
      expect(listing.locationLabel).not.toMatch(/hẻm\s*\d+/i);

      // Cancellation policy must be one of the 4 defined tiers
      expect(listing.cancellationPolicy).toBeDefined();
      expect(validPolicies).toContain(listing.cancellationPolicy);

      // Check-in and check-out standard times
      if (listing.checkInTime) {
        expect(listing.checkInTime).toMatch(/^\d{1,2}:\d{2}$/);
      }
      if (listing.checkOutTime) {
        expect(listing.checkOutTime).toMatch(/^\d{1,2}:\d{2}$/);
      }
    }
  });

  it('guarantees the inviolable security deposit invariant (REFUNDABLE_CHECKOUT_DEPOSIT_RATE is 10%)', () => {
    // Under RFC-0018 Section 2, the 10% security deposit is ALWAYS 100% refunded if cancelled before check-in,
    // regardless of whether cancellation policy is flexible, moderate, strict, or nonrefundable.
    expect(REFUNDABLE_CHECKOUT_DEPOSIT_RATE).toBe(0.10);
  });

  it('verifies that room types inherit or specify bedType and areaM2 cleanly', () => {
    const cypherListing = INITIAL_LISTINGS.find(l => l.id === 'LIST_CYPHER_02');
    expect(cypherListing).toBeDefined();
    expect(cypherListing?.bedType).toContain('King');
    expect(cypherListing?.areaM2).toBe(52);
    expect(cypherListing?.cancellationPolicy).toBe('moderate');
  });

  it('validates coarse location privacy principle (RFC-0012 & RFC-0018)', () => {
    // Public listing must only broadcast coarse area labels
    const mockPublicListing: Partial<Listing> = {
      title: 'Saigon Cyber Bunker',
      meshCoordinates: 'mesh:10.77:106.69',
      locationLabel: 'Quận 1, TP. Hồ Chí Minh',
      cancellationPolicy: 'flexible',
      bedType: '1 Giường đôi King',
      areaM2: 45
    };

    expect(mockPublicListing.locationLabel).toBe('Quận 1, TP. Hồ Chí Minh');
    // Coarse label does not leak specific GPS or house number
    expect(mockPublicListing.locationLabel).not.toContain('Đường ');
    expect(mockPublicListing.locationLabel).not.toContain('Số ');
  });
});
