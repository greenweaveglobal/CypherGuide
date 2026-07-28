# RFC-0001: Cách chọn Guardian Council cho Quỹ Bảo Hiểm

- **Trạng thái:** Draft (viết hồi tố — quyết định này đã được triển khai trước khi
  có RFC, nay mở lại để cộng đồng thật sự thảo luận thay vì giữ nguyên vì đã lỡ code)
- **Tác giả:** Claude (AI) + chủ dự án, cần cộng đồng bổ sung
- **Module liên quan:** `src/utils/insuranceFund.ts` (`selectGuardianCouncil`,
  `lockContributionToGuardianCouncil`)

## Vấn đề

Mỗi khoản đóng góp vào Quỹ Bảo Hiểm được khóa Cashu NUT-11 (P2PK) vào một tập pubkey
cố định ngay lúc mint — không thể "chờ" đến khi có tranh chấp mới biết khóa vào ai,
vì proof phải có điều kiện chi tiêu xác định từ đầu. Cần một cách chọn tập pubkey đó
("Guardian Council") sao cho: (a) đủ phi tập trung để không ai một mình rút quỹ được,
(b) không quá cứng nhắc đến mức không thể thay đổi khi thành viên không còn xứng đáng.

## Các phương án đã cân nhắc

### Phương án A: Top-N theo uy tín tại thời điểm đóng góp (ĐANG TRIỂN KHAI)
Chọn N npub có uy tín cao nhất (từ Proof-of-Stay thật) tại thời điểm mint, N mặc định
= 7, quorum = 2/3.
- Ưu điểm: đơn giản, không cần bỏ phiếu, tự động cập nhật dần khi có npub uy tín mới.
- Nhược điểm: **quyết định "N=7 là bao nhiêu" và "uy tín thời điểm nào" hoàn toàn do
  một phiên phát triển chọn, không qua thảo luận cộng đồng.** Một npub được chọn vào
  hội đồng tại thời điểm mint vẫn giữ quyền đó cho khoản tiền ĐÓ mãi mãi, kể cả nếu
  sau này họ không còn hoạt động hay uy tín giảm — vì proof đã khóa cứng, không thể
  cập nhật lại điều kiện chi tiêu của một proof đã tồn tại.

### Phương án B: n-of-m trên toàn bộ co-owners từng đóng góp
Mọi npub từng đóng góp vào quỹ đều là guardian, n_sigs tăng theo tổng số người.
- Ưu điểm: không ai bị loại, dân chủ tuyệt đối theo nghĩa "ai đóng góp thì có quyền".
- Nhược điểm: số lượng guardian có thể phình to không kiểm soát theo thời gian, làm
  n_sigs thực tế cần thu thập chữ ký ngày càng khó (nhiều người, khó liên lạc), và
  không loại được người đã rời mesh từ lâu.

### Phương án C: Bầu qua Protocol Governance (quadratic-by-time) định kỳ
Guardian Council được bầu bằng chính cơ chế `protocolGovernance.ts` (trọng số
tenure × uy tín), nhiệm kỳ cố định (ví dụ 90 ngày), council mới chỉ áp dụng cho các
khoản đóng góp SAU thời điểm bầu — khoản cũ vẫn giữ điều kiện khóa ban đầu (không thể
đổi ngược, đây là giới hạn vật lý của Cashu, không phải giới hạn thiết kế).
- Ưu điểm: hợp pháp tính (legitimacy) cao hơn hẳn — chính cộng đồng chọn ai giữ quỹ
  của họ, không phải một công thức im lặng. Council có thể bị "sa thải" ở nhiệm kỳ sau
  nếu hành xử tệ.
- Nhược điểm: phức tạp hơn, cần UI bầu cử + xử lý việc nhiều "thế hệ" Guardian Council
  cùng tồn tại song song (mỗi thế hệ ứng với các proof được mint trong nhiệm kỳ đó).

### Phương án D: Multisig cố định từ genesis (kiểu hội đồng sáng lập)
Một tập pubkey cố định ngay từ đầu dự án, không đổi.
- Ưu điểm: đơn giản nhất, dễ audit nhất.
- Nhược điểm: tái tạo lại đúng mô hình tập trung mà giao thức đang cố tránh — nếu
  hội đồng sáng lập biến mất hoặc bị compromise, quỹ vĩnh viễn không ai chi được (hoặc
  ngược lại, họ giữ quyền lực vĩnh viễn).

## Đề xuất

Giữ Phương án A cho giai đoạn Experimental hiện tại (đã triển khai, đơn giản, đủ dùng
để demo và test). **Nhưng đề xuất chuyển sang Phương án C trước khi nâng tier lên
Beta/Stable** — vì C là phương án duy nhất có tính hợp pháp cộng đồng thật, và giờ đã
có sẵn hạ tầng cần thiết (`protocolGovernance.ts` từ RFC/tính năng trước) để làm được.

## Đánh đổi bảo mật / phi tập trung

Phương án A hiện tại: tin tưởng vào công thức "uy tín thật tại thời điểm mint" thay vì
tin vào một quy trình có thể giám sát/phản đối. Rủi ro cụ thể: nếu một npub uy tín cao
lọt vào top-7 rồi sau đó thông đồng với 4/7 người khác (đạt quorum 2/3 làm tròn... cần
tính lại số chính xác cho N=7, quorum=5), họ có thể rút toàn bộ quỹ của các proof đã
khóa vào họ mà cộng đồng không có cơ chế nào ngăn — vì điều kiện chi tiêu đã cố định
trong proof, không "bỏ phiếu bãi nhiệm" được sau khi mint. Đây là lý do chính RFC này
tồn tại: quyết định N=7 và "top theo uy tín" cần được cộng đồng đồng thuận công khai,
không phải vì bản thân công thức sai, mà vì **ai giữ quyền kiểm soát tiền của người
khác luôn cần tính chính danh cao hơn một quyết định kỹ thuật đơn phương.**

## Maturity tier đề xuất sau khi triển khai

Giữ **Experimental** cho tới khi RFC này được thảo luận và một trong các phương án
được chính thức Accepted.

## Thảo luận

(Mở — đây là quyết định người viết RFC này chủ động thừa nhận đã tự chọn một mình,
mời cộng đồng phản biện.)
