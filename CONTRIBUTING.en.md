# Contribution Guidelines for Cypher Guide (Cypher Protocol v1.1)

Welcome to **Cypher Guide** — A decentralized P2P hospitality protocol powered by Lightning Network, Cashu Ecash, and Nostr.

---

## 1. Documentation & Policy Synchronicity

- **Vietnamese Source (`*.vi.md`)**: All protocol specifications and RFCs consider Vietnamese files as the primary source of truth.
- **English Translation (`*.en.md`)**: Synchronized translation files. All PRs modifying specifications MUST update both versions simultaneously.

---

## 2. Core Engineering Principles

1. **No-KYC & Zero Trust**: All user interactions rely on Nostr keypairs (`npub`/`nsec` & hex `pubkey`/`privKey`). Zero centralized servers, zero PII collection.
2. **Cryptographic Verification**: All payload messages, reviews, governance acts, and stay badges MUST be signed with Schnorr signatures (`nostr-tools`, `@noble/curves`).
3. **NUT-11 2-of-3 Multisig Escrow**: Security deposits are locked under NUT-11 P2PK 2-of-3 contracts between Guest, Host, and an active Arbitrator from `DEFAULT_ARBITRATOR_POOL`.
4. **Self-Healing Reconciliation**: Local data persisted in Zustand/localStorage must pass `DataReconciler.heal()` and `DataReconciler.verifyIntegrity()` checks.
5. **Continuous i18n First**: All new UI features added after i18n completion must use `t()` from the start, without waiting for a separate audit to catch missing translations.

---

## 3. Code Verification Workflow

Prior to submitting code changes, run linting and compilation checks:
```bash
npm run lint
npm run build
```
Both steps must pass with 0 errors.
