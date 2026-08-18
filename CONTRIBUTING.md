# Contributing to Cypher Guide / Hướng Dẫn Đóng Góp

Welcome to **Cypher Guide** — a sovereign, non-custodial P2P hospitality protocol powered by Bitcoin Lightning Network, Cashu Ecash, and Nostr.

---

### 🌐 Select Language / Chọn Ngôn Ngữ:

- 🇻🇳 **Tiếng Việt (Bản chuẩn gốc)**: [`CONTRIBUTING.vi.md`](./CONTRIBUTING.vi.md)
- 🇬🇧 **English (Full synchronized guide)**: [`CONTRIBUTING.en.md`](./CONTRIBUTING.en.md)

---

## Quick Reference / Tóm Tắt Nhanh

### 1. Core Principles / Nguyên Tắc Cốt Lõi
- **No-KYC & Zero Trust**: Nostr `npub`/`nsec` keypairs only. No centralized databases.
- **BIP-340 Schnorr Signatures**: All reviews, bookings, governance acts, and stays are cryptographically signed.
- **NUT-11 2-of-3 Multisig Escrow**: Non-custodial arbitrator escrow for guest security deposits.
- **RFC-0011 Boundary Principle**: New proofs or reputation metrics must pass the 3-test boundary checklist.

### 2. Code Verification / Kiểm Tra Code
Before submitting any Pull Request:
```bash
npm run lint
npm run build
```
Both checks must complete with zero errors.

### 3. Documentation Synchronicity / Đồng Bộ Tài Liệu
All RFCs and architectural documents exist in paired `.md` / `.vi.md` (Vietnamese source of truth) and `.en.md` (English translation). Always update both versions in the same PR.
