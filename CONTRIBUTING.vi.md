# Hướng Dẫn Đóng Góp Phát Triển Cypher Guide (Cypher Protocol v1.1)

Chào mừng các Cypherpunk Developer đến với dự án **Cypher Guide** — Giao thức đặt phòng lưu trú P2P phi tập trung, bảo mật mật mã và thanh toán qua Lightning Network, Cashu Ecash & Nostr.

---

## 1. Quy Ước Tài Liệu & Đồng Bộ Ngôn Ngữ (RFC-0004)

- **Bản Gốc Tiếng Việt (`*.vi.md` / `*.md`)**: Tất cả quy định kiến trúc và RFCs lấy bản tiếng Việt làm nguồn sự thật (source of truth).
- **Bản Dịch Tiếng Anh (`*.en.md`)**: Bản dịch đồng bộ 1:1. Khi gửi Pull Request sửa đổi bất kỳ tài liệu nào, **bắt buộc cập nhật song song cả 2 bản** trong cùng một PR để tránh lệch pha nội dung.

---

## 2. Nguyên Tắc Kỹ Thuật Cốt Lõi (Core Principles)

1. **No-KYC & Zero Trust**: Mọi tương tác người dùng phải dựa trên cặp khóa Nostr (bech32 `npub` / `nsec` & hex `pubkey` / `privKey`). Không sử dụng Server tập trung, không thu thập thông tin cá nhân (PII).
2. **Cryptographic Verification**: Mọi thông điệp, bình luận, phiếu bầu quản trị, và chứng nhận lưu trú phải được ký bằng chữ ký Schnorr BIP-340 (`nostr-tools`, `@noble/curves`).
3. **NUT-11 2-of-3 Multisig Escrow**: Tiền cọc bảo chứng được khóa bằng hợp đồng P2PK 2-of-3 giữa Khách (Guest), Chủ nhà (Host) và Trọng tài từ `DEFAULT_ARBITRATOR_POOL`.
4. **Self-Healing Reconciliation**: Dữ liệu lưu trữ local trên Zustand store & localStorage bắt buộc đi qua `DataReconciler.heal()` và `DataReconciler.verifyIntegrity()` để đảm bảo tính toàn vẹn và chống trôi dữ liệu.
5. **Continuous i18n First**: Mọi tính năng UI mới thêm vào phải tự động bọc chuỗi hiển thị qua hàm `t()` từ điển tĩnh ngay từ đầu, không hardcode tiếng Việt hay tiếng Anh.
6. **Financialization Boundary (RFC-0011)**: Mọi đề xuất sinh ra proof mới, tính điểm uy tín hoặc tác động phí bắt buộc phải vượt qua 3 bài kiểm tra (Verifiability, Protocol-Purpose, Original-Meaning) trước khi triển khai code.

---

## 3. Chiến Lược Nhánh (Branch Strategy)

- **`main`**: Bản phát hành chính thức, mã nguồn sạch, đã vượt qua toàn bộ quy trình kiểm toán linter và build.
- **Feature Branches**:
  - `feature/bft-insurance-schnorr`: Tích hợp và kiểm thử chữ ký Schnorr cho phiếu bầu trọng tài BFT.
  - `feature/host-dashboard-proof-of-stay`: Giao diện quản lý Chủ nhà, tiền ký quỹ và Bằng chứng lưu trú (Proof-of-Stay Kind 30078).
- **Quy tắc Merge**: Mọi PR phải qua review, không có merge conflict, và vượt qua kiểm tra `npm run lint` cùng `npm run build`.

---

## 4. Cấu Trúc Mã Nguồn Cốt Lõi (Project Anatomy)

* `/src/utils/crypto.ts`: Mã hóa NWC AES-GCM-256, ký tin nhắn Nostr, xác thực chữ ký Schnorr BIP-340.
* `/src/utils/governanceSchema.ts`: Schema Zod & Xác thực chữ ký Nostr Event cho các hành động quản trị (GovernanceAct).
* `/src/utils/reconciler.ts`: Động cơ đồng thuận & Tự chữa lành dữ liệu cục bộ (`DataReconciler`).
* `/src/utils/depositEscrow.ts`: Quản lý tiền cọc 2-of-3 Multisig / Timelock Escrow.
* `/src/utils/proofOfStay.ts`: Tạo, ký và xác thực Bằng chứng lưu trú di động (`Proof-of-Stay` Kind 30078).
* `/src/utils/dynamicFee.ts`: Thuật toán tính phí giao thức động theo đường cong uy tín logarit (RFC-0002).
* `/src/components/HostDashboard.tsx`: Bảng điều khiển Chủ nhà, quản lý phòng trọ, xác nhận check-in/check-out.
* `/src/components/GovernancePanel.tsx`: Giao diện quản trị Quỹ bảo hiểm BFT & bỏ phiếu trọng tài.

---

## 5. Quy Trình Kiểm Tra & Đóng Góp Code (Workflow)

Trước khi commit hoặc mở PR, chạy kiểm tra toàn bộ mã nguồn:

```bash
# Kiểm tra cú pháp và kiểu dữ liệu TypeScript
npm run lint

# Biên dịch thử nghiệm gói sản phẩm
npm run build
```

Cả hai lệnh trên phải trả về kết quả 0 lỗi (clean build) thì PR mới hợp lệ.
