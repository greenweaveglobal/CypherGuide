# RFC-0002: Protocol Fee Structure (Base Rate, Multipliers, Early Host Incentive; Reputation Curve as Future Option)

- **Status:** Draft (updated 2026-10 following project owner decision)
- **Author:** Project owner + AI-assisted drafting, community input needed
- **Related modules:** `src/utils/dynamicFee.ts`, `lib/configStore.ts`, `data/protocol_config.json`, `src/components/BookingModal.tsx`, `src/components/LodgingListings.tsx`

## Note on Previous Version of this RFC
The previous version (written retroactively) described a fee discount curve based on reputation (`BASE=3%`, `MIN=0.5%`, `discount = 40 × ln(1 + reputationScore)`) and stated it was "currently implemented". A source code audit in October 2026 showed that **this description did not match the codebase**: `dynamicFee.ts` does not contain reputation-based fee discounting. The actual code calculates fees using a fixed base rate multiplied by a security multiplier and congestion multiplier, bounded by minimum and maximum caps. The reputation discount curve has been moved to a future option (Option B below) and is no longer considered implemented.

## Problem
A fee structure is needed that is sufficient to provide operational revenue for the platform, yet low enough that hosts and guests want to use a nascent protocol without an existing user base. The old rate in code was 0.2% (with running config at 0.25%), vastly lower than mainstream centralized booking platforms (according to third-party public estimates: Booking.com ~10% to 25% with ~15% average, Airbnb ~15.5% host-only fee model, Agoda ~15% to 20%), and too low to sustain the project: at 0.25%, generating 15 million VND/month in revenue would require roughly 6 billion VND in gross booking volume each month.

## Current Fee Calculation in Implementation
- `protocolFeeSats = clamp(roomPriceSats × baseFeeRatePcm / 10000 × congestionMultiplier × networkCongestionScore × securityMultiplier, minFeeSats, maxFeeSats)`.
- `pcm` stands for per-cent-mille (parts per ten thousand): 100 pcm = 1%, 200 pcm = 2%.
- Security level multipliers (`securityLevel`): `relaxed` 0.8, `strict` 1.0, `paranoid` 1.5.
- Minimum 10 sats, maximum 10,000 sats per transaction (unchanged, see Open Questions).
- In addition, the UI estimates Lightning routing fees (~0.1%), which are separate from protocol fees.
- **Paying Party:** Guests pay protocol fees **on top** of the room rate; hosts receive the full room rate. Fees flow to the Treasury wallet via a dedicated invoice (RFC-0016), or bundled into the host invoice when non-separable.
- Administrators update `baseFeeRatePcm` via a NIP-98 authenticated API; every change generates an audit event.

## Alternatives Considered

### Option A: Retain a Fixed Base Rate + Early Host Incentive Tier (CHOSEN)
A single unified base rate, plus a time-limited incentive program for the initial cohort of hosts.
- Pros: Simple, transparent, directly matches existing code structure; incentives attract initial supply without depressing base rates for everyone.
- Cons: Incentive host whitelist is managed by administrators (soft point of centralization); hard to distinguish genuine initial hosts from Sybil identities.

### Option B: Reputation-Based Fee Discount Curve (UNIMPLEMENTED, Future Option)
Fee discounts scaled by Proof-of-Stay reputation score, e.g., `discount = k × ln(1 + reputationScore)` with a minimum floor.
- Pros: Rewards good behavior, incentivizes real transactions.
- Cons: Constants `BASE`, `MIN`, `k` in the old draft were arbitrary without empirical grounding. At the new 2% base rate, the entire curve must be recalculated. Reputation scores could be farmed (see RFC-0017), so reputation discounts require robust anti-collusion measures first.

### Option C: Parameters Decided by Protocol Governance Vote
`baseFeeRatePcm` and other parameters periodically voted on by Protocol Governance.
- Pros: True to the "build together, fix together" ethos.
- Cons: No technical mechanism currently exists to apply governance vote outcomes to running code; all parameters are currently set by admin.

## Proposal (Approved by Project Owner, 2026-10)
1. **Base Rate: 2% (`baseFeeRatePcm = 200`).** Replacing 0.2% in code and 0.25% in running config.
2. **Early Host Incentive Program: 1% (`earlyHostFeeRatePcm = 100`) for 12 months.** Applies to listings of registered early hosts. Multiplied by security level multipliers identically to base rate (e.g. `paranoid` yields 1.5%, `relaxed` yields 0.8%).
3. **Incentive Program Design Details** (points marked "proposed" await owner confirmation):
   - Host identity determined by `npub` in listing's `coOwners` (no dedicated host field yet); multi-owner rule: **proposed** to select the co-owner npub with the highest share, or first in list in case of tie.
   - Enrollment handled by administrators via NIP-98 authenticated API; each enrollment or removal generates a public audit event.
   - Each host receives 12 months from their **enrollment timestamp** (`enrolledAt`), cannot be backdated.
   - Enrolled host limit: **proposed** 20 hosts.
   - Eligibility: **proposed** genuine hosts, one npub per person, evaluated by administrator; no automated criteria defined yet.
4. The 10 sat minimum and 10,000 sat maximum caps remain unchanged in this RFC; see Open Questions regarding raising the cap.
5. Once finalized, the default across code, config, docs, and tests must align (200 pcm), eliminating the discrepancy between 20 and 25.

## Security & Decentralization Trade-offs
- **Parameter Control:** `baseFeeRatePcm` and the early host list are controlled by administrators (NIP-98 auth, hardcoded admin pubkeys), representing a soft centralization vector. Mitigated by publishing audit events for all changes, with Option C as a long-term goal.
- **Incentive Abuse:** In the absence of KYC, a single actor could create multiple npubs to capture incentives. Administrator vetting and cohort caps mitigate this risk though do not eliminate it.
- **Fee Paid as Surcharge by Guest:** Guests see a total price higher than the room rate. Must be clearly communicated on listing cards and during booking ("excludes protocol fee and 10% deposit"), never hidden.
- **Price Locked at Booking:** The applied fee is determined at time of booking to avoid price slippage after commitment.

## Metrics to Track
- Number of enrolled hosts and retention rates at 3, 6, and 12 months.
- Total realized fees collected vs gross booking volume (effective fee rate, factoring in min/max caps).
- Abandonment rate at payment step after fee display, compared to pre-update baseline.
- Host qualitative feedback regarding fee levels collected via concise surveys.

## Proposed Maturity Tier After Implementation
**Experimental**, until at least one cycle of real operational data (enrolled hosts, completed nights, abandonment rates) is gathered for re-evaluation.

## Open Questions
1. **10,000 sat fee cap:** At 2%, transactions above 500,000 sats (above ~333,000 sats under `paranoid`) hit the ceiling, yielding an effective fee below 2%. Should this ceiling be raised or kept as an implicit volume discount for high-value bookings?
2. **Incentive cohort size & criteria:** Is 20 hosts optimal, and what criteria should be applied beyond administrator review?
3. **Multi-owner listings:** Rule for selecting qualifying npub for discounts (see Proposal).
4. **Paying party:** Currently guest surcharge. Should hosts have the option to absorb fees (like Booking/Airbnb host-fee models) to present an all-inclusive rate?
5. **Post-12-month transition:** Do early hosts transition immediately to 2%, or ramp up progressively?
6. **Future fee adjustment notices:** Advance notice policy for changing `baseFeeRatePcm`, and non-retroactivity for confirmed bookings (proposed: no retroactivity).
7. When reputation data matures, should Option B be reintroduced, and with what anti-collusion defenses (RFC-0017)?
8. Legal and tax treatment of Treasury fee inflows (requires specialist counsel; not addressed in this RFC).

## Discussion
**2026-10 — Project Owner Decision:** Finalized base rate of 2% and 1% incentive for 12 months for the initial host cohort. Comparative baseline draws from public commission estimates of Booking.com, Airbnb, and Agoda (from third-party sources; subject to regional and temporal variations). The 2% figure is an empirical working hypothesis to be validated with real hosts, not an exact mathematical optimization.
