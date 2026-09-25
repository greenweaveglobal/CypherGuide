# Cypher Protocol Security Maturity Matrix

Cypher Guide adheres to a multi-tiered security maturity matrix tailored for P2P Cypherpunk protocols:

---

## 📊 Maturity Matrix Levels

| Level | Status | Technical Milestones |
| :--- | :--- | :--- |
| **Tier 0: Prototype** | 🟢 **Completed** | React 19 + Vite + Tailwind UI/UX, Local Storage state persistence, BOLT-11 invoice generator mock. |
| **Tier 1: Devnet / Testnet** | 🟡 **Partially Complete (Core Audited, Escrow Placeholder)** | • **Completed Security Audits:** NIP-49 Vault (`ncryptsec`/`scrypt`, zero raw keys in `sessionStorage`/`localStorage`); SSRF defense + callback amount bounds checking for LUD-06; BIP-340 Schnorr signature validation for KYC Attestations (Kind 30388) against host verifier whitelists; Dual-signed Proof-of-Stay badges (Kind 30078, Guest claim + Host endorsement); NIP-98 HTTP Auth for admin endpoints; Magic-byte validation blocking SVG XSS on media uploads; Preimage SHA-256 cryptographic verification for Lightning settlements; Automated Vitest suite (7 suites/23 tests) & CI GitHub Actions.<br>• **⚠️ MANDATORY DISCLOSURE:** The 2-of-3 BFT Arbitrator Council currently utilizes placeholder public keys for demo purposes — **no genuine third-party arbitrators currently hold the corresponding private keys**, and automated escrow dispute resolution is NOT available on production until 3 independent parties are onboarded. |
| **Tier 2: Mainnet Ready** | 🟡 **In Progress** | Unified production environment at `cypherguide.org` with 100% authentic Lightning payments (zero mock code paths); Production Nostr WebSocket Relays (WSS), Lightning WalletConnect (Alby / Mutiny / Phoenix), Bounded State Storage on L2/Rootstock, Automated smart escrow contracts (Tier 2/Phase 2). |

---

## ⚠️ Known Limitations

1. **Arbitrator Council is Currently a Placeholder**:
   - All public keys defined in `DEFAULT_ARBITRATOR_POOL` (`insuranceFund.ts`) serve as testing/demo placeholders to demonstrate the 2-of-3 BFT consensus algorithm.
   - **No genuine independent third-party arbitrators hold the corresponding private keys.**
   - Consequently, the Dispute Resolution and Insurance Payout mechanisms **CANNOT GUARANTEE TRUSTLESS SECURITY ON PRODUCTION** until three independent, reputable signers are officially onboarded with hardware key storage.

2. **Automated Escrow Custody (Phase 2 Under Active Development)**:
   - Currently, Live mode transactions operate as direct peer-to-peer (P2P) settlements to the Host's and co-owners' Lightning Addresses (LUD-16) per the agreed Profit Sharing ratios.
   - Non-custodial smart escrow mechanisms (DLCs, Hold Invoices, or Cashu multi-party escrows) are under architectural development and have not yet replaced direct settlement.

---

## 🔒 Executed Security Audits (Audit Log)

1. **NIP-49 Vault Encryption (H1)**: Nostr private key encrypted via NIP-49 (`ncryptsec` / `scrypt`), completely deprecating weak PINs and removing all raw keys from `sessionStorage` and `localStorage`.
2. **KYC Attestation Signature Verification (H2)**: Enforced cryptographic Schnorr signature verification (`verifyEvent`) on KYC attestations (Kind 30388) matching authentic `event.pubkey` against host-defined verifier whitelists (rejecting untrusted client claims).
3. **Dual-Signed Proof-of-Stay (H3)**: Enforced mandatory dual-signing for Proof-of-Stay (Kind 30078): Guest creates claim event, and Host signs an explicit endorsement event referencing the claim ID; unilateral guest self-signing is rejected.
4. **SSRF Defense & LUD-06 Amount Verification (H4)**: Hardened Lightning Address resolution against SSRF attacks (private IP range filtering, loopback protection, mandatory HTTPS, strict timeouts) and validated callback amounts against `[minSendable, maxSendable]`.
5. **NIP-98 HTTP Auth for Admin Endpoints (C1)**: Protected administrative server routes with Nostr HTTP Authentication (NIP-98), enforcing 60s timestamp replay windows and authorized npub whitelists.
6. **Magic-Byte Validation for Media Uploads (C3)**: Validated uploaded binary files using file signatures (PNG, JPEG, WebP, GIF), strictly banning SVG files to prevent stored XSS attacks.
7. **Preimage Cryptographic Verification (C4)**: Cryptographically verified `SHA-256(preimage) === payment_hash` before confirming any Lightning payment status, preventing fake invoices or arbitrary preimages.
8. **Schnorr Signatures & 32-Byte Hash Verification**: Integrated `finalizeEvent` & `verifyEvent` from `nostr-tools`. Enforced 32-byte SHA-256 digesting to prevent runtime exceptions.
9. **NWC Key Storage Security**: Client-side AES-GCM-256 encryption for NWC pairing strings and Nostr private keys in memory.
10. **Data Reconciliation**: `DataReconciler.heal()` auto-quarantines corrupted bookings lacking payment hashes.
11. **Documentation Lookup Assistant (RFC-0005) (Experimental Tier)**: Isolated server proxy for Gemini API calls with context-locked system prompt embedding official documents (`RFC/*.md`, `ARCHITECTURE.md`, `MATURITY.md`, `POSITIONING.md`), strictly enforcing "Chưa có tài liệu về việc này" for out-of-scope queries and displaying a permanent disclaimer label.
12. **Optional KYC Attestation Layer (RFC-0006) (Experimental Tier)**: Removed self-issuance buttons from production guest booking UI (isolated behind `import.meta.env.DEV`), removed pre-set verifier suggestion buttons from host registration modal (strictly enforcing free-text npub lists validated via bech32 checksums), ensuring Kind 30388 attestations must be signed by genuine third-party verifiers with isolated private keys.
13. **Sovereignty Boundary & Host Legal Warning (RFC-0012) (Draft/Boundary Tier)**: Explicitly formalizes the boundary between decentralized protocol layers and national sovereign legal obligations (guest temporary residency declaration, business income tax, fire safety compliance per Decree 282/2025/NĐ-CP). Embedded a direct legal disclaimer in `HostRegistrationModal.tsx` and established the community-maintained reference document `HOST_LEGAL_REALITY.md` outside the protocol specification tree.
14. **Agent-Ready Stay (RFC-0013) (Draft Tier)**: Standardizes the `AGENT-READY` amenity tag for cypherpunk/freelancer guests traveling with continuous AI agents. Guest remains strictly human (RFC-0003 unchanged), agent is accompanying infrastructure; avoids compute marketplace competition with Akash/io.net; creates no separate identity or reputation namespace for bots; verified objectively across 3 mandatory technical criteria (dedicated unshared SBC/mini-PC, private host-operated Nostr relay, guaranteed sustained bandwidth floor in Mbps) via machine metrics similar to `VERIFIED_NODE`; host legal liabilities preserved under RFC-0012.
15. **Local AI Positioning Statement (POSITIONING.md) (Experimental Tier)**: Explicitly articulates CypherGuide's positioning on local AI: not entering the trillion-dollar compute race (independently validated by Dr. Phạm Hy Hiếu's 3 pillars: Algorithm, Data, Compute), anchoring RFC-0009/0013 at Experimental tier until real public empirical data is produced, and rejecting ungrounded proposals for compute marketplaces (NIP-90 DVM) or autonomous financial decision-making agents.
