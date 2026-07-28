# RFC-0002: Reputation-Based Fee Discount Curve

- **Status:** Draft (written retroactively)
- **Author:** Claude (AI) + project owner, community input needed
- **Related module:** `src/utils/dynamicFee.ts`

## Problem

The platform fee needs to decrease with real reputation (Proof-of-Stay) to reward good
behavior, but needs a floor so the mesh still has operating revenue. We need a concrete
formula for how fast it decreases — currently: `BASE=3%`, `MIN=0.5%`,
`discount = 40 × ln(1 + reputationScore)`. **All three numbers (3%, 0.5%, the coefficient
40) are default values chosen by one dev session, not based on real market data or
community discussion.**

## Alternatives considered

### Option A: Logarithmic curve (CURRENTLY IMPLEMENTED)
`discount = k × ln(1 + score)`, fast decrease at low reputation, slower at high reputation.
- Pros: the first badges carry a large discount value (encourages new users to actually
  transact), avoids unlimited accumulation creating an overly large permanent privilege.
- Cons: the coefficient `k=40` is an arbitrary number nobody has validated economically —
  it could be too generous (the mesh loses revenue) or too stingy (not enough incentive),
  depending on the real accumulation rate of user reputation, which we have no data on yet.

### Option B: Fixed tiering
E.g.: reputation 0-5 → 3%, 5-20 → 2%, 20-50 → 1%, 50+ → 0.5%.
- Pros: easy to understand, easy to explain to users ("hit milestone X, get discount Y"),
  each tier can be adjusted independently later via RFC without changing the whole formula.
- Cons: creates sudden jumps at tier boundaries (transaction N-1 vs N can differ
  significantly in fee despite nearly identical reputation) — feels unfair at the edges.

### Option C: Dynamically adjusted via governance (not a hardcoded constant)
`BASE`, `MIN`, `k` are voted on periodically by Protocol Governance
(`protocolGovernance.ts`, its own RFC if needed) instead of being hardcoded.
- Pros: the mesh can self-adjust if fund revenue is insufficient or growth is slower than
  expected — true to the "build together, fix together" spirit instead of freezing a
  number forever.
- Cons: more complex to implement (needs a mechanism to actually apply a vote result into
  running code — there's currently no "on-chain parameter" concept, every parameter is a
  compile-time constant).

## Proposal

Keep Option A (already implemented) at Experimental tier. Proposal: after real data on
reputation accumulation rate exists (needs a few months of real operation), write a
follow-up RFC to either (1) tune the coefficient based on data, or (2) move to Option C
if the community prefers self-adjustment over waiting for a code change each time.

## Security / decentralization trade-offs

Lower risk than RFC-0001 (this isn't a fund-control parameter), but it's still an economic
decision directly affecting every transaction — belongs in an RFC rather than being
treated as an "implementation detail" not worth discussing.

## Proposed maturity tier after implementation

**Experimental** until at least one round of real data exists to re-evaluate the
coefficient.

## Discussion

(Open.)
