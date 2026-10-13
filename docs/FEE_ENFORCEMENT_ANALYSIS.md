# Phân tích cơ chế thu phí giao thức CypherGuide (Protocol Fee Enforcement Analysis)

- **Trạng thái:** Báo cáo kỹ thuật (Technical Architecture Report)
- **Tác giả:** Kỹ sư hệ thống AI (Đợt 13)
- **Mục tiêu:** Xác minh nguồn gốc mã nguồn luồng thanh toán phí, đánh giá tính ràng buộc ở tầng giao thức (enforcement boundary), phân tích các hướng giải pháp khả thi và đề xuất kiến trúc cho các đợt phát triển tiếp theo.
- **Phạm vi:** Không sửa đổi mã thực thi hiện tại; tài liệu hóa sự thật khách quan từ codebase.

---

## 1. Khảo sát luồng thanh toán hiện tại (Source Code Truth)

Khảo sát chi tiết ba module then chốt: `src/components/BookingModal.tsx`, `src/utils/depositEscrow.ts`, và `src/utils/reconciler.ts`.

### 1.1 Luồng thanh toán trong `BookingModal.tsx`

1. **Tính toán phí (Client-side):**
   - Khi khách hàng chọn ngày nhận/trả phòng và phòng lưu trú, `BookingModal.tsx` gọi hàm `calculateDynamicFee(...)` ngay tại trình duyệt client của khách (dòng 80-93 trong `src/utils/dynamicFee.ts`).
   - Phí giao thức (`protocolFeeSats`) được tính theo công thức:
     $$\text{protocolFeeSats} = \max(\text{minFeeSats}, \min(\text{maxFeeSats}, \text{amountSats} \times \text{baseRatePcm} / 10000 \times \text{multipliers}))$$
2. **Tạo hóa đơn Lightning tách đôi (Dual-Invoice Model - RFC-0016):**
   - **Hóa đơn 1 (Host Room Invoice):** Client gọi LNURL resolver tới `targetLightningAddress` của Host để lấy BOLT-11 invoice cho số tiền phòng (`finalHostSats = totalPriceSats`).
   - **Hóa đơn 2 (Treasury Protocol Invoice):** Client gọi LNURL resolver tới `treasuryAddress` (`infraIncentiveTreasuryLightningAddress`, lấy từ cấu hình protocol) để lấy BOLT-11 invoice riêng cho số tiền phí (`finalTreasurySats = protocolFeeSats`).
   - *Trường hợp gộp (Fallback merge):* Nếu `protocolFeeSats < 1` Sat hoặc node LNURL của Treasury gặp sự cố kết nối, client tự động gộp phí vào hóa đơn của Host (`finalHostSats = totalPriceSats + protocolFeeSats`, `finalTreasurySats = 0`).
3. **Thanh toán & Chuyển trạng thái:**
   - Khách trả hóa đơn Host qua WebLN / NWC hoặc thủ công (trình duyệt nhận preimage).
   - Khách trả hóa đơn Treasury riêng biệt (hoặc bỏ qua nếu đã gộp).
   - Khi hoàn tất, client tự tạo đối tượng `Booking` với `status: 'paid'`, lưu vào Zustand store cục bộ (`addBooking`) và phát sóng sự kiện Nostr lên relay.

### 1.2 Vai trò của `depositEscrow.ts`

- `depositEscrow.ts` chỉ quản lý khoản **tiền đặt cọc (Refundable Deposit)** thông qua NUT-11 Ecash 2-of-3 Multisig P2PK (Khách + Chủ nhà + Trọng tài BFT) hoặc HTLC timelock.
- Module này **hoàn toàn độc lập** với khoản phí giao thức `protocolFeeSats`. Tiền đặt cọc chỉ giải ngân khi khách check-out thành công (có Proof-of-Stay) hoặc khi có phán quyết trọng tài BFT. Không có bất kỳ logic nào trong `depositEscrow.ts` kiểm tra xem phí giao thức đã được chuyển vào Treasury hay chưa.

### 1.3 Vai trò của `reconciler.ts` (DataReconciler)

- `DataReconciler.heal(...)` kiểm tra tính toàn vẹn dữ liệu:
  - Loại bỏ các listing không hợp lệ (`!l.id || !l.coOwners`).
  - Cách ly (`quarantined`) các booking tự nhận `status: 'paid'` nhưng thiếu `paymentHash`.
- **Hạn chế:** `reconciler.ts` chỉ kiểm tra xem booking có `paymentHash` của tiền phòng hay không, **không kiểm tra** bằng chứng thanh toán preimage của hóa đơn Treasury, và không so sánh số tiền đã trả với tỷ lệ phí giao thức thực tế.

---

## 2. Lỗ hổng: Điều gì ngăn client đã sửa bỏ qua phí?

### Kết luận xác nhận:
> **Hiện tại KHÔNG CÓ BẤT KỲ CƠ CHẾ NÀO ở tầng giao thức ép buộc thanh toán phí Treasury.**

Một kẻ tấn công hoặc một người dùng sử dụng client đã sửa đổi mã nguồn (modified client / custom script) có thể:
1. Đặt `protocolFeeSats = 0` hoặc tự gán cờ `isTreasuryMerged = true` mà không cộng dồn tiền vào hóa đơn Host.
2. Hoàn toàn bỏ qua bước gọi thanh toán tới `treasuryInvoice`.
3. Tự phát sóng Nostr event Kind 1 khai báo booking hợp lệ chỉ với `paymentHash` của Host.
4. Host vẫn nhận đủ 100% tiền phòng từ hóa đơn của họ và vui vẻ tiếp đón khách, trong khi Quỹ Hạ Tầng (Treasury) không nhận được bất kỳ satoshi nào.

Nguyên nhân cốt lõi: **Kiến trúc client-side hiện tại tin tưởng vào trình duyệt của khách trong việc tự khai báo và tự nộp thuế giao thức (Honest Client Assumption).**

---

## 3. Các hướng giải pháp khả thi

| Phương án | Cơ chế hoạt động | Ưu điểm | Nhược điểm |
| :--- | :--- | :--- | :--- |
| **Phương án 1: Gộp phí vào hóa đơn Host (Host Fee Deduction / Split Payment)** | Khách chỉ thanh toán 1 hóa đơn duy nhất cho Host. Khi Host nhận tiền hoặc khi giải phóng cọc/doanh thu, ứng dụng của Host (hoặc ví Lightning hỗ trợ routing/splits như LND keysend / NWC) tự động trích nộp phí giao thức về Treasury. | - UX cực kỳ mượt mà: Khách chỉ quét 1 mã QR duy nhất.<br>- Tránh lỗi minSendable của các ví LNURL khi phí quá nhỏ (dưới 10 sats). | - Phụ thuộc vào thiện chí của Host hoặc yêu cầu ví của Host phải có tính năng split tự động (NWC auto-zap).<br>- Nếu Host dùng ví cá nhân không hỗ trợ hook, giao thức vẫn không ép buộc được. |
| **Phương án 2: Ràng buộc mở khóa Escrow bằng Bằng chứng nộp phí (Escrow Proof-of-Fee Lock)** | Khóa tiền ký quỹ (hoặc toàn bộ tiền lưu trú qua Escrow) theo điều kiện: Tiền cọc/tiền phòng chỉ được giải tỏa cho Host khi cung cấp Preimage chứng minh hóa đơn Treasury đã được thanh toán (`verifyLightningPreimage(treasuryPreimage, treasuryPaymentHash)`). | - Ràng buộc bằng mật mã học (Cryptographic enforcement): Không trả phí thì không thể rút cọc/doanh thu.<br>- Host có động lực kinh tế bắt buộc kiểm tra xem khách/hệ thống đã nộp phí Treasury hay chưa. | - Phức tạp hóa luồng giải ngân Escrow.<br>- Chỉ áp dụng được cho các booking có Escrow; nếu khách và host thỏa thuận thanh toán trực tiếp không cọc thì không áp dụng được. |
| **Phương án 3: Xác minh phía Server/Relay & Kiểm định đồng thuận (Relay-Enforced Verification)** | Server trung chuyển hoặc Relay Validator kiểm tra hóa đơn Treasury qua LNURL/LND node trước khi đóng dấu hợp lệ cho Booking event trên relay. Booking nào thiếu chữ ký Treasury receipt sẽ bị Relay từ chối phát sóng hoặc đánh dấu "Unverified / Non-Compliant". | - Chặt chẽ ở tầng mạng lưới (Network layer enforcement).<br>- Phù hợp với triết lý phi tập trung của Nostr: Các relay độc lập tự từ chối các booking gian lận phí. | - Cần backend hoặc relay có kết nối node Lightning riêng để truy vấn invoice state. |

---

## 4. Đề xuất kiến trúc cho các đợt tiếp theo

**Kiến trúc Đề xuất: Mô hình Kết hợp (Hybrid Approach: Hướng 1 + Hướng 2)**
1. **Giai đoạn Đặt phòng (UX):** Khách chỉ trả 1 hóa đơn tổng (Tiền phòng + Tiền cọc). 
2. **Giai đoạn Ràng buộc (Protocol Enforcement):**
   - Khoản tiền ký quỹ (hoặc một phần cọc bắt buộc 5,000 sats) được khóa qua NUT-11 Escrow.
   - Điều kiện hoàn cọc cho khách và giải phóng doanh thu cho Host yêu cầu nộp bằng chứng preimage của hóa đơn Treasury.
   - Mọi đề xuất mã hóa chi tiết sẽ được xây dựng thành một RFC chuyên biệt (RFC-0020 hoặc RFC-0021) và trình Chủ dự án duyệt trước khi viết mã.
