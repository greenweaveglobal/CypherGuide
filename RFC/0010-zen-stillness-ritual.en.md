# RFC-0010: Zen Stillness Ritual — Circle, Incense Stick, 369 Seconds

- **Status:** Draft
- **Author:** (TBD)
- **Date:** 2026-08-14
- **Related modules:** proposed new component (`src/components/StillnessRitual.tsx`),
  `src/components/ListingDetail.tsx` (attachment point in the check-in/checkout flow for
  `priceModel: 'dana'` listings — RFC-0008). **NOT related to**
  `src/utils/proofOfStay.ts` (RFC-0003) — the reason for this exclusion is explained
  below under Problem/Proposal.

## Problem

RFC-0008 defines the payment model for meditation-retreat/monastery-style listings, but
only addresses the **financial** side (dana/voluntary offering) — nothing in the app yet
reflects the **spiritual experience** actually taking place at these locations. The
project's founder proposed a specific, symbolic ritual:

- **The Zen circle (Ensō)** — represents the number **0**: emptiness, impermanence, a
  starting point with nothing to grasp onto.
- **Lighting one incense stick** — represents the number **1**: a single intention, one
  breath, one concrete act arising from emptiness.
- Once lit, a bell (vibration/frequency) sounds, starting a **369-second** countdown — a
  span of silence during which the user tries to think of nothing.

The real technical/design question here isn't "how to animate this" — it's: **should a
ritual meant for letting go (non-attachment) generate any data, proof, or reputation at
all?** This is the core tension that must be resolved before any code is written, since it
determines the entire architecture that follows.

## Options considered

### Option A: Pure ritual — no data recorded, no proof
The animation/sound runs entirely client-side, with no state persisted after the session
ends (not even local storage) — exactly like lighting a real incense stick: once it burns
out, there's nothing "proving" whether you sat still or your mind wandered for 369 seconds.
- Pros: **fully consistent with the ritual's own spirit** — doesn't turn stillness into
  something to "complete" or "show off." No security/privacy risk at all, since there's no
  data to leak.
- Cons: gives users no way to look back at "how many times have I done this" if they
  genuinely want to track a personal habit.

### Option B: Issue a Proof-of-Stillness — new proof_type per RFC-0003, published to
  Nostr, counted toward portable reputation
- Pros: consistent with how other behaviors in the app are recorded (Proof-of-Stay), could
  unlock perks or a badge.
- Cons: **rejected outright**, for two separate reasons:
  1. **It's inherently unverifiable.** Proof-of-Stay confirms a real physical event
     (stayed, checked out). "Thought of nothing for 369 seconds" is not an event that can
     honestly be signed and confirmed — the app only knows the timer ran out, not what the
     user's mind actually did. Turning it into a proof would be **manufacturing false
     evidence for an unprovable state**, fundamentally different from every other proof in
     the protocol.
  2. **It contradicts the very act it's meant to represent.** Turning stillness into
     something accumulated to boost reputation/unlock perks bolts an "achieve/possess"
     layer (attachment) onto an act whose whole point is letting go of exactly that —
     working directly against its own purpose.

### Option C: Local-only storage, no publishing, no sync, no proof — a simple personal
  counter on the user's own device, auto-cleared if the app is uninstalled
- Pros: addresses the legitimate part of Option A's downside (users wanting to know how
  many times they've practiced) without generating any proof/reputation/data that leaves
  the device — doesn't conflict with reasons (1) and (2) above, since this isn't "evidence"
  sent outward, just a silent personal note.
- Cons: the UI must clearly state this is just a self-count, not a verified achievement —
  to avoid users mistaking it for something with the same standing as Proof-of-Stay.

## Proposal

**Option A as the default**, with **Option C available as an opt-in toggle** (off by
default) for anyone who genuinely wants to track their own personal habit — not to show
off or trade for perks.

### Ritual design (implementation sketch)

1. **The Zen circle (Ensō)** — drawn via SVG stroke animation, the brushstroke left
   deliberately unclosed (true to Ensō tradition — imperfection is part of its meaning),
   representing the number 0.
2. **Incense** — tap/press to "light" it (a small flame effect + slowly fading smoke via
   CSS/SVG), representing the number 1 — the single act of initiation, nothing further
   required afterward.
3. **Opening bell** — use a real recorded sample of a **Keisu/Inkin** (the small bronze
   bell used in Japanese zendos — true to the same Zen tradition as the Ensō/incense,
   distinct from a Tibetan singing bowl, which belongs to a different tradition despite a
   similar timbre), not a synthesized pure sine tone (real metal overtones are what
   produce the authentic "ring then fade" feeling). **One single strike**, left to ring
   naturally (~3-5 seconds) before fading out completely as the 369-second silence begins
   — signaling "start." No "healing frequency" label (432Hz, 528Hz...) or any
   medical/scientific claim anywhere in the UI/copy — describe it only as "a traditional
   sound that opens a meditation session," chosen for its timbre, not for any Hz number.
4. **369 seconds** — a silent countdown, avoiding a jarring, distracting numeric display
   (it could simply be the Ensō circle fading in/out very slowly instead).
5. **Closing bell** — the same Keisu/Inkin sample, but **2-3 strikes spaced a few seconds
   apart** (clearly distinct from the single opening strike), so the user can tell the 369
   seconds have ended without watching a countdown number.
6. After it ends: **no "Complete!" screen**, no badge, no confetti — it simply, quietly
   returns to the previous screen, staying true to the intent of not turning it into an
   achievement.

### Where it attaches to the existing flow

Placed as a **standalone, optional action** before the "Confirm intent to stay" step on
`priceModel: 'dana'` listings (RFC-0008) — not mandatory, and doesn't block the booking
flow if the user skips it. Could later be expanded into its own section outside the
booking flow (e.g. within `Guide.tsx`) for anyone who wants to use it, not limited to
people currently booking a meditation retreat.

## Security / decentralization trade-offs

- **Options A/C introduce no new attack surface** — no event is published, no external
  API is called, and no data leaves the device at all (even under Option C, data stays in
  the user's own local storage).
- **Deliberately does not follow the Proof-of-Stay model (RFC-0003)**, even though on the
  surface it resembles it ("one behavior → one portable proof") — this is an intentional
  exception, not an oversight of forgetting to apply RFC-0003. Stated explicitly here so a
  future reader doesn't "fix" it into a new proof_type thinking it was an omission.
- **No biometric or sensor signal is collected** (heart rate, device motion, etc.) to
  "verify" that the user was genuinely still — doing so would turn a private ritual into
  surveillance, running directly against this RFC's own spirit.

## Proposed maturity tier after implementation

**Experimental** — needs real UX testing (in particular, animation length, and whether
369 seconds feels "just right" versus restless) before being considered stable.

## Discussion

(Open — community input needed: should the 369 seconds be configurable (e.g. 108 seconds,
21 minutes, as used in other meditation traditions) or fixed as a distinct part of Cypher
Guide's identity; and whether the bell sound should be a fixed in-app asset or allow users
to upload their own.)
