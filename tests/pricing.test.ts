import { describe, it, expect } from 'vitest';
import { 
  migrateListingToRoomTypes, 
  getListingMinPrice, 
  parseDate, 
  calculateStayPrice 
} from '../src/utils/pricing';
import { Listing } from '../src/types';

describe('Pricing Module', () => {
  const sampleListing: Listing = {
    id: 'listing_1',
    hostNpub: 'npub1host...',
    title: 'Da Lat Secret Cyber House',
    description: 'Autonomous house with Lightning locks',
    location: 'Da Lat, Vietnam',
    latitude: 11.94,
    longitude: 108.45,
    priceSats: 50000,
    maxGuests: 2,
    amenities: ['wifi', 'smart_lock'],
    imageUrl: 'https://example.com/img.jpg',
    createdAt: 1700000000
  };

  it('migrates legacy listing to room types structure seamlessly', () => {
    const migrated = migrateListingToRoomTypes(sampleListing);
    expect(migrated.roomTypes).toHaveLength(1);
    expect(migrated.roomTypes[0].priceSats).toBe(50000);
    expect(migrated.roomTypes[0].maxGuests).toBe(2);
  });

  it('calculates minimum price correctly for room catalog', () => {
    const minPriceInfo = getListingMinPrice(sampleListing);
    expect(minPriceInfo.minPriceSats).toBe(50000);
    expect(minPriceInfo.isDana).toBe(false);
  });

  it('parses calendar date components accurately', () => {
    const parsed = parseDate('2026-06-15');
    expect(parsed.dateStr).toBe('2026-06-15');
    expect(parsed.dayOfWeek).toBeDefined();
    expect(parsed.month).toBe(6);
  });

  it('computes total stay price correctly across nights', () => {
    const result = calculateStayPrice(
      sampleListing,
      '2026-06-15',
      '2026-06-18' // 3 nights
    );
    expect(result.nights).toBe(3);
    expect(result.totalSats).toBe(150000);
    expect(result.averageNightlySats).toBe(50000);
  });
});
