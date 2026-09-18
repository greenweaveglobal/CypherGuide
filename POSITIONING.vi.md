# CypherGuide & AI Cục Bộ — Bản Định Vị (dùng cho đơn xin tài trợ / giới thiệu dự án)

## Một câu tóm tắt

CypherGuide không tham gia cuộc đua AI tập trung hóa quy mô nghìn tỷ đô — chúng tôi
đang thử nghiệm một câu hỏi nhỏ hơn, cụ thể hơn: **liệu một mô hình ngôn ngữ nhỏ, chạy
hoàn toàn trên phần cứng giá rẻ mà chính người dùng sở hữu, có thể trả lời đủ tốt cho
đúng nhu cầu của nó hay không** — không cần đám mây, không cần công ty nào đứng giữa.

## Vì sao nói "tiếng nói nhỏ", không phải "giải pháp lớn"

Chúng tôi không tuyên bố cạnh tranh được với Nvidia, OpenAI, hay bất kỳ hạ tầng AI tập
trung nào — quy mô hoàn toàn khác nhau, không có ý nghĩa gì khi so sánh. Điều chúng tôi
tin: **giá trị của AI cục bộ không nằm ở việc thắng cuộc đua quy mô, mà ở việc tồn tại
như một lựa chọn thay thế thật, kiểm chứng được**, cho những ai coi trọng quyền riêng
tư/chủ quyền dữ liệu hơn là sức mạnh tuyệt đối của mô hình.

## Xác nhận độc lập từ một chuyên gia không liên quan tới dự án

TS. Phạm Hy Hiếu — Giám đốc Khối Chuyển đổi Trí tuệ Nhân tạo tại Techcombank, từng làm
việc tại Google Brain, xAI, và OpenAI — mô tả AI hiện đại dựa trên 3 cột trụ:
**Algorithm** (đã phổ biến, ~20 thuật toán nền tảng ai cũng tiếp cận được), **Data**
(doanh nghiệp có thể tự làm chủ), và **Compute** — mà ông gọi thẳng là **"bài toán tầm
quốc gia"**, đòi hỏi đầu tư từ nhà nước hoặc các tập đoàn quy mô như FPT, Viettel,
GreenNode.

Đây là xác nhận độc lập, từ một người có thẩm quyền thật trong ngành, không biết gì về
CypherGuide, cho đúng kết luận dự án đã tự rút ra: **compute quy mô lớn không phải sân
chơi của một giao thức nhỏ.** Chúng tôi không cố cạnh tranh ở cột trụ đó — chúng tôi
chọn phần vừa sức: giúp cá nhân tận dụng đúng phần cứng nhỏ họ đã sở hữu, cho đúng nhu
cầu hẹp của họ, không mơ tới việc xây "trung tâm dữ liệu quốc gia phiên bản phi tập
trung".

## Bằng chứng cụ thể, không phải tuyên ngôn suông

- **RFC-0009**: bộ thử nghiệm thật (thiết kế đầy đủ, sẵn sàng chạy) đo xem một mô hình
  1.5B tham số (Qwen2.5) chạy trên Raspberry Pi có trả lời đúng câu hỏi về tài liệu dự
  án hay không — có cả câu hỏi bẫy để kiểm tra mô hình có bịa thông tin hay không. Kết
  quả sẽ được công bố dù đạt hay không đạt.
- **RFC-0013**: tiện nghi "Agent-Ready" cho listing — hạ tầng biên (edge) do host tự vận
  hành, phục vụ đúng nhu cầu thật của giới freelancer/cypherpunk mang theo agent AI khi
  di chuyển, không tạo ra một "chợ compute" cạnh tranh với hạ tầng tập trung đã có.
- **Từ chối rõ ràng những gì không phù hợp**: đã từ chối tích hợp AI agent tự chủ có
  quyền quyết định tài chính không giới hạn (đề xuất GPT-6 Astra), đã sửa lại toàn bộ
  hướng đi ban đầu của RFC-0013 khi phát hiện nó lệch khỏi nguyên tắc cốt lõi — và giữ
  nguyên quyết định đó ngay cả khi có đề xuất sau này thử đưa mô hình "chợ compute" quay
  lại dưới một cái tên kỹ thuật khác (NIP-90 DVM).

## Điều chúng tôi không hứa

Chúng tôi không hứa AI cục bộ sẽ "thắng" AI tập trung, không hứa mốc thời gian cụ thể
cho việc mở rộng. Maturity tier của RFC-0009/0013 vẫn là **Experimental** — sẽ chỉ nâng
lên khi có số liệu thật, không phải khi có nhu cầu marketing.

## Vì sao điều này đáng để tài trợ

Không phải vì quy mô lớn — mà vì đây là một trong số ít dự án **thực sự kiểm chứng
được bằng cách tự chạy thử nghiệm công khai**, ghi lại cả thất bại lẫn thành công, thay
vì chỉ tuyên bố. Toàn bộ RFC, kể cả những lần tự sửa sai giữa chừng, đều công khai
tại github.com/greenweaveglobal/cypherguide.
