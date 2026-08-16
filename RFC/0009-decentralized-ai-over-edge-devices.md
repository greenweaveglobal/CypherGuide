# RFC-0009: AI Phi Tập Trung Chạy Trên Thiết Bị Ngoại Biên (Decentralized AI on Edge Devices)

- **Trạng thái:** Draft — **tầm nhìn dài hạn (visionary)**, không phải đặc tả triển khai
  ngay. RFC này **đào sâu Phương án C của RFC-0007** ("chạy mô hình ngôn ngữ nhỏ ngay
  trên từng node LoRa/relay" — khi đó bị gác lại vì "chưa khả thi") thành một RFC riêng,
  vì phạm vi của nó (giới hạn phần cứng thật, lựa chọn mô hình, giao thức phân phối suy
  luận) đủ lớn và đủ khác biệt để không còn là một mục con trong RFC-0007.
- **Tác giả:** (cần điền)
- **Ngày:** 2026-08-13
- **Module liên quan:** `src/components/MeshNeighborhood.tsx` (danh sách node LoRa hiện
  tại: LilyGO T-Beam, Heltec V3, Meshtastic Repeater — hiện là **dữ liệu demo tĩnh**,
  chưa có logic phần cứng thật), `src/utils/proofOfStay.ts` (RFC-0003, nền tảng tag/kind
  dùng chung nếu cần publish kết quả suy luận thành event), RFC-0007 (Lớp 1 — mesh
  infrastructure), RFC-0005 (đối chiếu: bản triển khai thật hiện tại, chạy trên server).

## Vấn đề

RFC-0007 đặt câu hỏi "liệu AI có thể chạy mà không cần backend", và đề xuất mô hình 3
lớp trong đó suy luận (inference) vẫn diễn ra ở **Lớp 3 — API bên ngoài** (Gemini hoặc
tương đương, do người dùng tự cắm key). Điều đó loại bỏ được backend của riêng dự án,
nhưng **không loại bỏ được phụ thuộc vào một bên thứ ba tập trung** (nhà cung cấp API).
Nếu mục tiêu cuối cùng là "phi tập trung" đúng nghĩa, câu hỏi còn lại là: **suy luận AI
có thể tự chạy ngay trên hạ tầng mesh (LoRa/relay) mà dự án đã có, không gọi ra ngoài
internet chút nào không?**

Đây chính là Phương án C mà RFC-0007 đã nêu nhưng gác lại vì "các thiết bị này thường có
tài nguyên rất hạn chế (điện năng thấp, CPU/RAM nhỏ)". RFC này không phủ nhận nhận định
đó — mà cố gắng trả lời chi tiết hơn: **hạn chế đó nằm ở đâu chính xác, và có đường đi
thực tế nào để tiệm cận nó theo từng bước, thay vì coi nó là "không bao giờ khả thi"?**

Vấn đề cụ thể cần giải:
1. Thiết bị ngoại biên thật trong `MeshNeighborhood.tsx` (LilyGO T-Beam, Heltec V3) dùng
   vi điều khiển lớp ESP32 — RAM cỡ vài trăm KB đến ~8MB (bản PSRAM), không có GPU, không
   chạy được bất kỳ mô hình ngôn ngữ nào theo nghĩa thông thường (kể cả bản lượng tử hóa
   nhỏ nhất hiện nay vẫn cần hàng trăm MB RAM).
2. Do đó "chạy AI trên chính node LoRa" theo nghĩa đen là **không khả thi với phần cứng
   hiện có trong danh sách** — cần phân biệt rõ giữa "node LoRa/relay" (chỉ truyền dữ
   liệu) và "thiết bị ngoại biên" nói chung (có thể là điện thoại, mini-PC, SBC như
   Raspberry Pi — mạnh hơn nhiều).
3. Nếu không định nghĩa lại phạm vi "thiết bị ngoại biên" cho chính xác, RFC sẽ lặp lại
   sai lầm RFC-0007 đã tự cảnh báo: mô tả một kiến trúc không tồn tại trong code/phần
   cứng thật.

## Các phương án đã cân nhắc

### Phương án A: Giữ nguyên hiện trạng — suy luận AI luôn ở Lớp 3 (API ngoài, RFC-0007)
- Ưu điểm: đơn giản, không cần thêm phần cứng gì, tận dụng được các API mạnh nhất hiện có.
- Nhược điểm: không giải quyết được câu hỏi gốc — vẫn phụ thuộc một bên thứ ba tập trung
  duy nhất cho bước suy luận, dù đã loại bỏ backend riêng của dự án.

### Phương án B: Chạy mô hình ngôn ngữ nhỏ (SLM) ngay trên node LoRa/relay hiện có
- Ưu điểm: "phi tập trung" đúng nghĩa đen nhất, suy luận diễn ra tại chính hạ tầng mesh.
- Nhược điểm: **loại bỏ** — đã xác nhận lại ở phần Vấn đề, các thiết bị LoRa hiện có
  (ESP32-class) không đủ RAM/CPU để chạy bất kỳ mô hình ngôn ngữ hữu ích nào. Đây không
  phải vấn đề tối ưu hóa phần mềm mà là giới hạn vật lý của phần cứng — không có lộ trình
  ngắn/trung hạn nào khắc phục được bằng cách viết code tốt hơn.

### Phương án C: Tách "node LoRa/relay" khỏi "thiết bị ngoại biên chạy AI" — suy luận
  chạy trên thiết bị mạnh hơn ở rìa mạng (điện thoại người dùng, mini-PC/SBC như
  Raspberry Pi 4/5, hoặc máy tính cá nhân đang mở app), LoRa chỉ tiếp tục đóng vai trò
  vận chuyển dữ liệu như RFC-0007 Lớp 1 (ĐỀ XUẤT)
- Ưu điểm: khả thi thật với phần cứng phổ biến hiện nay — SBC như Raspberry Pi 4/5 (4-8GB
  RAM) chạy được mô hình lượng tử hóa cỡ 1-3B tham số (ví dụ dạng GGUF qua llama.cpp) với
  tốc độ chấp nhận được cho truy vấn dạng "tra cứu tài liệu" (không cần realtime). Điện
  thoại đời mới cũng ngày càng đủ sức chạy các mô hình cỡ này on-device. Không cần internet
  cho bước suy luận nếu tài liệu nguồn đã được đồng bộ cục bộ.
- Nhược điểm: chất lượng câu trả lời của SLM 1-3B tham số kém xa các API lớn (Gemini,
  Claude...) — cần ràng buộc phạm vi trả lời chặt hơn nữa so với RFC-0005 (nguy cơ
  hallucination cao hơn ở mô hình nhỏ). Không phải ai cũng có sẵn SBC/điện thoại đủ mạnh —
  đây là tính năng cho nhóm người dùng có phần cứng phù hợp, không thể là đường dẫn chính
  cho người dùng phổ thông.

### Phương án D: Suy luận phân tán (distributed inference) — chia một mô hình lớn hơn ra
  nhiều node ngoại biên cùng tính toán, ghép kết quả qua mesh
- Ưu điểm: về lý thuyết cho phép chạy mô hình lớn hơn tổng tài nguyên một thiết bị đơn lẻ.
- Nhược điểm: **loại bỏ khỏi đề xuất chính** — độ trễ mạng LoRa (băng thông rất thấp,
  thường dưới 1 kbps hiệu dụng ở cấu hình tầm xa) hoàn toàn không phù hợp cho việc truyền
  activation/tensor giữa các bước suy luận, vốn cần băng thông cao và độ trễ thấp. Đây là
  hướng nghiên cứu học thuật thú vị nhưng không có đường đi thực tế trên hạ tầng LoRa hiện
  tại của dự án — ghi nhận như hướng xa, không đưa vào lộ trình.

## Đề xuất

**Phương án C**, với ranh giới phải nói rõ ngay từ đầu để không lặp lại nhầm lẫn của
RFC-0007: **"thiết bị ngoại biên" ở đây KHÔNG phải là node LoRa/relay** (những thứ đó tiếp
tục chỉ làm nhiệm vụ Lớp 1 — vận chuyển, đúng như RFC-0007 đã định), mà là các thiết bị
tính toán ở rìa mạng có đủ tài nguyên: SBC (Raspberry Pi 4/5 trở lên), mini-PC, hoặc chính
điện thoại/máy tính người dùng đang chạy app.

Lộ trình gợi ý (thăm dò, không cam kết thời điểm):
1. Thử nghiệm độc lập, tách hẳn khỏi RFC-0005/0007: chạy thử một mô hình lượng tử hóa nhỏ
   (1-3B tham số, định dạng GGUF) qua `llama.cpp` hoặc tương đương trên một Raspberry Pi
   5, giới hạn ngữ cảnh vào đúng tập tài liệu `RFC/*.md` + `ARCHITECTURE.md` như ràng buộc
   RFC-0005 đã đặt ra — đo thực tế thời gian phản hồi và tỷ lệ trả lời sai/bịa.
2. Nếu tốc độ/độ chính xác chấp nhận được, đây trở thành một **chế độ tùy chọn thứ ba**
   song song với "server proxy chung" (RFC-0005) và "tự cắm API key" (RFC-0007 Lớp 3):
   "chạy cục bộ trên thiết bị của tôi" — không gọi ra ngoài, không cần API key của ai cả.
3. Không đặt mục tiêu thay thế RFC-0005/0007 — ba chế độ tồn tại song song, người dùng tự
   chọn theo phần cứng và mức độ tin tưởng họ muốn đặt vào bên nào.
4. Vai trò của LoRa mesh trong bức tranh này giữ nguyên như RFC-0007 đã mô tả: chỉ lan
   truyền tài liệu/dữ liệu đã tag hóa, không tham gia bước suy luận.

## Đánh đổi bảo mật / phi tập trung

- **Chế độ "chạy cục bộ" đặt toàn bộ chi phí phần cứng và trách nhiệm vận hành vào tay
  người dùng** — không có bên nào (kể cả dự án) kiểm soát hay chịu trách nhiệm cho chất
  lượng câu trả lời của mô hình nhỏ chạy trên máy họ. Cần cảnh báo UI rõ ràng, tương tự
  nhãn miễn trừ đã bắt buộc ở RFC-0005: mô hình nhỏ có tỷ lệ bịa đặt cao hơn, không nên
  được xem là nguồn tin cậy hơn việc đọc trực tiếp RFC gốc.
- **Đây thực sự là mô thức phi tập trung nhất trong ba lựa chọn** (so với RFC-0005: tin
  tưởng server proxy của dự án; RFC-0007 Lớp 3: tin tưởng nhà cung cấp API bên ngoài) —
  không bên thứ ba nào được tin tưởng ở bước suy luận, kể cả dự án. Đánh đổi lại là chất
  lượng đầu ra thấp hơn và rào cản phần cứng.
- **Không được quảng cáo tính năng này như "AI chạy trên node LoRa"** — làm vậy là lặp lại
  chính xác kiểu mô tả sai kiến trúc mà RFC-0005 đã từ chối ở Phương án A của nó. Phải nói
  rõ: LoRa chỉ vận chuyển, suy luận chạy trên thiết bị tính toán riêng biệt.

## Maturity tier đề xuất sau khi triển khai

**Experimental** — chưa có dòng code hay số đo thực tế nào (tốc độ, độ chính xác) để đánh
giá. Không nâng tier cho tới khi bước 1 của lộ trình (thử nghiệm thật trên SBC) có kết quả
đo được cụ thể.

## Thảo luận

(Mở — cần làm rõ thêm: ngưỡng phần cứng tối thiểu cụ thể là gì (RAM/CPU) để một thiết bị
được coi là "đủ điều kiện" cho chế độ này; và liệu có nên giới hạn mô hình chỉ ở dạng
retrieval-augmented cực hẹp thay vì generative tự do, để giảm rủi ro hallucination của mô
hình nhỏ.)
