# RFC-0002: Đường cong giảm phí theo uy tín

- **Trạng thái:** Draft (viết hồi tố)
- **Tác giả:** Claude (AI) + chủ dự án, cần cộng đồng bổ sung
- **Module liên quan:** `src/utils/dynamicFee.ts`

## Vấn đề

Phí nền tảng cần giảm dần theo uy tín thật (Proof-of-Stay) để thưởng hành vi tốt,
nhưng phải có sàn tối thiểu để mesh còn nguồn thu vận hành. Cần một công thức cụ thể
cho tốc độ giảm — hiện tại: `BASE=3%`, `MIN=0.5%`,
`discount = 40 × ln(1 + reputationScore)`. **Cả ba con số này (3%, 0.5%, hệ số 40) là
giá trị mặc định do một phiên phát triển chọn, không dựa trên dữ liệu thị trường thật
hay thảo luận cộng đồng.**

## Các phương án đã cân nhắc

### Phương án A: Đường cong logarit (ĐANG TRIỂN KHAI)
`discount = k × ln(1 + score)`, giảm nhanh ở uy tín thấp, chậm dần khi uy tín cao.
- Ưu điểm: badge đầu tiên có giá trị lớn (khuyến khích người mới bắt đầu dùng thật),
  tránh việc tích lũy vô hạn tạo đặc quyền quá lớn.
- Nhược điểm: hệ số `k=40` là con số tùy ý, không ai kiểm chứng nó "đúng" theo nghĩa
  kinh tế nào — có thể quá hào phóng (mesh thất thu) hoặc quá keo kiệt (không đủ động
  lực) tùy vào tốc độ tích lũy uy tín thực tế của người dùng, thứ chưa có dữ liệu.

### Phương án B: Bậc thang cố định (tiering)
Ví dụ: uy tín 0-5 → 3%, 5-20 → 2%, 20-50 → 1%, 50+ → 0.5%.
- Ưu điểm: dễ hiểu, dễ giải thích cho người dùng ("đạt mốc X thì giảm phí"), dễ điều
  chỉnh từng bậc riêng lẻ qua RFC sau này mà không đổi cả công thức.
- Nhược điểm: tạo điểm nhảy đột ngột (giao dịch thứ N-1 vs N có thể chênh phí đáng kể
  dù uy tín gần như nhau) — cảm giác bất công ở ranh giới bậc.

### Phương án C: Điều chỉnh động qua governance (không phải hằng số code)
Các tham số `BASE`, `MIN`, `k` do chính Protocol Governance (`protocolGovernance.ts`,
RFC riêng nếu cần) biểu quyết định kỳ, thay vì hardcode.
- Ưu điểm: mesh có thể tự điều chỉnh nếu quỹ thu không đủ hoặc tăng trưởng chậm hơn
  kỳ vọng — đúng tinh thần "cùng xây, cùng sửa" thay vì đóng băng một con số mãi mãi.
- Nhược điểm: phức tạp hơn để triển khai (cần cơ chế thực thi kết quả vote vào code
  chạy — hiện chưa có "on-chain parameter" nào, mọi tham số đều là hằng số biên dịch).

## Đề xuất

Giữ Phương án A (đang triển khai) ở tier Experimental. Đề xuất: sau khi có dữ liệu
thật về tốc độ tích lũy uy tín (cần vài tháng vận hành thật), viết RFC tiếp theo để
hoặc (1) tinh chỉnh lại hệ số dựa trên dữ liệu, hoặc (2) chuyển sang Phương án C nếu
cộng đồng muốn tự điều chỉnh thay vì chờ mỗi lần sửa code.

## Đánh đổi bảo mật / phi tập trung

Rủi ro thấp hơn RFC-0001 (đây không phải tham số kiểm soát quyền chi tiền), nhưng vẫn
là quyết định kinh tế ảnh hưởng trực tiếp đến mọi giao dịch — nên đưa vào RFC thay vì
coi là "chi tiết triển khai" không đáng thảo luận.

## Maturity tier đề xuất sau khi triển khai

**Experimental** cho tới khi có ít nhất một vòng dữ liệu thật để đánh giá lại hệ số.

## Thảo luận

(Mở.)
