# Cypher Protocol Architecture Specification

**Version:** v1.1.0-Cypher
**Authors:** Cypherpunk Core Developers
**Language:** English (Translated from Vietnamese source)

---

## Donations — Official Address Verification

Cypher Guide has exactly **one** official donation address:

```
npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh
```

This is the only npub verified by the project. Any other npub claiming to be "the Cypher Guide donation address" is impersonation — please check it matches the string above exactly before sending any Zap/sats. This account is **not** used for official project announcements (see the separate marketing channel).

---

## 1. System Architecture Overview

Cypher Guide is a decentralized peer-to-peer hospitality platform operating on a client-side architecture interfaced with Nostr Relays and the Bitcoin Lightning Network.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CYPHER GUIDE UI                               │
│  (React 18 + Vite + Tailwind CSS + Lucide Icons + Motion Animation)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    NOSTR PROTOCOL   │  │  LIGHTNING & CASHU  │  │   LOCAL RECONCILER  │
│  - Secp256k1 Schnorr│  │  - NWC AES-GCM-256  │  │  - DataReconciler   │
│  - NIP-01/04/44/78  │  │  - NUT-11 2-of-3    │  │  - Self-Healing DB  │
│  - SimplePool Relays│  │    Multisig Escrow  │  │  - Zustand Store    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## 2. Core Engineering Modules

### 2.1 Crypto Engine (`/src/utils/crypto.ts`)
- BIP-340 Schnorr Signatures: `signRawSchnorr` & `verifyRawSchnorr` automatically digest message content into a 32-byte SHA-256 hash before signing or verifying.
- NWC Pairing Security: `encryptNwcPayload` & `decryptNwcPayload` leveraging AES-GCM-256 with HKDF derivation.

### 2.2 Cashu & Escrow (`/src/utils/cashu.ts` & `/src/utils/depositEscrow.ts`)
- Cashu NUT-11 P2PK 2-of-3 Multisig Expansion: Locks guest deposits between Guest, Host, and an active Arbitrator from `DEFAULT_ARBITRATOR_POOL`.
- Safe Redemption: `redeemCashuToken()` enforces P2PK Witness Schnorr verification locally before completing ecash claims.

### 2.3 Proof of Stay (`/src/utils/proofOfStay.ts`)
- RFC-0003 & NIP-78 (Kind 30078) Compliance: Mints cryptographic Proof-of-Stay badges using SHA-256 commitments and Nostr signatures upon check-out in `MyTrips.tsx`.

### 2.4 BFT Governance (`/src/utils/protocolGovernance.ts` & `insuranceFund.ts`)
- BFT Consensus: Dispute resolutions and protocol parameter updates require $\ge 2/3$ Arbitrator Quorum signatures.
- Quadratic Voting: Weighted community proposal voting based on staked Sats and lock duration.

### 2.5 Dynamic Fees & Infrastructure (`/src/utils/dynamicFee.ts`, `infraContribution.ts`, `referral.ts`)
- Dynamic fee calculation via `calculateDynamicFee()` contributing to the BFT Insurance Treasury.
- Infrastructure Meshnet Relay Node rewards via `calculateNodeIncentiveReward()`.
- Instant referral claim settlement via `claimReferralReward()` over Lightning Addresses.

### 2.6 Server Proxy Exception for AI Docs Assistant (`server.ts` & `src/components/DocsAssistant.tsx` - RFC-0005)
- **Trade-off & Architectural Exception:** To integrate the Automatic Documentation Lookup Assistant (RFC-0005) via Gemini API without exposing the `GEMINI_API_KEY` to client browsers, the system utilizes a small Server Proxy endpoint (`/api/docs-assistant/query` in `server.ts`).
- **Strict Boundary Isolation:** This is a **conscious architectural exception** completely independent and isolated from Layer 2 of the Cypher Guide protocol. All core protocol transaction flows (P2P bookings, Nostr Schnorr signatures, Lightning Network payments, Cashu Escrow locks) remain 100% client-side/serverless, with zero dependency or telemetry through this backend proxy.
