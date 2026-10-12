# RFC-0018: Standardized Accommodation Schema & Privacy-Preserving Listing Metadata

- **Status**: Draft
- **Authors**: Project owner + AI-assisted drafting, community input needed
- **Created**: 2026-10-08
- **Updated**: 2026-10 (project owner approved the cancellation table in section 2)
- **Inherits & Adheres To**: [RFC-0003](./0003-identity-portable-reputation.en.md), [RFC-0008](./0008-dana-based-stay.en.md), [RFC-0011](./0011-financialization-boundary-principle.en.md), [RFC-0012](./0012-sovereignty-boundary-principle.en.md), [RFC-0013](./0013-agent-ready-stay.en.md)

---

## 1. Summary

This RFC standardizes the Accommodation Listing Schema across CypherGuide, referencing the clarity and visual hierarchy of modern booking platforms (Booking.com, Airbnb) while strictly upholding CypherGuide's core sovereign foundation: **non-custodial escrow, zero mandatory KYC, native Bitcoin Lightning/Ecash payments, and uncompromising privacy protection**.

This specification resolves 4 major informational gaps on previous listing cards:
1. **Missing core physical metrics**: Bed configuration, room area, check-in/out times, and maximum guest capacity clearly presented.
2. **Ambiguous cancellation policies**: Standardizing 4 cancellation policy tier names (`flexible`, `moderate`, `strict`, `nonrefundable`).
3. **Privacy leaks in public listings**: Strictly forbidding detailed street addresses and precise GPS coordinates on public Nostr events; only coarse regional descriptors (City, District) are permitted.
4. **Upfront financial transparency before booking**: The listing card must clearly display the baseline nightly rate, the 10% refundable security deposit rate, and current protocol fees.

---

## 2. Four Cancellation Policy Tiers (Cancellation Policies)

The project owner has finalized **4 standardized tier names** for cancellation policies:
- `flexible`
- `moderate`
- `strict`
- `nonrefundable`

### Timelines & Penalty Rates (Approved by the Project Owner, 2026-10; Not Yet Enforced by the System)

The project owner has **approved** the table below as the standard commitment a host makes when choosing the corresponding tier. Because the system does **not yet enforce refunds** (see section 6), this is a host's commitment to the guest, not an automatic mechanism. Any later change to these timelines requires updating this RFC:

| Policy Tier (`cancellationPolicy`) | Free Cancellation Window | Full Refund Condition on Timely Cancel | Late Cancellation Rule |
| :--- | :--- | :--- | :--- |
| `flexible` | Prior to **24 hours** before check-in (`checkInTime`) | Refund **100%** of room price | Charge 50% room price of first night; refund remainder |
| `moderate` | Prior to **5 days** before check-in date | Refund **100%** of room price | Charge 100% of first night; refund remaining nights |
| `strict` | Prior to **14 days** before check-in date | Refund **100%** of room price | Non-refundable room price if cancelled within 14 days |
| `nonrefundable` | No free cancellation window | Room price non-refundable | 100% room price retained by Host upon booking |

### Inviolable Principle Regarding Security Deposits (Security Deposit)
Across **all 4 tiers above**, the **10% refundable security deposit** (`REFUNDABLE_CHECKOUT_DEPOSIT_RATE`) is **ALWAYS 100% REFUNDED TO THE GUEST** if the booking is cancelled prior to check-in time. The security deposit is an independent escrow collateral protecting against physical property damage, **never constitutes Host revenue**, and is never deducted according to cancellation penalty rates.

---

## 3. Coarse Location Privacy Principle

In strict compliance with [RFC-0012 (Sovereignty Boundary Principle)](./0012-sovereignty-boundary-principle.en.md):

1. **On public interfaces and publicly broadcast metadata**:
   - Only the `locationLabel` field at a coarse geographic region may be published (e.g., `"Da Lat, Lam Dong"`, `"District 1, Ho Chi Minh City"`, `"Con Dao District, Ba Ria - Vung Tau"`).
   - If an accommodation has not updated `locationLabel`, the interface displays `"Not specified"`, and strictly **MUST NOT** display the `mesh:` coordinate string or GPS coordinates as a fallback.
   - Strictly **FORBIDDEN** from publishing house numbers, alley/lane names, building names, or precise GPS coordinates (<5km radius) in public contents.
   - If coordinates must be stored to support regional distance search, the system must round coordinates to coarse regional granularity (maximum 1 decimal place, ~11km protection radius) before entering any public index or query.
2. **Confidential Dispatch Channel**:
   - Physical street addresses, smart lock codes (PIN/Key), and detailed navigation directions are transmitted strictly via end-to-end encryption (E2EE via NIP-44 or NIP-17) and dispatched privately to the guest **AFTER** the Lightning/Ecash transaction is confirmed.

---

## 4. TypeScript Schema Specification (Listing Schema)

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

## 5. Nostr Event Tag Mapping (Future Design)

*Note on current codebase state*: Currently CypherGuide listing data is stored locally (Zustand + IndexedDB) and seeded from `src/data.ts`. Existing Nostr events on the network are implemented solely for Proof-of-Stay (Kind 30078, `src/utils/proofOfStay.ts`), KYC Attestation (Kind 30388), NIP-98 Admin Auth (Kind 27235), and fee adjustment Audit Trail.

The tag mapping below represents a **directional future design** for when public listing publishing on Nostr relays is introduced, without fixing a rigid event kind at this stage:

```json
[
  ["d", "<listing_id>"],
  ["title", "Faraday Bunker & Bitcoin Mesh Lab"],
  ["location_label", "District 1, Ho Chi Minh City"],
  ["cancel_policy", "flexible"],
  ["bed_type", "1 King Bed"],
  ["area_m2", "45"],
  ["check_in", "14:00"],
  ["check_out", "11:00"]
]
```

---

## 6. Implementation Limitations

1. **System does not automatically enforce refunds per cancellation policy**: Currently the booking flow (`BookingModal.tsx`) and escrow mechanism (`depositEscrow.ts`) do not include automated refund calculation logic when a guest cancels.
2. **Host commitment**: Cancellation policy terms currently displayed on listing cards and detail pages are a **commitment by the host**; the system does not automatically execute room fee refunds via Lightning/Ecash.
3. **Mandatory UI warning label**: The user interface is required to display an accompanying note: *"Host commitment, system does not automatically enforce refunds"* alongside the cancellation policy name to avoid user misunderstandings.

---

## 7. Open Questions

1. **Seasonal or room-type variants**: The milestones (24 hours, 5 days, 14 days) and first-night penalty rates are **approved by the project owner** (2026-10). Remaining question: whether peak-season or room-type variants are needed, and what operating data should drive any adjustment.
2. **Dispute resolution handling upon cancellation**: When disputes arise regarding cancellation notification timestamps or room fee refunds between guest and host, what is the procedure for submitting evidence and arbitrating via the Arbitrator Council (RFC-0001)?
3. **Technical enforcement mechanism**: Which cryptographic primitive (Hold Invoices LND/CLN, Discreet Log Contracts DLC, or Cashu NUT-11 multisig escrow) should be adopted to automate room fee refunds in a fully non-custodial manner?

---

## 8. Price Transparency & Anti-Dark-Patterns

1. **Honest Pricing Display**:
   - Primary listing card rate: `From X sats / night`.
   - Mandatory secondary notice: `Excludes protocol fee (~{feePercent}%) and 10% refundable deposit at booking`.
   - Ensures guests encounter no unexpected charges upon opening `BookingModal`.
2. **Strict Prohibition of Artificial Scarcity (Anti-Slop / Anti-Urgency)**:
   - Forbids "Only 1 room left!" banners unless corroborated by real inventory state in `RoomType.status`.
   - Forbids countdown timers urging urgent checkout.
   - Forbids fake popups such as "15 people are currently viewing this stay".
