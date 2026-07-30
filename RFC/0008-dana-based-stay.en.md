# RFC-0008: Dana-Based Stay (Voluntary Contribution)

- **Status:** Draft
- **Related modules:** `types.ts` (`Listing`, `Booking`), `src/components/ListingDetail.tsx`,
  `src/utils/depositEscrow.ts`, `src/utils/dynamicFee.ts`, `src/utils/proofOfStay.ts`
  (RFC-0003 is a required prerequisite).

## Problem

The entire current booking flow assumes **every listing has a fixed price**
(`priceSats`), upfront Lightning payment, and a 2-way deposit escrow (RFC-0001/depositEscrow).
However, there is a real and common type of stay (meditation retreats, monasteries, community homestays)
operating on a **dana** (dana/voluntary donation) model: no listed price, no mandatory upfront payment,
guests contribute voluntarily — either after their stay or not at all. Forcing the current flow onto
this model is inherently flawed: an undetermined amount cannot be put in escrow, and dynamic fees cannot
be calculated on `priceSats = 0`.

## Alternatives Considered

### Option A: Force `priceSats = 0`, treat as paid, keep legacy flow
- Pros: No code changes.
- Cons: Loses the ability to accept voluntary contributions in-app — guests wanting to contribute
  post-stay must arrange payments outside (e.g. external links/forms) — fails to solve the core requirement.

### Option B: Add `priceModel` on Listing + post-stay contribution flow (PROPOSED)
Listings receive a new field `priceModel: 'fixed' | 'dana'`. If `'dana'`:
- No upfront payment step before securing a spot — booking = intent confirmation, not a financial transaction.
- No escrow or 2-way deposit (`depositEscrow.ts` is bypassed entirely for dana listings).
- After checkout, display a **"Send Voluntary Contribution"** option — a custom Lightning Zap button where
  guests choose any amount, or opt out completely.
- Pros: Faithful to the dana model, leverages Lightning for willing contributors without forcing anyone.
- Cons: Changes the core assumption that `Listing.priceSats` always exists and is > 0 — requires auditing all places reading this field (dynamicFee, insuranceFund contributions, listing cards) to avoid crashes/misrenders when `priceModel === 'dana'`.

### Option C: Informational-only dana listings without booking flow in-app
- Pros: Simplest implementation, no schema changes.
- Cons: Doesn't build a booking flow — merely external links, no better than an external form.

## Proposal

**Option B.**

### Data Design

```ts
// types.ts — Listing
priceModel?: 'fixed' | 'dana';   // defaults to 'fixed' if omitted (non-breaking for existing data)
priceSats: number;               // for dana: 0 or optional suggested minimum

// types.ts — Booking
donationSats?: number;           // actual amount contributed post-stay (can be 0/undefined)
donationTxProof?: string;        // Lightning payment preimage/proof if contributed
```

### Flow in `ListingDetail.tsx`

- If `listing.priceModel === 'dana'`: hide the upfront payment step, rename button to
  **"Confirm Intent to Stay"** — no invoice generation, no calls to `mintBookingDeposit`/`generateEscrowMultisigAddress`.
- After host confirms checkout (matching existing Proof-of-Stay flow), display the
  **"Send Voluntary Contribution (Optional)"** block — custom Sats input + Zap button, skippable.

### Proof-of-Stay for Dana Stays

Add distinguishing tags without changing `proof_type` (remains `"stay"`, adhering to RFC-0003 "evolve by addition"):

```
["payment_model", "dana" | "fixed"]
["donation_sats", "<actual amount received, can be 0>"]  // optional, present if contributed
```

Reason for not separating `proof_type`: it remains a real "completed stay" — only the payment model differs. Any reputation app can decide whether to treat dana badges equally to fixed-price badges (adhering to "each app interprets independently").

## Code Audit Checklist (Required before merging)

- `dynamicFee.ts`/`calculateDynamicFee`: for dana listings, percentage fees on 0 or undetermined amounts — return fee = 0 when `priceModel === 'dana'` without `donationSats`, calculate fee on actual `donationSats` post-stay if applicable.
- `insuranceFund.ts` (insurance contribution % of `totalPriceSats`): bypass mandatory contributions for dana bookings — insurance fund is meant for escrow disputes, dana listings have no escrow.
- Listing Cards (`LodgingListings.tsx`): display "Voluntary / Dana" instead of a fixed Sats amount when `priceModel === 'dana'`.
- `HostRegistrationModal.tsx`: add `priceModel` selector during listing creation — default to `'fixed'` to preserve legacy behavior.

## Security / Decentralization Trade-offs

- **No no-show protection** for dana bookings — intentional design: dana model is built on trust, not binding financial contracts. Clear UI disclaimer: *"Dana stay — no deposit, no financial reservation guarantee."*
- **Cannot fake contributions to pad reputation** — `donationSats`/`donationTxProof` are recorded only with a valid real Lightning preimage, identical to existing `paymentHash` verification.
- **Reverse exploitation risk**: a host could fake a "dana" listing to dodge insurance fund/escrow fees for a place secretly charging offline — no pure technical prevention, relies on public reputation/reviews.

## Proposed Maturity Tier

**Experimental** — pending implementation and real-world testing (e.g. upcoming retreat stay) before freezing.

## Discussion

(Open.)
