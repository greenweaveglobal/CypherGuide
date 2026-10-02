# RFC-0017: Stay Assistant Agents — Phase 1 (Non-Custodial)

- **Status:** Draft
- **Author:** Project owner + Claude (AI), community input needed
- **Date:** 2026-10-01
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
- The score is a **displayed hint only**; it never blocks or bans anyone automatically. Always shows the component breakdown and lets users inspect the underlying data.
- Privacy: no record is kept of which npub looked up which npub.
- Must be reviewed against RFC-0011 before rollout (the boundary between a reputation signal and financializing behavior).

### Module 3 — Room suggestions via NIP-90 (suggestions only)
- The agent listens for room-search requests on Nostr following the NIP-90 model (job request, job result), matches them against publicly listed rooms, and returns a list with Event IDs/links so both sides contact each other and close the deal themselves.
- **No** invoice creation, no deposit custody, no payment on anyone's behalf.
- The concrete kind in the 5000–5999 range is not yet chosen (see Open questions); request length and rate limits are required, and the agent ignores npubs on the project's mute list.

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
- **Centralization:** one project-operated agent is a soft point of centralization. Mitigated by publishing the algorithm and data, and by allowing anyone to rerun the WoT module and run a compatible agent.

## Success metrics (measured over the first 4 to 8 weeks)
- Share of room-search requests that receive a suggestion, and share of suggestions that are opened.
- Average response time.
- Average inference cost per question (converted to sats) — the basis for any later pricing.
- Number of tool calls blocked by the policy engine; number of reports of wrong suggestions or wrong content.
- Share of users who open the "see why" breakdown of a WoT score.

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

## Discussion

(Left empty on creation — update as community feedback arrives.)
