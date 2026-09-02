# RFC-0012: Ranh Giới Chủ Quyền (Sovereignty Boundary Principle)

- **Trạng thái:** Draft — giống RFC-0003 và RFC-0011, đây là **tài liệu nguyên tắc nền tảng** (cross-cutting), không gắn với module code cụ thể, mà định nghĩa rõ **cái gì giao thức CÓ THỂ phi tập trung hóa, và cái gì KHÔNG THỂ, dù có cố gắng đến đâu.**
- **Tác giả:** Chủ dự án + Claude (AI), cần cộng đồng bổ sung
- **Module liên quan:** không có module riêng — áp dụng như một ràng buộc tư duy cho mọi RFC tương lai liên quan tới host/khách (đặc biệt RFC-0001, 0003, 0006, 0008), và là cơ sở lý luận cho thảo luận cộng đồng về pháp lý host đã mở trên Nostr.

## Vấn đề

Khi đào sâu câu hỏi "host có thực sự đủ bản lĩnh để nhận Lightning từ khách, xét đến luật thuế và lưu trú của từng quốc gia" — câu trả lời tra cứu được (cụ thể tại Việt Nam, Nghị định 282/2025/NĐ-CP) cho thấy một sự thật quan trọng: **thanh toán bằng Lightning không hề miễn trừ host khỏi bất kỳ nghĩa vụ pháp lý nào** — khai báo tạm trú cho khách nước ngoài trong 12-24 giờ, đăng ký hộ kinh doanh khi vượt ngưỡng doanh thu, giấy phép an ninh trật tự/phòng cháy chữa cháy nếu vận hành như cơ sở lưu trú kinh doanh — tất cả các nghĩa vụ này **hoàn toàn độc lập với phương thức thanh toán**.

Đây không phải vấn đề riêng Việt Nam. Đây là một giới hạn mang tính cấu trúc: **phi tập trung hóa thanh toán không hề phi tập trung hóa được chủ quyền pháp lý của một quốc gia trên chính lãnh thổ của họ.** Một host ở bất kỳ đâu vẫn chịu đầy đủ luật nước sở tại — không giao thức nào, dù thiết kế tinh vi đến đâu, thay đổi được điều đó.

Vấn đề cụ thể cần giải quyết: **11 RFC hiện có chưa từng nói rõ ranh giới này.** Nếu không định nghĩa tường minh, có hai rủi ro đối lập:
1. Người dùng/host hiểu nhầm rằng dùng Lightning/Cashu đồng nghĩa với "vô hình" trước pháp luật — dẫn tới vi phạm thật, bị phạt thật (như trường hợp phạt 3-5 triệu VNĐ tại Việt Nam), gây tổn hại uy tín cho cả host lẫn dự án.
2. Ngược lại, dự án có thể bị cám dỗ "giải quyết" vấn đề này bằng cách xây một lớp tuân thủ pháp lý tập trung hóa — chính là con đường dẫn ngược về đúng mô hình gatekeeper tập trung mà CypherGuide sinh ra để tránh.

## Các phương án đã cân nhắc

### Phương án A: Giao thức hoàn toàn im lặng về luật địa phương — không nhắc gì tới nghĩa vụ pháp lý của host trong bất kỳ tài liệu nào
- Ưu điểm: giữ đúng tinh thần "protocol neutral", không đứng ra làm cố vấn pháp lý.
- Nhược điểm: **loại bỏ** — đây chính là rủi ro (1) ở trên. Im lặng hoàn toàn dễ bị hiểu nhầm thành ngầm xác nhận "không cần lo luật pháp" — nguy hiểm thật cho host mới, đặc biệt ai lần đầu tham gia không có kinh nghiệm vận hành lưu trú.

### Phương án B: Xây một lớp tuân thủ pháp lý chính thức — CypherGuide tự xác nhận/xác thực host đã tuân thủ luật từng quốc gia trước khi cho lên listing
- Ưu điểm: bảo vệ khách tốt nhất, giảm rủi ro pháp lý cho cả hệ sinh thái.
- Nhược điểm: **loại bỏ hoàn toàn** — không đội ngũ nào, dù lớn đến đâu, có thể theo kịp luật lưu trú/thuế của mọi quốc gia, mọi thời điểm (luật thay đổi liên tục — chính Nghị định 282/2025 mới có hiệu lực từ 15/12/2025, thay thế Nghị định 144/2021 trước đó). Xây dựng lớp "xác thực tuân thủ" biến CypherGuide thành một bên trung gian chịu trách nhiệm pháp lý — đúng vị trí "Financial Intermediary" mà RFC pháp lý Thụy Sĩ (thảo luận trước đây về Foundation/GmbH) đã cảnh báo tránh, giờ mở rộng sang rủi ro tương tự ở khía cạnh lưu trú/thuế.

### Phương án C: Tài liệu tham khảo do cộng đồng đóng góp, ghi rõ không phải nguồn chính thống, tách biệt hoàn toàn khỏi giao thức — theo đúng mô hình "Application Neutrality" của RFC-0006 (ĐỀ XUẤT)
- Ưu điểm: cảnh báo host một cách trung thực mà không biến CypherGuide thành bên chịu trách nhiệm pháp lý. Tận dụng đúng lợi thế phi tập trung: host ở từng quốc gia hiểu rõ luật nước họ hơn bất kỳ đội ngũ trung tâm nào.
- Nhược điểm: chất lượng thông tin phụ thuộc vào ai đóng góp — cần cơ chế ghi rõ nguồn và ngày cập nhật để tránh thông tin cũ/sai lan truyền như sự thật.

## Đề xuất

**Phương án C**, với ranh giới rõ ràng cần khắc sâu vào mọi tài liệu liên quan:

### Nguyên tắc cốt lõi: bảng ranh giới chủ quyền

| Có thể phi tập trung hóa (thuộc phạm vi giao thức) | Không thể phi tập trung hóa (thuộc chủ quyền quốc gia) |
|---|---|
| Thanh toán (Lightning/Cashu — RFC-0001, 0002) | Nghĩa vụ khai báo lưu trú/tạm trú |
| Danh tính (Nostr npub — RFC-0003) | Thuế thu nhập theo quốc gia cư trú |
| Uy tín (portable reputation — RFC-0003) | Giấy phép kinh doanh lưu trú/an ninh/PCCC |
| Xác thực tùy chọn (KYC opt-in — RFC-0006) | Quyền cưỡng chế/phạt của chính quyền sở tại |
| Suy luận AI (về lý thuyết, RFC-0009) | Sự hiện diện vật lý của con người trên lãnh thổ |

Lý do gốc rễ của ranh giới này: cột bên trái là **thông tin/giá trị di chuyển qua mạng**, không cần một cơ quan trung tâm xác nhận. Cột bên phải gắn liền với **sự hiện diện vật lý thật** và **độc quyền cưỡng chế của nhà nước trên lãnh thổ của họ** — hai thứ không giao thức nào, dù thiết kế tinh vi đến đâu, có thể mã hóa hay thay thế được.

### Việc cụ thể cần làm

1. **Tạo tài liệu riêng "Thực Tế Pháp Lý Cho Host"** (không phải RFC, không đánh số, đặt ngoài thư mục `RFC/` để tránh nhầm là chuẩn giao thức) — tổng hợp do host tự đóng góp theo từng quốc gia, mỗi mục ghi rõ **ai đóng góp, ngày nào, "đây là điều tôi được biết áp dụng ở nơi tôi", không phải tư vấn pháp lý chính thức**.
2. **Gắn cảnh báo ngắn vào luồng đăng ký host** (`HostRegistrationModal.tsx`) — không chặn đăng ký, chỉ hiển thị một dòng: *"Thanh toán qua giao thức không thay đổi nghĩa vụ khai báo lưu trú/thuế tại quốc gia bạn đang vận hành. Vui lòng tự kiểm tra luật địa phương."*
3. **Không xây bất kỳ tính năng "xác thực tuân thủ pháp lý" nào** trong sản phẩm — đúng kết luận của Phương án B, giữ ranh giới trách nhiệm rõ ràng.

## Đánh đổi bảo mật / phi tập trung

- **Đây là RFC đầu tiên định nghĩa giới hạn của chính CypherGuide**, không phải mở rộng khả năng — một dạng khiêm tốn có chủ đích. Rủi ro nếu bỏ qua RFC này: dự án vô tình để host tin rằng "phi tập trung" đồng nghĩa "vô hình trước pháp luật", dẫn tới hậu quả pháp lý thật cho host, làm tổn hại uy tín cộng đồng đã xây dựng.
- **Tài liệu "Thực Tế Pháp Lý" do cộng đồng đóng góp có rủi ro thông tin sai/cũ** — giảm thiểu bằng cách ghi rõ nguồn, ngày, và luôn đóng khung là "kinh nghiệm chia sẻ", không phải "tư vấn pháp lý chính thức" (tương tự cách RFC-0005 đóng khung Docs Assistant chỉ trả lời dựa trên RFC, không phải "phát ngôn viên chính thức").
- **Không đưa CypherGuide vào vị trí chịu trách nhiệm pháp lý thay host** — giữ đúng ranh giới đã có từ RFC pháp lý Thụy Sĩ: giao thức (CC0/mở) tách biệt khỏi bất kỳ pháp nhân thương mại nào, và giờ tách biệt rõ hơn nữa khỏi nghĩa vụ pháp lý cá nhân của từng host.

## Maturity tier đề xuất

**Draft**, tiến tới **Stable** như RFC-0003/0011 sau khi có ít nhất 2-3 quốc gia được cộng đồng đóng góp thông tin thật vào tài liệu "Thực Tế Pháp Lý Cho Host", xác nhận mô hình đóng góp cộng đồng thực sự vận hành được.

## Thảo luận

(Mở — đã đăng thảo luận công khai trên Nostr trước khi RFC này được viết ra, đặt đúng câu hỏi: CypherGuide nên xây tài liệu tham khảo luật từng quốc gia do cộng đồng đóng góp, hay nên giữ im lặng hoàn toàn và để RFC-0012 chỉ dừng ở việc định nghĩa ranh giới, không xây thêm gì cả? Cần thêm ý kiến từ host thực tế ở nhiều quốc gia trước khi quyết định dứt khoát giữa Phương án A và C.)
