# RFC-0013: Lưu Trú Sẵn Sàng Cho Agent (Agent-Ready Stay) — Tiện Nghi Cho Giới Cypher/Personal Business

- **Trạng thái:** Draft — **thay thế hoàn toàn** bản nháp RFC-0013 trước đó ("Compute-
  as-a-Stay", coi AI agent là một loại khách độc lập). Sau khi thảo luận thêm, hướng đó
  bị loại bỏ vì cạnh tranh trực diện với các chợ compute phi tập trung đã trưởng thành
  (Akash Network, io.net, Render) và phá vỡ mô hình "khách là con người" xuyên suốt 12
  RFC trước. Bản này đi theo hướng khác hẳn: **khách vẫn luôn là con người**, agent chỉ
  là hạ tầng đi kèm họ mang theo.
- **Tác giả:** Chủ dự án + Claude (AI), cần cộng đồng bổ sung
- **Module liên quan:** mở rộng hệ thống tag tiện nghi đã có (`LORA MESH NODE`, `SOLAR
  OFF-GRID`, `DIGITAL DETOX`, `VERIFIED_NODE` — thấy trong listing demo hiện tại),
  không đụng tới RFC-0003 (danh tính), không tạo namespace uy tín mới.

## Vấn đề

Ngày càng nhiều digital nomad trong giới cypherpunk/freelancer **mang theo AI agent
đang chạy việc cho họ liên tục** — agent coding, trợ lý cá nhân, bot theo dõi thị
trường — không phải giả thuyết, hiện tượng Moltbook (1.5 triệu agent tự động, thuộc
Meta Superintelligence Labs) cho thấy đây đã là thực tế phổ biến. Nhóm khách này cần
nhiều hơn một cái giường — họ cần **hạ tầng mà agent của họ có thể dựa vào** trong suốt
kỳ lưu trú: node compute riêng đủ ổn định, Nostr relay riêng (không định tuyến qua bên
thứ ba lạ), băng thông đảm bảo tối thiểu để agent chạy liên tục không gián đoạn.

Vấn đề cụ thể: hệ thống tag tiện nghi hiện tại (`LORA MESH NODE`, `SOLAR OFF-GRID`...)
mô tả tốt hạ tầng vật lý, nhưng **không có chuẩn nào cho "sẵn sàng phục vụ agent"** —
mỗi host tự mô tả tùy ý, khách không có cách nào so sánh listing nào thực sự đáp ứng
được nhu cầu vận hành agent liên tục, listing nào chỉ ghi "có wifi" chung chung.

## Các phương án đã cân nhắc

### Phương án A: Không làm gì — để tiện nghi agent tự phát triển tự nhiên qua mô tả tự
  do của host
- Ưu điểm: không cần chuẩn hóa gì, đơn giản nhất.
- Nhược điểm: không có từ vựng chung, khách không so sánh được, dễ xảy ra tình trạng
  host quảng cáo quá tay ("agent-ready") mà thực tế băng thông không đủ ổn định.

### Phương án B: Coi AI agent là một loại "khách" độc lập, có danh tính/uy tín/thanh
  toán riêng (bản nháp RFC-0013 trước đó)
- Ưu điểm: (đã phân tích ở bản trước)
- Nhược điểm: **loại bỏ** — cạnh tranh trực diện với hạ tầng compute phi tập trung đã
  trưởng thành hơn nhiều (Akash, io.net), và biến CypherGuide từ "nền tảng lưu trú cho
  người" thành "chợ compute cho bot" — lệch khỏi chính đối tượng cộng đồng đã xây dựng
  suốt từ đầu (Kyle, host Sài Gòn, Cyphermunk House — toàn bộ đều là con người tìm nơi
  ở).

### Phương án C: Định nghĩa chuẩn tag tiện nghi mới "Agent-Ready", xác minh bằng số
  liệu khách quan (uptime, băng thông tối thiểu, có compute node riêng hay không),
  hoạt động hoàn toàn trong mô hình khách-là-người hiện có (ĐỀ XUẤT)
- Ưu điểm: đúng nhu cầu thật của giới cypherpunk/freelancer mà không cần đổi bản chất
  sản phẩm; tận dụng đúng hạ tầng RFC-0007/0009 đã có; không cạnh tranh với Akash/io.net
  vì đây là tiện nghi đi kèm một kỳ lưu trú, không phải dịch vụ compute bán riêng.
- Nhược điểm: cần định nghĩa rõ ngưỡng tối thiểu để tránh host gắn tag "Agent-Ready" mà
  không đáp ứng thật.

## Đề xuất

**Phương án C.** Định nghĩa tag tiện nghi mới: **`AGENT-READY`**

### Tiêu chí tối thiểu để gắn tag (bắt buộc đạt đủ cả 3)

1. **Compute node riêng** — host cung cấp quyền truy cập một thiết bị tính toán riêng
   biệt (SBC/mini-PC) cho khách trong suốt kỳ lưu trú, không chia sẻ đồng thời với
   khách khác.
2. **Nostr relay riêng hoặc self-hosted** — agent của khách có thể kết nối qua relay do
   host tự vận hành, không bắt buộc định tuyến qua relay công cộng bên thứ ba.
3. **Băng thông sàn đảm bảo** (ví dụ tối thiểu X Mbps liên tục) — ghi rõ con số cụ thể
   trong listing, không dùng mô tả mơ hồ như "wifi tốt".

### Cách xác minh — theo đúng mô hình `VERIFIED_NODE` đã có

Giống cách listing hiện tại hiển thị `mesh:11.94.108.45 (Da Lat Pine Valley)` để xác
minh node LoRa thật — tag `AGENT-READY` cũng cần gắn với địa chỉ/thông số node có thể
kiểm tra được (ping test, uptime log công khai), không chỉ là lời tự nhận của host.

### Không tạo gì mới ngoài tag này

- **Không có danh tính/uy tín riêng cho agent** — agent vẫn là công cụ của khách con
  người, mọi uy tín/thanh toán vẫn thuộc về npub của người đặt phòng (đúng RFC-0003
  hiện có, không sửa đổi).
- **Không có mô hình giá riêng** — đây là tiện nghi cộng thêm vào giá listing hiện có
  (giống cách `SOLAR OFF-GRID` không có mô hình giá riêng), không phải dịch vụ tính phí
  theo CPU-giây như bản nháp trước.
- **Không đụng tới RFC-0008 (dana)** — một listing dana hoàn toàn có thể gắn thêm tag
  `AGENT-READY` nếu host thật sự có hạ tầng đó, không mâu thuẫn gì.

## Đánh đổi bảo mật / phi tập trung

- **Rủi ro chính**: host gắn tag `AGENT-READY` không đúng thực tế (băng thông không đủ,
  node dùng chung nhiều khách) — giảm thiểu bằng xác minh máy móc bắt buộc (giống
  `VERIFIED_NODE`), không dựa vào tự khai.
- **Không mở ra rủi ro tài chính mới** — vì không có agent nào tự thanh toán, không có
  spending cap cần quản lý, không có bề mặt tấn công tài chính mới so với listing thông
  thường. Đây là khác biệt an toàn quan trọng nhất so với bản nháp bị loại bỏ trước đó.
- **Ranh giới chủ quyền (RFC-0012) không phát sinh vấn đề mới** — khách vẫn là con
  người, vẫn khai báo tạm trú như bình thường, agent chỉ là công cụ họ mang theo, không
  tạo ra chủ thể pháp lý mới nào cần cân nhắc.

## Maturity tier đề xuất

**Draft**, có thể tiến nhanh lên **Stable** hơn bản nháp trước — vì đây chỉ là mở rộng
hệ thống tag tiện nghi đã có sẵn, rủi ro thấp, không cần hạ tầng mới phức tạp. Có thể
thử nghiệm ngay trên 1-2 listing thật (ví dụ Faraday Bunker đã có sẵn `LOCAL NOSTR
RELAY` — gần như đã đạt tiêu chí 2/3, chỉ cần bổ sung công bố băng thông sàn cụ thể).

## Thảo luận

(Mở — ngưỡng "băng thông sàn" cụ thể nên là bao nhiêu Mbps để coi là đủ cho agent chạy
liên tục? Cần ý kiến từ ai thực sự vận hành agent 24/7 để có con số thực tế, không phải
đoán.)
