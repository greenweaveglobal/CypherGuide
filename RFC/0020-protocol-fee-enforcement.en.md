# RFC-0020: Protocol Fee Enforcement Mechanism

- **Status:** Draft
- **Author:** Project Lead + AI drafting assistant
- **Date:** 2026-10-16 (Standardization update: 2026-10-16)
- **Related Modules:** `src/utils/dynamicFee.ts`, `src/components/BookingModal.tsx`, `src/utils/depositEscrow.ts`, `src/utils/proofOfStay.ts`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`

## Problem

According to the comprehensive codebase audit in `docs/FEE_ENFORCEMENT_ANALYSIS.md`, currently **no cryptographic mechanism exists at the protocol level to enforce Treasury fee settlement**.

Under the current architecture (RFC-0016):
1. Protocol fee calculation (`protocolFeeSats`) is executed exclusively on the guest's client side (`calculateDynamicFee`).
2. The protocol splits payments into two independent Lightning invoices (Dual-Invoice Model):
   - Invoice 1 routes to the Host's Lightning address.
   - Invoice 2 routes to the Infrastructure Reward Treasury address.
3. A modified client or custom script can effortlessly bypass the Treasury invoice (by setting `protocolFeeSats = 0` or simply omitting payment for Invoice 2) while settling the Host invoice in full.
4. The host receives 100% of their accommodation rate directly in their personal wallet and accommodates the guest. The real-world booking succeeds, but the protocol Treasury receives zero sats.

The fundamental issue is that the current implementation relies on an "Honest Client Assumption". An effective mechanism design aligned with the decentralized nature of Bitcoin, Lightning, and Nostr is required, rather than unenforced cryptographic assumptions.

## Current Operating Reality

- In the current CypherGuide production deployment, the protocol operates on the Dual-Invoice Model. Settling the Treasury fee depends entirely on whether the user's client honestly executes the payment.
- In practice, the system functions under a **voluntary honest-client model** — functionally equivalent to **Option C** (voluntary contribution).
- When the Project Lead formalizes a strategic decision, UI labels (such as "Protocol Fee" in booking summaries) should be updated to reflect the true nature (e.g., "Protocol Contribution (Optional)" under Option C, or "Attestation Service Fee" under Option B) to maintain complete transparency with users. Interface label modifications are out of scope for this revision.

## Evaluated Options

This document outlines 4 distinct architectural options for consideration by the Project Lead. This document does NOT select an option on behalf of the Project Lead.

---

### Option A: Single Unified Invoice with Escrow Proof-of-Fee Lock

- **Mechanism:**
  - Guest pays a single combined invoice (room rate + refundable escrow security deposit).
  - The security deposit (Escrow via Cashu NUT-11 Multisig or HTLC) includes a programmatic spending condition: deposit release to the guest (or payout to host) requires presenting a valid payment preimage demonstrating Treasury fee settlement (`verifyLightningPreimage(treasuryPreimage, treasuryPaymentHash)`).
- **Advantages:**
  - Leverages existing escrow infrastructure from RFC-0003/RFC-0008.
  - Enforces cryptographic conditions: escrow funds cannot unlock without the fee settlement preimage.
- **Flaws & Critical Vulnerabilities:**
  - **Host & Guest Collusion:** If host and guest collude offline or agree on a "zero-deposit booking", neither party engages the escrow contract and zero fees reach the Treasury.
  - **Direct Room Rate Settlement:** Because accommodation payments route directly P2P from guest to host, the protocol cannot freeze or claw back funds once the host receives them.
  - Substantially increases UX complexity for routine deposit refunds.

---

### Option B: Fee as Service Price, Not Transaction Tax

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

### Option C: Voluntary Contribution with On-Chain Recognition

- **Mechanism:**
  - Protocol fees transition into voluntary donations / protocol tips.
  - Contributions to the Treasury are publicly broadcast across Nostr relays via NIP-57 (Zaps) or NIP-58 (Badges).
  - Provides a "Top Benefactors" leaderboard and assigns governance voting weight proportional to satoshis contributed.
- **Advantages:**
  - Maximally transparent and avoids classification under intermediary financial fee collection.
  - Simplest UX: Guests choose 1%, 2%, or custom tip amounts to support infrastructure maintainers.
- **Disadvantages:**
  - Unstable and potentially minimal revenue (subject to the free-rider problem).
  - Unpredictable budget for subsidizing community relay nodes and developer grants.

---

### Option D: Relay / Server-Enforced Validation

- **Mechanism:**
  - Employs gated validating relays or a centralized CypherGuide relay gateway.
  - When a booking event (Kind 30078 or ephemeral event) is broadcast, the validating relay verifies fee settlement directly with the Treasury Lightning node via webhook/gRPC.
  - Unpaid bookings are rejected by the relay, preventing them from appearing in host or guest calendars.
- **Advantages:**
  - Enforces near-absolute compliance on participating infrastructure: no fee equals no recognized booking.
  - Does not rely on client goodwill.
- **Disadvantages:**
  - **Decentralization Compromise:** Establishes the relay/server as a centralized chokepoint. If the Treasury gateway goes offline, booking broadcasting halts network-wide.
  - Contradicts Nostr anti-censorship tenets (clients can switch to ungated relays).
  - Significantly higher operating costs for validator nodes.

---

## Comparative Matrix

| Criteria | Option A (Escrow Lock) | Option B (Service Price) | Option C (Voluntary) | Option D (Relay Validator) |
|---|---|---|---|---|
| **Decentralization Level** | High | Very High | Maximum | Medium - Low |
| **Technical Feasibility** | Medium (Collusion vulnerability) | Dependent on 4 prerequisites (Currently not implemented) | Very High (Viable immediately) | Medium (Requires dedicated nodes) |
| **Evasion Resistance** | Poor (Offline collusion) | Natural (No fee = No service benefit) | Non-resistant (Fully open) | Very High on primary relays |
| **User Experience (UX)** | Complex (Multi-step deposit claim) | Seamless, transparent value | Clean and lightweight | Dependent on relay availability |
| **Preliminary Legal Assessment (Requires Expert Review)** | Moderate (Escrow custody questions) | Dependent on software/service licensing structure | Lowest intermediary brokerage exposure | Complex (Transaction censorship) |

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
- **Failure mode if trusted party misbehaves:**
  - Under Option D, a malicious or malfunctioning validating relay can censor legitimate bookings. Under Option B, basic P2P commerce remains sovereign and unhindered; only ancillary attestation benefits depend on fee contributions.

## Success Metrics

Should a strategy be adopted, the following metrics will evaluate efficacy:
1. **Fee Compliance Rate:** Ratio of fee-contributing bookings relative to total booking volume.
2. **Treasury Sustainability Inflow:** Sufficient satoshi volume to cover community relay subsidies and insurance reserves.
3. **Proof-of-Stay Conversion Rate:** Proportion of guests voluntarily paying for official cryptographic attestation.

## Suggested Roadmap (Reference Only, Awaiting Project Lead Decision)

The following sequence reflects the author's technical perspective for advisory purposes, not a pre-empted strategic decision:
1. **Options A and D are not recommended:**
   - *Option A* is trivial to circumvent whenever guest and host agree to book without escrow, while room payments route directly to the host unhindered.
   - *Option D* turns validating relays into centralized chokepoints, contravening Nostr's open anti-censorship philosophy.
2. **Phase 1 (Near-Term):** Adopt the approach of **Option C** (Voluntary contribution with on-chain recognition). This can be deployed immediately, honestly mirrors current technical reality, and avoids false claims of enforcement.
3. **Phase 2 (Long-Term):** Once the project establishes a genuine Arbitration Council (onboarding independent third parties with separate hardware keys), deploys secure BFT escrow custody, and develops compelling attestation services, transition toward **Option B** (pricing individual value-added services).

## Open Questions for Project Lead Determination

The author recommends resolving the following open architectural questions prior to final approval:
1. **Fee Schedule & Pricing Models:** Should the 2.0% (base) and 1.0% (incentive) rates from RFC-0002 be preserved, or should the protocol transition to percentage-based or flat service fees per service (e.g., 500 sats for Proof-of-Stay attestation, 1,000 sats for Escrow dispute arbitration), particularly for micro-rate bookings to prevent disproportionate fees?
2. **Significance of the 1% Early Host Discount Across Models:** What does the 1% Early Host incentive mean under each model? (e.g., In Option C, is it a suggested lower voluntary tip; in Option B, is it a discounted attestation fee?). This policy must be settled before enrolling production hosts.
3. **Impact on RFC-0002:** How should definitions and formulas within RFC-0002 be adjusted once a strategic fee mechanism is ratified?
4. **Legal & Tax Advisory:** Automated transaction fee collection may risk classification under payment intermediary or marketplace brokerage regulations depending on jurisdiction. Legal and tax impacts vary significantly across jurisdictions and require independent professional review; this RFC draws no legal conclusions.

## Proposed Maturity Tier

**Draft** (Architectural research specification; no code implementations shall proceed without formal written sign-off from the Project Lead).

## Discussion

*(Awaiting formal review and decision from Project Lead).*
