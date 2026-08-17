# Cypher Guide

**Sovereign Peer-to-Peer Lodging & Community Protocol**

> *A non-custodial, censorship-resistant booking and identity protocol built on Nostr (NIP-01/05/47), Bitcoin Lightning Network, and autonomous cryptographic governance.*

---

## ⚠️ Security Notice & Protocol Maturity Status

> **Important**: Please review [`MATURITY.md`](./MATURITY.md) before interacting with live nodes or testing.

- **Current Stage**: **Tier 1 (Devnet / Testnet)**
  - ✅ **Completed**: BIP-340 Schnorr cryptographic event signing (`@noble/curves`), AES-GCM-256 client-side secret encryption, 2-of-3 BFT Arbitrator Council escrow, Dynamic Fee algorithms, cryptographic Proof-of-Stay badges (Nostr Kind 30078), self-healing client data reconcilers.
  - 🟡 **In Active Development (Tier 2)**: Live multi-relay WebSocket connections (WSS), production Lightning WalletConnect (NWC) mainnet bindings, and bounded layer-2 state storage.
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
git clone https://github.com/your-username/cypherguide.git
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
# Run TypeScript typechecks
npm run lint

# Build production bundle
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
