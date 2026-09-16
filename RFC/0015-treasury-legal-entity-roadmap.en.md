# RFC-0015: Treasury & Legal Entity Roadmap

- **Status:** Draft — a cross-cutting principle/roadmap document, not tied to a specific code module.
- **Authors:** Project owner + Claude (AI), community input welcome
- **Related modules:** none directly — shapes how community treasury (donations/grants) is governed across growth stages, inheriting the boundary defined in RFC-0012 and the Guardian Council mechanism from RFC-0001.

## Problem

CypherGuide currently receives donations through the founder's personal Lightning address. As the project grows (OpenSats grants, community donations), the question of "who controls the funds, who bears legal responsibility" becomes urgent — but the common instinct (rushing to form a full legal entity immediately) is impractical: a Swiss Foundation (Stiftung) requires roughly CHF 50,000 in initial capital (a supervisory-practice threshold, not a hard statutory figure) plus setup and operating fees — a first-year commitment of roughly CHF 70,000-75,000. This far exceeds the treasury scale of a project still in pilot stage with a handful of hosts.

Without a clear roadmap, the project faces two opposite risks:
1. Staying indefinitely on a "single personal wallet" model even once the treasury is large enough to warrant real community oversight — concentrating financial power in one individual, against the project's own ethos.
2. Rushing to form a Foundation while the treasury is still small — burning resources on legal infrastructure instead of protocol development, with costly restructuring if the scale was misjudged.

## Options considered

### Option A: Form a Foundation as soon as the first grant/donation arrives
- Rejected: not financially viable at the current stage; risks turning "fundraise to afford a Foundation" into the primary goal instead of protocol development.

### Option B: Never form a legal entity, stay on personal/informal multisig indefinitely
- Rejected once treasury grows large: cannot sign long-term contracts (VPS, services), cannot open a bank account for the fund, many large grant bodies require a receiving legal entity. Caps the project's growth ceiling.

### Option C: A 4-stage roadmap, each stage triggered by treasury conditions rather than fixed calendar dates (PROPOSED)
- Separates "transparent governance" (achievable immediately, cheap) from "full legal personhood" (only when actually needed).

## Proposal

**Option C**, structured as four condition-triggered stages — full stage descriptions (personal wallet → Guardian Council multisig → Swiss Verein → Swiss Foundation, each gated by a treasury threshold rather than a date) mirror the Vietnamese original above, along with the standing rule that no entity in this model may ever charge fees directly on P2P guest-host transactions, to avoid Swiss "Financial Intermediary" classification under AML law.

## Security / decentralization trade-offs

Early-stage centralization (personal wallet) is an acceptable, bounded risk given the treasury's small size at that point, resolved as soon as the first meaningful donation arrives by moving to Guardian Council multisig. Deferring legal-entity formation keeps faith with RFC-0012's boundary — not turning the project into a financial or legal intermediary before it's actually necessary.

## Proposed maturity tier

**Draft**, advancing to **Stable** once Stage 2 (Guardian Council multisig) is actually established and operating with a first real treasury balance.

## Discussion

(Open — this RFC asks the community directly: are the CHF 10,000-20,000 (Stage 3) and CHF 70,000-100,000 (Stage 4) thresholds reasonable, or should they be adjusted based on the real experience of other open-source/crypto projects that have gone through a similar path? Input from anyone with hands-on experience running a Swiss Verein or Foundation would be especially valuable.)
