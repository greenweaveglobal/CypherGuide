# Mức Độ Trưởng Thành & Lộ Trình An Ninh (Cypher Protocol Maturity Matrix)

Dự án Cypher Guide tuân thủ lộ trình phân cấp độ trưởng thành an ninh (Security Maturity Matrix) cho giao thức P2P Cypherpunk:

---

## 📊 Ma Trận Trưởng Thành (Maturity Levels)

| Cấp Độ | Trạng Thái | Đặc Điểm Kỹ Thuật |
| :--- | :--- | :--- |
| **Tier 0: Prototype** | 🟢 **Hoàn thành** | UI/UX React 18 + Vite + Tailwind, Local Storage persistence, Mô phỏng Lightning Invoice BOLT-11. |
| **Tier 1: Devnet / Testnet** | 🟢 **Hoàn thành** | Chữ ký Schnorr Nostr Event (`@noble/curves`), NWC Encrypted AES-GCM-256, Quỹ BFT Insurance 2/3 Quorum, Phí động Dynamic Fee, Proof-of-Stay Badge (Kind 30078), DataReconciler Self-Healing. |
| **Tier 2: Mainnet Ready** | 🟡 **Đang triển khai** | Kết nối Nostr Relay thực tế (WSS WebSocket Relays), Ví Lightning WalletConnect (Alby / Mutiny / Phoenix), Cashu Mint Integration. |

---

## 🔒 Kiểm Toán An Ninh Đã Thực Hiện (Audit Log)

1. **Chữ Ký Schnorr Trọng Tài BFT & 32-Byte Hash**: Tích hợp `schnorr.sign` & `schnorr.verify` từ `@noble/curves`. Tự động băm SHA-256 32-byte tránh crash do chuỗi JSON dài.
2. **Khóa Ký Quỹ 2-of-3 Multisig Escrow**: Lấy khóa Trọng tài thực sự từ `DEFAULT_ARBITRATOR_POOL` trong `insuranceFund.ts` thay vì hardcode key giả.
3. **NWC Key Storage Security**: Khóa riêng NWC / Nostr nsec được mã hóa bằng AES-GCM-256 trên bộ nhớ client; không gửi privKey lên localStorage thô.
4. **Data Reconciliation**: `DataReconciler.heal()` loại bỏ các booking nghi vấn (quarantined) thiếu `paymentHash`.
5. **Trợ Lý Tra Cứu Tài Liệu (RFC-0005) (Experimental Tier)**: Server proxy cô lập để gọi Gemini API, tích hợp System Prompt bị khóa cứng phạm vi tài liệu chính thức (`RFC/*.md`, `ARCHITECTURE.md`, `MATURITY.md`), bắt buộc trả lời "Chưa có tài liệu về việc này" khi ngoài phạm vi và hiển thị nhãn miễn trừ trách nhiệm cố định.
