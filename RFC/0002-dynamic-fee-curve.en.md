# RFC-0002: Protocol Contribution Structure (Suggested Base Rate, Multipliers, Early Host Incentive; Reputation Curve as Future Option)

- **Status:** Draft (updated 2026-10 following Project Lead decision and RFC-0020 alignment)
- **Author:** Project Lead + AI-assisted drafting, community input needed
- **Related modules:** `src/utils/dynamicFee.ts`, `lib/configStore.ts`, `data/protocol_config.json`, `src/components/BookingModal.tsx`, `src/components/LodgingListings.tsx`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`, `RFC/0020-protocol-fee-enforcement.en.md`

## Nature of Contribution & RFC-0020 Alignment

According to the analysis in `docs/FEE_ENFORCEMENT_ANALYSIS.md` and the Project Lead Decision in **RFC-0020 (Phase 1 - Option C)**:
- The protocol currently operates on direct P2P Lightning payments to the host's personal wallet; **no cryptographic mechanism exists at the protocol level to enforce Treasury payments**.
- Therefore, software and documentation must state the true nature: Payments to the Treasury represent **voluntary protocol contributions (suggested rates)**, not mandatory fees.
- The 2% base rate (`baseFeeRatePcm = 200`) and the 1% Early Host rate (`earlyHostFeeRatePcm = 100`) serve as **default suggested contribution amounts**.
- Guests booking accommodations retain full control to:
  1. Keep the automatically computed suggested contribution.
  2. Set the contribution to `0 sats` with a single tap/click, free of dark patterns or pressuring text.
  3. Enter any custom satoshi contribution amount.
- When guests choose `0 sats`, the system **does not generate a Treasury invoice**, and the booking completes successfully with the Host invoice alone.

## Note on Previous Version of this RFC
The previous version (written retroactively) described a fee discount curve based on reputation (`BASE=3%`, `MIN=0.5%`, `discount = 40 × ln(1 + reputationScore)`) and stated it was "currently implemented". A source code audit in October 2026 showed that **this description did not match the codebase**: `dynamicFee.ts` does not contain reputation-based fee discounting. The actual code calculates fees using a fixed base rate multiplied by a security multiplier and congestion multiplier, bounded by minimum and maximum caps. The reputation discount curve has been moved to a future option (Option B below) and is no longer considered implemented.

## Problem
A contribution structure is needed that is sufficient to provide operational revenue for community relay nodes (RFC-0016) and developer grants (RFC-0015), yet lightweight enough to encourage nascent P2P network adoption. The old rate in code was 0.2% (with running config at 0.25%), which was insufficient to sustain infrastructure. The 2% suggested base rate serves as a practical baseline, significantly lower than centralized commission rates (Booking.com 10-25%, Airbnb 15.5%, Agoda 15-20%).

## Current Suggested Contribution Calculation in Implementation
- `suggestedContributionSats = clamp(roomPriceSats × baseFeeRatePcm / 10000 × congestionMultiplier × networkCongestionScore × securityMultiplier, minFeeSats, maxFeeSats)`.
- `pcm` stands for per-cent-mille (parts per ten thousand): 100 pcm = 1%, 200 pcm = 2%. Technical parameter names `baseFeeRatePcm` and `earlyHostFeeRatePcm` remain unchanged for codebase compatibility.
- Security level multipliers (`securityLevel`): `relaxed` 0.8, `strict` 1.0, `paranoid` 1.5.
- Minimum `minFeeSats = 10 sats` and maximum `maxFeeSats = 10,000 sats` apply when computing the default suggested amount.
- **Custom Guest Input:** If a guest manually inputs a contribution amount, this custom value is **not constrained** by the 10,000 sat cap or the 10 sat floor (guests may choose to contribute more or any arbitrary amount).
- In addition, the UI estimates Lightning routing fees (~0.1%) so guests understand total network settlement costs.
- **Contributing Party:** Guests contribute voluntarily; hosts always receive 100% of the room rate. If a guest agrees to contribute, funds route to the Treasury via a dedicated invoice (RFC-0016).
- Administrators adjust `baseFeeRatePcm` via a NIP-98 authenticated API; each change produces an audit event.

## Alternatives Considered

### Option A: Retain a Fixed Base Rate + Early Host Incentive Tier (CHOSEN FOR SUGGESTED RATES)
A unified base rate (2%), plus a time-limited incentive suggested rate (1%) for the initial cohort of hosts.
- Pros: Simple, transparent, directly matches existing code structure; incentives attract initial supply without depressing overall baseline rates.
- Cons: Incentive host whitelist is managed by administrators (soft point of centralization); requires cryptographic verification of listing ownership (resolved via NIP-78 signatures in RFC-0019).

### Option B: Reputation-Based Fee Discount Curve (UNIMPLEMENTED, Future Option)
Fee discounts scaled by Proof-of-Stay reputation score, e.g., `discount = k × ln(1 + reputationScore)` with a minimum floor.
- Pros: Rewards good behavior, incentivizes real transactions.
- Cons: Constants `BASE`, `MIN`, `k` in the old draft were arbitrary without empirical grounding. Robust anti-collusion measures must precede implementation (see RFC-0017).

### Option C: Parameters Decided by Protocol Governance Vote
`baseFeeRatePcm` and other parameters periodically voted on by Protocol Governance.
- Pros: True to the "build together, fix together" ethos.
- Cons: No automated mechanism currently exists to apply governance vote outcomes to running code; all parameters are currently set by admin via NIP-98.

## Proposal & Decision (Approved by Project Lead, 2026-10)
1. **Suggested Base Contribution Rate: 2% (`baseFeeRatePcm = 200`).**
2. **Early Host Incentive Program: 1% (`earlyHostFeeRatePcm = 100`) for 12 months.**
   - Clearly defined: This represents a **lower suggested contribution rate** (1% instead of 2%) applied to listings of verified enrolled hosts with valid RFC-0019 signatures; **not a service discount** (RFC-0020).
   - Multiplied by security level multipliers identically to the base rate (e.g. `paranoid` yields 1.5%, `relaxed` yields 0.8%).
3. **Incentive Program Design Details:**
   - Host identity authenticated by pubkey hex verified through NIP-78 signature (RFC-0019).
   - Enrollment handled by administrators via NIP-98 authenticated API; each enrollment or removal generates an audit event.
   - Each host receives 12 months from their **enrollment timestamp** (`enrolledAt`), cannot be backdated.
   - Enrolled host limit: initial cohort of 20 hosts.
   - Eligibility: genuine hosts, one Nostr identity per person, vetted by administrator.
4. The 10 sat minimum and 10,000 sat maximum caps apply to the automated suggested calculation; custom guest inputs are not subject to the 10,000 sat ceiling.
5. Defaults across code, config, docs, and tests are unified at 200 pcm (2%) and 100 pcm (1%).

## Security & Decentralization Trade-offs
- **Parameter Control:** `baseFeeRatePcm` and the early host list are controlled by administrators via NIP-98, representing a soft centralization vector. Mitigated by publishing public audit events.
- **Voluntary vs Coercive:** Because the protocol cannot enforce payments without compromising the direct peer-to-peer nature of Lightning payments, it empowers guests to choose. Transparency builds lasting credibility.
- **Cost Transparency:** The checkout modal breaks down each component line-by-line: room rate for host, estimated Lightning routing fee, suggested protocol contribution (with 1-tap 0 sat reset), and 10% refundable deposit. Zero hidden costs.

## Metrics to Track
- Number of enrolled hosts and retention rates at 3, 6, and 12 months.
- **Suggested Rate Adherence Ratio:** Proportion of bookings where guests contribute the suggested default amount.
- **Zero-Contribution Ratio:** Proportion of bookings where guests intentionally adjust contribution to 0.
- **Average Sats Contributed:** Average satoshis contributed per completed transaction.
- Gross satoshis collected into Treasury vs gross booking volume (effective contribution rate).
- Abandonment rate at payment step compared to historical baselines.

## Proposed Maturity Tier
**Experimental**, until at least one cycle of real operational data (enrolled hosts, completed bookings, voluntary contribution ratios) is gathered for re-evaluation.

## Open Questions
1. **10,000 Sat Suggested Cap:** The 10,000 sat cap applies to automated suggested calculations (ensuring reasonable suggestions for high-value bookings over 500,000 sats). Guests may always choose to contribute higher amounts manually.
2. **Incentive Cohort Scale & Criteria:** Is 20 hosts optimal, and what specific criteria should govern expansion?
3. **Tiered Suggestions by Accommodation Value:** Should lower percentage suggestions apply to budget pod stays and higher percentages to luxury villas?
4. **Host Contributions:** The current interface allows guests to contribute during checkout; should hosts also be provided an option to contribute a portion of revenue to the Treasury via NIP-57 Zaps?
5. **Post-12-Month Transition:** Do early host listings revert immediately to the 2% suggested rate or taper gradually?
6. **Phase 2 Transition Trigger (RFC-0020 Option B):** When should the transition to a service-based fee model occur, and what prerequisites are mandatory?
7. Legal and tax treatment of voluntary Value4Value donations to the Treasury (requires independent counsel).

## Discussion
**2026-10 — Project Lead Decision:** Finalized suggested base contribution rate of 2% and 1% incentive for 12 months for the initial host cohort. Clarified per RFC-0020: This is a voluntary contribution (optional), adjustable to 0 with 1 tap. The protocol employs no dark patterns and exerts no coercive pressure.
