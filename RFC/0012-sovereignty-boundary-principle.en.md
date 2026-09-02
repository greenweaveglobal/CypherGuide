# RFC-0012: Sovereignty Boundary Principle

- **Status:** Draft — like RFC-0003 and RFC-0011, this is a **cross-cutting foundational document**, not tied to a specific code module, defining clearly **what the protocol CAN decentralize, and what it CANNOT, no matter how well it's designed.**
- **Author:** Project owner + Claude (AI), community input needed
- **Related modules:** none specific — applies as a reasoning constraint to all future host/guest-related RFCs (especially RFC-0001, 0003, 0006, 0008), and grounds the public Nostr discussion already opened about host legal reality.

## Problem

Digging into the question "can a host actually handle receiving Lightning from guests, given each country's tax and residency law" — researched findings (specifically for Vietnam, Decree 282/2025/NĐ-CP) reveal an important truth: **Lightning payment does not exempt a host from any legal obligation** — declaring a foreign guest's temporary residence within 12-24 hours, registering a household business past a revenue threshold, security/fire-safety permits if operating as a commercial lodging establishment — all of these obligations are **entirely independent of the payment method**.

This isn't a Vietnam-specific problem. It's a structural limit: **decentralizing payment does nothing to decentralize a country's legal sovereignty over its own territory.** A host anywhere remains fully subject to their local law — no protocol, however cleverly designed, changes that.

The specific problem to solve: **none of the existing 11 RFCs has ever stated this boundary explicitly.** Without an explicit definition, there are two opposing risks:
1. Users/hosts might mistakenly believe using Lightning/Cashu makes them "invisible" to the law — leading to real violations, real fines (such as the 3-5 million VND penalty in Vietnam), damaging trust for both the host and the project.
2. Conversely, the project could be tempted to "solve" this by building a centralized legal-compliance layer — which is exactly the path back to the centralized gatekeeper model CypherGuide exists to avoid.

## Options considered

### Option A: The protocol stays entirely silent on local law — no mention of host legal obligations in any documentation
- Pros: stays strictly "protocol neutral," doesn't position itself as legal counsel.
- Cons: **rejected** — this is exactly risk (1) above. Total silence is easily misread as tacit confirmation that "you don't need to worry about the law" — genuinely dangerous for new hosts, especially first-timers with no lodging-operations experience.

### Option B: Build a formal legal-compliance layer — CypherGuide verifies/attests that a host has complied with each country's laws before allowing a listing
- Pros: best guest protection, lowest legal risk across the ecosystem.
- Cons: **rejected outright** — no team, however large, can keep up with every country's residency/tax law at every point in time (laws change constantly — Decree 282/2025 itself only took effect Dec 15, 2025, replacing the earlier Decree 144/2021). Building a "compliance verification" layer turns CypherGuide into an intermediary bearing legal liability — exactly the "Financial Intermediary" position the earlier Swiss legal-entity discussion (Foundation/GmbH) warned against, now extended to a similar risk on the lodging/tax side.

### Option C: A community-contributed reference document, explicitly labeled non-authoritative, kept entirely separate from the protocol — following the same "Application Neutrality" model as RFC-0006 (PROPOSED)
- Pros: honestly warns hosts without turning CypherGuide into a legally liable party. Leverages the actual decentralization advantage: hosts in each country understand their own country's law better than any central team could.
- Cons: information quality depends on who contributes — needs a mechanism to record source and update date, to avoid stale or wrong information spreading as fact.

## Proposal

**Option C**, with a clear boundary that needs to be embedded into every related document:

### Core principle: the sovereignty boundary table

| Can be decentralized (in protocol scope) | Cannot be decentralized (national sovereignty) |
|---|---|
| Payment (Lightning/Cashu — RFC-0001, 0002) | Residency/guest declaration obligations |
| Identity (Nostr npub — RFC-0003) | Income tax by country of residence |
| Reputation (portable reputation — RFC-0003) | Lodging business/security/fire-safety permits |
| Optional attestation (opt-in KYC — RFC-0006) | The local government's enforcement/penalty authority |
| AI inference (theoretically, RFC-0009) | The physical presence of a person on that territory |

The root reason for this boundary: the left column is **information/value moving over a network**, requiring no central authority to confirm it. The right column is tied to **actual physical presence** and a **state's monopoly on enforcement within its own territory** — two things no protocol, however cleverly designed, can encode away or replace.

### Concrete next steps

1. **Create a separate "Host Legal Reality" document** (not an RFC, not numbered, placed outside the `RFC/` folder to avoid being mistaken for protocol standard) — a community-contributed compilation by country, each entry recording **who contributed it, when, and framed as "here's what I was told applies where I am," not official legal advice**.
2. **Add a short warning to the host registration flow** (`HostRegistrationModal.tsx`) — not blocking registration, just a line: *"Paying through the protocol does not change your residency-declaration or tax obligations in the country you operate in. Please check your local law yourself."*
3. **Do not build any "legal compliance verification" feature** in the product — following the Option B rejection above, keeping the responsibility boundary clear.

## Security / decentralization trade-offs

- **This is the first RFC that defines CypherGuide's own limits**, rather than expanding its capabilities — a deliberate form of humility. The risk of skipping this RFC: the project could inadvertently let hosts believe "decentralized" means "invisible to the law," leading to real legal consequences for hosts and damaging the community's earned trust.
- **The community-contributed "Legal Reality" document carries a risk of wrong/stale information** — mitigated by recording source and date, and always framing it as "shared experience," not "official legal advice" (the same framing RFC-0005 already uses for the Docs Assistant: answers only from RFCs, not an official spokesperson).
- **Does not position CypherGuide as legally liable on a host's behalf** — consistent with the boundary already established in the Swiss legal-entity discussion: the protocol (CC0/open) stays separate from any commercial entity, and now stays even more clearly separate from each individual host's personal legal obligations.

## Proposed maturity tier

**Draft**, moving toward **Stable** like RFC-0003/0011 once at least 2-3 countries have real community-contributed entries in the "Host Legal Reality" document, confirming the community-contribution model actually works in practice.

## Discussion

(Open — a public discussion was already posted on Nostr before this RFC was written, raising exactly this question: should CypherGuide build a community-contributed per-country legal reference, or should it stay entirely silent and let RFC-0012 only define the boundary without building anything further? More input is needed from real hosts across multiple countries before deciding conclusively between Option A and C.)
