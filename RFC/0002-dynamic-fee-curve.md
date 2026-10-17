# RFC-0002: Cấu trúc đóng góp giao thức (mức gợi ý cơ sở, hệ số, ưu đãi chủ nhà đầu tiên; đường cong theo uy tín là phương án tương lai)

- **Trạng thái:** Draft (cập nhật 2026-10 theo quyết định của Chủ dự án và định hướng RFC-0020)
- **Tác giả:** Chủ dự án + AI hỗ trợ soạn thảo, cần cộng đồng bổ sung
- **Module liên quan:** `src/utils/dynamicFee.ts`, `lib/configStore.ts`, `data/protocol_config.json`, `src/components/BookingModal.tsx`, `src/components/LodgingListings.tsx`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`, `RFC/0020-protocol-fee-enforcement.md`

## Bản chất khoản đóng góp & Định hướng RFC-0020

Theo phân tích tại `docs/FEE_ENFORCEMENT_ANALYSIS.md` và Quyết định của Chủ dự án tại **RFC-0020 (Giai đoạn 1 - Phương án C)**:
- Giao thức hiện tại vận hành mô hình thanh toán Lightning P2P trực tiếp tới ví của chủ nhà; **hoàn toàn không có cơ chế mật mã nào ép buộc khách phải trả phí Treasury**.
- Do đó, phần mềm và tài liệu nói đúng bản chất: Khoản thanh toán cho Treasury là **đóng góp giao thức tự nguyện (mức gợi ý)**, không phải là phí bắt buộc.
- Mức cơ sở 2% (`baseFeeRatePcm = 200`) và mức ưu đãi 1% (`earlyHostFeeRatePcm = 100`) cho chủ nhà tiên phong đóng vai trò là **mức đóng góp gợi ý mặc định**.
- Khách đặt phòng có toàn quyền:
  1. Giữ nguyên mức đóng góp gợi ý được tính toán tự động.
  2. Đặt về `0 sats` chỉ với 1 lần chạm/nhấp chuột mà không gặp bất kỳ dark pattern hay từ ngữ gây áp lực nào.
  3. Nhập một số satoshi đóng góp tùy tâm khác.
- Khi khách chọn mức `0 sats`, hệ thống **không tạo hóa đơn Treasury** và giao dịch đặt phòng vẫn hoàn tất thành công.

## Ghi chú về bản cũ của RFC này
Bản trước (viết hồi tố) mô tả một đường cong giảm phí theo uy tín (`BASE=3%`, `MIN=0.5%`, `discount = 40 × ln(1 + reputationScore)`) và ghi là "đang triển khai". Rà soát mã nguồn tháng 10/2026 cho thấy **mô tả đó không khớp với mã**: `dynamicFee.ts` không có giảm phí theo uy tín. Mã thực tế tính phí bằng một tỷ lệ cơ sở cố định nhân với hệ số bảo mật và hệ số tắc nghẽn, có mức tối thiểu và tối đa. Phần đường cong theo uy tín được chuyển thành phương án tương lai (Phương án B bên dưới), không còn được coi là đang triển khai.

## Vấn đề
Cần một cấu trúc đóng góp vừa đủ để giao thức có nguồn thu duy trì các node relay hạ tầng (RFC-0016) và quỹ phát triển (RFC-0015), vừa đủ nhẹ nhàng để khuyến khích mạng lưới P2P ban đầu. Mức cũ trong mã là 0,2% (cấu hình đang chạy 0,25%), quá thấp để nuôi dưỡng hạ tầng. Mức cơ sở gợi ý 2% được chọn làm điểm khởi đầu hợp lý, thấp hơn rất nhiều so với hoa hồng của các nền tảng tập trung (Booking.com 10-25%, Airbnb 15,5%, Agoda 15-20%).

## Cách tính mức đóng góp gợi ý hiện đang triển khai
- `suggestedContributionSats = clamp(số tiền phòng × baseFeeRatePcm / 10000 × congestionMultiplier × networkCongestionScore × securityMultiplier, minFeeSats, maxFeeSats)`.
- `pcm` là phần mười nghìn: 100 pcm = 1%, 200 pcm = 2%. Tên biến kỹ thuật `baseFeeRatePcm` và `earlyHostFeeRatePcm` được giữ nguyên để đảm bảo tương thích mã nguồn.
- Hệ số bảo mật (`securityLevel`): `relaxed` 0,8, `strict` 1,0, `paranoid` 1,5.
- Mức tối thiểu `minFeeSats = 10 sats`, tối đa `maxFeeSats = 10.000 sats` áp dụng khi tính toán mức gợi ý mặc định.
- **Khoản đóng góp tự nhập tùy chỉnh:** Nếu khách tự nhập số sats đóng góp, khoản này **không bị giới hạn** bởi trần 10.000 sats hay sàn 10 sats (khách có thể ủng hộ nhiều hơn hoặc chọn bất kỳ số sats nào).
- Ngoài ra, giao diện cộng thêm ước tính phí định tuyến Lightning (~0,1%) để khách nắm rõ tổng chi phí mạng lưới.
- **Bên đóng góp:** Khách đóng góp trên tinh thần tự nguyện; chủ nhà luôn nhận đủ 100% tiền phòng. Nếu khách đồng ý đóng góp, khoản đóng góp tới ví Treasury bằng hóa đơn riêng (RFC-0016).
- Quản trị viên điều chỉnh `baseFeeRatePcm` qua API có xác thực NIP-98; mỗi lần đổi có sự kiện kiểm toán.

## Các phương án đã cân nhắc

### Phương án A: Giữ một tỷ lệ cơ sở cố định, thêm ưu đãi theo nhóm chủ nhà (ĐƯỢC CHỌN CHO MỨC GỢI Ý)
Một tỷ lệ cơ sở chung (2%), cộng mức gợi ý ưu đãi (1%) có thời hạn cho nhóm chủ nhà đầu tiên.
- Ưu điểm: đơn giản, minh bạch, đã khớp mã hiện có; ưu đãi giúp thu hút nguồn cung ban đầu mà không hạ mức cơ sở chung.
- Nhược điểm: danh sách chủ nhà ưu đãi do quản trị viên kiểm soát (điểm tập trung mềm); cần cơ chế xác thực quyền sở hữu listing (đã giải quyết qua chữ ký NIP-78 ở RFC-0019).

### Phương án B: Đường cong giảm phí theo uy tín (CHƯA TRIỂN KHAI, phương án tương lai)
Phí giảm theo điểm uy tín Proof-of-Stay, ví dụ `discount = k × ln(1 + reputationScore)` với một sàn tối thiểu.
- Ưu điểm: thưởng hành vi tốt, khuyến khích giao dịch thật.
- Nhược điểm: các hằng số `BASE`, `MIN`, `k` của bản cũ là tùy ý, chưa có dữ liệu thực tế. Cần có cơ chế chống thông đồng cày điểm uy tín trước (xem RFC-0017).

### Phương án C: Tham số do governance biểu quyết
`baseFeeRatePcm` và các tham số khác do Protocol Governance biểu quyết định kỳ.
- Ưu điểm: đúng tinh thần "cùng xây, cùng sửa".
- Nhược điểm: chưa có cơ chế tự động áp dụng kết quả biểu quyết vào mã đang chạy; hiện mọi tham số do quản trị viên đặt thông qua NIP-98.

## Đề xuất & Quyết định (Đã được Chủ dự án chốt, 2026-10)
1. **Mức đóng góp gợi ý cơ sở: 2% (`baseFeeRatePcm = 200`).**
2. **Chương trình ưu đãi chủ nhà tiên phong: 1% (`earlyHostFeeRatePcm = 100`) trong 12 tháng.**
   - Định nghĩa rõ: Đây là **mức đóng góp gợi ý thấp hơn** (1% thay vì 2%) áp dụng cho các listing của chủ nhà đã được ghi danh hợp lệ và có chữ ký RFC-0019 còn hiệu lực; **không phải là giảm giá dịch vụ** (RFC-0020).
   - Kết hợp với hệ số bảo mật như mức cơ sở (ví dụ `paranoid` ra 1,5%, `relaxed` ra 0,8%).
3. **Chi tiết thiết kế của chương trình ưu đãi:**
   - Định danh chủ nhà là pubkey hex xác thực bởi chữ ký NIP-78 (RFC-0019).
   - Ghi danh bởi quản trị viên qua API có xác thực NIP-98; mỗi lần ghi danh hoặc gỡ có sự kiện kiểm toán.
   - Mỗi chủ nhà được hưởng 12 tháng kể từ ngày ghi danh (`enrolledAt`), không thể lùi ngày.
   - Giới hạn số chủ nhà ghi danh: 20 chủ nhà đầu tiên.
   - Điều kiện ghi danh: chủ nhà thật, mỗi người một danh tính Nostr, do quản trị viên xét duyệt.
4. Mức tối thiểu 10 sats và tối đa 10.000 sats được áp dụng cho mức gợi ý tính tự động; khoản khách tự nhập không chịu giới hạn trần 10.000 sats.
5. Mức mặc định trong mã, cấu hình, tài liệu và test thống nhất ở mức 200 pcm (2%) và 100 pcm (1%).

## Đánh đổi bảo mật / phi tập trung
- **Kiểm soát tham số:** `baseFeeRatePcm` và danh sách ưu đãi do quản trị viên kiểm soát qua NIP-98, là một điểm tập trung mềm. Minh bạch hóa bằng sự kiện kiểm toán công khai.
- **Tự nguyện vs Cưỡng chế:** Vì giao thức không thể ép buộc đóng góp mà không phá vỡ tính phi tập trung của thanh toán Lightning P2P, giao thức chấp nhận để khách tự quyết định. Sự minh bạch này trung thực với hiện trạng kỹ thuật và xây dựng niềm tin lâu dài với người dùng.
- **Minh bạch chi phí:** Giao diện hiển thị rõ ràng từng dòng: tiền phòng cho chủ nhà, ước tính phí định tuyến Lightning, đóng góp giao thức gợi ý (có nút chọn 0 sats), và cọc hoàn lại 10%. Tuyệt đối không giấu chi phí.

## Chỉ số theo dõi (Metrics to Track)
- Số chủ nhà ghi danh và tỷ lệ còn hoạt động sau 3, 6 và 12 tháng.
- **Tỷ lệ khách giữ nguyên mức gợi ý:** Tỷ lệ booking mà khách đồng ý đóng góp theo mức gợi ý mặc định.
- **Tỷ lệ khách chọn 0 sats:** Tỷ lệ booking mà khách chủ động chỉnh mức đóng góp về 0.
- **Trung bình số sats đóng góp mỗi đặt phòng:** Số satoshi thực tế đóng góp vào Treasury trên mỗi lượt đặt phòng thành công.
- Tổng satoshi thực thu vào Quỹ Treasury so với tổng giá trị đặt phòng (tỷ lệ đóng góp hiệu dụng).
- Tỷ lệ khách bỏ dở sau khi thấy bước thanh toán, so với trước khi đổi mức.

## Maturity tier đề xuất sau khi triển khai
**Experimental**, cho tới khi có ít nhất một vòng dữ liệu thật (số chủ nhà, số lượt đặt phòng, tỷ lệ đóng góp tự nguyện) để đánh giá lại.

## Câu hỏi mở
1. **Trần đóng góp gợi ý 10.000 sats:** Trần 10.000 sats hiện áp dụng cho mức gợi ý tự động (giúp các phòng giá cao từ 500.000 sats trở lên có mức gợi ý hợp lý). Khách vẫn có thể tự nhập số sats cao hơn nếu muốn ủng hộ thêm cho dự án.
2. **Quy mô và tiêu chí nhóm ưu đãi:** Con số 20 chủ nhà có phù hợp không, và tiêu chí ghi danh cụ thể khi mở rộng cộng đồng?
3. **Phân tầng mức gợi ý theo giá trị phòng:** Có nên đặt mức đóng góp gợi ý thấp hơn cho phòng bình dân và cao hơn cho phòng cao cấp không?
4. **Đóng góp từ phía chủ nhà:** Hiện tại giao diện cho phép khách đóng góp khi thanh toán; trong tương lai có cần thêm cơ chế để chủ nhà tự nguyện trích doanh thu ủng hộ Treasury qua NIP-57 Zap không?
5. **Sau 12 tháng ưu đãi:** Listing của chủ nhà ưu đãi chuyển về mức gợi ý cơ sở 2% ngay hay giảm dần?
6. **Thời điểm chuyển sang Giai đoạn 2 (Phương án B của RFC-0020):** Khi nào kích hoạt mô hình phí gắn với dịch vụ (trọng tài, bảo chứng Proof-of-Stay) và cần những điều kiện hạ tầng nào đi kèm?
7. Pháp lý và thuế đối với các khoản đóng góp tự nguyện Value4Value vào Treasury (cần ý kiến chuyên gia độc lập).

## Thảo luận
**2026-10 — Quyết định của Chủ dự án:** Chốt mức đóng góp gợi ý cơ sở 2% và ưu đãi 1% trong 12 tháng cho nhóm chủ nhà đầu tiên. Xác định rõ ràng theo RFC-0020: Đây là đóng góp tự nguyện (không bắt buộc), khách có thể chỉnh về 0 chỉ với 1 chạm. Giao thức không dùng dark patterns và không ép buộc thanh toán.
