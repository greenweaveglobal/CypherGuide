# RFC Index

Process: see `../CONTRIBUTING.en.md`. Template: `0000-template.en.md`. Architecture overview (non-RFC): `../ARCHITECTURE.en.md`.

Each document has a parallel `.en.md` version (e.g. `0003-....md` + `0003-....en.md`) — Vietnamese is the canonical source of truth, English is translated from it. When modifying content, update the Vietnamese version first and synchronize the English version in the same PR — avoid discrepancies between the two versions.

**RFC-0003 is the foundational document when two or more applications share Identity/Proof/Reputation** — code can be refactored or switch frameworks, but breaking commitments in RFC-0003 breaks ecosystem compatibility, not just a single app.

| # | Title | Status | Module |
|---|---|---|---|
| 0001 | Guardian Council Selection for Insurance Fund | Draft | `utils/insuranceFund.ts` |
| 0002 | Reputation-Based Dynamic Fee Curve | Draft | `utils/dynamicFee.ts` |
| 0003 | Identity & Portable Reputation | Draft | `utils/proofOfStay.ts` |
| 0004 | Internationalization (i18n) for User Interface | Draft | `src/components/*.tsx`, `src/locales/` |
| 0005 | Grounded Docs Assistant | Draft | `src/components/DocsAssistant.tsx` |
| 0006 | Optional Attestation Layer (KYC) | Draft | `utils/proofOfStay.ts` (extends `proof_type`) |
| 0007 | Decentralized AI over Mesh | Draft (visionary) | `DocsAssistant.tsx`, `server.ts` (RFC-0005) |
| 0008 | Dana-Based Stay | Draft | `types.ts`, `ListingDetail.tsx`, `depositEscrow.ts` |
| 0009 | Decentralized AI on Edge Devices | Draft (visionary) | `MeshNeighborhood.tsx` (RFC-0007 extension) |
| 0010 | Zen Stillness Ritual (Circle, Incense, 369 Seconds) | Draft | `StillnessRitual.tsx` (new), `ListingDetail.tsx` |
| 0011 | Financialization Boundary Principle | Draft | No dedicated module — applies retroactively to 0001, 0002, 0006, 0008, 0010 |
| 0012 | Sovereignty Boundary Principle | Draft | No dedicated module — applies to all Host/Guest interactions & legal docs |
| 0013 | Agent-Ready Stay — Amenity Tag for Cypherpunks / Personal Businesses | Draft | Extends amenity tag system (`AGENT-READY`), extends RFC-0007/0009, preserves RFC-0003, 0011, 0012 |
| 0014 | Agent Runtime Verification | Draft | Extends RFC-0013 focusing on agent runtime behavior (probe, tool-call trace), untouched infrastructure |
| 0015 | Treasury & Legal Entity Roadmap | Draft | No dedicated module — outlines how community treasury is managed across evolution phases |
| 0016 | Infrastructure Node Incentive (Proof-of-Relay + Lightning Payout Flow) | Draft | `src/utils/infraContribution.ts`, `src/store/useAppStore.ts`, `src/components/MeshNeighborhood.tsx` |
| 0017 | Stay Assistant Agents — Phase 1 (Non-Custodial) | Draft | Proposes `agents/` (extends RFC-0005, consumes RFC-0003, adheres to RFC-0011/0012) |
| 0018 | Standardized Accommodation Schema & Privacy-Preserving Listing Metadata | Draft | `src/types.ts`, `src/components/LodgingListings.tsx`, `src/components/ListingDetail.tsx`, `src/components/HostRegistrationModal.tsx` |

Next RFC number: **0019**.

## Naming Convention

`NNNN-short-slug.md`, 4-digit number, sequential, no duplicates. One RFC = one discrete decision with considered alternatives + security trade-offs (see `0000-template.md`). Broad, multi-topic architectural documents (system architecture, roadmap...) are **not** numbered as RFCs — placed at repo root (e.g., `ARCHITECTURE.md`), and RFCs reference them as needed.
