import { Listing, PriceRule } from '../types';

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

export function getEffectivePriceRule(listing: Listing, date: Date | string): PriceRule | null {
  if (listing.priceModel === 'dana') return null;
  if (!listing.priceRules || listing.priceRules.length === 0) return null;
  
  const matchingRules = listing.priceRules.filter(r => matchRule(r, date));
  if (matchingRules.length === 0) return null;
  
  // Highest priority rule wins
  matchingRules.sort((a, b) => b.priority - a.priority);
  return matchingRules[0];
}

export function getEffectivePrice(listing: Listing, date: Date | string): number {
  if (listing.priceModel === 'dana') return 0;
  const rule = getEffectivePriceRule(listing, date);
  return rule ? rule.priceSats : listing.priceSats;
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
}

export function calculateStayPrice(
  listing: Listing,
  checkInStr?: string,
  checkOutStr?: string
): StayPriceCalculation {
  if (listing.priceModel === 'dana') {
    return {
      totalSats: 0,
      nights: 1,
      nightlyBreakdown: [],
      averageNightlySats: 0,
      hasDynamicRules: false
    };
  }

  if (!checkInStr || !checkOutStr) {
    const todayPrice = getEffectivePrice(listing, new Date());
    const rule = getEffectivePriceRule(listing, new Date());
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
      hasDynamicRules: Boolean(rule)
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
    const rule = getEffectivePriceRule(listing, nightDate);
    const priceSats = rule ? rule.priceSats : listing.priceSats;

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

  const averageNightlySats = nights > 0 ? Math.round(totalSats / nights) : listing.priceSats;

  return {
    totalSats,
    nights,
    nightlyBreakdown,
    averageNightlySats,
    hasDynamicRules
  };
}
