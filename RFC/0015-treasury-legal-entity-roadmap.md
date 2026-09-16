# RFC-0015: Lộ Trình Treasury & Pháp Nhân (Treasury & Legal Entity Roadmap)

- **Trạng thái:** Draft — như RFC-0012, đây là tài liệu nguyên tắc/lộ trình, không gắn module code cụ thể.
- **Tác giả:** Chủ dự án + Claude (AI), cần cộng đồng bổ sung
- **Module liên quan:** không có module riêng — định hình cách treasury cộng đồng (donate/grant) được quản lý qua từng giai đoạn phát triển, kế thừa trực tiếp ranh giới đã định nghĩa ở RFC-0012 và cơ chế Guardian Council ở RFC-0001.

## Vấn đề

CypherGuide hiện nhận donate qua một địa chỉ Lightning cá nhân của người sáng lập. Khi dự án lớn dần (grant từ OpenSats, donate cộng đồng), câu hỏi "ai kiểm soát tiền, ai chịu trách nhiệm pháp lý" trở nên cấp thiết — nhưng giải pháp thường gặp (vội vàng lập pháp nhân đầy đủ ngay từ đầu) không thực tế: một Foundation (Stiftung) tại Thụy Sĩ đòi hỏi tối thiểu ~50.000 CHF vốn ban đầu (theo thông lệ giám sát, dù luật không ghi cứng con số này) cộng thêm phí thiết lập và vận hành — tổng cam kết năm đầu ước tính 70.000-75.000 CHF. Yêu cầu này vượt xa quy mô treasury ở giai đoạn dự án chỉ có vài host thí điểm.

Ngược lại, nếu không có lộ trình rõ ràng, dự án đối mặt hai rủi ro đối lập:
1. Giữ mãi mô hình "một ví cá nhân" ngay cả khi treasury đã đủ lớn để cần minh bạch/giám sát cộng đồng thật — rủi ro tập trung hoá quyền lực tài chính vào một cá nhân, đi ngược tinh thần dự án.
2. Vội vàng lập Foundation khi treasury còn nhỏ — tốn tài nguyên vào bộ máy pháp lý thay vì phát triển protocol, và có thể phải giải thể/tái cấu trúc tốn kém nếu ước tính sai quy mô.

## Các phương án đã cân nhắc

### Phương án A: Lập Foundation ngay khi có khoản grant/donate đầu tiên
- Ưu điểm: giải quyết dứt điểm vấn đề pháp lý/uy tín ngay từ đầu.
- Nhược điểm: **loại bỏ** — không khả thi tài chính ở giai đoạn hiện tại (chưa có treasury tương xứng với mức 70.000+ CHF cam kết), rủi ro biến việc "gọi vốn để lập Foundation" thành mục tiêu chính thay vì phát triển protocol.

### Phương án B: Không bao giờ lập pháp nhân, giữ mãi mô hình cá nhân/multisig phi chính thức
- Ưu điểm: đơn giản, không chi phí pháp lý.
- Nhược điểm: **loại bỏ khi treasury đủ lớn** — không ký được hợp đồng dài hạn (VPS, dịch vụ), không mở được tài khoản ngân hàng cho quỹ, nhiều tổ chức grant lớn yêu cầu pháp nhân nhận mới giải ngân được. Giới hạn trần phát triển của dự án.

### Phương án C: Lộ trình 4 giai đoạn, kích hoạt theo điều kiện treasury đạt được — không theo mốc thời gian cố định (ĐỀ XUẤT)
- Ưu điểm: mỗi bước tương xứng đúng quy mô treasury thật tại thời điểm đó, tách riêng "quản trị minh bạch" (làm được ngay, rẻ) khỏi "tư cách pháp nhân đầy đủ" (chỉ khi thực sự cần).
- Nhược điểm: đòi hỏi kỷ luật — không vội lập pháp nhân "cho có", cần cộng đồng đồng thuận rõ từng ngưỡng kích hoạt.

## Đề xuất

**Phương án C.**

### Giai đoạn 1 — Protocol thuần, chưa có pháp nhân (hiện tại)
- Domain/hạ tầng vận hành bằng chi phí cá nhân người sáng lập, công khai minh bạch đây là chi phí cá nhân tạm thời.
- Ví dev-donation hiện tại là ví cá nhân — chấp nhận được ở quy mô này với điều kiện **ghi rõ công khai** đây không phải quỹ cộng đồng chính thức.

### Giai đoạn 2 — Kích hoạt khi nhận grant/donate đầu tiên
- Chuyển ngay sang **ví multisig** với Guardian Council (tham chiếu RFC-0001) — 2-4 thành viên tin cậy trong cộng đồng Bitcoin/Nostr, không cần pháp nhân để thực hiện bước này.
- Đây là bước tạo minh bạch/giám sát cộng đồng thật, sớm hơn nhiều so với việc chờ đủ điều kiện lập Foundation.

### Giai đoạn 3 — Kích hoạt khi treasury đạt ~10.000-20.000 CHF
- Cân nhắc **Verein (Hội theo luật Thụy Sĩ)** — không yêu cầu vốn tối thiểu, chi phí thành lập thấp (vài trăm CHF), đủ tư cách pháp nhân để ký hợp đồng, mở tài khoản, nhận grant lớn hơn — mà chưa cần cam kết tài chính ở mức Foundation.

### Giai đoạn 4 — Kích hoạt khi treasury ổn định trên ~70.000-100.000 CHF
- Lập **Foundation (Stiftung) tại Zug** — đủ điều kiện tài chính để đáp ứng vốn ban đầu + chi phí vận hành mà không rút cạn quỹ hoạt động của dự án.
- **Labs GmbH** (lớp thương mại, tách biệt hoàn toàn khỏi protocol) chỉ cân nhắc sau Foundation, và chỉ nếu có nhu cầu kinh doanh thật (phần cứng, dịch vụ premium) — không bắt buộc.
- **Cảnh báo bắt buộc giữ nguyên ở mọi giai đoạn:** không pháp nhân nào trong mô hình này được thu phí trực tiếp từ giao dịch P2P giữa khách-host — vi phạm điều này khiến pháp nhân bị xếp vào "Financial Intermediary" theo luật Thụy Sĩ, kéo theo yêu cầu KYC/AML khắt khe, phá vỡ chính tinh thần phi tập trung của giao thức.

## Đánh đổi bảo mật / phi tập trung

- Giai đoạn 1-2 có rủi ro tập trung hoá tạm thời (ví cá nhân, chưa multisig) — chấp nhận được vì treasury còn quá nhỏ để đáng bị tấn công/lạm dụng, và chuyển sang multisig ngay khi có khoản tiền đầu tiên đáng kể.
- Việc không vội lập pháp nhân giữ đúng tinh thần RFC-0012 (đừng biến protocol/dự án thành trung gian tài chính/pháp lý sớm hơn cần thiết).
- Ngưỡng treasury kích hoạt từng giai đoạn là ước tính, cần cộng đồng xác nhận lại định kỳ khi có dữ liệu chi phí pháp lý cập nhật hơn.

## Maturity tier đề xuất

**Draft**, tiến tới **Stable** sau khi Giai đoạn 2 (multisig Guardian Council) thực sự được thiết lập và vận hành với khoản treasury thật đầu tiên.

## Thảo luận

(Mở — RFC này đặt ra câu hỏi cụ thể cho cộng đồng: ngưỡng treasury 10.000-20.000 CHF cho Giai đoạn 3 và 70.000-100.000 CHF cho Giai đoạn 4 có hợp lý không, hay cần điều chỉnh theo kinh nghiệm thực tế của các dự án mã nguồn mở/crypto khác đã từng đi qua lộ trình tương tự? Cần thêm ý kiến từ ai đã có kinh nghiệm vận hành Foundation/Verein tại Thụy Sĩ.)
