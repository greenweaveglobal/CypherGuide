# RFC-0020: Cơ chế thu phí giao thức (Protocol Fee Enforcement Mechanism)

- **Trạng thái:** Draft
- **Tác giả:** Chủ dự án + AI hỗ trợ soạn thảo
- **Ngày:** 2026-10-16
- **Module liên quan:** `src/utils/dynamicFee.ts`, `src/components/BookingModal.tsx`, `src/utils/depositEscrow.ts`, `src/utils/proofOfStay.ts`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`

## Vấn đề

Theo kết quả khảo sát mã nguồn chi tiết tại `docs/FEE_ENFORCEMENT_ANALYSIS.md`, hiện tại **hoàn toàn không có cơ chế nào ở tầng giao thức ép buộc thanh toán phí Treasury**.

Trong kiến trúc hiện hành (RFC-0016):
1. Việc tính toán phí giao thức (`protocolFeeSats`) được thực hiện hoàn toàn ở phía client của khách hàng (`calculateDynamicFee`).
2. Giao thức chia khoản thanh toán thành 2 hóa đơn Lightning độc lập (Dual-Invoice Model):
   - Hóa đơn 1 gửi tới địa chỉ Lightning của chủ nhà (Host).
   - Hóa đơn 2 gửi tới địa chỉ Quỹ Thưởng Hạ Tầng (Treasury).
3. Một client bị can thiệp mã nguồn độc hại (modified client / custom script) hoặc một bot tự tạo có thể dễ dàng bỏ qua hóa đơn Treasury (đặt `protocolFeeSats = 0` hoặc không thanh toán hóa đơn 2) trong khi vẫn thanh toán đủ tiền phòng cho chủ nhà.
4. Chủ nhà nhận đủ 100% tiền phòng trên ví cá nhân và sẵn sàng đón tiếp khách. Giao dịch vẫn diễn ra bình thường ngoài đời thực, nhưng Quỹ Hạ Tầng của giao thức không thu được một satoshi nào.

Nguyên nhân cốt lõi là hệ thống hiện tại đang vận hành dựa trên giả định "Client lương thiện" (Honest Client Assumption). Cần một thiết kế cơ chế (mechanism design) thực tế, phù hợp với bản chất phi tập trung của Bitcoin/Lightning/Nostr, thay vì áp đặt các giả định không thể thực thi bằng mật mã học.

## Các phương án đã cân nhắc

Tài liệu này trình bày 4 phương án kiến trúc khác nhau để Chủ dự án xem xét và đưa ra quyết định chiến lược. Tài liệu KHÔNG tự ý chọn phương án thay cho Chủ dự án.

---

### Phương án A: Gộp một hóa đơn và ràng buộc hoàn cọc theo bằng chứng nộp phí (Escrow Proof-of-Fee Lock)

- **Cơ chế hoạt động:**
  - Khách chỉ thanh toán 1 hóa đơn tổng (tiền phòng + tiền cọc ký quỹ Escrow).
  - Khoản tiền cọc (Deposit Escrow qua Cashu NUT-11 Multisig hoặc HTLC) được cài đặt điều kiện khóa mở rộng: Tiền cọc chỉ được hoàn lại cho khách (hoặc giải tỏa một phần cho chủ nhà) khi xuất trình được preimage hợp lệ chứng minh hóa đơn phí Treasury đã được thanh toán (`verifyLightningPreimage(treasuryPreimage, treasuryPaymentHash)`).
- **Ưu điểm:**
  - Tận dụng cơ chế ký quỹ sẵn có của RFC-0003/RFC-0008.
  - Sử dụng ràng buộc toán học bằng mật mã học (cryptographic condition): Không có preimage nộp phí thì hợp đồng escrow không thể mở khóa.
- **Nhược điểm và Chỗ hở nghiêm trọng:**
  - **Khách và Chủ nhà thông đồng:** Nếu khách và chủ nhà thỏa thuận ngoài luồng (collusion) hoặc tự thỏa thuận "đặt phòng không qua cọc", thì không bên nào báo cáo giao dịch lên escrow và không ai nộp phí Treasury.
  - **Tiền phòng đi thẳng:** Do tiền phòng là giao dịch P2P trực tiếp từ khách sang ví của chủ nhà, giao thức không thể phong tỏa hay thu giữ tiền phòng nếu chủ nhà đã cầm tiền.
  - Tăng độ phức tạp cho luồng giải ngân cọc của người dùng bình thường.

---

### Phương án B: Phí là giá của dịch vụ, không phải thuế trên giao dịch (Fee as Service Price, not Transaction Tax)

- **Cơ chế hoạt động:**
  - Từ bỏ tư duy xem phí giao thức là một khoản "thuế bắt buộc" đánh lên toàn bộ giao dịch P2P (vốn không thể cưỡng chế trong mạng mở).
  - Thay vào đó, **phí giao thức là khoản thanh toán cho các dịch vụ gia tăng có thể kiểm soát và bảo chứng bằng mật mã**:
    1. **Dịch vụ trọng tài và bảo vệ cọc (BFT Escrow & Dispute Arbitration):** Chỉ những booking có nộp phí Treasury mới được bảo hiểm bởi Quỹ BFT (RFC-0001) và được Hội đồng Trọng tài thụ lý khi có tranh chấp mất cọc, hư hỏng phòng.
    2. **Chứng nhận Lưu trú Bất biến (Proof-of-Stay NFT Certification - RFC-0003):** Sự kiện đúc Proof-of-Stay chỉ được relay giao thức ký bảo chứng (attested) khi có bằng chứng preimage phí giao thức. Không có Proof-of-Stay thì khách không thể xây dựng Danh tiếng Di động (Portable Reputation) và không thể viết đánh giá uy tín trên Nostr.
    3. **Hiển thị và Xếp hạng Listing (Listing Discovery & Priority Relay Broadcast):** Các host đóng góp phí đều đặn được các relay của mạng lưới ưu tiên lập chỉ mục, đẩy lên đầu danh sách tìm kiếm và hiển thị huy hiệu "Verified Autonomous Stay".
    4. **Báo cáo tín nhiệm và phân tích (Reputation & Agent Audit Feeds):** Cung cấp dữ liệu API và báo cáo kiểm toán cho các Agent AI tự hành đặt phòng.
- **Ưu điểm:**
  - Hoàn toàn phù hợp với triết lý Cypherpunk: Không cưỡng chế bằng bạo lực hay kiểm duyệt, mà tạo ra giá trị dịch vụ thực tế để người dùng tự nguyện trả tiền.
  - Không thể bị "gian lận": Người dùng không trả phí thì đơn giản là không nhận được dịch vụ bảo chứng và bằng chứng lưu trú, trong khi giao dịch P2P thuần túy giữa 2 bên vẫn diễn ra tự do.
- **Nhược điểm:**
  - Các giao dịch đặt phòng giá trị nhỏ hoặc khách vãng lai không quan tâm đến điểm danh tiếng có thể chọn bỏ qua phí. Doanh thu Treasury sẽ phụ thuộc vào nhu cầu thực tế của các dịch vụ bảo chứng.

---

### Phương án C: Đóng góp tự nguyện, có ghi nhận (Voluntary Contribution with On-Chain Recognition)

- **Cơ chế hoạt động:**
  - Phí giao thức được chuyển thành khoản đóng góp tự nguyện (Voluntary Donation / Protocol Tip).
  - Mọi khoản đóng góp vào Quỹ Hạ Tầng (Treasury) được ghi nhận công khai trên relay Nostr qua sự kiện NIP-57 (Zaps) hoặc NIP-58 (Badges).
  - Cung cấp bảng xếp hạng "Top Benefactors" và trao quyền biểu quyết quản trị (Governance Voting Weight) tương ứng với mức satoshi đã đóng góp.
- **Ưu điểm:**
  - Cực kỳ minh bạch, không phát sinh rủi ro pháp lý liên quan đến hoạt động môi giới thu phí trung gian tài chính.
  - UX đơn giản nhất: Khách có thể tùy chọn tích chọn đóng góp 1%, 2% hoặc tự chọn số sats ủng hộ đội ngũ phát triển hạ tầng.
- **Nhược điểm:**
  - Doanh thu không ổn định và có thể rất thấp (hiệu ứng "người đi nhờ xe" - free-rider problem).
  - Không thể dự phóng ngân sách duy trì các node hạ tầng relay và dev fund.

---

### Phương án D: Máy chủ hoặc Relay xác minh tập trung hơn (Relay / Server-Enforced Validation)

- **Cơ chế hoạt động:**
  - Sử dụng mạng lưới Relay có cổng thanh toán (Gated/Validating Relays) hoặc Server trung chuyển của CypherGuide.
  - Khi một sự kiện Booking (Kind 30078 hoặc Ephemeral Booking Event) được gửi lên relay, Relay Validator kết nối trực tiếp với node Lightning của Treasury qua webhook/gRPC để xác nhận hóa đơn phí đã thanh toán thành công (settled).
  - Nếu hóa đơn phí chưa thanh toán, Relay sẽ từ chối lưu trữ và phát sóng sự kiện booking, khiến booking không xuất hiện trên hệ thống quản lý của chủ nhà và khách.
- **Ưu điểm:**
  - Ràng buộc kỹ thuật gần như tuyệt đối: Không nộp phí thì booking không được mạng lưới ghi nhận.
  - Không phụ thuộc vào sự hợp tác hay trung thực của client.
- **Nhược điểm:**
  - **Mất tính phi tập trung (Decentralization Compromise):** Đưa Relay/Server trở thành điểm nghẽn tập trung (chokepoint). Nếu server/node Treasury ngừng hoạt động, toàn bộ hệ thống đặt phòng bị tê liệt.
  - Đi ngược lại nguyên tắc chống kiểm duyệt của Nostr (người dùng có thể chuyển sang relay khác không kiểm tra phí).
  - Chi phí vận hành node và hạ tầng relay validator cao hơn đáng kể.

---

## So sánh tổng hợp các phương án

| Tiêu chí | Phương án A (Cọc Escrow) | Phương án B (Giá dịch vụ) | Phương án C (Tự nguyện) | Phương án D (Relay Validator) |
|---|---|---|---|---|
| **Mức độ phi tập trung** | Cao | Rất cao | Tối đa | Trung bình - Thấp |
| **Tính khả thi kỹ thuật** | Trung bình (Dễ bị lách) | Rất cao (Khả thi ngay) | Rất cao | Trung bình (Cần node chuyên dụng) |
| **Khả năng chống lách luật** | Kém (Thông đồng ngoài luồng) | Tự nhiên (Không trả phí = Không có quyền lợi) | Không chống (Chấp nhận tự do) | Rất cao trên relay chính |
| **Trải nghiệm người dùng (UX)** | Phức tạp (Nhiều bước giải ngân) | Mượt mà, rõ ràng về quyền lợi | Đơn giản, nhẹ nhàng | Bị phụ thuộc trạng thái relay |
| **Rủi ro pháp lý môi giới** | Trung bình | Thấp (Bán dịch vụ bảo chứng) | Cực thấp | Cao (Kiểm duyệt giao dịch) |

## Đánh đổi bảo mật / phi tập trung

- **Tin tưởng ai:**
  - **Phương án A & B:** Không tin tưởng bên thứ ba tập trung nào; tin tưởng vào logic toán học của các hợp đồng mật mã (smart contracts/signatures) và động lực kinh tế tự nhiên của người tham gia.
  - **Phương án C:** Tin tưởng vào tinh thần cộng đồng Cypherpunk và văn hóa Value4Value của hệ sinh thái Bitcoin/Nostr.
  - **Phương án D:** Phải tin tưởng vào cụm Server/Relay kiểm định và node Lightning của Treasury.
- **Điều gì xảy ra nếu bên được tin tưởng hành xử xấu:**
  - Ở Phương án D, nếu relay kiểm định bị tấn công hoặc kiểm duyệt ác ý, nó có thể từ chối các booking hợp lệ của người dùng. Ở Phương án B, người dùng luôn giữ trọn quyền tự do giao dịch P2P, chỉ có quyền lợi gia tăng (bảo chứng/Proof-of-Stay) là gắn liền với đóng góp phí.

## Chỉ số thành công (Success Metrics)

Nếu một phương án được thông qua và triển khai, các chỉ số sau sẽ đo lường hiệu quả:
1. **Tỷ lệ tuân thủ nộp phí (Fee Compliance Rate):** Tỷ lệ số booking có đóng góp phí trên tổng số booking phát sinh.
2. **Doanh thu bền vững của Quỹ Hạ Tầng (Treasury Inflow):** Đủ bù đắp chi phí vận hành các node relay cộng đồng và bảo hiểm rủi ro.
3. **Tỷ lệ chuyển đổi Proof-of-Stay:** Tỷ lệ khách hàng mong muốn trả phí để nhận Proof-of-Stay chính thức.

## Các câu hỏi mở cần Chủ dự án quyết định

Tài liệu này khuyến nghị Chủ dự án xem xét các câu hỏi mở sau trước khi phê duyệt:
1. **Mức phí hiện hành trong từng phương án:** Tỷ lệ 2.0% (cơ sở) và 1.0% (ưu đãi) của RFC-0002 có nên giữ nguyên, hay nên chuyển thành mức phí cố định theo dịch vụ (ví dụ: 500 sats cho chứng nhận Proof-of-Stay, 1,000 sats cho bảo hiểm trọng tài Escrow)?
2. **Ảnh hưởng tới RFC-0002:** Nếu chọn Phương án B hoặc C, RFC-0002 có cần được cập nhật để định nghĩa lại bản chất của công thức tính phí động?
3. **Ý kiến chuyên gia pháp lý và thuế:** Khi giao thức tự động thu phí giao dịch, ở một số khu vực tài phán có nguy cơ bị phân loại là đơn vị trung gian thanh toán hoặc sàn giao dịch thương mại điện tử. Phương án B (bán dịch vụ phần mềm/chứng thực dữ liệu) hoặc Phương án C (Value4Value donation) thường có hành lang pháp lý an toàn hơn rất nhiều.

## Maturity tier đề xuất sau khi triển khai

**Draft** (Tài liệu nghiên cứu kiến trúc định hướng, không triển khai code cho tới khi có quyết định phê duyệt bằng văn bản của Chủ dự án).

## Thảo luận

*(Chờ quyết định chính thức từ Chủ dự án).*
