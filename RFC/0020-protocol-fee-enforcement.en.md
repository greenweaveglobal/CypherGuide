# RFC-0020: Protocol Fee Enforcement Mechanism

- **Status:** Draft (Phase 1 per Option C adopted; Phase 2 per Option B is the target direction, non-committed)
- **Author:** Project Lead + AI drafting assistant
- **Date:** 2026-10-16 (Standardization update: 2026-10-16)
- **Related Modules:** `src/utils/dynamicFee.ts`, `src/components/BookingModal.tsx`, `src/utils/depositEscrow.ts`, `src/utils/proofOfStay.ts`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`

## Project Lead Decision (October 2026)

In October 2026, following the technical codebase analysis in `docs/FEE_ENFORCEMENT_ANALYSIS.md` and the options evaluated in this document, the Project Lead formally approved the strategic direction for protocol funding:

1. **Phase 1 (Current):** Adopt **Option C (Voluntary Protocol Contribution with Recognition)**.
   - The fee is fundamentally recognized as a **voluntary contribution** supporting community relay infrastructure and open-source development (RFC-0016, RFC-0015).
   - The protocol honors user autonomy: guests have full control to accept the suggested rate, adjust to 0 sats, or enter a custom amount.
   - Adjusting to 0 sats requires a single tap/click, with strictly no dark patterns (no pressuring language, no countdown clocks, no confirmation modals). Bookings complete successfully when the contribution is 0.
2. **Phase 2 (Future Target):** Direct development toward **Option B (Fee as Price of Specific Services)** once all 4 technical prerequisites are met (real independent arbitrators, live BFT escrow custody, independent Proof-of-Stay attester network, and relay listing discovery).
3. **Discarded Options:** **Option A and Option D will not be implemented**.
   - Option A is trivial to circumvent when guest and host collude to bypass deposits, while room rates route directly to the host unhindered.
   - Option D converts relays into centralized chokepoints, contradicting Nostr's anti-censorship philosophy.
4. **Meaning of the 1% Early Host Incentive:**
   - The 1% (100 pcm) incentive for Early Hosts (RFC-0002) is defined as a **lower suggested contribution rate** (1% instead of 2% base) for listings of verified enrolled hosts, **not a discount on services**.
   - **Comparative Analysis Across Architectural Options:**
     - *In Option B (Service Fee):* The 1% incentive functions as a direct service fee discount on attestation and dispute services (e.g., discounted Proof-of-Stay attestation or reduced escrow arbitration fees).
     - *In Option C (Voluntary Contribution - Phase 1):* The 1% incentive manifests as a **lower default suggested contribution rate** (1% rather than 2%) presented to guests booking at an early host's listing; guests maintain full autonomy to adjust this amount.
     - *In Option D (Relay Validator):* The 1% incentive represents a reduced minimum fee threshold enforced by the validating gateway relay before forwarding booking events.
5. **Scope of Commitment:**
   - This represents a **strategic directional decision**, **not a timeline commitment** for launching Phase 2 (Option B).

> **Important Legal Notice:** All observations concerning legal, regulatory, financial intermediary, and tax implications in this document represent preliminary technical assessments of the software development team, not formal legal counsel, and have not been reviewed by independent attorneys. Legal safety across options may mitigate certain intermediary risks but remains contingent on how regulatory authorities in respective jurisdictions classify the operational model.

---

## Problem

According to the comprehensive codebase audit in `docs/FEE_ENFORCEMENT_ANALYSIS.md`, currently **no cryptographic mechanism exists at the protocol level to enforce Treasury fee settlement**.

Under the current architecture (RFC-0016):
1. Protocol fee calculation (`protocolFeeSats`) is executed exclusively on the guest's client side (`calculateDynamicFee`).
2. The protocol splits payments into two independent Lightning invoices (Dual-Invoice Model):
   - Invoice 1 routes to the Host's Lightning address.
   - Invoice 2 routes to the Infrastructure Reward Treasury address.
3. A modified client or custom script can effortlessly bypass the Treasury invoice (by setting `protocolFeeSats = 0` or simply omitting payment for Invoice 2) while settling the Host invoice in full.
4. The host receives 100% of their accommodation rate directly in their personal wallet and accommodates the guest. The real-world booking succeeds, but the protocol Treasury receives zero sats.

The fundamental issue is that earlier architectures relied on an "Honest Client Assumption". An effective mechanism design aligned with the decentralized nature of Bitcoin, Lightning, and Nostr is required, rather than unenforced cryptographic assumptions.

## Current Operating Reality

- In the current CypherGuide production deployment, the protocol operates on the Dual-Invoice Model. Settling the Treasury fee depends entirely on whether the user's client honestly executes the payment.
- In practice, the system functions under a **voluntary honest-client model** — functionally equivalent to **Option C** (voluntary contribution).
- Aligned with the Project Lead's decision, UI labels (such as "Protocol Fee" in booking summaries) must be updated to **"Protocol contribution (optional)"** to ensure complete honesty and transparency with users.

## Evaluated Options

This document records the 4 architectural options analyzed during system evaluation:

---

### Option A: Single Unified Invoice with Escrow Proof-of-Fee Lock - *[Discarded]*

- **Mechanism:**
  - Guest pays a single combined invoice (room rate + refundable escrow security deposit).
  - The security deposit (Escrow via Cashu NUT-11 Multisig or HTLC) includes a programmatic spending condition: deposit release to the guest (or payout to host) requires presenting a valid payment preimage demonstrating Treasury fee settlement (`verifyLightningPreimage(treasuryPreimage, treasuryPaymentHash)`).
- **Advantages:**
  - Leverages existing escrow infrastructure from RFC-0003/RFC-0008.
  - Enforces cryptographic conditions: escrow funds cannot unlock without the fee settlement preimage.
- **Flaws & Critical Vulnerabilities leading to rejection:**
  - **Host & Guest Collusion:** If host and guest collude offline or agree on a "zero-deposit booking", neither party engages the escrow contract and zero fees reach the Treasury.
  - **Direct Room Rate Settlement:** Because accommodation payments route directly P2P from guest to host, the protocol cannot freeze or claw back funds once the host receives them.
  - Substantially increases UX complexity for routine deposit refunds.

---

### Option B: Fee as Service Price, Not Transaction Tax - *[Target for Phase 2]*

- **Mechanism:**
  - Deprecate treating protocol fees as a "mandatory transaction tax" imposed on peer-to-peer commerce (which cannot be cryptographically enforced in an open protocol).
  - Instead, **protocol fees represent pricing for cryptographically auditable value-added services**:
    1. **BFT Escrow & Dispute Arbitration:** Only bookings with verified Treasury contributions receive coverage under the BFT Insurance Fund (RFC-0001) and qualify for arbitration hearings regarding damaged property or disputed deposits.
    2. **Co-Signed Cryptographic Proof-of-Stay Certification (RFC-0003):** The Proof-of-Stay event is only attested and co-signed by protocol attesters/relays upon receipt of the fee payment preimage. *Technical note:* In the codebase (`src/utils/proofOfStay.ts`), Proof-of-Stay is a dual-signed Nostr Kind 30078 event (guest claim + host endorsement), **not a blockchain NFT token**. Without this attestation, guests cannot build portable reputation or publish verified reviews on Nostr.
    3. **Listing Discovery & Priority Relay Indexing:** Hosts with consistent protocol contributions receive priority relay indexing, search boosting, and "Verified Autonomous Stay" attestation badges.
    4. **Reputation & Agent Audit Feeds:** Provides authenticated API feeds and verification traces for autonomous AI booking agents.
- **Advantages:**
  - Fully aligned with Cypherpunk philosophy: Replaces coercive enforcement with tangible service value that users willingly purchase.
  - Immune to evasion: Users who decline the fee simply forgo attestation services and dispute guarantees, while basic P2P commerce continues unhindered.
- **Disadvantages:**
  - Budget-conscious travelers or transient bookings with zero interest in reputation may bypass fees. Treasury revenue becomes dependent on market demand for attestation services.

#### Prerequisites for Option B

Option B can only function in production once the following four supporting infrastructure services exist. A direct codebase audit indicates:
1. **Arbitration Council & Escrow:** In `src/utils/insuranceFund.ts` (lines 55-77), `DEFAULT_ARBITRATOR_POOL` consists of 3 static placeholder keys for simulation; no independent third-party arbitrators hold private keys (**not yet implemented with real arbitrators**).
2. **BFT Insurance Fund (RFC-0001):** The current code only simulates client-side BFT consensus tallying; live deposit custody contracts (FROST multisig or Cashu mint) are **not yet implemented**.
3. **Attester Service for Proof-of-Stay:** In `src/utils/proofOfStay.ts`, Proof-of-Stay is co-signed directly between Guest and Host; an independent protocol attester service co-signing events upon fee verification is **not yet implemented**.
4. **Listing Discovery & Priority Ranking:** Listing data is stored locally in client application state (`useAppStore.ts`); relay-level indexing and priority sorting based on fee contributions are **not yet implemented**.

---

### Option C: Voluntary Contribution with On-Chain Recognition - *[Selected for Phase 1]*

- **Mechanism:**
  - Protocol fees transition into **voluntary protocol contributions**.
  - Guests see a default suggested amount (computed per RFC-0002 formulas), with immediate controls to keep the suggested amount, adjust to 0 sats (1 tap), or specify a custom satoshi amount.
  - When the guest selects 0 sats, no Treasury invoice is generated and the booking completes seamlessly.
  - Contributions to the Treasury are publicly broadcast across Nostr relays via NIP-57 (Zaps) or NIP-58 (Badges).
- **Security Note on Governance Voting:**
  - Initial discussions suggested assigning governance voting weight proportional to sats contributed. Tying voting power directly to satoshi volume introduces severe risks of plutocracy (wealthy actors buying influence) and Sybil attacks (forging multiple identities to dominate polls).
  - Therefore, **voting weight proportional to contribution sats will NOT be implemented in Phase 1**, remaining an open question for dedicated review.
- **Advantages:**
  - Maximally transparent; regarded in technical assessments as mitigating financial intermediary brokerage risks, though legal classification ultimately depends on judicial and regulatory interpretation in each jurisdiction.
  - Cleanest UX: Guests choose the suggested amount, 0 sats, or a custom contribution without friction.
- **Disadvantages:**
  - Unstable and potentially minimal revenue (subject to the free-rider problem).

---

### Option D: Relay / Server-Enforced Validation - *[Discarded]*

- **Mechanism:**
  - Employs gated validating relays or a centralized CypherGuide relay gateway.
  - When a booking event is broadcast, the validating relay verifies fee settlement directly with the Treasury Lightning node via webhook/gRPC.
  - Unpaid bookings are rejected by the relay.
- **Reasons for Rejection:**
  - **Decentralization Compromise:** Establishes the relay/server as a centralized chokepoint. If the Treasury gateway goes offline, booking broadcasting halts network-wide.
  - Contradicts Nostr anti-censorship tenets (clients can switch to ungated relays).

---

## Comparative Matrix

| Criteria | Option A (Escrow Lock) | Option B (Service Price) | Option C (Voluntary - Phase 1) | Option D (Relay Validator) |
|---|---|---|---|---|
| **Decentralization Level** | High | Very High | Maximum | Medium - Low |
| **Technical Feasibility** | Medium (Collusion vulnerability) | Dependent on 4 prerequisites (Currently not implemented) | Very High (Viable immediately, honest) | Medium (Requires dedicated nodes) |
| **Evasion Resistance** | Poor (Offline collusion) | Natural (No fee = No service benefit) | Non-resistant (Fully open, encourages voluntary support) | Very High on primary relays |
| **User Experience (UX)** | Complex (Multi-step deposit claim) | Seamless, transparent value | Clean, lightweight, 1-tap reset to 0 | Dependent on relay availability |
| **Preliminary Legal Assessment (Technical assessment, no legal counsel)** | Moderate (Escrow custody questions) | Dependent on software/service licensing structure | Evaluated as minimizing intermediary brokerage risk | Complex (Transaction censorship) |

## Security & Decentralization Trade-offs

- **Who is trusted:**
  - **Options A & B:** Zero centralized intermediaries; relies on cryptographic contracts and rational economic incentives.
  - **Option C:** Relies on Cypherpunk community goodwill and the Value4Value culture of the Bitcoin/Nostr ecosystem.
  - **Option D:** Requires trusting validating server/relay infrastructure and the Treasury Lightning node.
- **Attester as a New Trust Assumption (Applicable to Option B):**
  - In Option B, requiring a protocol relay/attester to co-sign Proof-of-Stay upon receiving fee payment preimages introduces a **new trust assumption** regarding the attester.
  - Single attester risk: Creates a centralized censorship chokepoint and single point of failure.
  - Failure modes if attester is compromised or malicious: A compromised attester key could forge endorsements for bookings that paid no fees; conversely, a denial-of-service (DoS) or outage at the attester prevents paying guests from obtaining their valid Proof-of-Stay.
  - Therefore, Option B necessitates a decentralized network of independent attesters operating under an m-of-n threshold signature scheme. This RFC does not prematurely fix the number of attesters without strategic approval from the Project Lead.

## Adopted Roadmap

Based on the Project Lead's decision (October 2026), the execution sequence is established as follows:
1. **Phase 1 (Current): Implement Option C (Voluntary Contribution with Recognition):**
   - Respect technical reality: The protocol cannot enforce payment when accommodation funds route directly P2P to the host.
   - Truth in presentation: UI, software, and documentation state clearly that Treasury payments are voluntary contributions (non-mandatory), with default rates computed per RFC-0002.
   - Provide frictionless controls: suggested amount, 0 sats (1 tap), or custom amount without dark patterns.
   - When 0 sats is chosen, no Treasury invoice is generated, and payment/reconciliation completes with the Host invoice alone.
2. **Phase 2 (Future Target): Transition to Option B (Fee Tied to Services):**
   - Transition to Phase 2 occurs only when all 4 surveyed prerequisites are met:
     1. Onboarded genuine Arbitration Council with independent hardware keys (replacing current 3 placeholder keys).
     2. Deployed live BFT insurance custody contracts (FROST / Cashu mint).
     3. Built decentralized attester network operating m-of-n threshold signatures for Proof-of-Stay.
     4. Engineered relay-level listing discovery and indexing mechanisms.
3. **Discard Options A and D:** Option A is rejected due to offline collusion bypass; Option D is rejected due to centralized chokepoints.

## Success Metrics

1. **Voluntary Contribution Ratio:** Ratio of bookings containing non-zero protocol contributions relative to total booking volume.
2. **Treasury Sustainability Inflow:** Sufficient satoshi volume to cover community relay subsidies and insurance reserves.
3. **Average Sats Contributed:** Average number of satoshis contributed per transaction.

## Open Questions for Project Lead Determination

1. **Contributor Recognition & Guest Privacy:** How should contributor recognition (e.g., NIP-58 badges, public zaps, or on-relay leaderboards) be engineered to celebrate benefactors while safeguarding guest privacy (avoiding leaking personal travel histories, dates, or identities when broadcasting payment records)?
2. **Suggested Rates by Accommodation Value:** Should the suggested contribution rate be tiered based on property valuation (e.g., lower percentage or flat caps for budget stays vs. luxury villas) rather than uniform 2% and 1% multipliers?
3. **Phase 2 Transition Thresholds & Metrics:** What quantitative thresholds will govern the transition to Phase 2 (e.g., minimum number of live independent arbitrators, insurance reserve size in BTC, or voluntary contribution compliance rates in Phase 1)?
4. **Decentralized Governance & Plutocracy Risks:** How should voting mechanisms be structured to avoid plutocratic governance if contribution-weighted voting is revisited in the future?
5. **Incentive Structure: Retain % Ratio vs. Fixed Fee Per Service?** When advancing toward Phase 2 (Option B), should early host incentives and protocol fees remain proportional percentages (1% vs. 2% of room rate) or transition to fixed satoshi fees per service category (e.g., flat 500 sats for Proof-of-Stay attestation, flat 1,000 sats for Escrow arbitration insurance, with discounts/exemptions for early hosts)?
6. **Legal & Tax Advisory:** Transitioning from a fee model to a Value4Value voluntary contribution model requires independent professional legal review per jurisdiction; this RFC represents preliminary technical analysis and offers no legal conclusions.

## Proposed Maturity Tier

**Draft** (Phase 1 per Option C adopted; Phase 2 per Option B is the target direction, non-committed to specific timelines).

## Discussion

*(Recording the strategic decision of the Project Lead, October 2026).*
