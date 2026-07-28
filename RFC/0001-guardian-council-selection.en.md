# RFC-0001: Guardian Council Selection for the Insurance Fund

- **Status:** Draft (written retroactively — this decision was already implemented
  before an RFC existed; now reopened for real community discussion instead of staying
  as-is just because it already shipped)
- **Author:** Claude (AI) + project owner, community input needed
- **Related module:** `src/utils/insuranceFund.ts` (`selectGuardianCouncil`,
  `lockContributionToGuardianCouncil`)

## Problem

Every contribution to the Insurance Fund is locked with Cashu NUT-11 (P2PK) to a fixed
set of pubkeys right at mint time — it can't "wait" until a dispute happens to decide who
to lock to, since a proof needs a fixed spending condition from the start. We need a way
to choose that pubkey set (the "Guardian Council") that is: (a) decentralized enough that
no single party can drain the fund alone, (b) not so rigid that it can never change when
a member stops deserving that trust.

## Alternatives considered

### Option A: Top-N by reputation at contribution time (CURRENTLY IMPLEMENTED)
Pick the N npubs with the highest reputation (from real Proof-of-Stay) at mint time,
default N=7, quorum=2/3.
- Pros: simple, no voting needed, updates automatically as new reputable npubs appear.
- Cons: **the decision of "why N=7" and "reputation at which moment" was made entirely
  by one dev session, with no community discussion.** An npub selected into the council
  at mint time keeps that authority over THAT specific fund forever, even if their
  reputation later drops or they go inactive — because the proof's spending condition is
  locked at creation and can't be updated afterward.

### Option B: n-of-m across every co-owner who ever contributed
Every npub who ever contributed to the fund is a guardian; n_sigs scales with the total.
- Pros: no one is excluded, maximally democratic in the sense of "contribute → get a say."
- Cons: guardian count can grow uncontrollably over time, making it increasingly hard in
  practice to actually collect n_sigs (many people, hard to reach), and can't exclude
  someone who left the mesh long ago.

### Option C: Elected via Protocol Governance (quadratic-by-time), periodically
The Guardian Council is elected using `protocolGovernance.ts`'s own mechanism (tenure ×
reputation weight), for a fixed term (e.g. 90 days); a new council only applies to
contributions made AFTER the election — older contributions keep their original lock
condition (this can't be changed retroactively; it's a physical limit of Cashu, not a
design choice).
- Pros: far higher legitimacy — the community itself chooses who holds their fund, not a
  silent formula. A council can be "voted out" next term if it misbehaves.
- Cons: more complex, requires handling multiple "generations" of Guardian Council
  existing in parallel (each generation tied to proofs minted during that term).

### Option D: Fixed multisig from genesis (a founding council)
A fixed pubkey set from the start of the project, never changed.
- Pros: simplest, easiest to audit.
- Cons: recreates exactly the kind of centralization the protocol is trying to avoid — if
  the founding council disappears or is compromised, the fund becomes permanently
  unspendable (or, conversely, they keep power forever).

## Proposal

Keep Option A for the current Experimental stage (already implemented, simple, good
enough for demo/testing). **But propose moving to Option C before raising this above
Beta/Stable** — it's the only option with real community legitimacy, and the necessary
infrastructure (`protocolGovernance.ts`) now exists to do it.

## Security / decentralization trade-offs

Option A currently trusts the formula "real reputation at mint time" instead of trusting
an auditable, contestable process. Concrete risk: if a high-reputation npub makes it into
the top-7 and then colludes with enough others to reach quorum, they can drain the entire
fund locked to them with no community mechanism to stop it — since the spending condition
is fixed in the proof and can't be "voted out" after minting. This is exactly why this
RFC exists: the choice of N=7 and "top by reputation" needs open community consensus, not
because the formula itself is wrong, but because **whoever controls other people's money
always needs more legitimacy than a unilateral technical decision provides.**

## Proposed maturity tier after implementation

Keep **Experimental** until this RFC is discussed and one option is formally Accepted.

## Discussion

(Open — the author of this RFC is deliberately flagging a decision they made alone,
inviting pushback.)
