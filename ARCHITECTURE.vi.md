# Kiến Trúc Giao Thức Cypher Protocol (Cypher Protocol Architecture Specification)

**Phiên Bản:** v1.1.0-Cypher
**Tác Giả:** Cypherpunk Core Developers
**Ngôn Ngữ:** Tiếng Việt (Nguồn sự thật)

---

## Donation — Xác Thực Địa Chỉ Chính Thức

Cypher Guide chỉ có **một** địa chỉ nhận donate chính thức duy nhất:

```
npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh
```

Đây là npub duy nhất được xác thực bởi dự án. Bất kỳ npub nào khác tự nhận là "địa chỉ donate Cypher Guide" đều là giả mạo — vui lòng kiểm tra khớp chính xác chuỗi trên trước khi gửi bất kỳ khoản Zap/Sats nào. Tài khoản này **không** dùng để phát ngôn/thông báo chính thức của dự án (xem kênh marketing riêng).

---

## 1. Tổng Quan Hệ Thống

Cypher Guide là nền tảng Đặt phòng & Lưu trú P2P phi tập trung, hoạt động hoàn toàn trên kiến trúc Client-Side kết hợp mạng Nostr Relays và Bitcoin Lightning Network.

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

## 2. Các Module Kỹ Thuật Chính

### 2.1 Crypto Engine (`/src/utils/crypto.ts`)
- Chữ ký Schnorr BIP-340: `signRawSchnorr` & `verifyRawSchnorr` băm SHA-256 32-byte an toàn cho mọi thông điệp.
- Mã hóa NWC: `encryptNwcPayload` & `decryptNwcPayload` dùng AES-GCM-256 + HKDF.

### 2.2 Cashu & Escrow (`/src/utils/cashu.ts` & `/src/utils/depositEscrow.ts`)
- Mở rộng Cashu NUT-11 P2PK 2-of-3 Multisig: Khóa cọc cược giữa Khách, Chủ nhà và Trọng tài BFT từ `DEFAULT_ARBITRATOR_POOL`.
- Giải ngân an toàn: `redeemCashuToken()` kiểm tra P2PK Witness Schnorr locally trước khi cho phép rút tiền.

### 2.3 Proof of Stay (`/src/utils/proofOfStay.ts`)
- Chuẩn hóa RFC-0003 & NIP-78 (Kind 30078): Đúc Badge NFT chứng nhận lưu trú bằng SHA-256 & chữ ký Nostr của Khách khi Checkout tại `MyTrips.tsx`.

### 2.4 Quản Trị BFT (`/src/utils/protocolGovernance.ts` & `insuranceFund.ts`)
- BFT Consensus: Giải quyết tranh chấp và sửa đổi tham số giao thức chỉ thực thi khi đạt $\ge 2/3$ Quorum chữ ký Trọng tài.
- Quadratic Voting: Biểu quyết cộng đồng theo trọng số cọc Sats & thời gian khóa.

### 2.5 Phí Động & Hạ Tầng (`/src/utils/dynamicFee.ts`, `infraContribution.ts`, `referral.ts`)
- Phí động `calculateDynamicFee()` nạp vào Quỹ Bảo Hiểm BFT.
- Thưởng hạ tầng Meshnet Relay Node qua `calculateNodeIncentiveReward()`.
- Nhận thưởng giới thiệu `claimReferralReward()` chuyển Sats trực tiếp qua Lightning Address.

### 2.6 Server Proxy Ngoại Lệ Cho Trợ Lý Tra Cứu AI (`server.ts` & `src/components/DocsAssistant.tsx` - RFC-0005)
- **Đánh đổi & Ngoại lệ kiến trúc:** Để tích hợp tính năng Tra Cứu Tài Liệu Tự Động (RFC-0005) qua Gemini API mà không làm lộ `GEMINI_API_KEY` ra trình duyệt client, hệ thống sử dụng một endpoint Server Proxy nhỏ (`/api/docs-assistant/query` trên `server.ts`).
- **Phân định ranh giới rõ ràng:** Đây là **ngoại lệ có ý thức (conscious exception)** hoàn toàn độc lập và tách biệt khỏi Layer 2 của giao thức Cypher Guide. Toàn bộ các luồng giao dịch cốt lõi của giao thức (đặt phòng P2P, chữ ký Nostr Schnorr, ví Lightning Network, khóa cọc Cashu Escrow) vẫn hoạt động 100% Client-Side / Serverless, không phụ thuộc hay truyền qua máy chủ backend này.
