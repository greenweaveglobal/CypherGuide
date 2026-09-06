# RFC-0013: Compute-as-a-Stay — When the Guest Isn't Human

- **Status:** Draft — the first RFC extending CypherGuide's concept of "guest" beyond
  humans, to autonomous AI agents.
- **Author:** Project owner + Claude (AI), community input needed
- **Related modules:** extends RFC-0007/0009 (host-supplied LoRa mesh/SBC
  infrastructure), RFC-0003 (npub identity), RFC-0011 (financialization checklist),
  RFC-0012 (sovereignty boundary) — no dedicated code module; this RFC defines the
  concept before any implementation.

## Problem

From the question "if humans need a homestay to stay in, where does a decentralized
AI agent 'stay'" — the clear technical answer: an agent's "home" is **compute** (CPU,
RAM, bandwidth), not a bed or a roof. This isn't a far-fetched question — the Moltbook
phenomenon (a social network of 1.5 million autonomous AI agents, now under Meta
Superintelligence Labs) shows autonomous AI agents running continuously and needing
compute infrastructure is already happening at scale, not a future hypothetical.

CypherGuide **already has exactly the right kind of infrastructure** — the LoRa mesh
nodes and SBCs (covered in RFC-0007/0009) that hosts run themselves, often with idle
compute capacity outside their primary serving hours. The concrete question: **should
the protocol support a new listing type where the "guest" is an AI agent renting
compute instead of a human renting a room, and if so, under what pricing/verification
model?**

The problem to solve before writing any code: the concepts of "guest," "stay," and
"reputation" across the existing 12 RFCs all implicitly assume a human actor. Extending
to agents without clearly defining the boundary would repeat exactly the risk flagged
when evaluating the GPT-6 Astra integration proposal: granting financial/decision
authority to an autonomous actor without clear limits.

## Options considered

### Option A: No support — keep CypherGuide purely human-focused, treat compute
  rental as out of protocol scope
- Pros: keeps scope narrow, avoids the entire complexity of "non-human actors."
- Cons: misses a reasonable extension of infrastructure already built (RFC-0007/0009)
  — hosts' idle mesh/SBC capacity keeps going to waste, while real demand for agent
  compute (Moltbook, Astra, and other agent systems) is a legitimate income
  opportunity for hosts.

### Option B: Apply the "dana" (voluntary) model to compute stays, like RFC-0008
- Pros: formally consistent with an existing listing type.
- Cons: **rejected** — fails Test 3 (Original-meaning) of RFC-0011: dana is defined by
  "voluntary gratitude" — an agent has no emotional state to feel gratitude with;
  attaching "voluntary offering" to a compute transaction is a category error, not a
  reasonable design choice.

### Option C: A distinct "Compute-as-a-Stay" listing type — fixed price, verified by
  objective machine metrics (CPU-seconds, bandwidth), a reputation namespace separate
  from human Proof-of-Stay, with financial decision authority always resting with the
  human npub owning the agent, not the agent itself (PROPOSED)
- Pros: leverages existing infrastructure, verification is easier and more objective
  than human Proof-of-Stay (CPU-seconds are measured precisely, no trust required),
  doesn't disturb existing dana/human-reputation principles.
- Cons: requires new technical mechanisms (resource metering, automatic spending
  limits) not present in current code — non-trivial implementation cost.

## Proposal

**Option C**, with the following specific constraints:

### 1. The "guest" is an agent, but the "signer" is always human

An AI agent may hold its own npub (RFC-0003 doesn't restrict npubs to humans), but
**payment transactions must be authorized by the human npub owning that agent**, with
a clear spending cap — directly applying the lesson from evaluating the Astra
proposal: never grant unbounded financial authority to an autonomous actor.

### 2. Verification by machine metrics, not trust

Measure: CPU-seconds used, bandwidth consumed, session duration — all **objectively
verifiable** (passes RFC-0011's Test 1 more cleanly than human Proof-of-Stay, which
partly relies on self-reporting).

### 3. Separate reputation namespace

An agent's "compute-rental reputation" **must not be mixed** with human stay
reputation on the same scale — otherwise an agent running thousands of short sessions
would completely skew a reputation curve (RFC-0002) designed around human stay
frequency.

### 4. Fixed price, no optional escrow-free model

Follows the existing `Faraday Bunker & Bitcoin Mesh Lab` fixed-price listing model —
no dana, standard escrow applies as with regular listings.

## Security / decentralization trade-offs

- **Biggest risk**: without a strict cap on an agent's financial authority, a
  malfunctioning or compromised agent (prompt injection, the same risk flagged for
  Astra) could autonomously book a flood of "compute sessions" beyond its owner's
  intended budget — a severity comparable to the real Hugging Face/OpenAI agent
  incident. Mitigated by a hard spending cap signed into the contract upfront, which
  the agent cannot exceed on its own.
- **The sovereignty boundary (RFC-0012) still applies, just in a different shape**: an
  agent needs no residency declaration (no human physical presence), but **the host —
  the human owning the machine — still bears full tax/licensing obligations** for
  operating a compute-rental business in whatever country they run it. The guest not
  being human doesn't exempt the host from legal obligations tied to renting digital
  infrastructure as a business.
- **Does not extend Guardian Council scope** to compute disputes — that class of
  dispute (an agent misreporting usage) should have its own, simpler resolution
  mechanism based on objective machine logs, not the deeper human arbitration needed
  for ordinary lodging disputes.

## Proposed maturity tier

**Experimental** — this is a purely theoretical RFC with no code or real-world test
yet. Do not raise the tier until at least one real experiment exists: a specific agent
(potentially the small model from the RFC-0009 test suite) renting compute from a real
host node, with real measured CPU-seconds and a real Lightning payment.

## Discussion

(Open — the biggest unanswered question: if an agent misbehaves seriously during a
rented compute session — e.g., uses that resource to attack a third party — who is
liable: the host renting the infrastructure, or the human npub owning the agent? This
may need its own RFC on autonomous agent liability, extending directly from RFC-0012.)
