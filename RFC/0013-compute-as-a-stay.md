# RFC-0013: Lưu Trú Bằng Compute (Compute-as-a-Stay) — Khi Khách Không Phải Con Người

- **Trạng thái:** Draft — RFC đầu tiên mở rộng khái niệm "khách" của CypherGuide ra khỏi
  con người, sang tác nhân AI tự động (autonomous agent).
- **Tác giả:** Chủ dự án + Claude (AI), cần cộng đồng bổ sung
- **Module liên quan:** mở rộng từ RFC-0007/0009 (hạ tầng LoRa mesh/SBC do host cung
  cấp), RFC-0003 (danh tính npub), RFC-0011 (checklist tài chính hóa), RFC-0012 (ranh
  giới chủ quyền) — không có module code riêng, đây là RFC định nghĩa khái niệm trước
  khi có triển khai.

## Vấn đề

Từ câu hỏi "nếu con người cần homestay để ở, AI agent phi tập trung sẽ 'ở' đâu" — câu
trả lời kỹ thuật rõ ràng: "nhà" của một agent chính là **compute** (CPU, RAM, băng
thông), không phải giường/mái che. Đây không phải câu hỏi viển vông — hiện tượng
Moltbook (mạng xã hội 1.5 triệu AI agent tự động, thuộc Meta Superintelligence Labs)
cho thấy tác nhân AI tự động vận hành liên tục, cần hạ tầng tính toán, đã là thực tế
đang diễn ra ở quy mô lớn, không còn là giả thuyết tương lai.

CypherGuide **đã có sẵn đúng loại hạ tầng cần thiết** — các node LoRa mesh và SBC (đề
cập trong RFC-0007/0009) do host tự vận hành, thường dư thừa công suất tính toán ngoài
giờ phục vụ chính. Câu hỏi cụ thể: **giao thức có nên hỗ trợ một loại listing mới, nơi
"khách" là một AI agent thuê compute thay vì con người thuê phòng, và nếu có thì theo
mô hình giá/xác minh nào?**

Vấn đề cần giải quyết trước khi viết bất kỳ dòng code nào: khái niệm "khách", "lưu
trú", "uy tín" trong 12 RFC hiện có đều ngầm định chủ thể là con người. Mở rộng sang
agent mà không định nghĩa rõ ranh giới sẽ lặp lại đúng rủi ro đã cảnh báo khi đánh giá
đề xuất tích hợp GPT-6 Astra: trao quyền tài chính/quyết định cho một tác nhân tự động
mà không có giới hạn rõ ràng.

## Các phương án đã cân nhắc

### Phương án A: Không hỗ trợ — giữ CypherGuide thuần túy cho con người, coi việc cho
  thuê compute là ngoài phạm vi giao thức
- Ưu điểm: giữ phạm vi hẹp, tránh toàn bộ độ phức tạp của "tác nhân không phải người".
- Nhược điểm: bỏ lỡ một mở rộng hợp lý của chính hạ tầng đã xây (RFC-0007/0009) — công
  suất mesh/SBC dư thừa của host tiếp tục lãng phí, trong khi nhu cầu compute cho agent
  tự động đang tăng thật (Moltbook, Astra và các hệ agent khác) là cơ hội thu nhập
  chính đáng cho host.

### Phương án B: Áp mô hình "dana" (tùy tâm) cho lưu trú compute, giống RFC-0008
- Ưu điểm: nhất quán về mặt hình thức với listing hiện có.
- Nhược điểm: **loại bỏ** — chạy qua Test 3 (Original-meaning) của RFC-0011: dana định
  nghĩa bằng "lòng biết ơn tự nguyện" — một agent không có trạng thái cảm xúc để biết
  ơn, gắn "tùy tâm" vào giao dịch compute là lỗi phạm trù, không phải lựa chọn thiết
  kế hợp lý.

### Phương án C: Loại listing riêng "Compute-as-a-Stay" — giá cố định, xác minh bằng
  số liệu máy móc khách quan (CPU-giây, băng thông), namespace uy tín tách biệt khỏi
  Proof-of-Stay của con người, quyền quyết định tài chính luôn thuộc về npub con người
  sở hữu agent, không phải chính agent (ĐỀ XUẤT)
- Ưu điểm: tận dụng đúng hạ tầng sẵn có, xác minh dễ dàng và khách quan hơn cả
  Proof-of-Stay con người (CPU-giây đo được chính xác, không cần lòng tin), không đụng
  tới các nguyên tắc dana/uy tín con người hiện có.
- Nhược điểm: cần cơ chế kỹ thuật mới (đo lường tài nguyên, giới hạn chi tiêu tự động)
  chưa có trong code hiện tại — chi phí triển khai không nhỏ.

## Đề xuất

**Phương án C**, với các ràng buộc cụ thể sau:

### 1. "Khách" là agent, nhưng "người ký hợp đồng" luôn là con người

Một AI agent có thể có npub riêng (RFC-0003 không giới hạn npub chỉ dành cho người),
nhưng **giao dịch thanh toán phải được ủy quyền bởi npub con người sở hữu agent đó**,
kèm hạn mức chi tiêu rõ ràng (spending cap) — đúng bài học rút ra khi đánh giá đề xuất
Astra: không trao quyền tài chính không giới hạn cho một tác nhân tự động.

### 2. Xác minh bằng số liệu máy móc, không phải lòng tin

Đo lường: CPU-giây đã dùng, băng thông tiêu thụ, thời lượng phiên — tất cả đều **verify
được khách quan** (Test 1 của RFC-0011 pass rõ ràng hơn cả Proof-of-Stay con người, vốn
dựa một phần vào khai báo).

### 3. Namespace uy tín tách biệt

"Uy tín thuê compute" của một agent **không được trộn lẫn** với uy tín lưu trú của con
người trong cùng một thang điểm — tránh việc một agent chạy hàng nghìn phiên ngắn làm
lệch hoàn toàn thang uy tín vốn được thiết kế cho tần suất lưu trú của con người
(RFC-0002).

### 4. Giá cố định, không escrow tùy chọn

Theo đúng mô hình `Faraday Bunker & Bitcoin Mesh Lab` (listing giá cố định hiện có) —
không áp dụng dana, có escrow như listing thông thường.

## Đánh đổi bảo mật / phi tập trung

- **Rủi ro lớn nhất**: nếu không giới hạn chặt quyền tài chính của agent, một agent bị
  lỗi hoặc bị tấn công (prompt injection, giống rủi ro đã nêu với Astra) có thể tự động
  đặt hàng loạt "phiên compute" vượt ngân sách dự kiến của chủ sở hữu — mức độ nghiêm
  trọng tương đương sự cố Hugging Face/OpenAI agent đã xảy ra thật. Giảm thiểu bằng hạn
  mức chi tiêu cứng (hard spending cap) ký sẵn trong hợp đồng, không thể agent tự vượt
  qua.
- **Ranh giới chủ quyền vẫn áp dụng (RFC-0012), chỉ dịch chuyển hình thức**: agent
  không cần khai báo tạm trú (không có sự hiện diện vật lý con người), nhưng **host —
  con người sở hữu máy — vẫn chịu đầy đủ nghĩa vụ thuế/giấy phép cho hoạt động cho thuê
  hạ tầng tính toán** tại quốc gia họ vận hành. Việc "khách" không phải người không
  miễn trừ host khỏi nghĩa vụ pháp lý liên quan tới việc kinh doanh cho thuê tài
  nguyên số.
- **Không mở rộng phạm vi Guardian Council** để xử lý tranh chấp compute — tranh chấp
  loại này (agent báo cáo sai số liệu sử dụng) nên có cơ chế phân xử riêng, đơn giản
  hơn, dựa trên log máy móc khách quan, không cần trọng tài con người can thiệp sâu như
  tranh chấp lưu trú thông thường.

## Maturity tier đề xuất

**Experimental** — đây là RFC hoàn toàn lý thuyết, chưa có dòng code hay thử nghiệm
thực tế nào. Không nâng tier cho tới khi có ít nhất một thử nghiệm thật: một agent cụ
thể (có thể chính là mô hình nhỏ từ bộ thử nghiệm RFC-0009) thuê compute từ một node
host thật, đo được số liệu CPU-giây/thanh toán thật qua Lightning.

## Thảo luận

(Mở — câu hỏi lớn nhất chưa có câu trả lời: nếu agent hoạt động sai lệch nghiêm trọng
trong phiên thuê compute — ví dụ dùng tài nguyên đó để tấn công bên thứ ba — trách
nhiệm thuộc về ai: host cho thuê hạ tầng, hay npub con người sở hữu agent? Đây có thể
cần một RFC riêng về trách nhiệm pháp lý của agent tự động, mở rộng từ chính RFC-0012.)
