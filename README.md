# Cypher Guide

**Sovereign Peer-to-Peer Lodging & Community Protocol**

- 🌐 **Live Mainnet Web App**: [https://cypherguide.org](https://cypherguide.org)  
  *Production environment. Strict non-custodial P2P settlements via real Lightning nodes & LNURL. All mock/simulation code paths are stripped.*
- 📄 **Documentation & RFCs**: [https://cypherguide.org/?tab=guide](https://cypherguide.org/?tab=guide)

> *A non-custodial, censorship-resistant booking and identity protocol built on Nostr (NIP-01/05/47), Bitcoin Lightning Network, and autonomous cryptographic governance.*

---

## ⚠️ Security Notice & Protocol Maturity Status

> **Important**: Please review [`MATURITY.md`](./MATURITY.md) before interacting with live nodes or testing.

- **Current Stage**: **Tier 1 (Devnet / Testnet) — Core Audited, Escrow in Transition**
  - ✅ **Completed & Audited**: NIP-49 Vault (`ncryptsec`/`scrypt`, zero raw keys in storage), SSRF-hardened LUD-06 resolver, BIP-340 Schnorr KYC attestation verification (Kind 30388), Dual-signed Proof-of-Stay badges (Kind 30078, Guest + Host co-signing), NIP-98 admin HTTP Auth, magic-byte image validation blocking SVG XSS, Preimage SHA-256 cryptographic verification for Lightning payments, automated 23-test Vitest CI suite.
  - ⚠️ **Mandatory Disclosure (Arbitrator Council)**: The 2-of-3 BFT Arbitrator Council in `insuranceFund.ts` currently uses **placeholder public keys for simulation/demo** — no genuine independent third-party arbitrators hold the corresponding private keys. Automated trustless dispute resolution is NOT operational on production until 3 independent parties are onboarded.
  - 🟡 **In Active Development (Tier 2)**: Live multi-relay WebSocket connections (WSS), production Lightning WalletConnect (NWC) mainnet bindings, and non-custodial smart escrow contracts (DLC / Hold Invoices).
- **Safety Rule**: **DO NOT deposit or stake significant mainnet funds.** Test with testnet satoshis or minimal experimental amounts only.

---

## Core Protocol Architecture

1. **Sovereign Identity (Nostr Keypairs)**
   - No emails, passwords, or centralized database logins.
   - User identity derives strictly from public/private keypairs (`npub`/`nsec`) with BIP-340 Schnorr signatures.
2. **Non-Custodial Lightning Escrow (BOLT-11 & NWC)**
   - Peer-to-peer bookings settled over the Bitcoin Lightning Network.
   - Client-side encrypted Nostr Wallet Connect (`nostr+walletconnect://`) for automated micro-settlements.
3. **2-of-3 BFT Insurance & Dispute Resolution (RFC-0001)**
   - Cryptographic arbitrator quorum safeguards guest deposits and host guarantees without central platform custody.
4. **Reputation-Adjusted Dynamic Fees (RFC-0002)**
   - Platform service fees taper dynamically based on verifiable Proof-of-Stay history.
5. **Portable Reputation & Proof-of-Stay (RFC-0003)**
   - Cryptographic check-in/check-out attestations (Kind 30078) owned by users, portable across any Nostr client.
6. **Dana & Voluntary Offerings (RFC-0008)**
   - Native support for monastery and spiritual retreat stays with zero upfront fee and voluntary post-stay offerings.
7. **Zen Stillness & Financialization Boundary (RFC-0010 & RFC-0011)**
   - Client-side 369s stillness ritual and a formal 3-test boundary principle preventing unwarranted gamification of non-transactional human experiences.

---

## Repository Structure

```text
├── RFC/                 # 11 Formal Request for Comments & Architectural Standards
│   ├── README.md        # Index of all RFCs (0001 - 0011)
│   └── 0011-...md       # Financialization Boundary Principle
├── src/
│   ├── components/      # Modular React 19 UI components
│   ├── locales/         # i18n localization dictionaries (vi, en)
│   ├── services/        # Crypto, Nostr, and Docs search services
│   ├── utils/           # Schnorr BFT, dynamic fees, proof-of-stay math
│   └── types.ts         # TypeScript domain interfaces
├── ARCHITECTURE.md      # Comprehensive protocol system architecture
├── MATURITY.md          # Multi-tier security matrix and audit logs
├── POSITIONING.md       # Local AI positioning statement & grant application rationale
├── HOST_LEGAL_REALITY.md # Practical operational and legal reality reference for hosts
├── CONTRIBUTING.md      # Code standards, RFC lifecycle, and PR guides
├── server.ts            # Local development and documentation proxy server
└── LICENSE              # Open-source MIT License
```

---

## Quick Start (Development)

### Prerequisites
- Node.js `20.x` or higher
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/greenweave/cypherguide.git
cd cypherguide

# Copy example environment variables
cp .env.example .env

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Building & Verification

```bash
# Run automated tests (Vitest)
npm test

# Run TypeScript typechecks
npm run lint

# Build production bundle (cypherguide.org)
# (Strict mode: strips mock invoice generation and simulated preimages)
npm run build
```

---

## Governance & Contributing

Cypher Guide evolves through the **RFC (Request for Comments)** process. Before submitting pull requests for architectural changes or new proof types, please read:

1. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — How to propose RFCs and write code.
2. [`RFC/0011-financialization-boundary-principle.md`](./RFC/0011-financialization-boundary-principle.md) — Mandatory 3-test boundary checklist for any feature affecting proofs, reputation, or fees.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.
