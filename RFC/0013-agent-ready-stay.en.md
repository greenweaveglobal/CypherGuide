# RFC-0013: Agent-Ready Stay — An Amenity for the Cypher/Personal Business Crowd

- **Status:** Draft — **fully replaces** the earlier RFC-0013 draft ("Compute-as-a-
  Stay," which treated an AI agent as an independent guest type). After further
  discussion, that direction was dropped because it competed directly with mature
  decentralized compute marketplaces (Akash Network, io.net, Render) and broke the
  "guest is human" model running through all 12 prior RFCs. This version takes a
  different path: **the guest is always human**, the agent is just infrastructure they
  bring along.
- **Author:** Project owner + Claude (AI), community input needed
- **Related modules:** extends the existing amenity tag system (`LORA MESH NODE`,
  `SOLAR OFF-GRID`, `DIGITAL DETOX`, `VERIFIED_NODE` — seen on current demo listings),
  doesn't touch RFC-0003 (identity), creates no new reputation namespace.

## Problem

A growing number of digital nomads in the cypherpunk/freelancer space **travel with an
AI agent running continuously on their behalf** — coding agents, personal assistants,
market-tracking bots. Not hypothetical — the Moltbook phenomenon (1.5 million
autonomous agents, now under Meta Superintelligence Labs) shows this is already
mainstream. This guest segment needs more than a bed — they need **infrastructure
their agent can rely on** throughout the stay: a stable dedicated compute node, a
private Nostr relay (not routed through an unfamiliar third-party relay), a
guaranteed minimum bandwidth floor so the agent can run uninterrupted.

The specific problem: the current amenity tag system (`LORA MESH NODE`, `SOLAR
OFF-GRID`...) describes physical infrastructure well, but **has no standard for
"agent-ready"** — every host describes it however they like, and guests have no way to
compare which listing genuinely supports continuous agent operation versus one that
just says "good wifi."

## Options considered

### Option A: Do nothing — let agent-support amenities evolve organically through
  free-text host descriptions
- Pros: no standardization needed, simplest.
- Cons: no shared vocabulary, guests can't compare, hosts could easily overclaim
  "agent-ready" when bandwidth isn't actually stable enough.

### Option B: Treat the AI agent as an independent "guest" type, with its own
  identity/reputation/payment (the earlier RFC-0013 draft)
- Pros: (analyzed in the earlier draft)
- Cons: **rejected** — competes directly with far more mature decentralized compute
  infrastructure (Akash, io.net), and turns CypherGuide from "a lodging platform for
  people" into "a compute marketplace for bots" — drifting away from the exact
  community built from day one (Kyle, the Saigon host, Cyphermunk House — all humans
  looking for a place to stay).

### Option C: Define a new standardized amenity tag "Agent-Ready," verified by
  objective metrics (uptime, minimum bandwidth, presence of a dedicated compute node),
  operating entirely within the existing guest-is-human model (PROPOSED)
- Pros: matches real demand from the cypherpunk/freelancer crowd without changing the
  product's nature; leverages existing RFC-0007/0009 infrastructure; doesn't compete
  with Akash/io.net since this is an amenity bundled with a stay, not a standalone
  compute service.
- Cons: needs a clearly defined minimum threshold so hosts can't tag "Agent-Ready"
  without actually meeting it.

## Proposal

**Option C.** Define a new amenity tag: **`AGENT-READY`**

### Minimum criteria to earn the tag (all 3 required)

1. **Dedicated compute node** — the host provides access to a separate compute device
   (SBC/mini-PC) exclusively for the guest for the duration of the stay, not
   simultaneously shared with other guests.
2. **Private or self-hosted Nostr relay** — the guest's agent can connect through a
   relay the host runs themselves, not required to route through an unfamiliar public
   third-party relay.
3. **Guaranteed bandwidth floor** (e.g., a stated minimum X Mbps sustained) — a
   specific number stated in the listing, not vague language like "good wifi."

### Verification — following the existing `VERIFIED_NODE` model

The same way current listings display `mesh:11.94.108.45 (Da Lat Pine Valley)` to
verify a real LoRa node, the `AGENT-READY` tag must be tied to a checkable
address/metric (ping test, public uptime log) — not just the host's self-claim.

### Nothing new beyond this tag

- **No separate identity/reputation for the agent** — the agent remains the human
  guest's tool; all reputation/payment still belongs to the booking human's npub
  (consistent with existing RFC-0003, unmodified).
- **No separate pricing model** — this is an amenity added to the existing listing
  price (the same way `SOLAR OFF-GRID` has no separate pricing model), not a
  CPU-second billed service as in the earlier draft.
- **Doesn't touch RFC-0008 (dana)** — a dana listing can perfectly well also carry the
  `AGENT-READY` tag if the host genuinely has that infrastructure; no conflict.

## Security / decentralization trade-offs

- **Main risk**: a host tagging `AGENT-READY` without actually meeting it (insufficient
  bandwidth, a node shared across multiple guests) — mitigated by mandatory machine
  verification (same as `VERIFIED_NODE`), not self-reporting.
- **Introduces no new financial risk** — since no agent pays for anything itself,
  there's no spending cap to manage, no new financial attack surface compared to a
  regular listing. This is the most important safety difference from the rejected
  earlier draft.
- **No new issue for the sovereignty boundary (RFC-0012)** — the guest is still human,
  still declares residency as normal; the agent is just a tool they bring, creating no
  new legal actor to consider.

## Proposed maturity tier

**Draft**, able to move to **Stable** faster than the earlier draft — since this is
just an extension of the existing amenity tag system, low risk, no complex new
infrastructure needed. Could be trialed immediately on 1-2 real listings (e.g. Faraday
Bunker already has `LOCAL NOSTR RELAY` — already close to meeting criterion 2 of 3,
just needs a stated bandwidth floor added).

## Discussion

(Open — what should the specific "bandwidth floor" number be, in Mbps, to count as
sufficient for continuous agent operation? Needs input from someone who actually runs
agents 24/7 for a real-world number, not a guess.)
