# Cypher Protocol Security Maturity Matrix

Cypher Guide adheres to a multi-tiered security maturity matrix tailored for P2P Cypherpunk protocols:

---

## 📊 Maturity Matrix Levels

| Level | Status | Technical Milestones |
| :--- | :--- | :--- |
| **Tier 0: Prototype** | 🟢 **Completed** | React 18 + Vite + Tailwind UI/UX, Local Storage state persistence, BOLT-11 invoice generator mock. |
| **Tier 1: Devnet / Testnet** | 🟢 **Completed** | BIP-340 Schnorr signatures (`@noble/curves`), AES-GCM-256 NWC Encryption, 2/3 BFT Arbitrator Quorum, Dynamic Fee engine, Cryptographic Proof-of-Stay Badges (Kind 30078), DataReconciler Self-Healing. |
| **Tier 2: Mainnet Ready** | 🟡 **In Progress** | Production Nostr WebSocket Relays (WSS), Lightning WalletConnect (Alby / Mutiny / Phoenix), Live Cashu Mint integration. |

---

## 🔒 Executed Security Audits

1. **Schnorr Signatures & 32-Byte Hash Verification**: Integrated `schnorr.sign` & `schnorr.verify` from `@noble/curves`. Enforced 32-byte SHA-256 digesting to prevent string length runtime exceptions.
2. **2-of-3 Multisig Escrow Arbitrator Key**: Sourced genuine arbitrator public keys from `DEFAULT_ARBITRATOR_POOL` inside `insuranceFund.ts` replacing arbitrary placeholder strings.
3. **NWC Key Storage Security**: Client-side AES-GCM-256 encryption for NWC pairing strings and Nostr private keys.
4. **Data Reconciliation**: `DataReconciler.heal()` auto-quarantines corrupted bookings lacking payment hashes.
5. **Documentation Lookup Assistant (RFC-0005) (Experimental Tier)**: Isolated server proxy for Gemini API calls with context-locked system prompt embedding official documents (`RFC/*.md`, `ARCHITECTURE.md`, `MATURITY.md`), strictly enforcing "Chưa có tài liệu về việc này" for out-of-scope queries and displaying a permanent disclaimer label.
6. **Optional KYC Attestation Layer (RFC-0006) (Experimental Tier)**: Removed self-issuance buttons from production guest booking UI (isolated behind `import.meta.env.DEV`), removed pre-set verifier suggestion buttons from host registration modal (strictly enforcing free-text npub lists validated via bech32 checksums), ensuring Kind 30388 attestations must be signed by genuine third-party verifiers with isolated private keys.
