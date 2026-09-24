# Mức Độ Trưởng Thành & Lộ Trình An Ninh (Cypher Protocol Maturity Matrix)

Dự án Cypher Guide tuân thủ lộ trình phân cấp độ trưởng thành an ninh (Security Maturity Matrix) cho giao thức P2P Cypherpunk:

---

## 📊 Ma Trận Trưởng Thành (Maturity Levels)

| Cấp Độ | Trạng Thái | Đặc Điểm Kỹ Thuật |
| :--- | :--- | :--- |
| **Tier 0: Prototype** | 🟢 **Hoàn thành** | UI/UX React + Vite + Tailwind, Local Storage persistence, Mô phỏng Lightning Invoice BOLT-11. |
| **Tier 1: Devnet / Testnet** | 🟡 **Hoàn thành một phần (Đã vá cốt lõi, Escrow còn Placeholder)** | • **Đã hoàn tất kiểm toán an ninh thực tế:** Mã hóa NIP-49 Vault (`ncryptsec`/`scrypt`, loại bỏ hoàn toàn `sessionStorage` raw key); Phòng thủ SSRF LUD-06 + kiểm tra hạn mức callback; Xác thực chữ ký Schnorr KYC Attestation (Kind 30388) theo whitelist Verifier; Proof-of-Stay (Kind 30078) đồng ký 2 bên (Khách + Host); Xác thực NIP-98 HTTP Auth cho admin endpoints; Magic-byte validation chặn SVG XSS cho media upload; Xác minh mật mã Preimage SHA-256 cho thanh toán Lightning; Tự động hóa kiểm thử Vitest (7 suites/23 tests) & CI GitHub Actions.<br>• **⚠️ CẢNH BÁO BẮT BUỘC:** Hội đồng Trọng tài BFT 2-of-3 hiện dùng public key placeholder cho mục đích demo — **chưa có trọng tài thật nào giữ private key tương ứng**, cơ chế giải quyết tranh chấp escrow hiện KHÔNG khả dụng trên production cho tới khi hoàn tất onboard 3 bên độc lập. |
| **Tier 2: Mainnet Ready** | 🟡 **Đang triển khai** | Tách biệt hoàn toàn build Live (`cypherguide.org`, không code path giả lập) và Testnet Demo (`demo.cypherguide.org`); Kết nối Nostr Relay thực tế (WSS WebSocket Relays), Ví Lightning WalletConnect (Alby / Mutiny / Phoenix), Bounded State Storage trên L2/Rootstock, Hợp đồng ký quỹ Escrow tự động (Đợt 2). |

---

## ⚠️ Giới Hạn Đã Biết (Known Limitations)

1. **Hội đồng Trọng tài (Arbitrator Council) Hiện Là Placeholder**:
   - Toàn bộ public key trong `DEFAULT_ARBITRATOR_POOL` (`insuranceFund.ts`) hiện chỉ đóng vai trò placeholder phục vụ mô phỏng thuật toán đồng thuận BFT 2-of-3 trong môi trường thử nghiệm.
   - **Chưa có bất kỳ trọng tài bên thứ ba độc lập nào nắm giữ private key tương ứng.**
   - Do đó, cơ chế giải quyết tranh chấp (Dispute Resolution) và giải ngân quỹ bảo hiểm (Insurance Payout) **KHÔNG KHẢ DỤNG & KHÔNG ĐẢM BẢO TÍNH PHI TÍN NHIỆM TRÊN PRODUCTION** cho tới khi hoàn tất quy trình onboard 3 bên trọng tài độc lập sở hữu phần cứng lưu trữ khóa riêng riêng biệt.

2. **Cơ Chế Ký Quỹ Escrow Tự Động (Đợt 2 Chưa Hoàn Tất)**:
   - Hiện tại, luồng thanh toán trong bản Live là thanh toán P2P trực tiếp (Direct Settlement) đến địa chỉ Lightning Address (LUD-16) của Host và các bên đồng sở hữu theo tỷ lệ Profit Sharing.
   - Cơ chế giữ cọc phi lưu ký thông minh (DLC / Hold Invoices / Cashu Multi-sig Escrow) đang trong giai đoạn nghiên cứu kiến trúc Đợt 2 và chưa thay thế hoàn toàn giao dịch P2P trực tiếp.

3. **Môi Trường Demo vs Live**:
   - **Bản Live (`cypherguide.org`)**: Được biên dịch với `VITE_PAYMENT_MODE=live`. Không chứa bất kỳ nhánh code giả lập thanh toán hay invoice fake nào. Host bắt buộc phải cung cấp Lightning Address thực tế để nhận thanh toán.
   - **Bản Demo (`demo.cypherguide.org`)**: Được biên dịch với `VITE_PAYMENT_MODE=demo`. Chạy trên Testnet/Signet Lightning thật (Mutinynet/Polar) hoặc môi trường mô phỏng an toàn, có banner cảnh báo cố định không thể tắt.

---

## 🔒 Kiểm Toán An Ninh Đã Thực Hiện (Audit Log)

1. **NIP-49 Vault Encryption (H1)**: Mã hóa khóa riêng Nostr bằng chuẩn NIP-49 (`ncryptsec` / `scrypt`), thay thế mã PIN yếu và loại bỏ hoàn toàn việc lưu trữ khóa thô trong `sessionStorage`/`localStorage`.
2. **KYC Attestation Signature Verification (H2)**: Kiểm tra chữ ký Schnorr (`verifyEvent`) của chứng nhận KYC (Kind 30388) và đối chiếu `event.pubkey` mật mã thực tế với whitelist Verifier của Host (thay vì tin cậy `verifierNpub` do client khai báo).
3. **Dual-Signed Proof-of-Stay (H3)**: Chuẩn hóa Proof-of-Stay (Kind 30078) bắt buộc đồng ký 2 bên: Khách tạo claim event và Host ký endorsement event trỏ tới claim id; từ chối đơn phương tự ký.
4. **SSRF Defense & LUD-06 Amount Verification (H4)**: Lớp phòng thủ SSRF cho bộ giải mã Lightning Address (chặn dải IP nội bộ/loopback, ép HTTPS, timeout chặt) và kiểm tra amount callback nằm trong khoảng `[minSendable, maxSendable]`.
5. **NIP-98 HTTP Auth Cho Endpoint Cấu Hình Admin (C1)**: Bảo vệ API routes quản trị bằng xác thực chữ ký Nostr HTTP Auth (NIP-98) với timestamp replay protection và whitelist npub quản trị viên.
6. **Magic-Byte Validation Cho Media Upload (C3)**: Xác thực tệp tin hình ảnh qua magic bytes (PNG, JPEG, WebP, GIF), chặn triệt để SVG để ngăn ngừa tấn công Stored XSS.
7. **Preimage Cryptographic Verification Cho Xác Nhận Thanh Toán (C4)**: Xác minh mật mã `SHA-256(preimage) === payment_hash` trước khi xác nhận trạng thái thanh toán Lightning thành công, ngăn chặn invoice giả mạo hoặc preimage tùy ý.
8. **Chữ Ký Schnorr Trọng Tài BFT & 32-Byte Hash**: Tích hợp `finalizeEvent` & `verifyEvent` chính thức từ `nostr-tools`. Băm SHA-256 32-byte chuẩn hóa trước khi ký hoặc đối chiếu quorum.
9. **NWC Key Storage Security**: Khóa riêng NWC / Nostr nsec được mã hóa bằng AES-GCM-256 trên bộ nhớ client; không gửi privKey lên localStorage thô.
10. **Data Reconciliation**: `DataReconciler.heal()` loại bỏ các booking nghi vấn (quarantined) thiếu `paymentHash`.
11. **Trợ Lý Tra Cứu Tài Liệu (RFC-0005) (Experimental Tier)**: Server proxy cô lập để gọi Gemini API, tích hợp System Prompt bị khóa cứng phạm vi tài liệu chính thức (`RFC/*.md`, `ARCHITECTURE.md`, `MATURITY.md`, `POSITIONING.md`), bắt buộc trả lời "Chưa có tài liệu về việc này" khi ngoài phạm vi và hiển thị nhãn miễn trừ trách nhiệm cố định.
12. **Lớp KYC Tùy Chọn (RFC-0006) (Experimental Tier)**: Loại bỏ hoàn toàn luồng tự-cấp attestation khỏi giao diện production (chỉ bật giả lập trong local dev mode `import.meta.env.DEV`), loại bỏ nút gợi ý pre-set verifier ở modal host (chỉ chấp nhận danh sách npub nhập tự do validate bech32 checksum), đảm bảo attestation Kind 30388 phải do Verifier bên thứ 3 thực sự ký bằng khóa riêng độc lập.
13. **Ranh Giới Chủ Quyền & Cảnh Báo Pháp Lý Host (RFC-0012) (Draft/Boundary Tier)**: Định nghĩa rõ ranh giới giữa tầng công nghệ phi tập trung và chủ quyền pháp lý quốc gia (khai báo tạm trú, thuế, PCCC theo Nghị định 282/2025/NĐ-CP). Tích hợp cảnh báo trực tiếp trong luồng đăng ký Host (`HostRegistrationModal.tsx`) và tạo tài liệu tham khảo cộng đồng `HOST_LEGAL_REALITY.md` độc lập với giao thức.
14. **Lưu Trú Sẵn Sàng Cho Agent (RFC-0013) (Draft Tier)**: Chuẩn hóa tag tiện nghi `AGENT-READY` cho khách lưu trú cypherpunk/freelancer mang theo AI agent chạy liên tục. Khách luôn luôn là con người (RFC-0003 không đổi), agent chỉ là công cụ/hành lý mang theo; không tạo chợ compute đối đầu với Akash/io.net; không tạo danh tính hay thang điểm uy tín riêng cho bot; xác minh khách quan qua 3 tiêu chí kỹ thuật bắt buộc (compute node SBC/mini-PC riêng không chia sẻ, Nostr relay riêng do host tự vận hành, cam kết sàn băng thông tối thiểu Mbps) bằng machine metrics tương tự `VERIFIED_NODE`; giữ nguyên trách nhiệm pháp lý của host theo RFC-0012.
15. **Bản Định Vị AI Cục Bộ (POSITIONING.md) (Experimental Tier)**: Xác lập rõ ràng luận điểm định vị của CypherGuide về AI cục bộ: không tham gia cuộc đua compute nghìn tỷ đô (độc lập khẳng định qua 3 cột trụ của TS. Phạm Hy Hiếu: Algorithm, Data, Compute), giữ vững mức trưởng thành Experimental cho RFC-0009/0013 chỉ nâng hạng khi có số liệu thực nghiệm công khai, từ chối các đề xuất chợ compute (DVM NIP-90) hay agent tự chủ tài chính không giới hạn.
