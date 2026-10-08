# RFC-0018: Standardized Accommodation Schema & Privacy-Preserving Listing Metadata

- **Status**: Draft
- **Authors**: CypherGuide Core Contributors & Architecture Working Group
- **Created**: 2026-10-08
- **Inherits & Adheres To**: [RFC-0003](./0003-identity-portable-reputation.en.md), [RFC-0008](./0008-dana-based-stay.en.md), [RFC-0011](./0011-financialization-boundary-principle.en.md), [RFC-0012](./0012-sovereignty-boundary-principle.en.md), [RFC-0013](./0013-agent-ready-stay.en.md)

---

## 1. Summary

This RFC standardizes the Accommodation Listing Schema across CypherGuide. Taking cues from modern travel platforms (Booking.com, Airbnb) regarding intuitive visual hierarchy, it strictly preserves CypherGuide's core sovereign foundation: **non-custodial escrow, zero mandatory KYC, native Bitcoin Lightning settlements, and uncompromising privacy**.

It eliminates 4 major informational gaps on prior listing cards:
1. **Missing core physical metrics**: Bed configuration, room area, check-in/out hours, and clear capacity limits.
2. **Ambiguous cancellation policies**: Establishing 4 standardized tiers with explicit deadlines and refund formulas.
3. **Privacy leaks in public listings**: Forbidding exact street addresses and high-resolution GPS in public Nostr events; enforcing coarse regional descriptors (City, District).
4. **Upfront financial transparency**: Exposing the baseline nightly rate, the current protocol fee structure, and the 10% refundable security deposit prior to checkout.

---

## 2. Four Standardized Cancellation Policies

As ratified by the project lead, cancellation rules follow 4 deterministic tiers based on local accommodation timezone:

| Policy Tier (`cancellationPolicy`) | Free Cancellation Window | Full Refund Condition | Late Cancellation Penalty |
| :--- | :--- | :--- | :--- |
| `flexible` | Prior to **24 hours** before check-in (`checkInTime`) | **100%** room price refund | First night charged at 50%; remaining nights refunded |
| `moderate` | Prior to **5 days** before check-in date | **100%** room price refund | First night charged at 100%; remaining nights refunded |
| `strict` | Prior to **14 days** before check-in date | **100%** room price refund | Non-refundable room price if cancelled within 14 days |
| `nonrefundable` | No free cancellation window | Room price non-refundable | 100% room price retained by Host upon booking |

### Invariant Escrow Deposit Principle
Across **all 4 tiers above**, the **10% refundable security deposit** (`REFUNDABLE_CHECKOUT_DEPOSIT_RATE`) is **ALWAYS 100% REFUNDED TO THE GUEST** if the booking is cancelled prior to check-in or completed without property damage claims. Security deposits belong to the escrow trust account, never constitute Host revenue, and are immune to cancellation fee deductions.

---

## 3. Coarse Location Privacy Principle

In strict compliance with [RFC-0012 (Sovereignty Boundary Principle)](./0012-sovereignty-boundary-principle.en.md):

1. **Public Nostr Events (Kind 30078 / Kind 31923)**:
   - Must only publish `locationLabel` at coarse administrative boundaries (e.g., `"Da Lat, Lam Dong"`, `"District 1, Ho Chi Minh City"`).
   - Must NEVER include street names, house numbers, or precise GPS coordinates (<5km radius).
2. **Confidential Dispatch**:
   - Exact building addresses, smart lock codes, and precise directions are shared exclusively via end-to-end encrypted messages (E2EE NIP-04/NIP-44) **AFTER** payment confirmation.

---

## 4. TypeScript Schema Specification

```typescript
export type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'nonrefundable';

export interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  images?: Nip94Image[];
  meshCoordinates: string;
  
  // RFC-0018 Extensions (Optional for full backwards compatibility)
  locationLabel?: string;            // Coarse regional name (City, District)
  cancellationPolicy?: CancellationPolicy; // flexible | moderate | strict | nonrefundable
  cancellationNote?: string;        // Short host note (max 100 chars)
  bedType?: string;                 // e.g. "1 King Bed", "2 Twin Beds"
  areaM2?: number;                  // Usable room area (m²)
  checkInTime?: string;             // Standard check-in time (e.g. "14:00")
  checkOutTime?: string;            // Standard check-out time (e.g. "12:00")
  
  roomTypes: RoomType[];
  priceSats: number;
  priceModel?: 'fixed' | 'dana';
  priceRules?: PriceRule[];
  maxGuests?: number;
  securitySpecs: string[];
  coOwners: CoOwner[];
  acceptedKycVerifiers?: string[];
  kycThresholdSats?: number;
  status: 'available' | 'occupied';
  reviews: Review[];
  editHistory?: EditHistoryEntry[];
}
```

---

## 5. Nostr Event Tags

New fields map cleanly to Nostr event tags, safely ignored by legacy clients:

```json
[
  ["d", "<listing_id>"],
  ["title", "Faraday Bunker & Bitcoin Mesh Lab"],
  ["location_label", "District 1, Ho Chi Minh City"],
  ["cancel_policy", "flexible", "Free cancellation up to 24h prior"],
  ["bed_type", "1 King Bed"],
  ["area_m2", "45"],
  ["check_in", "14:00"],
  ["check_out", "11:00"]
]
```

---

## 6. Price Transparency & Anti-Dark-Pattern Discipline

1. **Honest Pricing**:
   - Primary display: `From X sats / night`.
   - Secondary subtitle: `Excludes protocol fee (~{feePercent}%) and 10% refundable deposit at booking`.
2. **Zero False Urgency**:
   - No fake "Only 1 room left!" banners unless corroborated by actual inventory states in `RoomType.status`.
   - No countdown clocks urging instant checkout.
   - No artificial "15 people are viewing this right now" popups.
