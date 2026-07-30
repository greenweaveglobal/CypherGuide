# RFC-0008: Lưu Trú Dựa Trên Tùy Tâm (Dana-Based Stay)

- **Trạng thái:** Draft
- **Related modules:** `types.ts` (`Listing`, `Booking`), `src/components/ListingDetail.tsx`,
  `src/utils/depositEscrow.ts`, `src/utils/dynamicFee.ts`, `src/utils/proofOfStay.ts`
  (RFC-0003 là nền tảng bắt buộc đọc trước).

## Vấn đề

Toàn bộ luồng đặt phòng hiện tại giả định **mọi listing đều có giá cố định**
(`priceSats`), thanh toán Lightning trước, cọc 2 chiều giữ chỗ (RFC-0001/depositEscrow).
Nhưng có một dạng lưu trú thật, phổ biến (khóa thiền, thiền viện, một số homestay cộng
đồng) hoạt động theo mô hình **dana** (tùy tâm/cúng dường): không có giá niêm yết,
không bắt buộc trả trước, người ở tự nguyện đóng góp — có thể sau khi đã lưu trú xong,
có thể không đóng gì cả. Áp thẳng luồng hiện tại vào trường hợp này là sai bản chất:
không thể "escrow" một khoản tiền chưa xác định, không thể tính phí động trên
`priceSats = 0`.

## Các phương án đã cân nhắc

### Phương án A: Ép `priceSats = 0`, coi như đã thanh toán, giữ nguyên luồng cũ
- Ưu điểm: không đổi code gì cả.
- Nhược điểm: mất khả năng nhận đóng góp tùy tâm ngay trong app — người muốn cúng
  dường sau khi ở phải tự tìm cách gửi ra ngoài (giống hệt link Zalo/form hiện tại của
  khóa thiền thật) — không giải quyết đúng nhu cầu ban đầu.

### Phương án B: Thêm `priceModel` trên Listing + luồng đóng góp sau lưu trú (ĐỀ XUẤT)
Listing có trường mới `priceModel: 'fixed' | 'dana'`. Nếu `'dana'`:
- Không có bước thanh toán trước khi nhận chỗ — đặt chỗ = xác nhận ý định, không phải
  giao dịch tài chính.
- Không tạo escrow/cọc 2 chiều (`depositEscrow.ts` bỏ qua hoàn toàn cho listing dana).
- Sau khi checkout, hiện tùy chọn **"Gửi đóng góp tùy tâm"** — một nút Zap Lightning
  tùy ý, số tiền tùy khách chọn, có thể bỏ qua hoàn toàn không đóng gì.
- Ưu điểm: đúng bản chất mô hình dana, vẫn tận dụng được Lightning cho ai muốn đóng
  góp, không ép buộc ai.
- Nhược điểm: đổi giả định cốt lõi `Listing.priceSats` luôn tồn tại và > 0 — cần rà lại
  mọi nơi đọc trường này (dynamicFee, insuranceFund contribution, hiển thị giá trên card
  listing) để không crash/hiển thị sai khi `priceModel === 'dana'`.

### Phương án C: Listing dana chỉ mang tính thông tin, không có luồng đặt chỗ trong app
- Ưu điểm: đơn giản nhất, không đụng cấu trúc dữ liệu.
- Nhược điểm: không phải "xây luồng đặt chỗ" như mục tiêu đã chọn — chỉ là link ra
  ngoài, không khác gì Google Form hiện tại của khóa thiền thật.

## Đề xuất

**Phương án B.**

### Thiết kế dữ liệu

```ts
// types.ts — Listing
priceModel?: 'fixed' | 'dana';   // mặc định 'fixed' nếu không có (không phá dữ liệu cũ)
priceSats: number;               // với dana: 0 hoặc để hiển thị "gợi ý tối thiểu" nếu host muốn ghi

// types.ts — Booking
donationSats?: number;           // số tiền khách thực sự gửi sau khi ở (có thể 0/undefined)
donationTxProof?: string;        // preimage/proof thanh toán Lightning nếu có đóng góp
```

### Luồng trong `ListingDetail.tsx`

- Nếu `listing.priceModel === 'dana'`: ẩn hoàn toàn bước "thanh toán trước", nút đặt
  chỗ đổi thành **"Xác nhận ý định lưu trú"** — không tạo invoice, không gọi
  `mintBookingDeposit`/`generateEscrowMultisigAddress`.
- Sau khi host xác nhận đã checkout (giống luồng Proof-of-Stay hiện có), hiện khối
  **"Gửi đóng góp tùy tâm (tùy chọn)"** — input số Sats tự do + nút Zap, có thể bỏ qua.

### Proof-of-Stay cho lưu trú dana

Thêm tag phân biệt, KHÔNG đổi `proof_type` (vẫn là `"stay"`, tận dụng đúng nguyên tắc
"evolve by addition" của RFC-0003):

```
["payment_model", "dana" | "fixed"]
["donation_sats", "<số tiền thực nhận, có thể là 0>"]  // optional, chỉ có nếu có đóng góp
```

Lý do không tách `proof_type` riêng: đây vẫn là một lượt "đã lưu trú" thật — chỉ khác
mô hình thanh toán. Ứng dụng nào tính uy tín có thể tự quyết định có tính badge dana
ngang bằng badge fixed-price hay không (đúng nguyên tắc "mỗi ứng dụng tự diễn giải").

## Rà soát các nơi giả định `priceSats > 0` (bắt buộc kiểm tra trước khi merge)

- `dynamicFee.ts`/`calculateDynamicFee`: với listing dana, phí % trên 0 hoặc trên số
  tiền chưa xác định trước — trả về phí = 0 khi `priceModel === 'dana'` và chưa có
  `donationSats`, tính phí (nếu áp dụng) trên `donationSats` thực nhận sau khi có.
- `insuranceFund.ts` (đóng góp quỹ bảo hiểm theo % `totalPriceSats`): bỏ qua đóng góp
  bắt buộc cho booking dana — quỹ bảo hiểm vốn dùng cho tranh chấp escrow, listing dana
  không có escrow nên không có tranh chấp tài chính để bảo hiểm.
- Card hiển thị listing (`LodgingListings.tsx`): hiển thị "Tùy tâm" thay vì số Sats cụ
  thể khi `priceModel === 'dana'`.
- `HostRegistrationModal.tsx`: thêm lựa chọn `priceModel` lúc tạo listing — mặc định
  `'fixed'` để không đổi hành vi listing cũ.

## Đánh đổi bảo mật / phi tập trung

- **Không có bảo vệ chống no-show** cho booking dana — đúng chủ đích, không phải thiếu
  sót: mô hình dana vốn dựa trên tín nhiệm, không phải hợp đồng tài chính ràng buộc. Ghi
  rõ trong UI: *"Lưu trú tùy tâm — không có cọc, không có bảo đảm giữ chỗ bằng tài
  chính."*
- **Không thể giả mạo đóng góp để tăng uy tín** — vì `donationSats`/`donationTxProof`
  chỉ được ghi khi có preimage Lightning thật xác nhận, giống cơ chế `paymentHash` hiện
  có, không phải con số tự khai.
- **Rủi ro lạm dụng ngược**: một host có thể tạo listing "dana" giả để né hoàn toàn quỹ
  bảo hiểm/escrow cho một chỗ ở thực chất có tính phí ngầm bên ngoài app — không có cách
  kỹ thuật nào ngăn hoàn toàn, chỉ có thể dựa vào uy tín/review công khai (đúng giới hạn
  đã chấp nhận ở các RFC khác về niềm tin phi tập trung).

## Maturity tier đề xuất

**Experimental** — chưa triển khai, và nên tự trải nghiệm luồng "thật" ít nhất 1 lần
(chuyến đi khóa thiền sắp tới) trước khi coi thiết kế này đã đủ đúng với thực tế.

## Thảo luận

(Mở.)
