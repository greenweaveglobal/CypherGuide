# Hướng Dẫn Đóng Góp Phát Triển Cypher Guide (Cypher Protocol v1.1)

Chào mừng các Cypherpunk Developer đến với dự án **Cypher Guide** — Giao thức đặt phòng lưu trú P2P phi tập trung, bảo mật mật mã và thanh toán qua Lightning Network & Nostr.

---

## 1. Nguyên Tắc Cốt Lõi (Core Principles)

1. **No-KYC & Zero Trust**: Mọi tương tác người dùng phải dựa trên cặp khóa Nostr (bech32 `npub` / `nsec` & hex `pubkey` / `privKey`). Không sử dụng Server tập trung, không thu thập thông tin cá nhân.
2. **Cryptographic Verification**: Mọi thông điệp, bình luận, phiếu bầu quản trị, và chứng nhận lưu trú phải được ký bằng Schnorr / Nostr Event Signatures (Event Kind 1, Kind 4 Direct Message, NIP-04 / NIP-44 NWC).
3. **Double-Entry & Self-Healing Reconciliation**: Dữ liệu local lưu trên Zustand store & localStorage phải đi qua `DataReconciler.heal()` và `DataReconciler.verifyIntegrity()` để đảm bảo toàn vẹn.
4. **BFT Insurance Fund & 2-of-3 Escrow**: Giải quyết tranh chấp thông qua nhóm Trọng tài BFT (Quorum 2/3 chữ ký) và khóa tiền đặt cọc bằng hợp đồng Timelock / Multisig Escrow.

---

## 2. Quy Trình Hợp Nhất & Phát Triển (Branch Strategy)

* **Main Branch**: Bản phát hành chính thức đã qua kiểm toán (Audit Clean).
* **Feature Branches**:
  * `feature/bft-insurance-schnorr`: Tích hợp chữ ký Schnorr thật từ `nostr-tools` cho phiếu bầu trọng tài.
  * `feature/host-dashboard-proof-of-stay`: Giao diện quản lý Chủ nhà, tiền ký quỹ và Bằng chứng lưu trú.
* Khi hợp nhất (Merge): Bắt buộc kiểm tra `lint_applet` và `compile_applet` đạt kết quả Build thành công.

---

## 3. Cấu Trúc Dự Án (Project Anatomy)

* `/src/utils/crypto.ts`: Mã hóa NWC AES-GCM-256, ký tin nhắn Nostr, kiểm tra chữ ký Schnorr (`nostr-tools`).
* `/src/utils/governanceSchema.ts`: Schema Zod & Xác thực chữ ký Nostr Event cho GovernanceAct.
* `/src/utils/reconciler.ts`: Động cơ đồng thuận & Tự chữa lành dữ liệu (DataReconciler).
* `/src/utils/depositEscrow.ts`: Quản lý tiền cọc 2-of-3 Multisig / Timelock Escrow.
* `/src/utils/proofOfStay.ts`: Tạo và kiểm tra Bằng chứng lưu trú (Proof of Stay).
* `/src/utils/dynamicFee.ts`: Tính phí giao thức động (Dynamic Protocol Fee).
* `/src/components/HostDashboard.tsx`: Bảng điều khiển Chủ nhà.
* `/src/components/GovernancePanel.tsx`: Quản trị Quỹ bảo hiểm BFT & Đề xuất cộng đồng.
