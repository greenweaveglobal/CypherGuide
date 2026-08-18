# Contribution Guidelines for Cypher Guide (Cypher Protocol v1.1)

Welcome, Cypherpunk Developers, to **Cypher Guide** — A sovereign decentralized P2P lodging protocol powered by Bitcoin Lightning Network, Cashu Ecash, and Nostr.

---

## 1. Documentation & Policy Synchronicity (RFC-0004)

- **Vietnamese Source (`*.vi.md` / `*.md`)**: All protocol architecture specifications and RFCs consider Vietnamese files as the primary source of truth.
- **English Translation (`*.en.md`)**: Full 1:1 synchronized translation files. When submitting Pull Requests that modify documentation, **you MUST update both language versions simultaneously** within the same PR to maintain consistency.

---

## 2. Core Engineering Principles

1. **No-KYC & Zero Trust**: All user interactions rely purely on Nostr keypairs (bech32 `npub` / `nsec` & hex `pubkey` / `privKey`). Zero centralized database servers, zero Personal Identifiable Information (PII) collection.
2. **Cryptographic Verification**: All payload messages, reviews, governance votes, and stay badges MUST be cryptographically signed with BIP-340 Schnorr signatures (`nostr-tools`, `@noble/curves`).
3. **NUT-11 2-of-3 Multisig Escrow**: Security deposits are locked under NUT-11 P2PK 2-of-3 contracts between Guest, Host, and an active Arbitrator from `DEFAULT_ARBITRATOR_POOL`.
4. **Self-Healing Reconciliation**: Local state persisted in Zustand stores & localStorage must pass through `DataReconciler.heal()` and `DataReconciler.verifyIntegrity()` to ensure ledger integrity.
5. **Continuous i18n First**: All new UI components and features must wrap user-facing strings in static dictionary `t()` calls from the start, avoiding hardcoded text.
6. **Financialization Boundary (RFC-0011)**: Any proposal introducing new proofs, reputation metrics, or fee discounts must pass the mandatory 3-test boundary checklist (Verifiability, Protocol-Purpose, Original-Meaning) before implementation.

---

## 3. Branch Strategy

- **`main`**: Official production-ready release branch with verified audit status.
- **Feature Branches**:
  - `feature/bft-insurance-schnorr`: Integration and test suite for BFT Arbitrator Council Schnorr signatures.
  - `feature/host-dashboard-proof-of-stay`: Host operations dashboard, escrow management, and Proof-of-Stay (Kind 30078) lifecycle.
- **Merge Requirements**: Every PR must be reviewed, free of merge conflicts, and pass all linter and build verification steps.

---

## 4. Core Project Anatomy

* `/src/utils/crypto.ts`: NWC AES-GCM-256 encryption, Nostr payload signing, BIP-340 Schnorr signature validation.
* `/src/utils/governanceSchema.ts`: Zod schema validation & Nostr event signature verification for `GovernanceAct`.
* `/src/utils/reconciler.ts`: Consensus state engine & self-healing reconciler (`DataReconciler`).
* `/src/utils/depositEscrow.ts`: 2-of-3 Multisig & Timelock Escrow coordinator for guest deposits.
* `/src/utils/proofOfStay.ts`: Issuance, signing, and verification of portable `Proof-of-Stay` (Kind 30078).
* `/src/utils/dynamicFee.ts`: Logarithmic reputation-adjusted protocol fee curve algorithm (RFC-0002).
* `/src/components/HostDashboard.tsx`: Host management panel, listing creation, and check-in/check-out attestations.
* `/src/components/GovernancePanel.tsx`: BFT Insurance Fund administration and arbitrator voting interface.

---

## 5. Verification & PR Workflow

Before committing changes or opening a PR, run full local verification:

```bash
# Verify TypeScript typing and syntax
npm run lint

# Compile production bundle
npm run build
```

Both commands must pass with zero errors (clean build) for a PR to be merged.
