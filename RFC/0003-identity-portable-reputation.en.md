# RFC-0003: Identity & Portable Reputation

- **Status:** Draft — only the **core principles** below are treated as near-frozen from
  this Draft onward; every other schema detail (specific tags, the kind number, scoring
  formulas) stays open, only becoming "frozen"/Stable after going through all the stages
  under Lifecycle.
- **Related modules:** `src/utils/proofOfStay.ts`, `src/utils/insuranceFund.ts`
  (`computeReputationFromProofs`), and every future app (Learn/Build/Connect) that will
  read this same data.

## Problem

Cypher Guide isn't just a booking app — if the Learn/Build/Stay/Connect ecosystem takes
shape, all of them need to read the same Identity + Reputation layer. Today,
`proofOfStay.ts` defines one Nostr kind (30388) and a tag set exclusively for "has
stayed." If Build/Learn/Connect each later invent their own kind/tags, no app can read
another app's reputation — right back to the "locking users into one product" problem
this protocol is trying to avoid.

## Core principles (aim to reach consensus early, not waiting for all 5 stages)

This is the **only** part this RFC wants early agreement on — because it's a commitment
to users, not an implementation detail to be revisited later:

1. **Identity belongs to the user** — Nostr npub/nsec, no central account.
2. **Reputation is portable** — any app following this schema can read it, not locked to
   Cypher Guide alone.
3. **Reputation is non-transferable** — bound to the npub's own signature, cannot be
   bought/sold/gifted (unlike an NFT or a loyalty-point token).
4. **The schema is versioned** — every proof event carries a version tag, so adding a new
   field later never breaks old data.
5. **Each application interprets for itself** — there is no single "total reputation
   score" decided by the protocol; the protocol only emits raw signals, each app computes
   its own score for its own purpose (see Reputation Engine).
6. **Interpretation belongs to the application, not the protocol** — the protocol only
   states "this is a `proof_type=stay`," never "add 10 points" / "cut 5% off the fee" /
   "grants a 100-sat credit line." The economic/social meaning of a proof is Stay's job,
   or Connect's, or Learn's — each interpreting it differently is fine. This keeps the
   protocol from ever needing a change just because one app changes its business logic.
7. **Evolve by addition, not replacement** — add a new tag instead of changing what an
   old tag means; add `v=2` when extending instead of breaking `v=1`; keep the ability to
   read old data for as long as possible. This principle has already been applied in the
   very first implementation (a badge missing `proof_type` defaults to `"stay"` instead
   of being treated as invalid) — not just theory.

## Design (Draft — still changeable)

### 1. Identity
- npub as the primary identifier, authenticated via standard NIP-01 Schnorr signatures
  (already implemented, Stable).
- Profile (name, avatar...) is optional, never required to have reputation.

### 2. Proof Objects — generalizing from a per-feature `kind` to a shared `proof_type`

Instead of one Nostr kind per feature, use **one shared kind** for every "portable
contribution proof," distinguished by a `proof_type` tag:

```
kind: 30388   (keeping the current number for now — NOT yet frozen, see Lifecycle)
tags:
  ["d", "<unique_action_id>_<short_npub>"]
  ["proof_type", "stay" | "build" | "learn" | "connect" | ...]
  ["v", "1"]                      // schema version, mandatory from this point on
  ["subject_npub", "<npub>"]      // who is being credited (usually = signer's pubkey,
                                   // but kept separate to support third-party
                                   // attestation, e.g. a host confirming for a guest)
  ...tags specific to proof_type (Stay: listing/role/start/end/amount_sats — kept as
  already implemented; Build: repo/pr_id; Learn: guide_id; Connect: —)
content: human-readable description, machine readers are not required to parse content
```

Direct benefit: adding `proof_type: "build"` or `"learn"` later, any code reading the
shared kind keeps working — no app needs to know the full proof_type list in advance.
Doesn't stop at the initial 4 types: `mentor`, `speaker`, `organizer`, `contributor`,
`reviewer`, `merchant`... all work with this same schema without a new kind, as long as
they follow the 7 core principles above — that's the mark of a sufficiently general schema.

### 3. Reputation Engine — a raw signal source, not an absolute score

The protocol only guarantees: real, signature-verified proof events are readable, per
`proof_type`. There is **no** single `computeReputationScore()` applied to every app.
Each app decides its own weighting:

- Stay cares about: counting/time-decaying `proof_type=stay` (already implemented, see
  `computeReputationFromProofs` — needs fixing to filter exactly `proof_type=stay`,
  currently counts any proof regardless of type since only one type existed before).
- Build (future) cares about: counting `proof_type=build` with tag `pr_status=merged`.
- Learn (future) cares about: counting `proof_type=learn`.

## Lifecycle (Draft → 2 apps → community → Stable → Frozen)

1. **RFC-0003 Draft** (this document) — agree on the 7 core principles + draft schema.
2. **Implement in Stay** — update `proofOfStay.ts` to emit `proof_type: "stay"` + a `v`
   tag (implemented alongside this RFC).
3. **At least one other app reads it too** — Learn or Connect actually parsing Stay's
   proof events and vice versa (hasn't happened yet — the condition for the next stage).
4. **Real community adoption** — not just 2 internal apps reading each other, but users
   outside the project also creating/reading proof events per this schema.
5. **Stable, then Frozen** — once stages 3-4 prove the schema works at real scale, freeze
   the specific `kind` number and mandatory tags; version bumps after that require their
   own RFC, and can only add (principle 7), never change the meaning of a Frozen tag.

## Security / decentralization trade-offs

There's no central registry confirming which `proof_type` is "valid" — any app can invent
a new `proof_type` without asking permission, true to the permissionless spirit. Risk: two
independent projects could pick the same `proof_type` name with different semantics (e.g.
two apps both using `"build"` for two entirely different meanings). Mitigated by a
non-binding listing file (`RFC/proof-types.md`, created once a real second `proof_type`
exists) — for reference only, not an enforcement mechanism, true to principle 5 ("each
application interprets for itself").

## Protocol Guarantees

These are concrete commitments the protocol makes to **every** application reading this
schema — different from the 7 principles above (which are design philosophy), these are
things an app can *rely on* when coding, and things a future RFC must give a clear reason
for if it wants to break:

1. **Backward Compatibility** — a valid proof from an old version keeps being readable in
   newer versions, unless a later RFC states a clear reason it can no longer be maintained.
2. **Application Neutrality** — the protocol doesn't favor Stay over Learn or Build; every
   app shares the same data layer, there's no "primary app" and "secondary apps."
3. **User Ownership** — identity and proofs are bound to the user's Nostr key, never to a
   Cypher Guide server or account.
4. **Extensibility** — a new proof type is added by extending the schema (a new tag, a new
   `proof_type`, a new `v`), never by changing the meaning of existing data.

## Architecture Context: why this RFC is Layer 2

```
Layer 3 — Applications      Stay · Learn · Build · Connect
Layer 2 — Protocol          RFC-0003: Identity · Proof · Reputation
Layer 1 — Infrastructure    Nostr · Lightning · Cashu
```

RFC-0003 defines exactly Layer 2 — the one layer every Layer-3 app must agree on. Layer 3
can change frameworks (React → Flutter), change UI, split into a separate mobile app —
Layer 2 doesn't need to change along with it, as long as the Protocol Guarantees above
still hold. This is also why this RFC, more than any single code file, deserves to be
treated as the project's most important document once two or more apps depend on it: code
can be refactored, frameworks can be swapped, but breaking a commitment at Layer 2 breaks
compatibility for the whole ecosystem, not just one app.

## Maturity tier

This whole RFC: **Experimental** until stage 4 of the Lifecycle (real community adoption)
completes. No part of it gets labeled Stable before a second application exists and users
outside the project read the same schema.

## Discussion

(Open.)
