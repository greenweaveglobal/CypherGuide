# RFC-0010: Nghi Thức Tĩnh Tâm — Vòng Tròn, Nén Nhang, 369 Giây (Zen Stillness Ritual)

- **Trạng thái:** Draft
- **Tác giả:** (cần điền)
- **Ngày:** 2026-08-14
- **Module liên quan:** component mới đề xuất (`src/components/StillnessRitual.tsx`),
  `src/components/ListingDetail.tsx` (điểm gắn vào luồng check-in/checkout của listing
  `priceModel: 'dana'` — RFC-0008), **KHÔNG liên quan tới** `src/utils/proofOfStay.ts`
  (RFC-0003) — lý do loại trừ nêu rõ ở mục Vấn đề/Đề xuất bên dưới.

## Vấn đề

RFC-0008 định nghĩa mô hình thanh toán cho các listing kiểu khóa thiền/thiền viện, nhưng
chỉ giải quyết phần **tài chính** (dana/tùy tâm) — chưa có gì trong app phản ánh **trải
nghiệm tinh thần** thật sự diễn ra ở những nơi này. Người sáng lập đề xuất một nghi thức
cụ thể, mang tính biểu tượng:

- **Vòng tròn Zen (Ensō)** — đại diện cho số **0**: trống rỗng, vô thường, điểm khởi đầu
  không có gì để bám víu.
- **Thắp một cây nhang** — đại diện cho số **1**: một ý định duy nhất, một hơi thở, một
  hành động cụ thể bắt đầu từ hư không.
- Sau khi thắp xong, một tiếng chuông (tần số rung) vang lên, bắt đầu đếm **369 giây**
  — khoảng lặng để người dùng cố gắng không nghĩ gì.

Câu hỏi kỹ thuật/thiết kế thật sự không phải "làm animation thế nào" — mà là: **một nghi
thức vốn dùng để buông bỏ (non-attachment) có nên tạo ra bất kỳ dữ liệu, bằng chứng, hay
uy tín nào không?** Đây là căng thẳng cốt lõi cần giải quyết trước khi viết dòng code
nào, vì nó quyết định toàn bộ kiến trúc theo sau.

## Các phương án đã cân nhắc

### Phương án A: Nghi thức thuần túy — không ghi lại bất kỳ dữ liệu nào, không proof
Animation/âm thanh chạy hoàn toàn phía client, không lưu trạng thái sau khi phiên kết
thúc (kể cả local storage) — giống hệt việc thắp một nén nhang thật ngoài đời: khi nhang
tàn, không có gì "chứng minh" bạn đã ngồi yên hay đã nghĩ vẩn vơ suốt 369 giây.
- Ưu điểm: **nhất quán triệt để với chính tinh thần của nghi thức** — không biến tĩnh
  tâm thành một việc để "hoàn thành" hay "khoe". Không có rủi ro bảo mật/riêng tư nào vì
  không có dữ liệu để rò rỉ.
- Nhược điểm: không có cách nào cho người dùng tự xem lại "tôi đã làm việc này bao nhiêu
  lần" nếu họ thật sự muốn theo dõi thói quen cá nhân.

### Phương án B: Phát hành Proof-of-Stillness — proof_type mới theo RFC-0003, publish
  lên Nostr, tính vào uy tín portable
- Ưu điểm: nhất quán với cách các hành vi khác trong app được ghi nhận (Proof-of-Stay),
  có thể dùng để mở khóa ưu đãi hoặc badge.
- Nhược điểm: **loại bỏ hoàn toàn** — hai lý do, không chỉ một:
  1. **Không thể verify được về bản chất.** Proof-of-Stay xác nhận một sự kiện vật lý có
     thật (đã ở, đã trả phòng). "Đã không nghĩ gì trong 369 giây" không phải sự kiện có
     thể ký xác nhận trung thực — ứng dụng chỉ biết đồng hồ đã chạy hết, không biết tâm
     trí người dùng đã làm gì. Biến nó thành proof là **tạo bằng chứng giả về một trạng
     thái không thể chứng minh**, khác bản chất với mọi proof khác trong giao thức.
  2. **Mâu thuẫn triết lý ngay trong chính hành động.** Biến tĩnh tâm thành thứ tích lũy
     để tăng uy tín/mở khóa ưu đãi là gắn thêm một tầng "đạt được/sở hữu" (attachment)
     vào chính hành động vốn để buông bỏ nó — phản tác dụng với mục đích ban đầu.

### Phương án C: Lưu cục bộ (local-only), không publish, không sync, không proof — một
  bộ đếm cá nhân đơn giản trên chính thiết bị, tự động xóa nếu người dùng gỡ app
- Ưu điểm: đáp ứng phần nhu cầu hợp lý của Phương án A/nhược điểm (người dùng muốn tự
  biết mình đã thực hành bao nhiêu lần) mà không tạo ra proof/uy tín/dữ liệu rời khỏi
  máy — không mâu thuẫn với lý do (1) và (2) ở trên vì đây không phải "bằng chứng" gửi ra
  ngoài, chỉ là ghi chú cá nhân im lặng.
- Nhược điểm: cần nói rõ trong UI đây chỉ là con số tự đếm, không phải thành tích được
  xác thực — tránh người dùng hiểu nhầm nó có giá trị như Proof-of-Stay.

## Đề xuất

**Phương án A làm mặc định**, với **Phương án C là tùy chọn tắt/mở được** (mặc định TẮT)
cho ai thật sự muốn tự theo dõi thói quen cá nhân — không phải để khoe hay đổi ưu đãi.

### Thiết kế nghi thức (gợi ý triển khai)

1. **Vòng tròn Zen (Ensō)** — vẽ bằng SVG stroke animation, nét cọ không khép kín hoàn
   toàn (đúng truyền thống Ensō — sự không hoàn hảo là một phần ý nghĩa), tượng trưng số 0.
2. **Nhang** — chạm/nhấn để "thắp" (hiệu ứng lửa nhỏ + khói mờ dần bằng CSS/SVG), tượng
   trưng số 1 — hành động khởi đầu duy nhất, không thao tác gì thêm sau đó.
3. **Chuông mở đầu** — dùng mẫu âm thu thật từ **Keisu/Inkin** (chuông đồng nhỏ dùng
   trong thiền đường Nhật — đúng truyền thống Zen của Ensō/nhang, khác với chuông Tây
   Tạng/singing bowl vốn thuộc truyền thống khác dù âm sắc gần giống), không tổng hợp
   bằng sine wave thuần (âm bội kim loại thật mới tạo cảm giác "ngân rồi tan" đúng chất).
   **1 tiếng đơn**, để ngân tự nhiên (~3-5 giây) rồi tắt hẳn trước khi vào 369 giây im
   lặng — báo hiệu "bắt đầu". Không gán nhãn "tần số chữa lành" (432Hz, 528Hz...) hay bất
   kỳ tuyên bố y học/khoa học nào trong UI/copy — chỉ mô tả là "âm thanh truyền thống mở
   đầu thiền định", chọn vì chất âm chứ không vì con số Hz.
4. **369 giây** — đồng hồ đếm ngược im lặng, không hiển thị số đếm giật cục gây xao nhãng
   (có thể chỉ là vòng tròn Ensō mờ dần/sáng dần rất chậm).
5. **Chuông kết thúc** — cùng mẫu Keisu/Inkin nhưng **2-3 tiếng cách nhau vài giây** (khác
   rõ với 1 tiếng lúc mở đầu), để người dùng phân biệt "đã hết 369 giây" mà không cần nhìn
   số đếm.
6. Sau khi kết thúc: **không có màn hình "Hoàn thành!"**, không huy hiệu, không confetti
   — chỉ lặng lẽ quay lại màn hình trước đó, đúng tinh thần không biến nó thành thành tích.

### Điểm gắn vào luồng hiện có

Đặt như một **hành động độc lập, tùy chọn** trước bước "Xác nhận ý định lưu trú" ở
listing `priceModel: 'dana'` (RFC-0008) — không bắt buộc, không chặn luồng đặt chỗ nếu
người dùng bỏ qua. Có thể mở rộng sau thành một mục riêng ngoài luồng đặt phòng (ví dụ
trong `Guide.tsx`) cho bất kỳ ai muốn dùng, không giới hạn ở người đang đặt khóa thiền.

## Đánh đổi bảo mật / phi tập trung

- **Phương án A/C không có bề mặt tấn công mới** — không publish event, không gọi API
  ngoài, không có dữ liệu nào rời khỏi thiết bị (kể cả ở chế độ C, dữ liệu chỉ nằm trong
  local storage của chính máy người dùng).
- **Cố ý không tuân theo mô hình Proof-of-Stay (RFC-0003)** dù về hình thức có vẻ giống
  ("một hành vi → một bằng chứng portable") — đây là ngoại lệ có chủ đích, không phải sơ
  suất quên áp dụng RFC-0003. Ghi rõ điều này để người đọc RFC sau không "sửa" nó thành
  một proof_type mới vì tưởng đó là thiếu sót.
- **Không thu thập bất kỳ tín hiệu sinh trắc/cảm biến nào** (nhịp tim, chuyển động máy...)
  để "xác minh" người dùng thật sự tĩnh tâm — làm vậy sẽ biến một nghi thức riêng tư thành
  giám sát, đi ngược hoàn toàn tinh thần của chính RFC này.

## Maturity tier đề xuất sau khi triển khai

**Experimental** — cần thử nghiệm UX thật (đặc biệt độ dài animation, cảm giác 369 giây
có "vừa đủ" hay gây sốt ruột) trước khi coi là ổn định.

## Thảo luận

(Mở — cần cộng đồng góp ý: 369 giây có nên tùy chỉnh được (ví dụ 108 giây, 21 phút theo
các truyền thống thiền khác) hay cố định đúng một giá trị làm bản sắc riêng của Cypher
Guide; và liệu âm thanh chuông nên là asset cố định trong app hay cho phép người dùng tự
tải lên âm thanh riêng của họ.)
