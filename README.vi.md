# Cypher Guide

**Giao Thức Lưu Trú & Cộng Đồng Phi Tập Trung (Sovereign P2P Protocol)**

> *Hệ thống đặt phòng và định danh phi lưu ký, chống kiểm duyệt xây dựng trên nền tảng Nostr (NIP-01/05/47), mạng lưới Bitcoin Lightning và cơ chế quản trị mật mã tự trị.*

---

## ⚠️ Cảnh Báo An Ninh & Trạng Thái Trưởng Thành Giao Thức

> **Lưu ý**: Vui lòng đọc kỹ [`MATURITY.md`](./MATURITY.md) trước khi tương tác với node thực tế hoặc thử nghiệm.

- **Giai đoạn hiện tại**: **Tier 1 (Devnet / Testnet)**
  - ✅ **Đã hoàn thành**: Ký sự kiện mật mã Schnorr BIP-340 (`@noble/curves`), mã hóa khóa AES-GCM-256 phía client, Quỹ bảo hiểm BFT 2-of-3 Arbitrator Escrow, thuật toán Dynamic Fee, huy hiệu mật mã Proof-of-Stay (Nostr Kind 30078), bộ tự phục hồi dữ liệu Data Reconciler.
  - 🟡 **Đang tích cực triển khai (Tier 2)**: Kết nối đa relay Nostr thời gian thực (WSS WebSocket Relays), kết nối ví Lightning WalletConnect (NWC) mainnet, lưu trữ trạng thái có giới hạn trên L2.
- **Nguyên tắc an toàn**: **TUYỆT ĐỐI KHÔNG nạp hay lưu ký tài sản thật giá trị lớn.** Chỉ thử nghiệm với satoshi testnet hoặc số tiền tối thiểu.

---

## Các Trụ Cột Kiến Trúc Chính

1. **Định Danh Tự Chủ (Nostr Keypairs)**
   - Không email, không mật khẩu, không phụ thuộc máy chủ trung tâm.
   - Định danh người dùng dựa trên cặp khóa công khai/bí mật (`npub`/`nsec`) ký bằng thuật toán Schnorr BIP-340.
2. **Ký Quỹ Phi Lưu Ký Qua Lightning (BOLT-11 & NWC)**
   - Giao dịch đặt phòng ngang hàng được thanh toán tức thì qua Bitcoin Lightning Network.
   - Mã hóa client-side kết nối ví Nostr Wallet Connect (`nostr+walletconnect://`) cho các khoản giải ngân tự động.
3. **Quỹ Bảo Hiểm & Trọng Tài BFT 2-of-3 (RFC-0001)**
   - Cơ chế biểu quyết đa chữ ký bảo vệ tiền đặt cọc của khách và bảo chứng cho host mà không cần nền tảng trung gian giữ tiền.
4. **Phí Động Theo Uy Tín (RFC-0002)**
   - Phí dịch vụ giảm dần dựa trên lịch sử lưu trú và đóng góp được xác thực bằng chữ ký mật mã.
5. **Uy Tín Di Động & Proof-of-Stay (RFC-0003)**
   - Chứng thực nhận phòng/trả phòng (Kind 30078) thuộc sở hữu của người dùng, mang theo được sang mọi ứng dụng Nostr khác.
6. **Lưu Trú Tùy Tâm / Cúng Dường (RFC-0008)**
   - Hỗ trợ thiền viện, homestay cộng đồng theo mô hình tùy tâm (Dana) không thu phí ban đầu.
7. **Tĩnh Tâm & Ranh Giới Tài Chính Hóa (RFC-0010 & RFC-0011)**
   - Nghi thức tĩnh tâm 369s và bộ 3 bài kiểm tra ranh giới ngăn chặn việc thương mại hóa/gamify các trải nghiệm tinh thần vô vụ lợi.

---

## Cấu Trúc Thư Mục

```text
├── RFC/                 # 11 Tài liệu đề xuất tiêu chuẩn & kiến trúc
│   ├── README.md        # Danh mục toàn bộ RFC (0001 - 0011)
│   └── 0011-...md       # Nguyên tắc ranh giới tài chính hóa
├── src/
│   ├── components/      # Các component giao diện React 19
│   ├── locales/         # Bộ từ điển đa ngôn ngữ i18n (vi, en)
│   ├── services/        # Dịch vụ mật mã, Nostr và tra cứu tài liệu
│   ├── utils/           # Thuật toán Schnorr BFT, phí động, Proof-of-Stay
│   └── types.ts         # Khai báo kiểu dữ liệu TypeScript
├── ARCHITECTURE.md      # Tài liệu tổng quan kiến trúc hệ thống
├── MATURITY.md          # Ma trận cấp độ trưởng thành an ninh & nhật ký kiểm toán
├── CONTRIBUTING.md      # Quy tắc đóng góp và quy trình RFC
├── server.ts            # Máy chủ phát triển và proxy tra cứu tài liệu
└── LICENSE              # Giấy phép nguồn mở MIT
```

---

## Hướng Dẫn Cài Đặt & Phát Triển

### Yêu Cầu
- Node.js `20.x` trở lên
- npm hoặc bun

### Khởi Chạy

```bash
# Clone repository
git clone https://github.com/your-username/cypherguide.git
cd cypherguide

# Tạo file biến môi trường từ mẫu
cp .env.example .env

# Cài đặt thư viện
npm install

# Chạy server phát triển
npm run dev
```

Truy cập ứng dụng tại `http://localhost:3000`.

### Kiểm Tra & Build

```bash
# Kiểm tra lỗi TypeScript
npm run lint

# Biên dịch sản phẩm production
npm run build
```

---

## Quản Trị & Đóng Góp

Cypher Guide phát triển thông qua quy trình **RFC (Request for Comments)**. Trước khi tạo Pull Request thay đổi kiến trúc hoặc thêm loại proof mới, vui lòng đọc:

1. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Quy trình đề xuất RFC và đóng góp mã nguồn.
2. [`RFC/0011-financialization-boundary-principle.md`](./RFC/0011-financialization-boundary-principle.md) — Bộ tiêu chuẩn 3 bài kiểm tra bắt buộc trước khi tài chính hóa bất kỳ tính năng mới nào.

---

## Giấy Phép (License)

Phát hành dưới **Giấy phép MIT**. Xem chi tiết tại [`LICENSE`](./LICENSE).
