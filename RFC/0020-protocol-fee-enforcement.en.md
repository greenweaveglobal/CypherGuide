# RFC-0020: Protocol Fee Enforcement Mechanism

- **Status:** Draft
- **Author:** Project Lead + AI drafting assistant
- **Date:** 2026-10-16
- **Related Modules:** `src/utils/dynamicFee.ts`, `src/components/BookingModal.tsx`, `src/utils/depositEscrow.ts`, `src/utils/proofOfStay.ts`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`

## Problem

According to the comprehensive codebase audit in `docs/FEE_ENFORCEMENT_ANALYSIS.md`, there is currently **no cryptographic or consensus mechanism at the protocol layer that strictly enforces payment of Treasury fees**.

Under the current architecture (RFC-0016):
1. Protocol fee calculation (`protocolFeeSats`) is performed entirely client-side inside the guest's browser (`calculateDynamicFee`).
2. The payment flow splits settlement into two distinct Lightning invoices (Dual-Invoice Model):
   - Invoice 1 routes to the host's Lightning address.
   - Invoice 2 routes to the Infrastructure Treasury address.
3. A modified client or custom script can easily bypass the Treasury invoice (by setting `protocolFeeSats = 0` or omitting payment of Invoice 2) while paying 100% of the room rate to the host.
4. The host receives full payment directly into their personal wallet and accommodates the guest. The real-world booking succeeds, but the Infrastructure Treasury collects zero satoshis.

The root cause is that the current architecture operates under an "Honest Client Assumption." A realistic mechanism design aligned with Bitcoin, Lightning, and Nostr decentralization principles is required, rather than unenforced client-side mandates.

## Options Considered

This document presents 4 distinct architectural options for the Project Lead's strategic consideration. This RFC does NOT unilaterally select an option; the decision rests exclusively with the Project Lead.

---

### Option A: Merged Single Invoice Bound to Escrow Proof-of-Fee Lock

- **Mechanism:**
  - The guest pays a single aggregated invoice (room rate + security deposit).
  - The refundable deposit (managed via Cashu NUT-11 Multisig or HTLC timelock) carries an extended unlock condition: The deposit is only released back to the guest (or host) upon providing a valid Lightning preimage proving the Treasury fee invoice was settled (`verifyLightningPreimage(treasuryPreimage, treasuryPaymentHash)`).
- **Pros:**
  - Leverages existing escrow infrastructure from RFC-0003 and RFC-0008.
  - Enforces a cryptographic condition: Without fee settlement preimages, the escrow contract cannot unlock.
- **Cons & Critical Loophole:**
  - **Guest-Host Collusion:** If the host and guest collude off-band or agree to book without a deposit, neither party engages the escrow contract and the Treasury fee is entirely evaded.
  - **Direct Room Payments:** Because room funds route P2P directly to the host's wallet, the protocol cannot seize or freeze room revenue once paid.
  - Adds user friction to ordinary deposit refund workflows.

---

### Option B: Fee as Service Price, Not Transaction Tax

- **Mechanism:**
  - Abandon the paradigm of treating protocol fees as a compulsory "tax" on private P2P transactions (which is unenforceable in permissionless networks).
  - Instead, **the protocol fee is the price paid for cryptographic value-added services**:
    1. **BFT Escrow & Dispute Arbitration (RFC-0001):** Only bookings with settled Treasury contributions qualify for BFT Insurance Fund protection and dispute resolution by the Guardian Council.
    2. **Immutable Proof-of-Stay NFT Certification (RFC-0003):** Proof-of-Stay events are only counter-signed and attested by protocol relays upon presenting Treasury fee payment proofs. Without Proof-of-Stay, guests cannot build portable reputation or post immutable reviews on Nostr.
    3. **Listing Discovery & Priority Relay Ranking:** Hosts who consistently generate verified protocol fees receive priority indexing, boosted placement in client search results, and a "Verified Autonomous Stay" badge.
    4. **Reputation & Agent Audit Feeds:** Machine-readable audit feeds for autonomous booking agents.
- **Pros:**
  - Fully adheres to Cypherpunk philosophy: No coercive censorship; rather, real utility motivates voluntary payment.
  - Cheat-proof: Users who skip the fee simply forego attestation and arbitration services, while underlying P2P stays proceed unimpeded.
- **Cons:**
  - Low-value bookings or transient guests indifferent to portable reputation may bypass the fee. Treasury revenue correlates with demand for trust and attestation services.

---

### Option C: Voluntary Contribution with On-Chain Recognition

- **Mechanism:**
  - Protocol fees are structured as optional protocol contributions / Value4Value tips.
  - Every satoshi contributed to the Infrastructure Treasury is publicly acknowledged on Nostr relays via NIP-57 Zaps or NIP-58 Badges.
  - Features public benefactor leaderboards and governance signaling weight based on historical support.
- **Pros:**
  - Complete transparency with minimal regulatory risk regarding financial intermediary licensing.
  - Cleanest UX: Guests can choose to contribute 1%, 2%, or a custom amount.
- **Cons:**
  - Unpredictable revenue subject to the free-rider problem.
  - Inadequate for reliably funding dedicated relay infrastructure and ongoing development.

---

### Option D: Relay / Server-Enforced Validation

- **Mechanism:**
  - Employs gated validating relays or a CypherGuide validation server.
  - When a booking event (Kind 30078 or ephemeral event) is broadcast, validating relays connect to the Treasury Lightning node via webhook/gRPC to confirm the fee invoice is settled.
  - If unpaid, relays drop the event, preventing the booking from appearing on host or guest dashboards.
- **Pros:**
  - Near-absolute technical enforcement: Unpaid bookings are rejected by the network.
  - Does not rely on client software honesty.
- **Cons:**
  - **Centralization Compromise:** Introduces the validating relay/server as a centralized chokepoint. If the Treasury node fails, booking publication halts.
  - Antithetical to Nostr censorship resistance (users can route around validating relays).
  - Higher operational overhead and maintenance costs for validating infrastructure.

---

## Comparative Matrix

| Evaluation Criteria | Option A (Escrow Lock) | Option B (Service Utility) | Option C (Voluntary) | Option D (Relay Validator) |
|---|---|---|---|---|
| **Decentralization Degree** | High | Very High | Maximum | Medium to Low |
| **Technical Feasibility** | Medium (Collusion prone) | Very High (Immediate) | Very High | Medium (Dedicated nodes needed) |
| **Evasion Resistance** | Poor (Off-band collusion) | Inherent (No fee = No service) | None (Open by design) | Very High on primary relays |
| **User Experience (UX)** | Complex refund steps | Intuitive and value-driven | Simple and unforced | Dependent on relay availability |
| **Regulatory / Intermediary Risk** | Medium | Low (Software/data attestation) | Extremely Low | High (Transaction filtering/custody) |

## Security & Decentralization Trade-offs

- **Who is trusted:**
  - **Options A & B:** Trust in cryptographic contracts, Schnorr signatures, and rational economic incentives. No trusted intermediary.
  - **Option C:** Trust in community alignment and Value4Value ethos.
  - **Option D:** Must trust validating server/relay operators and the Treasury Lightning node.
- **Failure mode if trusted party misbehaves:**
  - Under Option D, a compromised validator could censor legitimate user bookings. Under Option B, users retain unconstrained sovereignty over direct P2P payments; only enhanced attestations require fee contributions.

## Success Metrics

Should a strategy be adopted, the following metrics will track performance:
1. **Fee Compliance Rate:** Ratio of fee-contributing bookings against total discovered bookings.
2. **Treasury Sustainability:** Stable revenue covering community relay operations and developer bounties.
3. **Proof-of-Stay Conversion:** Percentage of guests choosing to secure verified Proof-of-Stay credentials.

## Open Questions for Project Lead Decision

1. **Fee Rates Across Options:** Should the 2.0% base and 1.0% early host rates from RFC-0002 remain, or transition to fixed per-service tiers (e.g., 500 sats for Proof-of-Stay attestation, 1,000 sats for BFT dispute coverage)?
2. **Impact on RFC-0002:** Does adopting Option B or C require amending RFC-0002 to redefine dynamic fee semantics?
3. **Legal & Tax Advisory:** Directly taxing private transactions risks classification as an unlicensed money transmitter or marketplace in certain jurisdictions. Software attestation sales (Option B) or Value4Value donations (Option C) offer significantly safer legal boundaries. Expert legal counsel is strongly recommended.

## Proposed Maturity Tier

**Draft** (Strategic architectural proposal; no code modifications will occur until formal written approval from the Project Lead).

## Discussion

*(Awaiting decision and direction from the Project Lead).*
