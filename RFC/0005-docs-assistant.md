# RFC-0005: Trợ Lý Tra Cứu Dựa Trên Tài Liệu (Grounded Docs Assistant)

- **Trạng thái:** Draft
- **Related module:** component mới (đề xuất `src/components/DocsAssistant.tsx`),
  `@google/genai` (dependency đã có sẵn trong `package.json` nhưng chưa dùng ở đâu).

## Vấn đề

Cộng đồng ngoài dự án (đặc biệt người không đọc được tiếng Việt hoặc không quen đọc
code/RFC trực tiếp) cần một cách nhanh để hỏi "cơ chế X hoạt động thế nào", "phí tính
sao", "cọc hoàn lại khi nào". Đã có ý tưởng biến việc này thành một "AI Agent đại diện
pháp nhân/gương mặt thương hiệu" — RFC này **không đi theo hướng đó**: một AI không thể
là đại diện pháp nhân, và mô tả nó như vậy chỉ che giấu chứ không xóa được trách nhiệm
thật đứng sau dự án. Phạm vi ở đây hẹp hơn nhiều và có chủ đích: **một công cụ tra cứu**,
không phải người phát ngôn.

## Các phương án đã cân nhắc

### Phương án A: AI Agent tự trị, đại diện/phát ngôn cho dự án
- Ưu điểm: nghe hoành tráng, đa ngôn ngữ, phản hồi 24/7.
- Nhược điểm: **loại bỏ ngay** — rủi ro pháp lý/trách nhiệm không giải quyết được (ai
  chịu trách nhiệm nếu nó hứa sai?), rủi ro hallucination mô tả cơ chế không có thật y
  hệt vấn đề "AI Arbiter" đã bị bác trước đó, và về bản chất mô tả một kiến trúc không
  tồn tại trong code — đúng thứ MATURITY.md/RFC được sinh ra để ngăn.

### Phương án B: Trợ lý tra cứu, giới hạn cứng vào tài liệu đã publish (ĐỀ XUẤT)
Chỉ trả lời dựa trên nội dung `RFC/`, `ARCHITECTURE.md`, `MATURITY.md`, và code thật
được nạp làm ngữ cảnh (context) cho mỗi câu hỏi — không được trả lời ngoài phạm vi đó.
- Ưu điểm: verify được (câu trả lời đối chiếu ngược lại đúng file nào), không giả vờ là
  đại diện chính thức, hữu ích thật cho người mới.
- Nhược điểm: cần ràng buộc kỹ để không "sáng tạo thêm" khi tài liệu không có câu trả
  lời — nếu làm ẩu sẽ suy thoái ngược về Phương án A.

### Phương án C: Chỉ search full-text phía client, không dùng AI
- Ưu điểm: không phụ thuộc API bên thứ ba, không có rủi ro hallucination, giữ đúng
  nguyên tắc "không backend" tuyệt đối.
- Nhược điểm: không trả lời được câu hỏi diễn đạt tự nhiên ("tại sao chọn top-N thay vì
  bầu cử"), người dùng phải tự đọc và ghép thông tin.

### Phương án D: Trang FAQ tĩnh
- Ưu điểm: đơn giản nhất, không rủi ro gì.
- Nhược điểm: không linh hoạt, không trả lời được câu hỏi ngoài danh sách đã soạn sẵn.

## Đề xuất

**Phương án B**, nhưng với một đánh đổi cần nói thẳng ở mục dưới — nếu đánh đổi đó
không chấp nhận được, lùi về Phương án C cho một bản MVP trước, nâng cấp lên B sau.

### Ràng buộc bắt buộc khi triển khai Phương án B

1. **System prompt khóa cứng phạm vi**: chỉ được trả lời dựa trên nội dung được nạp vào
   ngữ cảnh (RFC + ARCHITECTURE + MATURITY + trích đoạn code liên quan). Nếu tài liệu
   không có câu trả lời, bắt buộc trả lời "Chưa có tài liệu về việc này" — **không được
   suy đoán hay bịa cơ chế chưa tồn tại**.
2. **Nhãn UI rõ ràng, không thể bỏ qua**: hiển thị cố định gần khung chat, ví dụ "Công
   cụ tra cứu tài liệu tự động — không phải đại diện chính thức của dự án. Câu trả lời
   có thể sai, luôn đối chiếu lại RFC/code gốc." Không đặt tên kiểu "Cypher AI Spokesperson"
   hay bất kỳ tên nào ngụ ý đây là phát ngôn viên.
3. **Không được trả lời thay cho các quyết định thật** (giá, chính sách, cam kết hoàn
   tiền, tư cách pháp nhân) — những câu hỏi đó phải trỏ người dùng về kênh liên hệ thật
   (không phải chatbot tự quyết).

## Đánh đổi bảo mật / phi tập trung (mục bắt buộc, đọc kỹ trước khi triển khai)

Đây là điểm quan trọng nhất của RFC này: **một trợ lý AI thật (gọi Gemini API) về bản
chất cần một cuộc gọi tới dịch vụ bên thứ ba** — đúng loại phụ thuộc mà RFC-0004 từng từ
chối cho việc dịch thuật (Phương án D ở đó) vì "vi phạm nguyên tắc không backend". Ở đây
tình huống tương tự:

- Nếu gọi Gemini API **thẳng từ client** với API key nhúng trong code/bundle: key sẽ lộ
  công khai (ai mở DevTools cũng lấy được), người khác dùng ké quota/API key của dự án.
- Nếu muốn giấu key: cần một **proxy nhỏ phía server** — nhưng đó chính là dựng một
  backend, dù nhỏ, cho riêng tính năng này — mâu thuẫn trực tiếp với nguyên tắc cốt lõi
  "giao thức không backend" đã tuyên bố từ RFC đầu tiên.

**Không có cách nào dùng AI thật (không phải Phương án C) mà tránh hoàn toàn 1 trong 2
đánh đổi trên.** Đề xuất xử lý trung thực: coi tính năng này là **ngoại lệ có ý thức**,
tách biệt hẳn khỏi "giao thức" (nó là công cụ tài liệu, không phải Cypher Guide Protocol
Layer 2), triển khai qua proxy nhỏ, và ghi rõ trong `ARCHITECTURE.md`: đây là dịch vụ phụ
trợ ngoài giao thức lõi, có phụ thuộc bên thứ ba, khác biệt hoàn toàn với mọi cơ chế khác
của dự án — không để người đọc nhầm tưởng cả giao thức đã âm thầm có backend.

## Maturity tier đề xuất

**Experimental** — cần ít nhất một vòng kiểm tra thật xem hệ thống có tuân thủ đúng ràng
buộc "không bịa" ở trên hay không trước khi công bố rộng rãi.

## Thảo luận

(Mở.)
