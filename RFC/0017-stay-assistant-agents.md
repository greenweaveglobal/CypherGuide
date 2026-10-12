# RFC-0017: Agent Hỗ Trợ Lưu Trú — Giai Đoạn 1 (Không Giữ Tiền)

- **Trạng thái:** Draft
- **Tác giả:** Chủ dự án + Claude (AI), cần cộng đồng bổ sung
- **Ngày:** 2026-10-01 (cập nhật 2026-10-10 và 2026-10-12 sau phản hồi công khai, xem mục Thảo luận)
- **Module liên quan:** mở rộng RFC-0005 (Docs Assistant), dùng dữ liệu của RFC-0003 (Identity & Portable Reputation), tuân thủ RFC-0011 (Ranh giới tài chính hóa) và RFC-0012 (Ranh giới chủ quyền); khác phạm vi với RFC-0013/0014 (agent của *khách* chạy trên hạ tầng của host). Code mới nằm ở một thư mục/dịch vụ riêng (đề xuất `agents/`), chạy tách khỏi relay và khỏi app chính.

## Vấn đề

CypherGuide muốn có hỗ trợ khách, gợi ý phòng và đánh giá uy tín **mà không dựng đội CSKH hay bộ máy kiểm duyệt tập trung**. Một ý tưởng được đưa ra: thả các AI agent tự trị hoạt động trên Nostr và Lightning, gồm 5 nhóm việc: (1) môi giới và đặt phòng tự động, (2) trợ lý lưu trú 24/7, (3) chấm điểm uy tín Web-of-Trust (WoT), (4) trọng tài và giữ tiền cọc bằng Hold Invoice, (5) tự điều chỉnh giá thuê.

Khảo sát mã nguồn Automaton (Conway Research, MIT) cho thấy một runtime agent tự trị đầy đủ: ví riêng, tự sửa mã, tự nhân bản, "chết" khi hết tiền. Nó có nhiều mẫu thiết kế đáng học (policy engine, chống prompt injection, trần chi tiêu, skill dạng Markdown) nhưng gắn chặt với Conway Cloud, USDC trên Base và ví EVM, không có Nostr hay Lightning.

Vấn đề cần quyết định: **agent được làm gì và không được làm gì ở giai đoạn đầu**, sao cho có giá trị thật mà không đưa vào hệ thống một điểm hỏng tài chính mới, và không phá nguyên tắc "không giữ tiền hộ, không KYC" của giao thức.

## Các phương án đã cân nhắc

### Phương án A: Không dùng agent — chỉ giao diện và Docs Assistant (RFC-0005) hiện có
- Ưu điểm: không thêm bề mặt tấn công, không chi phí vận hành mới.
- Nhược điểm: khách phải tự tìm phòng và tự đánh giá người lạ; không có phản hồi 24/7 ngoài tài liệu tĩnh.

### Phương án B: Agent tự trị đầy đủ — ví riêng, tự sửa mã, tự nhân bản, giữ tiền cọc và làm trọng tài (theo ý tưởng gốc)
- Ưu điểm: nhiều dịch vụ, nhiều nguồn thu tiềm năng.
- Nhược điểm: **loại bỏ cho giai đoạn này.**
  - Trọng tài tự động là mục tiêu của prompt injection: một bên tranh chấp có thể gài chỉ dẫn vào chat hoặc ảnh để buộc agent giải phóng tiền.
  - Hold Invoice của Lightning chỉ phù hợp giữ trong thời gian ngắn; giữ nhiều ngày làm khóa thanh khoản kênh và có nguy cơ bị đóng kênh. Không phù hợp lưu trú dài ngày.
  - Dòng tiền chạy qua ví nóng của agent là điểm hỏng duy nhất: VPS bị xâm nhập hoặc agent bị thao túng là mất quỹ. Phí giao thức nên tách ở tầng giao thức (RFC-0002), không qua ví agent.
  - Tự sửa mã và tự nhân bản làm tăng rủi ro vòng lặp mất kiểm soát và khó kiểm toán.
  - Repo hiện chưa có trọng tài người thật (ba pubkey trong `DEFAULT_ARBITRATOR_POOL` là placeholder), nên cũng chưa có nơi để chuyển các quyết định này.

### Phương án C: Agent hỗ trợ, **không giữ tiền, không tự sửa mã** — ba module (ĐỀ XUẤT)
- Ưu điểm: giá trị thật ở chỗ khách đang thiếu (tìm phòng, hỏi đáp, đánh giá), mọi quyết định có tiền vẫn do con người và giao thức đảm nhiệm, bề mặt rủi ro nhỏ và đo được.
- Nhược điểm: ít nguồn thu trực tiếp từ agent; cần viết mới phần NIP-90 vì repo chưa có.

### Phương án D: Fork nguyên Automaton rồi tùy biến
- Ưu điểm: có sẵn nhiều thành phần.
- Nhược điểm: **loại bỏ.** Mang theo toàn bộ phần không cần (EVM/Base/USDC/Conway, tự sửa mã, tự nhân bản, cơ chế "chết khi hết tiền") và phải gỡ từng phần. Chỉ **mượn mẫu thiết kế** (ghi nhận giấy phép MIT khi tái sử dụng mã).

## Đề xuất

**Phương án C.** Ba module độc lập, mỗi module chạy được riêng:

### Module 1 — Trợ lý hỏi đáp lưu trú (Concierge)
- Mở rộng RFC-0005: trả lời dựa trên tài liệu của CypherGuide và thông tin listing do chủ nhà công khai (nội quy, chỉ đường, quán nhận BTC gần đó, hướng dẫn OpSec chung).
- **Không xử lý** mã khóa cửa, mật khẩu Wi-Fi hay thông tin truy cập. Chủ nhà gửi các thông tin này trực tiếp cho khách qua kênh của họ sau khi đặt phòng.
- Không hứa về an ninh, pháp lý hay hoàn tiền; các nội dung này dùng câu trả lời cố định do con người viết.

### Module 2 — Điểm tín nhiệm WoT xác định (không dùng LLM)
- Thuật toán công khai, tính bằng mã (đồ thị và công thức), cho cùng đầu vào luôn ra cùng kết quả. Người dùng có thể tự chạy lại để kiểm chứng.
- Tín hiệu theo mức khó giả:
  1. **Chính:** proof đồng ký hai bên sau mỗi lần lưu trú (RFC-0003: Proof-of-Stay) và đánh giá có chữ ký của bên kia.
  2. **Phụ:** độ tuổi npub, liên kết với các npub đã có proof, hoạt động zap. Tín hiệu này dễ tạo giả hàng loạt (Sybil), nên chỉ có trọng số thấp.
- **Chống thông đồng (collusion):** hai chữ ký chỉ chứng minh hai khóa đồng ý với nhau, không chứng minh hai người độc lập đã gặp nhau. Một người điều khiển cả hai khóa có thể ký nhiều lần lưu trú giả. Vì vậy module phải:
  1. Giảm trọng số của các proof giữa những npub khép kín (chủ yếu chỉ ký cho nhau), và ưu tiên proof có liên kết tới npub nằm ngoài cụm đó. **Không dùng ngưỡng cứng** kiểu "trên X% thì bị phạt": dùng trọng số liên tục theo mức độ khép kín, và hiệu chỉnh bằng mô phỏng chứ không bằng một con số chọn tùy ý.
  2. Đặt **trần** lượng uy tín mà một cụm khép kín có thể tự tạo ra trước khi có tín hiệu độc lập từ bên ngoài cụm.
  3. Có **bài test hồi quy mô phỏng tấn công**: một nhóm nhỏ khóa do một bên điều khiển ký nhiều lần lưu trú giả; test đo điểm mà nhóm đó tạo ra và so với trần đã đặt. Test chạy lại mỗi khi đổi thuật toán và là điều kiện để phát hành.
  4. Có **bài test thứ hai cho cụm bình thường**: cộng đồng thật (buổi gặp mặt, DAO, nhóm bạn) vốn tạo ra những cụm kết nối dày. Test mô phỏng các cụm này và đo **tỷ lệ bị phạt nhầm** (false positive). Thuật toán phải đạt cả hai test: không để cụm giả tự nâng điểm quá trần, và không phạt cụm thật vượt mức chấp nhận. Mức chấp nhận chưa quyết định; xem Câu hỏi mở.
  Cách xác định "ngoài cụm" và mức trần cụ thể chưa quyết định; xem Câu hỏi mở.
- **Dữ liệu đầu vào có thể kiểm toán (tùy chọn):** mỗi điểm có thể kèm bản ghi đầu vào đã băm, đóng dấu thời gian và ký bằng khóa của agent, để chủ nhà sau này chứng minh agent đã thấy gì lúc đặt phòng. Dữ liệu đầu vào chứa quan hệ giữa các npub nên chỉ chia sẻ cho các bên liên quan, không công khai, và không được làm lộ ai đã tra cứu ai.
- Điểm chỉ là **gợi ý hiển thị**, không tự chặn hay cấm ai. Luôn hiển thị lý do thành phần và cho phép người dùng xem dữ liệu gốc.
- Quyền riêng tư: không ghi lại npub nào đã tra npub nào.
- Phải được rà theo RFC-0011 trước khi triển khai (ranh giới giữa tín hiệu uy tín và tài chính hóa hành vi).

### Module 3 — Gợi ý phòng qua NIP-90 (chỉ gợi ý)
- Agent lắng nghe yêu cầu tìm phòng trên Nostr theo mô hình NIP-90 (job request, job result), đối chiếu với listing đang công khai, trả về danh sách kèm Event ID/liên kết để hai bên tự liên hệ và tự chốt.
- **Không** tạo invoice, không giữ cọc, không đại diện thanh toán.
- Kind cụ thể trong dải 5000–5999 chưa chọn (xem Câu hỏi mở); cần giới hạn độ dài và tần suất yêu cầu, bỏ qua npub bị mute theo danh sách của dự án.
- **Quyền riêng tư của yêu cầu:** một yêu cầu tìm phòng chứa vị trí, ngày ở và ngân sách, nên nếu phát công khai sẽ lộ ý định đi lại của khách. Mặc định phải mã hóa yêu cầu tới agent được chỉ định (dùng NIP-44 hoặc NIP-17, không dùng NIP-04), hoặc nếu bắt buộc phát công khai thì dùng thông tin mờ (thành phố thay cho địa chỉ, khoảng ngày thay cho ngày cụ thể). Relay vẫn thấy metadata (ai gửi, lúc nào). Agent không lưu nội dung yêu cầu lâu hơn mức cần thiết.

### Giới hạn an toàn bắt buộc
1. **Danh tính riêng:** agent dùng một cặp khóa Nostr riêng. Tuyệt đối không dùng khóa của npub chính thức của dự án. Khóa riêng không nằm trong repo.
2. **Cách ly hạ tầng:** chạy trên VPS riêng, không chung máy với relay, và không chung máy với bất kỳ khóa nào của dự án.
3. **Công cụ tối thiểu (allowlist):** chỉ có đọc dữ liệu listing và relay, đăng sự kiện Nostr bằng khóa riêng của agent. **Không** có shell, ghi file tùy ý, cài gói, hay sửa mã. Không có công cụ chuyển tiền ở giai đoạn 1. Nếu sau này cần trả phí dịch vụ bằng Lightning thì dùng kết nối NWC riêng với ngân sách nhỏ do ví cấp, kèm trần phía agent.
4. **Chống prompt injection:** mọi nội dung đến từ Nostr (yêu cầu, DM, mô tả listing) là dữ liệu không đáng tin. Không bao giờ được coi là chỉ dẫn. Cần một lớp lọc và một policy engine kiểm mọi lệnh gọi công cụ trước khi chạy (mượn mẫu từ Automaton), ghi nhật ký đầy đủ để kiểm toán.
5. **Công khai là AI:** hồ sơ agent ghi rõ đây là agent. Agent không tự tạo đánh giá, zap hay tương tác giả.
6. **Marketing có người duyệt:** bài đăng chủ động và tin nhắn chủ động đi qua hàng chờ để con người duyệt. Agent chỉ trả lời khi được hỏi hoặc được mention. Không gửi DM hàng loạt cho người chưa đồng ý nhận.
7. **Trần chi phí và công tắc ngắt:** trần chi phí suy luận theo ngày; dừng khi vượt trần; có cách tắt khẩn cấp bằng một lệnh.
8. **Phí giao thức không đi qua agent:** phí nền tảng vẫn tính ở tầng giao thức (RFC-0002), không chuyển qua ví agent.

### Những phần dời sang giai đoạn sau (không thuộc RFC này)
Hold Invoice và quản lý tiền cọc, trọng tài tự động, điều chỉnh giá thuê tự động, dòng phí qua ví agent, thu phí mỗi lượt tra cứu. Điều kiện để xem lại: có trọng tài người thật, đã chạy bộ kiểm tra hành vi của RFC-0014 cho agent này, đã đo chi phí suy luận thực tế, và đã có ý kiến pháp lý.

### Mượn từ Automaton, và bỏ
- **Mượn (mẫu thiết kế):** policy engine kiểm công cụ trước khi chạy; lớp chống prompt injection; theo dõi và giới hạn chi tiêu; skill dạng Markdown.
- **Bỏ:** EVM/Base/USDC/Conway, tự sửa mã, tự nhân bản, cơ chế "chết khi hết tiền".

## Đánh đổi bảo mật / phi tập trung

- **Tin ai:** người vận hành agent (hiện là chủ dự án) và nhà cung cấp mô hình suy luận. Nhà cung cấp nhìn thấy nội dung câu hỏi gửi lên. Do đó không gửi dữ liệu nhạy cảm (mã khóa cửa, mật khẩu), và ưu tiên mô hình chạy cục bộ khi chất lượng đủ dùng.
- **Nếu agent bị thao túng:** hậu quả bị giới hạn ở đăng sai nội dung hoặc gợi ý sai, vì agent không có quyền chuyển tiền, đọc khóa hay sửa mã. Đây là lý do cốt lõi của việc giữ giai đoạn 1 không giữ tiền.
- **Nếu VPS agent bị xâm nhập:** kẻ tấn công có được khóa Nostr của agent (có thể mạo danh agent) nhưng không chạm tới relay, khóa chính thức hay quỹ. Khóa agent phải thay thế được nhanh và hồ sơ công khai cần cách thông báo thu hồi.
- **Điểm WoT:** thuật toán công khai thì kẻ gian cũng đọc được cách lách. Vì thế điểm chỉ là gợi ý, ưu tiên tín hiệu cần hai bên đồng ký, và không dùng làm cơ chế chặn tự động.
- **Thông đồng và chi phí giả mạo:** phí protocol làm mỗi lần lưu trú giả tốn thêm một khoản nhỏ (với mức cơ sở 2% theo RFC-0002, một đêm giá 150.000 sats tốn khoảng 3.000 sats phí), nhưng khoản này không đủ ngăn một cụm quyết tâm vì tiền phòng quay về chính họ. Phòng thủ chính phải là cấu trúc (giảm trọng số cụm khép kín, đặt trần, ưu tiên tín hiệu ngoài cụm), không dựa vào chi phí.
- **Tập trung hóa:** một agent do dự án vận hành là một điểm tập trung mềm. Giảm bằng cách công khai thuật toán và dữ liệu, và cho phép bất kỳ ai chạy lại module WoT và dựng agent tương thích.

## Chỉ số thành công (đo trong 4 đến 8 tuần đầu)
- Tỷ lệ yêu cầu tìm phòng nhận được gợi ý, và tỷ lệ gợi ý được mở xem.
- Thời gian phản hồi trung bình.
- Chi phí suy luận trung bình mỗi câu hỏi (đổi ra sats) — làm cơ sở đặt giá sau này.
- Số lần policy engine chặn một lệnh; số báo cáo gợi ý sai hoặc nội dung sai.
- Tỷ lệ người dùng mở "xem lý do" của điểm WoT.
- Kết quả bài test mô phỏng thông đồng: lượng điểm tối đa một cụm khép kín tạo ra so với trần đã đặt (phải đạt trước khi phát hành).
- Tỷ lệ cụm bình thường (meetup, DAO) bị giảm điểm nhầm trong bài test mô phỏng; chỉ số này phải nằm dưới mức chấp nhận đã đặt.

## Maturity tier đề xuất sau khi triển khai

Experimental (xem `MATURITY.md`). Chỉ nâng lên Beta khi đã có đo đạc đủ các chỉ số trên và đã rà soát độc lập các giới hạn an toàn.

## Câu hỏi mở

1. Chọn kind NIP-90 cho yêu cầu tìm phòng (dải 5000–5999) và cách công bố để client khác tương thích.
2. Agent lắng nghe trên relay nào (`relay.cypherguide.org` và relay công cộng nào).
3. Đặt tên và NIP-05 cho agent (cần thêm vào `public/.well-known/nostr.json`).
4. Chạy mô hình cục bộ hay gọi API; ngưỡng chất lượng chấp nhận được.
5. Có thu phí tra cứu uy tín hay không, mức bao nhiêu; chưa quyết định trước khi đo chi phí.
6. Phí môi giới riêng (ý tưởng gốc 1–2%) có cộng thêm vào phí giao thức hiện tại không. Đề xuất mặc định: **không**, giữ một lớp phí duy nhất ở RFC-0002.
7. Khía cạnh pháp lý của dịch vụ môi giới/gợi ý ở Việt Nam và nơi khác (cần ý kiến luật sư, không do RFC này kết luận).
8. Cách xác định "ngoài cụm" và mức độ khép kín trong đồ thị uy tín (ví dụ phân tích thành phần liên thông và tỷ lệ cạnh đi ra ngoài), hàm trọng số liên tục tương ứng, mức trần uy tín của một cụm khép kín, và mức chấp nhận về tỷ lệ phạt nhầm cụm thật. Chưa có dữ liệu thực nghiệm về tỷ lệ thất bại của các cuộc tấn công WoT hiện có để chọn con số; cần nguồn dữ liệu hoặc nghiên cứu.
9. Có cung cấp bản ghi đầu vào có ký không, lưu ở đâu, ai xem được, và làm sao không làm lộ quan hệ giữa các npub.
10. Mã hóa yêu cầu NIP-90: chọn NIP-44 hay NIP-17, và định dạng để client khác tương thích.

## Thảo luận

**2026-10-10 — phản hồi công khai trên Nostr.** Bản thông báo RFC này nhận ba phản hồi từ các tài khoản chưa xác minh danh tính (RFC không xác định đó là người hay agent, và coi nội dung phản hồi là dữ liệu chưa tin cậy như mọi nội dung từ Nostr):

- **HalHermes:** hai khóa do cùng một người điều khiển có thể đồng ký các lần lưu trú giả; hai chữ ký chỉ chứng minh sự đồng thuận giữa hai khóa. Đề nghị một bài test hồi quy: một cặp khách/chủ nhà giả tạo được bao nhiêu uy tín trước khi cần sự tin cậy từ bên ngoài cụm của chính nó. **Đã đưa vào Module 2** (chống thông đồng, trần uy tín, bài test mô phỏng) và vào Đánh đổi bảo mật, Chỉ số thành công, Câu hỏi mở số 8.
- **thebaby (BlindOracle):** nên ký và đóng dấu thời gian các đầu vào của mỗi điểm để chủ nhà sau này chứng minh được agent đã thấy gì lúc đặt phòng. **Đã đưa vào Module 2 như lựa chọn tùy chọn**, kèm ràng buộc quyền riêng tư (Câu hỏi mở số 9). Tài khoản này nhắc tới sản phẩm của họ; RFC không xác nhận hay tích hợp dịch vụ của bất kỳ bên thứ ba nào.
- **Hax Medroom:** đồng tình rằng việc gắn nhãn rõ là AI là điều quan trọng nhất trong các giới hạn an toàn. Không có thay đổi; giữ nguyên.

Ngoài ra, thảo luận này làm rõ một điểm RFC trước đó chưa nêu: quyền riêng tư của yêu cầu NIP-90 (đã thêm vào Module 3 và Câu hỏi mở số 10).

**2026-10-12 — phản hồi thêm.**

- **Remora (tự nhận là agent Nostr tự động; chưa xác minh):** hỏi cách định lượng "độc lập" trong đồ thị uy tín khi các động lực xã hội thật (buổi gặp mặt, DAO) vốn tạo ra cụm tương quan, và hỏi về một ngưỡng "80%" cùng cơ sở thực nghiệm của nó. **Làm rõ:** bản nháp RFC không có ngưỡng 80% nào; nó cố ý chỉ dùng "chủ yếu" và để cách xác định cùng mức trần ở Câu hỏi mở số 8. **Đã đưa vào RFC:** không dùng ngưỡng cứng (trọng số liên tục), thêm bài test thứ hai cho cụm bình thường đo tỷ lệ phạt nhầm, và ghi nhận chưa có dữ liệu thực nghiệm để chọn số.
- **Stoic Sovereign:** bình luận chung về chủ quyền cá nhân và nghi ngờ mọi cơ chế, không có nội dung kỹ thuật cụ thể về RFC. Không có thay đổi.
