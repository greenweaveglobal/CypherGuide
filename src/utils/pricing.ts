import { Listing, PriceRule, RoomType } from '../types';

export const DAY_OF_WEEK_MAP: { [key: number]: string } = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA'
};

export const DAY_OF_WEEK_LABELS: { [key: string]: { vi: string; en: string } } = {
  MO: { vi: 'Thứ 2', en: 'Mon' },
  TU: { vi: 'Thứ 3', en: 'Tue' },
  WE: { vi: 'Thứ 4', en: 'Wed' },
  TH: { vi: 'Thứ 5', en: 'Thu' },
  FR: { vi: 'Thứ 6', en: 'Fri' },
  SA: { vi: 'Thứ 7', en: 'Sat' },
  SU: { vi: 'Chủ Nhật', en: 'Sun' }
};

/**
 * Migration helper: Guarantees every Listing has a valid roomTypes array (min 1 element),
 * and keeps deprecated fields (priceSats, maxGuests, priceRules) synchronized with roomTypes[0].
 */
export function migrateListingToRoomTypes(listing: Listing): Listing {
  if (!listing) return listing;

  if (listing.roomTypes && listing.roomTypes.length > 0) {
    const primary = listing.roomTypes[0];
    return {
      ...listing,
      priceSats: primary.priceSats,
      maxGuests: primary.maxGuests,
      priceRules: primary.priceRules || []
    };
  }

  // Fallback for legacy listings without roomTypes
  const defaultRoom: RoomType = {
    id: `rt_default_${listing.id ? listing.id.slice(0, 10) : Math.random().toString(36).substring(2, 8)}`,
    name: listing.title || 'Tiêu Chuẩn (Standard)',
    maxGuests: listing.maxGuests || 2,
    priceSats: listing.priceSats ?? 0,
    securitySpecs: listing.securitySpecs ? [...listing.securitySpecs] : [],
    priceRules: listing.priceRules ? [...listing.priceRules] : [],
    images: listing.imageUrl ? [listing.imageUrl] : [],
    status: 'available'
  };

  return {
    ...listing,
    roomTypes: [defaultRoom],
    priceSats: defaultRoom.priceSats,
    maxGuests: defaultRoom.maxGuests,
    priceRules: defaultRoom.priceRules
  };
}

/**
 * Get specific RoomType by ID or fallback to the first available roomType.
 */
export function getRoomType(listing: Listing, roomTypeId?: string): RoomType {
  const migrated = migrateListingToRoomTypes(listing);
  if (roomTypeId) {
    const found = migrated.roomTypes.find(rt => rt.id === roomTypeId);
    if (found) return found;
  }
  return migrated.roomTypes[0];
}

/**
 * Calculates the lowest base price among room types for display in catalog cards.
 */
export function getListingMinPrice(listing: Listing): { minPriceSats: number; isDana: boolean; roomCount: number } {
  if (listing.priceModel === 'dana') {
    return { minPriceSats: 0, isDana: true, roomCount: listing.roomTypes?.length || 1 };
  }
  const migrated = migrateListingToRoomTypes(listing);
  const prices = migrated.roomTypes.map(rt => rt.priceSats);
  const minPrice = prices.length > 0 ? Math.min(...prices) : migrated.priceSats;
  return {
    minPriceSats: minPrice,
    isDana: false,
    roomCount: migrated.roomTypes.length
  };
}

export function parseDate(input: Date | string): { dateStr: string; dayOfWeek: string; month: number } {
  const d = typeof input === 'string' ? new Date(input) : input;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayOfWeek = DAY_OF_WEEK_MAP[d.getDay()] || 'MO';
  return { dateStr, dayOfWeek, month };
}

export function matchRule(rule: PriceRule, input: Date | string): boolean {
  const { dateStr, dayOfWeek, month } = parseDate(input);
  
  if (rule.type === 'date_range') {
    if (!rule.startDate || !rule.endDate) return false;
    return dateStr >= rule.startDate && dateStr <= rule.endDate;
  }
  
  if (rule.type === 'day_of_week') {
    if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return false;
    return rule.daysOfWeek.includes(dayOfWeek);
  }
  
  if (rule.type === 'recurring_month') {
    if (rule.startMonth === undefined || rule.endMonth === undefined) return false;
    if (rule.startMonth <= rule.endMonth) {
      return month >= rule.startMonth && month <= rule.endMonth;
    } else {
      // wraps around new year e.g. Nov (11) to Feb (2)
      return month >= rule.startMonth || month <= rule.endMonth;
    }
  }
  
  return false;
}

export function getEffectivePriceRule(
  listing: Listing,
  date: Date | string,
  roomTypeId?: string
): PriceRule | null {
  if (listing.priceModel === 'dana') return null;
  const room = getRoomType(listing, roomTypeId);
  const rules = room.priceRules || listing.priceRules;
  if (!rules || rules.length === 0) return null;
  
  const matchingRules = rules.filter(r => matchRule(r, date));
  if (matchingRules.length === 0) return null;
  
  // Highest priority rule wins
  matchingRules.sort((a, b) => b.priority - a.priority);
  return matchingRules[0];
}

export function getEffectivePrice(
  listing: Listing,
  date: Date | string,
  roomTypeId?: string
): number {
  if (listing.priceModel === 'dana') return 0;
  const room = getRoomType(listing, roomTypeId);
  const rule = getEffectivePriceRule(listing, date, roomTypeId);
  return rule ? rule.priceSats : room.priceSats;
}

export interface StayPriceCalculation {
  totalSats: number;
  nights: number;
  nightlyBreakdown: Array<{
    date: string;
    dayOfWeek: string;
    priceSats: number;
    ruleLabel?: string;
  }>;
  averageNightlySats: number;
  hasDynamicRules: boolean;
  roomType: RoomType;
}

export function calculateStayPrice(
  listing: Listing,
  checkInStr?: string,
  checkOutStr?: string,
  roomTypeId?: string
): StayPriceCalculation {
  const room = getRoomType(listing, roomTypeId);

  if (listing.priceModel === 'dana') {
    return {
      totalSats: 0,
      nights: 1,
      nightlyBreakdown: [],
      averageNightlySats: 0,
      hasDynamicRules: false,
      roomType: room
    };
  }

  if (!checkInStr || !checkOutStr) {
    const todayPrice = getEffectivePrice(listing, new Date(), room.id);
    const rule = getEffectivePriceRule(listing, new Date(), room.id);
    return {
      totalSats: todayPrice,
      nights: 1,
      nightlyBreakdown: [
        {
          date: parseDate(new Date()).dateStr,
          dayOfWeek: parseDate(new Date()).dayOfWeek,
          priceSats: todayPrice,
          ruleLabel: rule?.label
        }
      ],
      averageNightlySats: todayPrice,
      hasDynamicRules: Boolean(rule),
      roomType: room
    };
  }

  const start = new Date(checkInStr);
  const end = new Date(checkOutStr);
  const diffTime = end.getTime() - start.getTime();
  const rawNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const nights = rawNights > 0 ? rawNights : 1;

  const nightlyBreakdown: Array<{
    date: string;
    dayOfWeek: string;
    priceSats: number;
    ruleLabel?: string;
  }> = [];

  let totalSats = 0;
  let hasDynamicRules = false;

  for (let i = 0; i < nights; i++) {
    const nightDate = new Date(start);
    nightDate.setDate(start.getDate() + i);
    const { dateStr, dayOfWeek } = parseDate(nightDate);
    const rule = getEffectivePriceRule(listing, nightDate, room.id);
    const priceSats = rule ? rule.priceSats : room.priceSats;

    if (rule) {
      hasDynamicRules = true;
    }

    nightlyBreakdown.push({
      date: dateStr,
      dayOfWeek,
      priceSats,
      ruleLabel: rule?.label
    });
    totalSats += priceSats;
  }

  const averageNightlySats = nights > 0 ? Math.round(totalSats / nights) : room.priceSats;

  return {
    totalSats,
    nights,
    nightlyBreakdown,
    averageNightlySats,
    hasDynamicRules,
    roomType: room
  };
}
