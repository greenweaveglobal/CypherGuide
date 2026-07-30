# Hướng Dẫn Đóng Góp Phát Triển Cypher Guide (Cypher Protocol v1.1)

Chào mừng bạn đến với dự án **Cypher Guide** — Giao thức đặt phòng lưu trú P2P phi tập trung, bảo mật mật mã và thanh toán qua Lightning Network & Nostr.

---

## 1. Quy Ước Tài Liệu & Đồng Bộ Ngôn Ngữ

- **Bản Gốc Việt (`*.vi.md`)**: Tất cả quy định và RFCs lấy bản tiếng Việt làm nguồn sự thật.
- **Bản Dịch Anh (`*.en.md`)**: Bản dịch đồng bộ. Khi thực hiện PR sửa đổi tài liệu, vui lòng cập nhật song song cả 2 bản.

---

## 2. Nguyên Tắc Cốt Lõi (Core Principles)

1. **No-KYC & Zero Trust**: Mọi tương tác người dùng phải dựa trên cặp khóa Nostr (bech32 `npub` / `nsec` & hex `pubkey` / `privKey`). Không sử dụng Server tập trung, không thu thập thông tin cá nhân.
2. **Cryptographic Verification**: Mọi thông điệp, bình luận, phiếu bầu quản trị, và chứng nhận lưu trú phải được ký bằng Schnorr / Nostr Event Signatures (`nostr-tools`, `@noble/curves`).
3. **NUT-11 2-of-3 Multisig Escrow**: Tiền cọc được khóa bằng hợp đồng P2PK 2-of-3 giữa Khách, Chủ nhà và Trọng tài từ `DEFAULT_ARBITRATOR_POOL`.
4. **Self-Healing Reconciliation**: Dữ liệu local lưu trên Zustand store & localStorage phải đi qua `DataReconciler.heal()` và `DataReconciler.verifyIntegrity()` để đảm bảo toàn vẹn.
5. **Continuous i18n First**: Mọi tính năng UI mới thêm sau khi i18n đã hoàn thành phải tự chạy qua `t()` ngay từ đầu, không đợi audit riêng phát hiện ra.

---

## 3. Quy Trình Kiểm Tra Code

Khi phát triển tính năng mới, bắt buộc chạy linter và build thử nghiệm:
```bash
npm run lint
npm run build
```
Cả hai lệnh phải thành công 100% trước khi gửi PR.
