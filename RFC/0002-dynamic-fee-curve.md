# RFC-0002: Cấu trúc phí giao thức (mức cơ sở, hệ số, ưu đãi chủ nhà đầu tiên; đường cong theo uy tín là phương án tương lai)

- **Trạng thái:** Draft (cập nhật 2026-10 sau quyết định của chủ dự án)
- **Tác giả:** Chủ dự án + AI hỗ trợ soạn thảo, cần cộng đồng bổ sung
- **Module liên quan:** `src/utils/dynamicFee.ts`, `lib/configStore.ts`, `data/protocol_config.json`, `src/components/BookingModal.tsx`, `src/components/LodgingListings.tsx`

## Ghi chú về bản cũ của RFC này
Bản trước (viết hồi tố) mô tả một đường cong giảm phí theo uy tín (`BASE=3%`, `MIN=0.5%`, `discount = 40 × ln(1 + reputationScore)`) và ghi là "đang triển khai". Rà soát mã nguồn tháng 10/2026 cho thấy **mô tả đó không khớp với mã**: `dynamicFee.ts` không có giảm phí theo uy tín. Mã thực tế tính phí bằng một tỷ lệ cơ sở cố định nhân với hệ số bảo mật và hệ số tắc nghẽn, có mức tối thiểu và tối đa. Phần đường cong theo uy tín được chuyển thành phương án tương lai (Phương án B bên dưới), không còn được coi là đang triển khai.

## Vấn đề
Cần một cấu trúc phí vừa đủ để nền tảng có nguồn thu vận hành, vừa đủ thấp để chủ nhà và khách muốn dùng một giao thức chưa có nguồn khách. Mức cũ trong mã là 0,2% (cấu hình đang chạy 0,25%), thấp hơn rất nhiều so với mặt bằng của các nền tảng đặt phòng tập trung (theo các nguồn bên thứ ba: Booking.com khoảng 10% đến 25% với trung bình khoảng 15%, Airbnb 15,5% theo mô hình phí do chủ nhà chịu, Agoda khoảng 15% đến 20%), và quá thấp để nuôi dự án: với 0,25%, muốn thu 15 triệu VND mỗi tháng cần khoảng 6 tỷ VND tổng giá trị đặt phòng mỗi tháng.

## Cách tính phí hiện đang triển khai
- `protocolFeeSats = clamp(số tiền phòng × baseFeeRatePcm / 10000 × congestionMultiplier × networkCongestionScore × securityMultiplier, minFeeSats, maxFeeSats)`.
- `pcm` là phần mười nghìn: 100 pcm = 1%, 200 pcm = 2%.
- Hệ số bảo mật (`securityLevel`): `relaxed` 0,8, `strict` 1,0, `paranoid` 1,5.
- Mức tối thiểu 10 sats, tối đa 10.000 sats mỗi giao dịch (chưa đổi, xem Câu hỏi mở).
- Ngoài ra giao diện cộng một ước tính phí định tuyến Lightning (khoảng 0,1%), không thuộc phí giao thức.
- **Bên trả phí:** khách trả phí giao thức **cộng thêm** trên tiền phòng; chủ nhà nhận đủ tiền phòng. Phí tới ví Treasury bằng hóa đơn riêng (RFC-0016), hoặc gộp vào hóa đơn của chủ nhà khi không tách được.
- Quản trị viên đổi `baseFeeRatePcm` qua API có xác thực NIP-98; mỗi lần đổi có sự kiện kiểm toán.

## Các phương án đã cân nhắc

### Phương án A: Giữ một tỷ lệ cơ sở cố định, thêm ưu đãi theo nhóm chủ nhà (ĐƯỢC CHỌN)
Một tỷ lệ cơ sở chung, cộng một chương trình ưu đãi có thời hạn cho nhóm chủ nhà đầu tiên.
- Ưu điểm: đơn giản, minh bạch, đã khớp mã hiện có; ưu đãi giúp thu hút nguồn cung ban đầu mà không hạ mức cơ sở cho mọi người.
- Nhược điểm: danh sách chủ nhà ưu đãi do quản trị viên kiểm soát (điểm tập trung mềm); khó phân biệt "chủ nhà đầu tiên" thật với người tạo nhiều danh tính để hưởng ưu đãi.

### Phương án B: Đường cong giảm phí theo uy tín (CHƯA TRIỂN KHAI, phương án tương lai)
Phí giảm theo điểm uy tín Proof-of-Stay, ví dụ `discount = k × ln(1 + reputationScore)` với một sàn tối thiểu.
- Ưu điểm: thưởng hành vi tốt, khuyến khích giao dịch thật.
- Nhược điểm: các hằng số `BASE`, `MIN`, `k` của bản cũ là tùy ý, chưa có dữ liệu. Với mức cơ sở mới 2%, cần tính lại toàn bộ. Điểm uy tín còn có thể bị tạo hàng loạt (xem RFC-0017), nên giảm phí theo uy tín cần chống thông đồng trước.

### Phương án C: Tham số do governance biểu quyết
`baseFeeRatePcm` và các tham số khác do Protocol Governance biểu quyết định kỳ.
- Ưu điểm: đúng tinh thần "cùng xây, cùng sửa".
- Nhược điểm: chưa có cơ chế áp dụng kết quả biểu quyết vào mã đang chạy; hiện mọi tham số do quản trị viên đặt.

## Đề xuất (đã được chủ dự án chốt, 2026-10)
1. **Mức cơ sở: 2% (`baseFeeRatePcm = 200`).** Thay cho 0,2% trong mã và 0,25% trong cấu hình đang chạy.
2. **Chương trình ưu đãi chủ nhà đầu tiên: 1% (`earlyHostFeeRatePcm = 100`) trong 12 tháng.** Áp dụng cho các listing của chủ nhà đã được ghi danh. Kết hợp với hệ số bảo mật như mức cơ sở (ví dụ `paranoid` ra 1,5%, `relaxed` ra 0,8%).
3. **Chi tiết thiết kế của chương trình ưu đãi** (các điểm đánh dấu "đề xuất" chờ chủ dự án xác nhận):
   - Định danh chủ nhà là `npub` trong `coOwners` của listing (chưa có trường chủ nhà riêng); quy tắc cho listing nhiều đồng sở hữu: **đề xuất** dùng npub đồng sở hữu có tỷ lệ chia lớn nhất, nếu hòa thì npub đứng đầu danh sách.
   - Ghi danh bởi quản trị viên qua API có xác thực NIP-98; mỗi lần ghi danh hoặc gỡ có sự kiện kiểm toán công khai.
   - Mỗi chủ nhà được hưởng 12 tháng kể từ **ngày ghi danh** (`enrolledAt`), không thể lùi ngày.
   - Giới hạn số chủ nhà ghi danh: **đề xuất** 20.
   - Điều kiện ghi danh: **đề xuất** chủ nhà thật, mỗi người một npub, do quản trị viên xét; chưa quy định tiêu chí tự động.
4. Mức tối thiểu 10 sats và tối đa 10.000 sats giữ nguyên trong RFC này; câu hỏi nâng trần xem bên dưới.
5. Khi chốt xong, mức mặc định trong mã, cấu hình, tài liệu và test phải khớp (200 pcm), không còn tồn tại hai con số 20 và 25.

## Đánh đổi bảo mật / phi tập trung
- **Kiểm soát tham số:** `baseFeeRatePcm` và danh sách ưu đãi do quản trị viên (xác thực NIP-98, danh sách pubkey cố định trong mã) kiểm soát, nên đây là một điểm tập trung mềm. Giảm rủi ro bằng cách công khai mọi thay đổi bằng sự kiện kiểm toán, và để Phương án C làm hướng dài hạn.
- **Lạm dụng ưu đãi:** vì không KYC, một người có thể tạo nhiều npub để hưởng ưu đãi. Do quản trị viên xét ghi danh và có giới hạn số lượng, rủi ro được hạn chế nhưng không loại bỏ.
- **Phí do khách trả cộng thêm:** khách thấy tổng giá cao hơn giá niêm yết. Phải hiển thị rõ ngay trên thẻ và khi đặt phòng (đã có nhãn "chưa gồm phí protocol và cọc 10%"), không giấu phí.
- **Giá chốt lúc đặt:** phí áp dụng là phí tại thời điểm đặt phòng, để tránh đổi giá khi khách đã cam kết.

## Chỉ số theo dõi
- Số chủ nhà ghi danh và tỷ lệ còn hoạt động sau 3, 6 và 12 tháng.
- Tổng phí thực thu so với tổng giá trị đặt phòng (tỷ lệ phí hiệu dụng, tính cả giới hạn tối thiểu và tối đa).
- Tỷ lệ khách bỏ dở sau khi thấy phí ở bước thanh toán, so với trước khi đổi mức.
- Phản hồi của chủ nhà về mức phí, thu thập bằng khảo sát ngắn với các chủ nhà thật.

## Maturity tier đề xuất sau khi triển khai
**Experimental**, cho tới khi có ít nhất một vòng dữ liệu thật (số chủ nhà, số đêm đặt, tỷ lệ bỏ dở) để đánh giá lại.

## Câu hỏi mở
1. **Trần phí 10.000 sats:** ở mức 2%, mọi giao dịch trên 500.000 sats (trên khoảng 333.000 sats ở `paranoid`) chạm trần nên phí hiệu dụng thấp hơn 2%. Có nâng trần hay giữ làm chính sách hỗ trợ phòng giá cao?
2. **Quy mô và tiêu chí nhóm ưu đãi:** con số 20 chủ nhà có phù hợp không, và dùng tiêu chí gì ngoài việc quản trị viên xét?
3. **Listing nhiều đồng sở hữu:** quy tắc chọn npub để xác định ưu đãi (xem mục Đề xuất).
4. **Bên trả phí:** hiện khách trả cộng thêm. Có cần tùy chọn để chủ nhà gánh phí (kiểu Booking/Airbnb) cho các listing muốn hiển thị giá cuối bao gồm phí?
5. **Sau 12 tháng:** chủ nhà ưu đãi chuyển lên 2% ngay, hay giảm dần?
6. **Cập nhật mức phí về sau:** cần quy trình thông báo trước cho chủ nhà và khách khi đổi `baseFeeRatePcm`, và có áp dụng cho các đặt phòng đã xác nhận không (đề xuất: không).
7. Khi có dữ liệu về uy tín, có đưa Phương án B vào lại không, và chống thông đồng thế nào (RFC-0017).
8. Pháp lý và thuế đối với khoản phí thu về Treasury (cần ý kiến chuyên gia, RFC này không kết luận).

## Thảo luận
**2026-10 — quyết định của chủ dự án:** chốt mức cơ sở 2% và ưu đãi 1% trong 12 tháng cho nhóm chủ nhà đầu tiên. Cơ sở so sánh là các số liệu công khai về hoa hồng của Booking.com, Airbnb và Agoda (từ các bài của bên thứ ba, có thể thay đổi theo quốc gia và theo thời gian, cần kiểm tra lại với chính sách chính thức khi trích dẫn). Mức 2% là một giả thuyết cần kiểm chứng với chủ nhà thật, không phải kết quả tính toán chính xác.
