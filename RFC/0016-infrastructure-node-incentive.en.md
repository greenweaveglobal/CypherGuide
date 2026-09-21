# RFC-0016: Infrastructure Node Incentive (Proof-of-Relay + Lightning Payout Flow)

- **Status:** Draft
- **Author:** (fill in npub/name)
- **Date:** 2026-09-21
- **Related modules:** `src/utils/infraContribution.ts`, `src/store/useAppStore.ts`, `src/components/MeshNeighborhood.tsx`

## Problem

The current "Infrastructure Node Incentives Program" (`claimNodeIncentive`) is a pure simulation:

- The node list (`nodeIncentives`) is hardcoded in the store and has no link to the actual relay list (`relays`) that an operator adds themselves in the Mesh tab.
- Uptime/packets-routed figures are fixed constants, not measured from real activity.
- `claimNodeIncentive()` generates a fake `mockTxHash` and never calls a real Lightning invoice, NWC, or LNURL flow — it always resolves `success: true`.

This is sufficient for demo/pitch purposes, but unusable for real relay/mesh infrastructure (e.g. an independent operator who just stood up `relay.cypherguide.org`). We need a real mechanism that solves two distinct problems:

1. **The oracle problem (fraud-resistant measurement):** how do we know a node is *actually* online and routing traffic, without trusting the node itself to self-report — since the operator has a direct incentive to inflate numbers for a bigger reward.
2. **The Lightning liquidity/payout problem:** where the reward Sats actually come from, which channel they're paid through, and how to handle an underfunded treasury or a failed payment.

## Options considered

### Option A: Self-reported metrics (current state)
- Pros: simple, no extra infrastructure, easy to demo.
- Cons: zero fraud resistance — the node operator can report any number they like. Not viable for production.

### Option B: Bitcoin-style Proof-of-Work mining
Considered because the user asked whether a Bitcoin/Sats mining-style algorithm would fit.
- Pros: a battle-tested mechanism, strong Sybil resistance through computational cost.
- Cons: **wrong problem fit.** PoW rewards burning meaningless computation (solving a random hash) to secure a single shared global ledger — it verifies nothing about whether a node is *actually relaying messages* or maintaining real uptime. A node could "mine" heavily while never having routed a single packet. Applying PoW here would reward the wrong behavior (burning electricity) instead of the behavior we actually want to incentivize (serving the network). Rejected.

### Option C: Witness Network / Proof-of-Coverage (Helium-style)
- Mechanism: other nodes in the network (or a separate independent witness set) periodically send a random challenge (nonce) to the node being verified, measure response time, and sign an attestation. A quorum of independent witnesses is required for validity, preventing a single colluding witness from vouching falsely.
- Pros: a mechanism proven at scale (Helium), a better conceptual fit for "prove real infrastructure service" than PoW.
- Cons: requires a sufficiently large, sufficiently independent witness pool — in a small network (CypherGuide's early stage) collusion risk is high when N is small.

### Option D: Crowdsourced Client Attestation (Proof-of-Usage)
- Mechanism: real users' own CypherGuide client apps (when they book, message, etc.) anonymously log which relay they actually connected to, latency, and success/failure — aggregated periodically (no single report is trusted; noise is filtered by volume).
- Pros: harder to game than self-reporting since it comes from many independent clients not controlled by the node operator; measures the right thing (whether the relay is actually useful to real users, not just "still alive").
- Cons: early on, with few real users, data is sparse and noisy; needs a mechanism to prevent one person spinning up many fake clients (client-side Sybil risk).

## Proposal

Combine **C + D** in stages, rather than committing to one fixed model from day one:

- **Experimental stage (small network):** use D (Proof-of-Usage) as the primary signal — the witness network (C) isn't yet large enough to resist collusion. Client apps log real interactions with relays and submit reports signed with the user's Nostr key (to prevent source spoofing), aggregated over a time window (e.g. 24h).
- **Once the network is large enough (>N independent verified nodes):** add C (witness challenges) as a cross-verification layer, reducing full reliance on D.
- Drop Option B (PoW) entirely — wrong fit for the reasons above; if the "mining" framing is useful at all, it should stay a marketing metaphor, not the actual technical mechanism.
- Keep the spirit of the current reward formula (`base rate from messages routed + bandwidth + uptime bonus`), but feed it from D/C instead of hardcoded numbers.

### Lightning payout flow

This is the user's second question — **this is not "mining new Sats"** the way Bitcoin issues new supply via block reward. Here, reward Sats must come from **an existing funded treasury** — this is a *redistribution* problem, not a *new issuance* problem:

- **Funding source:** route a % of booking transaction fees (see the existing RFC-0002 Dynamic Fee Curve) into a dedicated infra-rewards treasury Lightning address/node — separate from the current dev-donation wallet.
- **Payout mechanism:** on a valid claim (meeting the C/D conditions above), call a real LNURL-pay or NWC `pay_invoice` to the `nodeOperatorLnAddress`, with retry/backoff on invoice failure or expiry.
- **Mandatory circuit breaker:** if treasury balance falls below a safe threshold, disable the Claim button and show an "insufficient treasury" state — `claimNodeIncentive` must NOT return a fake `success: true` when the payout hasn't actually happened (unlike the current simulated code).
- **Batch payouts** (bundling many small claims into a single periodic payout, e.g. daily) should be considered over paying each claim instantly, to reduce LN routing fees as the node network grows.

## Security / decentralization trade-offs

- **Who is trusted, and how much:** in the D stage (Proof-of-Usage), the system trusts the *aggregate of many real clients* rather than the node operator — but a minimum threshold of independent client reports is required before a reward is computed; otherwise a single client (even one controlled by the operator) could still push a fraudulent report through.
- **Sybil risk in witnesses (stage C):** if the witness pool is too small, the operator could stand up multiple fake witnesses to self-attest. Witnesses should be required to have a minimum reputation/history (tying into RFC-0003 Identity Portable Reputation) before being counted in a quorum.
- **Treasury risk:** whoever holds the treasury wallet's keys directly decides who gets paid — this needs explicit clarification on whether it's multisig or a single key, plus a mechanism for publicly auditing balance/payout history (ideally as Nostr events, consistent with the protocol's "no centralized storage" principle).

## Proposed maturity tier after implementation

Experimental — needs testing with a small real node network before graduating to Beta, especially to validate D's fraud resistance before scaling up.

## Discussion

(Left empty at creation — update as community feedback comes in.)
