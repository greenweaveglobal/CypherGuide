# RFC-0011: Ranh Giới Tài Chính Hóa (Financialization Boundary Principle)

- **Trạng thái:** Draft — giống RFC-0003, đây là **tài liệu nguyên tắc nền tảng**
  (cross-cutting), không gắn với một module code cụ thể nào, mà là bộ tiêu chí mọi
  RFC sau này (và RFC trước cần rà soát lại) phải chạy qua trước khi quyết định một
  hành vi có nên sinh ra proof/điểm uy tín/phí hay không.
- **Tác giả:** Claude (AI) + chủ dự án, cần cộng đồng bổ sung
- **Module liên quan:** không có module riêng — áp dụng ngược lại cho
  `src/utils/insuranceFund.ts` (RFC-0001), `src/utils/dynamicFee.ts` (RFC-0002),
  `src/utils/proofOfStay.ts` (RFC-0003, RFC-0006), `ListingDetail.tsx` (RFC-0008),
  `StillnessRitual.tsx` (RFC-0010).

## Vấn đề

Xâu chuỗi các RFC đã có, lộ ra hai xu hướng thiết kế đối lập chạy song song mà
chưa RFC nào gọi tên hay giải thích ranh giới giữa chúng:

**Xu hướng A — tài chính hóa/định lượng hóa hành vi:**
- RFC-0001: chọn Guardian Council dựa trên uy tín định lượng từ Proof-of-Stay.
- RFC-0002: phí nền tảng giảm theo công thức toán học của uy tín tích lũy.
- RFC-0003: hạ tầng uy tín portable dùng chung cho mọi hành vi trong hệ sinh thái.
- RFC-0006: KYC attestation — một dạng proof khác được cộng vào cùng lớp danh tính.

**Xu hướng B — chủ động từ chối tài chính hóa:**
- RFC-0008: dana — cố tình không giá cố định, không escrow, không proof thanh toán.
- RFC-0010: nghi thức tĩnh tâm — cố tình loại trừ khỏi mô hình Proof-of-Stay dù kỹ
  thuật hoàn toàn có thể áp dụng, với lý do rõ ràng: hành vi không thể verify trung
  thực + biến nó thành proof mâu thuẫn với chính mục đích của hành vi đó.

Hai xu hướng này **không sai** — mỗi RFC đều tự lý giải hợp lý trong phạm vi hẹp của
nó. Nhưng khi đặt cạnh nhau, không có nguyên tắc chung nào cho phép một người viết
RFC mới trả lời câu hỏi: **"tính năng tôi sắp đề xuất nên đi theo Xu hướng A hay B?"**
mà không phải tranh luận lại từ đầu mỗi lần, dựa trên cảm tính của phiên viết đó.
Đây chính là rủi ro thật: không phải hai xu hướng mâu thuẫn nhau, mà là **không có
tiêu chí khách quan để phân loại**, khiến việc phân loại phụ thuộc vào ai đang viết
RFC hôm đó.

## Các phương án đã cân nhắc

### Phương án A: Tài chính hóa toàn bộ — mọi hành vi đều nên sinh proof/điểm để nhất
  quán với RFC-0003
Mở rộng Proof-of-Stay để bao gồm cả hoàn tất dana, hoàn tất phiên tĩnh tâm, v.v.
- Ưu điểm: nhất quán tuyệt đối, một mô hình duy nhất cho mọi hành vi trong app.
- Nhược điểm: **loại bỏ** — đây chính xác là điều RFC-0010 đã từ chối và có lý do
  chính đáng (không thể verify trạng thái nội tâm; mâu thuẫn với chính mục đích của
  dana/thiền là buông bỏ/không vụ lợi). Áp dụng máy móc "nhất quán" ở đây phá hỏng ý
  nghĩa gốc của chính những hành vi đó.

### Phương án B: Phi tài chính hóa toàn bộ — bỏ luôn uy tín định lượng khỏi
  Guardian Council/phí, quay về chọn thủ công hoặc phí cố định
- Ưu điểm: dứt điểm mâu thuẫn bằng cách chọn hẳn một phía.
- Nhược điểm: **loại bỏ** — Guardian Council (RFC-0001) và phí theo uy tín (RFC-0002)
  giải quyết vấn đề vận hành thật (chống sybil, chọn ai giữ quỹ bảo hiểm một cách phi
  tập trung) mà không có cách thay thế nào tốt hơn định lượng uy tín từ một sự kiện
  vật lý có thể verify (đã lưu trú thật). Bỏ đi sẽ quay lại vấn đề gốc mà RFC-0001 nêu.

### Phương án C: Đặt ra bộ tiêu chí khách quan (checklist) để phân loại từng hành vi
  — không chọn một phía, mà giải thích TẠI SAO mỗi phía đúng cho trường hợp của nó
  (ĐỀ XUẤT)
- Ưu điểm: giữ được cả hai xu hướng đang có mà không cần đảo ngược bất kỳ RFC nào đã
  triển khai — chỉ cần chứng minh chúng đều pass/fail đúng tiêu chí một cách nhất
  quán. Cho người viết RFC tương lai một công cụ cụ thể để tự trả lời, không cần hỏi
  lại "trực giác" của ai.
- Nhược điểm: cần rà soát lại toàn bộ RFC cũ để áp checklist, và checklist có thể
  chưa bao quát hết mọi trường hợp biên tương lai — sẽ cần bổ sung dần.

## Đề xuất

**Phương án C.** Ba phép thử sau đây, **cả ba đều phải pass** thì một hành vi mới
được phép sinh ra proof/điểm uy tín/ảnh hưởng đến phí — chỉ cần fail một phép thử là
đủ để loại, không cần fail cả ba:

### 1. Phép thử khả năng verify (Verifiability test)
Sự kiện có phải một **sự thật khách quan bên ngoài** mà một bên thứ ba (hoặc chính
giao thức) có thể xác nhận trung thực hay không — khác với một **trạng thái nội tâm**
chỉ người trong cuộc tự biết?
- Đã lưu trú thật (RFC-0003) → **pass** (có thể verify qua địa điểm/thời gian).
- Đã thanh toán một khoản Lightning cụ thể → **pass** (verify qua invoice/preimage).
- "Đã không nghĩ gì trong 369 giây" (RFC-0010) → **fail** — không ai, kể cả giao thức,
  xác nhận trung thực được trạng thái tâm trí.

### 2. Phép thử mục đích giao thức (Protocol-purpose test)
Việc định lượng hành vi này có phục vụ **tính toàn vẹn của giao thức** (chống sybil,
phân bổ quyền giữ quỹ, công bằng phí) hay chỉ để **thưởng/gamify** người dùng?
- Chọn Guardian Council theo uy tín (RFC-0001) → **pass** (cần một cơ chế chọn ai giữ
  quỹ phi tập trung, không có mục đích nào khác).
- Giảm phí theo uy tín (RFC-0002) → **pass** (chống sybil — tài khoản mới không thể
  giả mạo lịch sử lưu trú thật để hưởng ưu đãi).
- Huy hiệu "đã tĩnh tâm 10 lần" → **fail** — mục đích duy nhất là gamify, không phục
  vụ toàn vẹn giao thức nào.

### 3. Phép thử ý nghĩa gốc của hành vi (Original-meaning test)
Bản chất/truyền thống của hành vi đó **tự định nghĩa nó là phi giao dịch** hay không
— nếu có, tài chính hóa nó là lỗi phạm trù (category error), không chỉ là một lựa
chọn thiết kế có thể cân nhắc.
- Đặt phòng trả tiền cố định → **pass** (bản chất vốn là giao dịch).
- Dana (RFC-0008) → **fail** — theo đúng truyền thống, dana định nghĩa bởi tính tùy
  tâm/phi giao dịch; gắn escrow/giá vào nó phá vỡ chính định nghĩa của nó.
- Tĩnh tâm (RFC-0010) → **fail** — ý nghĩa truyền thống của hành vi này là buông bỏ
  (non-attachment); biến nó thành thành tích đi ngược lại chính nó.

### Đối chiếu lại các RFC hiện có (retroactive check)

| RFC | Test 1 | Test 2 | Test 3 | Kết luận |
|---|---|---|---|---|
| 0001 Guardian Council | Pass | Pass | Pass | Đúng khi tài chính hóa |
| 0002 Phí theo uy tín | Pass | Pass | Pass | Đúng khi tài chính hóa |
| 0006 KYC attestation | Pass | Pass | Pass | Đúng khi tài chính hóa (opt-in) |
| 0008 Dana | — | — | Fail | Đúng khi từ chối tài chính hóa |
| 0010 Tĩnh tâm | Fail | Fail | Fail | Đúng khi từ chối tài chính hóa |

Kết quả: **cả 5 RFC hiện có đều đã tự nhiên rơi đúng phía checklist này**, dù không
RFC nào viết ra tiêu chí tường minh lúc đó. Điều này củng cố rằng đây không phải mâu
thuẫn cần sửa code, mà là **một nguyên tắc ẩn chưa được viết thành văn** — RFC-0011
chỉ làm công việc gọi tên nó, để không phải "may mắn đoán đúng" ở các RFC tiếp theo.

### Việc cần làm

Thêm một dòng tham chiếu ngắn tới RFC-0011 ở đầu mỗi RFC 0001/0002/0006/0008/0010
(không đổi nội dung, chỉ trỏ về đây) khi có PR sửa các file đó lần tới — không cần
làm ngay lập tức trong RFC này.

## Đánh đổi bảo mật / phi tập trung

- Đây là RFC về **nguyên tắc quyết định**, không tự nó thay đổi code/bề mặt tấn công
  nào — rủi ro duy nhất là nếu checklist bị áp dụng sai hoặc bị bỏ qua trong tương
  lai, khiến một hành vi vốn nên là Xu hướng B lại bị kéo vào Xu hướng A (financial
  creep) — ví dụ nếu sau này có ai đề xuất "gắn điểm uy tín cho việc tham gia governance
  vote" mà không chạy qua Test 3 trước.
- Ngược lại, checklist cũng bảo vệ khỏi xu hướng đối lập: từ chối tài chính hóa những
  thứ THẬT SỰ cần nó vì lý do toàn vẹn giao thức (ví dụ nếu ai đó đề xuất bỏ hẳn uy
  tín khỏi Guardian Council vì "nghe có vẻ giống dana" — sẽ fail rõ ràng ở Test 1/2,
  checklist ngăn được cả việc lạm dụng "tinh thần chống tài chính hóa" một cách không
  đúng chỗ).

## Maturity tier đề xuất

**Draft**, tiến tới gần **Stable** như RFC-0003 (là nguyên tắc nền tảng, ít thay đổi)
sau khi cộng đồng góp ý thêm ví dụ biên (edge case) và ít nhất 1-2 RFC tương lai đã
áp dụng checklist thành công trong thực tế.

## Thảo luận

(Mở — cần cộng đồng góp ý: có nên thêm phép thử thứ 4 về **khả năng đảo ngược**
(reversibility) — một khi đã tài chính hóa một hành vi, việc bỏ tài chính hóa nó sau
này khó hơn nhiều so với chiều ngược lại, nên có lẽ cần thiên vị nhẹ về phía "khi
nghi ngờ, chọn Xu hướng B trước, tài chính hóa sau nếu thật sự cần" thay vì coi hai
xu hướng ngang hàng nhau.)
