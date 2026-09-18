# CypherGuide & Local AI — Positioning Statement (for grant applications / project intro)

## One-sentence summary

CypherGuide isn't entering the trillion-dollar centralized AI race — we're testing a
smaller, more specific question: **can a small language model, running entirely on
cheap hardware the user actually owns, answer well enough for its actual purpose** —
no cloud, no company standing in between.

## Why "a small voice," not "a big solution"

We don't claim to compete with Nvidia, OpenAI, or any centralized AI infrastructure —
the scales are incomparable, and there's no meaningful comparison to make. What we
believe: **the value of local AI isn't in winning the scale race, it's in existing as
a real, checkable alternative**, for people who value privacy/data sovereignty more
than raw model power.

## Independent confirmation from an expert unrelated to the project

Dr. Phạm Hy Hiếu — Head of AI Transformation at Techcombank, formerly at Google Brain,
xAI, and OpenAI — describes modern AI as resting on 3 pillars: **Algorithm** (already
commoditized, ~20 core algorithms anyone can access), **Data** (something enterprises
can own themselves), and **Compute** — which he calls outright **"a national-scale
problem,"** requiring state investment or corporations at the scale of FPT, Viettel,
GreenNode.

This is an independent confirmation, from someone with real authority in the field who
knows nothing about CypherGuide, arriving at exactly the conclusion the project already
reached on its own: **large-scale compute isn't a small protocol's arena.** We're not
trying to compete on that pillar — we're taking the part that fits our size: helping an
individual make good use of the small hardware they already own, for their own narrow
need, not dreaming of building a "decentralized version of a national data center."

## Concrete evidence, not a manifesto

- **RFC-0009**: a real test suite (fully designed, ready to run) measuring whether a
  1.5B-parameter model (Qwen2.5) running on a Raspberry Pi can correctly answer
  questions about the project's own documentation — including trap questions to check
  whether the model fabricates information. Results will be published whether they
  succeed or not.
- **RFC-0013**: an "Agent-Ready" listing amenity — edge infrastructure hosts run
  themselves, serving the real needs of freelancers/cypherpunks who travel with an AI
  agent, without creating a "compute marketplace" competing with existing centralized
  infrastructure.
- **Clear rejection of what doesn't fit**: we declined integrating an autonomous AI
  agent with unbounded financial decision authority (the GPT-6 Astra proposal), and
  fully rewrote RFC-0013's original direction after recognizing it drifted from core
  principles — and held that decision even when a later proposal tried bringing the
  "compute marketplace" model back under a different technical name (NIP-90 DVM).

## What we don't promise

We don't promise local AI will "beat" centralized AI, and we don't promise a specific
timeline for scaling up. RFC-0009/0013's maturity tier remains **Experimental** — it
only moves up when there's real data, not when there's a marketing need for it to.

## Why this is worth funding

Not because of scale — because this is one of the few projects that actually **proves
itself by running public experiments**, recording both failures and successes instead
of just asserting them. Every RFC, including the ones that were self-corrected mid-way,
is public at github.com/greenweaveglobal/cypherguide.
