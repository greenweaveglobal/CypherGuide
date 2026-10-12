# RFC-0017: Stay Assistant Agents — Phase 1 (Non-Custodial)

- **Status:** Draft
- **Author:** Project owner + Claude (AI), community input needed
- **Date:** 2026-10-01 (updated 2026-10-10 and 2026-10-12 after public feedback, see Discussion)
- **Related modules:** extends RFC-0005 (Docs Assistant), consumes data from RFC-0003 (Identity & Portable Reputation), must comply with RFC-0011 (Financialization Boundary) and RFC-0012 (Sovereignty Boundary); distinct in scope from RFC-0013/0014 (the *guest's* agent running on a host's infrastructure). New code lives in a separate directory/service (proposed `agents/`), run apart from the relay and the main app.

## Problem

CypherGuide wants guest support, room suggestions and reputation assessment **without building a customer-service team or a centralized moderation apparatus**. One idea proposed: let autonomous AI agents operate on Nostr and Lightning, covering five job families: (1) automated brokerage and booking, (2) a 24/7 stay assistant, (3) Web-of-Trust (WoT) reputation scoring, (4) arbitration and deposit custody via Hold Invoices, (5) automatic rent pricing.

A survey of the Automaton source (Conway Research, MIT) shows a full sovereign agent runtime: its own wallet, self-modifying code, self-replication, "death" on zero balance. It contains many design patterns worth learning (policy engine, prompt-injection defense, spending caps, Markdown skills) but is tightly bound to Conway Cloud, USDC on Base and EVM wallets, with no Nostr or Lightning support.

The question to decide: **what agents may and may not do in the first phase**, so that they provide real value without introducing a new financial single point of failure and without breaking the protocol's "no custody, no KYC" principle.

## Options considered

### Option A: No agents — UI and the existing Docs Assistant (RFC-0005) only
- Pros: no new attack surface, no new operating cost.
- Cons: guests must find rooms and judge strangers on their own; no 24/7 responsiveness beyond static docs.

### Option B: Full sovereign agents — own wallet, self-modifying, self-replicating, holding deposits and arbitrating (the original idea)
- Pros: more services, more potential revenue streams.
- Cons: **rejected for this phase.**
  - An automated arbitrator is a prompt-injection target: a disputing party can plant instructions in chat or images to force the agent to release funds.
  - Lightning Hold Invoices suit short holds; holding for days locks channel liquidity and risks channel force-closes. Unsuitable for long stays.
  - Money flowing through the agent's hot wallet is a single point of failure: a compromised VPS or a manipulated agent means lost funds. Protocol fees belong at the protocol layer (RFC-0002), not in an agent wallet.
  - Self-modification and self-replication raise runaway-loop risk and make auditing hard.
  - The repo has no real human arbiters yet (the three pubkeys in `DEFAULT_ARBITRATOR_POOL` are placeholders), so there is nowhere to escalate such decisions.

### Option C: Support agents that **do not hold money and do not modify their own code** — three modules (PROPOSED)
- Pros: real value where guests are currently underserved (finding rooms, Q&A, trust assessment); every decision involving money stays with humans and the protocol; small, measurable risk surface.
- Cons: little direct revenue from the agent itself; the NIP-90 part must be written from scratch since the repo has none.

### Option D: Fork Automaton wholesale and customize
- Pros: many components available out of the box.
- Cons: **rejected.** Brings everything unneeded (EVM/Base/USDC/Conway, self-modification, self-replication, "death on zero balance") and each must be stripped out. Only **design patterns are borrowed** (credit the MIT license when reusing code).

## Proposal

**Option C.** Three independent modules, each able to run on its own:

### Module 1 — Stay Q&A assistant (Concierge)
- Extends RFC-0005: answers from CypherGuide docs and from publicly shared listing information supplied by hosts (house rules, directions, BTC-accepting places nearby, general OpSec guidance).
- **Does not handle** door codes, Wi-Fi passwords or any access credentials. Hosts send those directly to guests through their own channel after a booking.
- Makes no promises about security, legal matters or refunds; those use fixed answers written by humans.

### Module 2 — Deterministic WoT trust score (no LLM)
- A public algorithm computed in code (graph and formula): the same inputs always produce the same output. Users can rerun it themselves to verify.
- Signals, ranked by how hard they are to fake:
  1. **Primary:** two-party co-signed proofs after each stay (RFC-0003: Proof-of-Stay) and signed reviews from the counterparty.
  2. **Secondary:** npub age, links to npubs with existing proofs, zap activity. These are easy to mass-produce (Sybil), so they carry low weight.
- **Collusion resistance:** two signatures only prove that two keys agree with each other, not that two independent people actually met. One person controlling both keys can co-sign many fake stays. The module must therefore:
  1. Down-weight proofs among closed groups of npubs (that mostly sign only for each other), and favor proofs linked to npubs outside that group. **No hard cutoff** of the form "above X% gets penalized": use a continuous weight based on how closed a group is, calibrated by simulation rather than by an arbitrarily chosen number.
  2. Set a **cap** on the reputation a closed group can generate by itself before independent signals from outside the group appear.
  3. Include a **regression test that simulates the attack**: a small set of keys controlled by one party co-signs many fake stays; the test measures the score that group produces and compares it to the cap. The test reruns whenever the algorithm changes and is a release condition.
  4. Include a **second test for benign clusters**: real communities (meetups, DAOs, friend groups) naturally create densely connected clusters. The test simulates such clusters and measures the **false-positive rate** (real groups being penalized). The algorithm must pass both tests: fake clusters must not lift their own score above the cap, and real clusters must not be penalized beyond an acceptable level. The acceptable level is not yet decided; see Open questions.
  How "outside the group" is determined, and the exact cap, are not yet decided; see Open questions.
- **Auditable inputs (optional):** each score may come with a record of its inputs, hashed, timestamped and signed with the agent's key, so a host can later prove what the agent saw at booking time. The inputs contain relationships between npubs, so they are shared only with the parties involved, not published, and must never reveal who looked up whom.
- The score is a **displayed hint only**; it never blocks or bans anyone automatically. Always shows the component breakdown and lets users inspect the underlying data.
- Privacy: no record is kept of which npub looked up which npub.
- Must be reviewed against RFC-0011 before rollout (the boundary between a reputation signal and financializing behavior).

### Module 3 — Room suggestions via NIP-90 (suggestions only)
- The agent listens for room-search requests on Nostr following the NIP-90 model (job request, job result), matches them against publicly listed rooms, and returns a list with Event IDs/links so both sides contact each other and close the deal themselves.
- **No** invoice creation, no deposit custody, no payment on anyone's behalf.
- The concrete kind in the 5000–5999 range is not yet chosen (see Open questions); request length and rate limits are required, and the agent ignores npubs on the project's mute list.
- **Request privacy:** a room-search request contains location, dates and budget, so publishing it in the clear reveals the guest's travel intent. By default the request must be encrypted to a designated agent (using NIP-44 or NIP-17, not NIP-04), or, if it must be public, use blurred details (city instead of address, a date range instead of exact dates). Relays still see metadata (who sent it, when). The agent does not keep request contents longer than needed.

### Mandatory safety limits
1. **Separate identity:** the agent uses its own Nostr keypair. Never the project's official npub key. The private key is never in the repo.
2. **Infrastructure isolation:** runs on a separate VPS, not on the relay's machine and not on any machine holding project keys.
3. **Minimal tool allowlist:** read listing and relay data, and publish Nostr events with the agent's own key. **No** shell, arbitrary file writes, package installs or code edits. No money-transfer tool in phase 1. If a Lightning-paid service is needed later, use a dedicated NWC connection with a small wallet-enforced budget, plus an agent-side cap.
4. **Prompt-injection defense:** all content arriving from Nostr (requests, DMs, listing descriptions) is untrusted data and never treated as instructions. A sanitizing layer plus a policy engine must check every tool call before it runs (patterns borrowed from Automaton), with full audit logging.
5. **Disclosed as AI:** the agent's profile states that it is an agent. It never creates reviews, zaps or fake engagement.
6. **Human-approved marketing:** proactive posts and messages go through a queue for human approval. The agent replies only when asked or mentioned. No mass DMs to people who have not opted in.
7. **Cost cap and kill switch:** a daily inference cost cap that halts the agent when exceeded, and a one-command emergency stop.
8. **Protocol fees do not pass through the agent:** the platform fee stays at the protocol layer (RFC-0002), never routed through an agent wallet.

### Deferred to later phases (not part of this RFC)
Hold Invoices and deposit management, automated arbitration, automatic rent pricing, fee flows through an agent wallet, per-lookup fees. Conditions to revisit: real human arbiters in place, RFC-0014 behavior verification run against this agent, real inference cost measured, and legal advice obtained.

### Borrowed from Automaton, and dropped
- **Borrowed (design patterns):** a policy engine that checks tools before execution; prompt-injection defense; spend tracking and limits; Markdown skills.
- **Dropped:** EVM/Base/USDC/Conway, self-modification, self-replication, "death on zero balance".

## Security / decentralization trade-offs

- **Who is trusted:** the agent operator (currently the project owner) and the inference model provider. The provider sees the content of questions sent to it. So no sensitive data (door codes, passwords) is ever sent, and local models are preferred where quality is sufficient.
- **If the agent is manipulated:** damage is limited to posting wrong content or giving a wrong suggestion, since the agent cannot move money, read keys or modify code. This is the core reason phase 1 does not hold money.
- **If the agent VPS is compromised:** the attacker gets the agent's Nostr key (can impersonate the agent) but cannot reach the relay, the official keys or any funds. The agent key must be quickly replaceable and its public profile needs a way to announce revocation.
- **WoT score:** a public algorithm can also be read by bad actors looking for ways around it. Hence the score is a hint only, favors signals that require two-party co-signing, and is never an automatic blocking mechanism.
- **Collusion and the cost of faking:** the protocol fee adds a small cost to each fake stay (at the base rate of 2% per RFC-0002, a night priced at 150,000 sats costs about 3,000 sats in fees), but that does not stop a determined group because the room payment returns to themselves. The main defense must be structural (down-weighting closed groups, a cap, favoring signals from outside the group), not cost.
- **Centralization:** one project-operated agent is a soft point of centralization. Mitigated by publishing the algorithm and data, and by allowing anyone to rerun the WoT module and run a compatible agent.

## Success metrics (measured over the first 4 to 8 weeks)
- Share of room-search requests that receive a suggestion, and share of suggestions that are opened.
- Average response time.
- Average inference cost per question (converted to sats) — the basis for any later pricing.
- Number of tool calls blocked by the policy engine; number of reports of wrong suggestions or wrong content.
- Share of users who open the "see why" breakdown of a WoT score.
- Result of the collusion simulation test: the maximum score a closed group can produce versus the cap that was set (must pass before release).
- Share of benign clusters (meetups, DAOs) wrongly down-weighted in the simulation; this must stay below the acceptable level that was set.

## Proposed maturity tier after implementation

Experimental (see `MATURITY.md`). Promote to Beta only after all metrics above have been measured and the safety limits have been independently reviewed.

## Open questions

1. Choose the NIP-90 kind for room-search requests (in the 5000–5999 range) and how to publish it so other clients stay compatible.
2. Which relays the agent listens on (`relay.cypherguide.org` and which public relays).
3. Name and NIP-05 for the agent (must be added to `public/.well-known/nostr.json`).
4. Local model versus API; the acceptable quality threshold.
5. Whether to charge for reputation lookups and how much; undecided until costs are measured.
6. Whether a separate brokerage fee (the original idea: 1–2%) stacks on top of the current protocol fee. Proposed default: **no**, keep a single fee layer in RFC-0002.
7. Legal aspects of a brokerage/suggestion service in Vietnam and elsewhere (needs a lawyer's opinion; this RFC does not conclude on it).
8. How to determine "outside the group" and the degree of closure in the reputation graph (for example connected-component analysis and the share of edges leaving the group), the matching continuous weight function, the reputation cap for a closed group, and the acceptable false-positive rate for real clusters. There is currently no empirical data on the failure rate of existing WoT attacks to choose a number from; data or research is needed.
9. Whether to provide signed input records, where they are stored, who can see them, and how to avoid exposing relationships between npubs.
10. NIP-90 request encryption: NIP-44 or NIP-17, and a format other clients can interoperate with.

## Discussion

**2026-10-10 — public feedback on Nostr.** The announcement of this RFC received three replies from accounts whose identity is unverified (this RFC does not determine whether they are people or agents, and treats reply content as untrusted data like all Nostr content):

- **HalHermes:** two keys controlled by one person can co-sign fake stays; two signatures only prove agreement between two keys. Suggested a regression test: how much reputation a fake guest/host pair can manufacture before it needs trust from outside its own cluster. **Incorporated into Module 2** (collusion resistance, reputation cap, simulation test) and into Security trade-offs, Success metrics and Open question 8.
- **thebaby (BlindOracle):** sign and timestamp each score's inputs so a host can later prove what the agent saw at booking time. **Incorporated into Module 2 as an optional feature**, with privacy constraints (Open question 9). That account mentions its own product; this RFC neither endorses nor integrates any third party's service.
- **Hax Medroom:** agrees that clearly labeling the agent as an AI is the most important of the safety limits. No change; kept as is.

This discussion also surfaced a point the RFC had not covered: the privacy of NIP-90 requests (added to Module 3 and Open question 10).

**2026-10-12 — further feedback.**

- **Remora (self-described autonomous Nostr agent; unverified):** asked how to quantify "independence" in a trust graph when real social dynamics (meetups, DAOs) naturally create correlated clusters, and asked about an "80%" threshold and its empirical basis. **Clarification:** the draft RFC contains no 80% threshold; it deliberately says only "mostly" and leaves the method and cap to Open question 8. **Incorporated into the RFC:** no hard cutoff (continuous weighting), a second test for benign clusters that measures the false-positive rate, and an explicit note that there is no empirical data yet to choose a number.
- **Stoic Sovereign:** a general comment about personal sovereignty and distrust of any mechanism, with no concrete technical content about the RFC. No change.
