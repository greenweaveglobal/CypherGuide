# RFC-0009: Decentralized AI on Edge Devices

- **Status:** Draft — **long-term vision**, not an implementation spec yet. This RFC
  **expands Option C of RFC-0007** ("run a small language model directly on each
  LoRa/relay node" — shelved at the time as "not yet feasible") into its own RFC, because
  its scope (real hardware constraints, model choice, inference-distribution protocol) is
  large and distinct enough to no longer be a sub-item of RFC-0007.
- **Author:** (TBD)
- **Date:** 2026-08-13
- **Related modules:** `src/components/MeshNeighborhood.tsx` (current LoRa node list:
  LilyGO T-Beam, Heltec V3, Meshtastic Repeater — currently **static demo data**, no real
  hardware logic yet), `src/utils/proofOfStay.ts` (RFC-0003, the shared tag/kind
  foundation if inference results ever need to be published as events), RFC-0007 (Layer 1
  — mesh infrastructure), RFC-0005 (for comparison: the current real implementation,
  server-based).

## Problem

RFC-0007 asks "can AI run without a backend", and proposes a 3-layer model in which
inference still happens at **Layer 3 — external API** (Gemini or equivalent, with the
user supplying their own key). That removes the project's own backend, but **does not
remove dependence on a single centralized third party** (the API provider). If the actual
goal is decentralization in the fullest sense, the remaining question is: **can AI
inference run directly on the mesh infrastructure (LoRa/relay) the project already has,
with no outbound internet call at all?**

This is exactly Option C that RFC-0007 raised and shelved, citing that "these devices
typically have very limited resources (low power, small CPU/RAM)." This RFC doesn't
dispute that finding — it tries to answer it in more detail: **where exactly does that
limit sit, and is there a realistic incremental path toward it, rather than writing it off
as permanently infeasible?**

Specific problems to address:
1. The real edge devices listed in `MeshNeighborhood.tsx` (LilyGO T-Beam, Heltec V3) use
   ESP32-class microcontrollers — RAM ranging from a few hundred KB up to ~8MB (PSRAM
   variants), no GPU, and cannot run any language model in the conventional sense (even
   the smallest quantized models today still need hundreds of MB of RAM).
2. Therefore "running AI on the LoRa node itself" is, literally, **not feasible with the
   hardware currently listed** — a clear distinction is needed between "LoRa/relay node"
   (transport only) and "edge device" in the broader sense (which could be a phone,
   mini-PC, or SBC like a Raspberry Pi — far more capable).
3. Without redefining "edge device" precisely, this RFC would repeat the exact mistake
   RFC-0007 warned itself against: describing an architecture that doesn't exist in the
   real code/hardware.

## Options considered

### Option A: Keep the status quo — AI inference always at Layer 3 (external API, RFC-0007)
- Pros: simple, no extra hardware needed, leverages the strongest available APIs.
- Cons: doesn't answer the original question — still depends on a single centralized third
  party for the inference step, even after removing the project's own backend.

### Option B: Run a small language model (SLM) directly on the existing LoRa/relay nodes
- Pros: decentralization in the most literal sense — inference happens right at the mesh
  infrastructure.
- Cons: **rejected** — as confirmed in the Problem section, the existing LoRa hardware
  (ESP32-class) lacks the RAM/CPU to run any useful language model. This isn't a software
  optimization problem but a physical hardware limit — no short/medium-term roadmap fixes
  this by writing better code.

### Option C: Separate "LoRa/relay node" from "edge device running AI" — inference runs on
  a more capable device at the network edge (the user's phone, a mini-PC/SBC such as
  Raspberry Pi 4/5, or a personal computer running the app), while LoRa continues to serve
  only as data transport per RFC-0007 Layer 1 (PROPOSED)
- Pros: realistically feasible with commonly available hardware today — SBCs like
  Raspberry Pi 4/5 (4-8GB RAM) can run quantized models around 1-3B parameters (e.g. GGUF
  format via llama.cpp) at acceptable speed for "document lookup"-style queries (no
  real-time requirement). Modern phones are increasingly capable of running models this
  size on-device too. No internet needed for the inference step if source documents are
  already synced locally.
- Cons: answer quality from a 1-3B parameter SLM is far below large APIs (Gemini,
  Claude...) — needs even tighter answer-scope constraints than RFC-0005 (higher
  hallucination risk on small models). Not everyone owns a suitable SBC/phone — this is a
  feature for users with matching hardware, not a primary path for the general user base.

### Option D: Distributed inference — split a larger model across multiple edge nodes that
  compute jointly, combining results over the mesh
- Pros: theoretically allows running a model larger than any single device's resources.
- Cons: **excluded from the main proposal** — LoRa's network latency and very low
  effective bandwidth (often under 1 kbps in long-range configurations) are entirely
  unsuited to passing activations/tensors between inference steps, which need high
  bandwidth and low latency. This is an interesting academic research direction but has no
  practical path on the project's current LoRa infrastructure — noted as a far-future
  direction, not part of the roadmap.

## Proposal

**Option C**, with a boundary that must be stated up front to avoid repeating RFC-0007's
own pitfall: **"edge device" here does NOT mean the LoRa/relay node** (those continue to
do Layer 1 work only — transport, exactly as RFC-0007 defined), but rather compute-capable
devices at the network edge: SBCs (Raspberry Pi 4/5 or better), mini-PCs, or the user's own
phone/computer already running the app.

Suggested roadmap (exploratory, no committed timeline):
1. Independent experiment, kept fully separate from RFC-0005/0007: run a small quantized
   model (1-3B parameters, GGUF format) via `llama.cpp` or equivalent on a Raspberry Pi 5,
   with context restricted to the same `RFC/*.md` + `ARCHITECTURE.md` document set that
   RFC-0005's constraints already specify — measure real response time and
   wrong/fabricated-answer rate.
2. If speed/accuracy prove acceptable, this becomes a **third optional mode** alongside
   "shared server proxy" (RFC-0005) and "bring your own API key" (RFC-0007 Layer 3):
   "run locally on my device" — no outbound calls, no API key from anyone required.
3. Not intended to replace RFC-0005/0007 — three modes coexist, and users choose based on
   their hardware and how much trust they want to place in each option.
4. The LoRa mesh's role in this picture stays exactly as RFC-0007 described: propagating
   tagged documents/data only, not participating in the inference step.

## Security / decentralization trade-offs

- **The "run locally" mode places all hardware cost and operational responsibility on the
  user** — no party (including the project) controls or is responsible for the small
  model's answer quality on their machine. A clear UI warning is needed, similar to the
  disclaimer RFC-0005 already requires: small models have a higher fabrication rate and
  should not be treated as more trustworthy than reading the source RFC directly.
- **This is genuinely the most decentralized of the three modes** (compared to RFC-0005:
  trusting the project's proxy server; RFC-0007 Layer 3: trusting an external API
  provider) — no third party is trusted at the inference step, not even the project
  itself. The trade-off is lower output quality and a hardware barrier to entry.
- **This feature must never be marketed as "AI running on the LoRa node"** — doing so would
  repeat the exact kind of architecture mis-description that RFC-0005 rejected in its
  Option A. It must be stated clearly: LoRa only transports data; inference runs on a
  separate compute device.

## Proposed maturity tier after implementation

**Experimental** — no code or real measurements (speed, accuracy) exist yet. Do not raise
the tier until roadmap step 1 (real SBC experiment) produces concrete measured results.

## Discussion

(Open — needs further clarification: the exact minimum hardware threshold (RAM/CPU) for a
device to "qualify" for this mode; and whether the model should be constrained to narrow
retrieval-augmented behavior rather than free generative output, to reduce the small
model's hallucination risk.)
