# Mức Độ Trưởng Thành & Lộ Trình An Ninh (Cypher Protocol Maturity Matrix)

Dự án Cypher Guide tuân thủ lộ trình phân cấp độ trưởng thành an ninh (Security Maturity Matrix) cho giao thức P2P Cypherpunk:

---

## 📊 Ma Trận Trưởng Thành (Maturity Levels)

| Cấp Độ | Trạng Thái | Đặc Điểm Kỹ Thuật |
| :--- | :--- | :--- |
| **Tier 0: Prototype** | 🟢 **Hoàn thành** | UI/UX React + Vite + Tailwind, Local Storage persistence, Mô phỏng Lightning Invoice BOLT-11. |
| **Tier 1: Devnet / Testnet** | 🟢 **Hoàn thành** | Chữ ký Schnorr Nostr Event (`nostr-tools`), NWC Encrypted AES-GCM-256, Quỹ BFT Insurance 2-of-3 Quorum, Phí động Dynamic Fee, Proof-of-Stay Hash, DataReconciler Self-Healing. |
| **Tier 2: Mainnet Ready** | 🟡 **Đang triển khai** | Kết nối Nostr Relay thực tế (WSS WebSocket Relays), Ví Lightning WalletConnect (Alby / Mutiny / Phoenix), Bounded State Storage trên L2/Rootstock. |

---

## 🔒 Kiểm Toán An Ninh Đã Thực Hiện (Audit Log)

1. **Chữ Ký Schnorr Trọng Tài BFT**: Tích hợp `finalizeEvent` & `verifyEvent` chính thức từ `nostr-tools`. Loại bỏ hoàn toàn mock signatures.
2. **NWC Key Storage Security**: Khóa riêng NWC / Nostr nsec được mã hóa bằng AES-GCM-256 trên bộ nhớ client; không gửi privKey lên localStorage thô.
3. **Data Reconciliation**: `DataReconciler.heal()` loại bỏ các booking nghi vấn (quarantined) thiếu `paymentHash`.
4. **Trợ Lý Tra Cứu Tài Liệu (RFC-0005) (Experimental Tier)**: Server proxy cô lập để gọi Gemini API, tích hợp System Prompt bị khóa cứng phạm vi tài liệu chính thức (`RFC/*.md`, `ARCHITECTURE.md`, `MATURITY.md`), bắt buộc trả lời "Chưa có tài liệu về việc này" khi ngoài phạm vi và hiển thị nhãn miễn trừ trách nhiệm cố định.
5. **Lớp KYC Tùy Chọn (RFC-0006) (Experimental Tier)**: Loại bỏ hoàn toàn luồng tự-cấp attestation khỏi giao diện production (chỉ bật giả lập trong local dev mode `import.meta.env.DEV`), loại bỏ nút gợi ý pre-set verifier ở modal host (chỉ chấp nhận danh sách npub nhập tự do validate bech32 checksum), đảm bảo attestation Kind 30388 phải do Verifier bên thứ 3 thực sự ký bằng khóa riêng độc lập.
6. **Ranh Giới Chủ Quyền & Cảnh Báo Pháp Lý Host (RFC-0012) (Draft/Boundary Tier)**: Định nghĩa rõ ranh giới giữa tầng công nghệ phi tập trung và chủ quyền pháp lý quốc gia (khai báo tạm trú, thuế, PCCC theo Nghị định 282/2025/NĐ-CP). Tích hợp cảnh báo trực tiếp trong luồng đăng ký Host (`HostRegistrationModal.tsx`) và tạo tài liệu tham khảo cộng đồng `HOST_LEGAL_REALITY.md` độc lập với giao thức.
7. **Lưu Trú Bằng Compute (RFC-0013) (Draft/Experimental Tier)**: Mở rộng định nghĩa 'khách' sang AI agent tự động thuê tài nguyên (CPU, RAM, băng thông) trên node SBC/LoRa của host. Ràng buộc bất biến: Quyền ký giao dịch và thanh toán luôn thuộc về npub con người sở hữu agent với hạn mức chi tiêu cứng (spending cap); xác minh bằng số liệu máy đo khách quan; thang uy tín tách biệt; giá cố định có escrow; giữ nguyên trách nhiệm pháp lý của host theo RFC-0012.
