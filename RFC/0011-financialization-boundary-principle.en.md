# RFC-0011: Financialization Boundary Principle

- **Status:** Draft — like RFC-0003, this is a **cross-cutting foundational document**,
  not tied to any single code module, but a set of criteria every future RFC (and
  existing RFCs, retroactively) must run through before deciding whether a behavior
  should generate a proof / reputation score / fee effect.
- **Author:** Claude (AI) + project owner, community input needed
- **Related modules:** none specific — applies retroactively to
  `src/utils/insuranceFund.ts` (RFC-0001), `src/utils/dynamicFee.ts` (RFC-0002),
  `src/utils/proofOfStay.ts` (RFC-0003, RFC-0006), `ListingDetail.tsx` (RFC-0008),
  `StillnessRitual.tsx` (RFC-0010).

## Problem

Tracing through the existing RFCs reveals two opposing design trends running in
parallel, neither of which any RFC has named or explained the boundary between:

**Trend A — financializing/quantifying behavior:**
- RFC-0001: selects the Guardian Council based on quantified reputation from
  Proof-of-Stay.
- RFC-0002: platform fees decrease per a mathematical formula of accumulated
  reputation.
- RFC-0003: a portable reputation layer shared across every behavior in the ecosystem.
- RFC-0006: KYC attestation — another kind of proof added to the same identity layer.

**Trend B — deliberately refusing financialization:**
- RFC-0008: dana — intentionally no fixed price, no escrow, no payment proof.
- RFC-0010: the stillness ritual — intentionally excluded from the Proof-of-Stay
  model even though it's technically straightforward to apply, for clearly stated
  reasons: the behavior can't be honestly verified, and turning it into a proof
  contradicts the behavior's own purpose.

Neither trend is wrong — each RFC justifies itself reasonably within its own narrow
scope. But placed side by side, there's no shared principle that lets whoever writes
the next RFC answer: **"should the feature I'm about to propose follow Trend A or
Trend B?"** without re-litigating the question from scratch each time, based on
whatever that session's intuition happens to be. That's the real risk here — not that
the two trends conflict, but that **there's no objective criterion for classifying**
a new behavior, leaving the classification dependent on whoever happens to be writing
the RFC that day.

## Options considered

### Option A: Financialize everything — every behavior should generate a
  proof/score for consistency with RFC-0003
Extend Proof-of-Stay to also cover completed dana offerings, completed stillness
sessions, etc.
- Pros: total consistency, a single model for every behavior in the app.
- Cons: **rejected** — this is exactly what RFC-0010 already refused, for good
  reason (an inner state can't be honestly verified; it contradicts the very purpose
  of dana/meditation, which is letting go / non-attachment). Applying "consistency"
  mechanically here destroys the original meaning of those behaviors.

### Option B: De-financialize everything — remove quantified reputation from the
  Guardian Council/fees entirely, revert to manual selection or a flat fee
- Pros: settles the conflict by picking one side outright.
- Cons: **rejected** — the Guardian Council (RFC-0001) and reputation-based fees
  (RFC-0002) solve real operational problems (sybil resistance, decentralized
  selection of who custodies the insurance fund) with no better substitute than
  quantifying reputation from a verifiable physical event (an actual stay). Removing
  it reopens the exact problem RFC-0001 was written to solve.

### Option C: Define an objective checklist to classify each behavior — pick no
  single side, but explain WHY each side is correct for its own case (PROPOSED)
- Pros: preserves both existing trends without reversing any already-implemented RFC
  — it only needs to show they each pass/fail the criteria consistently. Gives future
  RFC authors a concrete tool to answer the question themselves, rather than deferring
  to anyone's "gut feeling."
- Cons: requires revisiting existing RFCs to apply the checklist, and the checklist
  may not cover every future edge case — it will need to be extended over time.

## Proposal

**Option C.** The following three tests — **all three must pass** — before a new
behavior is allowed to generate a proof, reputation score, or fee effect. Failing
even one test is sufficient to exclude it; it doesn't need to fail all three.

### 1. Verifiability test
Is the event an **objective external fact** that a third party (or the protocol
itself) can honestly confirm — as opposed to an **inner state** only the person
themselves knows?
- An actual stay occurred (RFC-0003) → **pass** (verifiable via location/time).
- A specific Lightning payment was made → **pass** (verifiable via invoice/preimage).
- "Thought of nothing for 369 seconds" (RFC-0010) → **fail** — no one, not even the
  protocol, can honestly confirm a state of mind.

### 2. Protocol-purpose test
Does quantifying this behavior serve **protocol integrity** (sybil resistance,
allocating custody authority, fee fairness) — or is it purely to
**reward/gamify** the user?
- Selecting the Guardian Council by reputation (RFC-0001) → **pass** (a mechanism is
  needed to decide who decentrally custodies the fund, with no other purpose).
- Fee discounts by reputation (RFC-0002) → **pass** (sybil resistance — a new account
  can't fake a real stay history to claim the discount).
- A "meditated 10 times" badge → **fail** — its only purpose is gamification, serving
  no protocol integrity function.

### 3. Original-meaning test
Does the behavior's own nature/tradition **define itself as non-transactional** — if
so, financializing it is a category error, not merely a debatable design choice.
- Booking a stay at a fixed price → **pass** (inherently transactional by nature).
- Dana (RFC-0008) → **fail** — by tradition, dana is defined by its voluntary,
  non-transactional nature; attaching escrow/pricing to it breaks its own definition.
- Meditation (RFC-0010) → **fail** — this behavior's traditional meaning is letting go
  (non-attachment); turning it into an achievement works directly against itself.

### Retroactive check against existing RFCs

| RFC | Test 1 | Test 2 | Test 3 | Conclusion |
|---|---|---|---|---|
| 0001 Guardian Council | Pass | Pass | Pass | Correctly financialized |
| 0002 Reputation-based fees | Pass | Pass | Pass | Correctly financialized |
| 0006 KYC attestation | Pass | Pass | Pass | Correctly financialized (opt-in) |
| 0008 Dana | — | — | Fail | Correctly refuses financialization |
| 0010 Stillness ritual | Fail | Fail | Fail | Correctly refuses financialization |

Result: **all 5 existing RFCs already land on the correct side of this checklist**,
even though none of them wrote the criteria out explicitly at the time. This
reinforces that this isn't a conflict needing a code fix, but **an unwritten
principle that was already implicitly guiding decisions** — RFC-0011 simply does the
work of naming it, so future RFCs don't have to "get lucky" guessing right.

### Follow-up work

Add a short reference line pointing to RFC-0011 at the top of RFC-0001/0002/0006/
0008/0010 (no content change, just a pointer) the next time a PR touches those files
— no need to do this immediately as part of this RFC.

## Security / decentralization trade-offs

- This RFC is about a **decision principle**, and doesn't itself change any
  code/attack surface — the only risk is if the checklist is misapplied or skipped in
  the future, letting a behavior that should belong to Trend B get pulled into Trend A
  (financial creep) — e.g. if someone later proposes "award reputation points for
  participating in a governance vote" without running Test 3 first.
- Conversely, the checklist also guards against the opposite drift: refusing
  financialization for things that genuinely need it for protocol-integrity reasons
  (e.g. if someone proposed removing reputation from the Guardian Council because "it
  feels like it should be more dana-like" — that would clearly fail Test 1/2; the
  checklist prevents misapplying the "anti-financialization spirit" where it doesn't
  belong).

## Proposed maturity tier

**Draft**, moving toward near-**Stable** like RFC-0003 (a foundational, rarely-changing
principle) once the community contributes more edge-case examples and at least 1-2
future RFCs have successfully applied the checklist in practice.

## Discussion

(Open — community input needed: should a fourth test be added for
**reversibility** — once a behavior has been financialized, un-financializing it
later is much harder than the reverse, so perhaps there should be a slight bias
toward "when in doubt, default to Trend B first, financialize later only if truly
necessary" rather than treating the two trends as equally weighted by default.)
