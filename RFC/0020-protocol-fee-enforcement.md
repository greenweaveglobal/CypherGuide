# RFC-0020: Cơ chế thu phí giao thức (Protocol Fee Enforcement Mechanism)

- **Trạng thái:** Draft (Giai đoạn 1 theo Phương án C đã được chọn; Giai đoạn 2 theo Phương án B là hướng đích, chưa cam kết)
- **Tác giả:** Chủ dự án + AI hỗ trợ soạn thảo
- **Ngày:** 2026-10-16 (Cập nhật chuẩn hóa: 2026-10-16)
- **Module liên quan:** `src/utils/dynamicFee.ts`, `src/components/BookingModal.tsx`, `src/utils/depositEscrow.ts`, `src/utils/proofOfStay.ts`, `docs/FEE_ENFORCEMENT_ANALYSIS.md`

## Quyết định của Chủ dự án (Project Lead Decision - 2026-10)

Vào tháng 10/2026, sau khi xem xét phân tích kỹ thuật tại `docs/FEE_ENFORCEMENT_ANALYSIS.md` và các phương án kiến trúc trong tài liệu này, Chủ dự án đã chính thức thông qua quyết định chiến lược về cơ chế thu phí:

1. **Giai đoạn 1 (Hiện hành):** Áp dụng **Phương án C (Đóng góp giao thức tự nguyện, có ghi nhận)**.
   - Bản chất của khoản phí là **đóng góp tự nguyện** nhằm duy trì các node relay và tài trợ phát triển hạ tầng mã nguồn mở (RFC-0016, RFC-0015).
   - Giao thức tôn trọng quyền tự do của người dùng: Khách có toàn quyền giữ nguyên mức gợi ý, chỉnh về 0 sats, hoặc nhập số sats tùy tâm.
   - Thao tác đặt về 0 sats chỉ tốn một lần chạm/nhấp chuột, tuyệt đối không có dark patterns (không dùng từ ngữ gây áp lực, không có đồng hồ đếm ngược, không hiện hộp thoại cản trở). Giao dịch đặt phòng vẫn hoàn tất thành công khi khoản này bằng 0.
2. **Giai đoạn 2 (Hướng đích tương lai):** Hướng tới **Phương án B (Phí gắn liền với giá trị dịch vụ)** khi hệ thống đã đáp ứng đầy đủ 4 điều kiện tiên quyết (trọng tài thật, quỹ bảo hiểm cọc BFT, mạng lưới attester Proof-of-Stay độc lập, và cơ chế hiển thị listing).
3. **Các phương án bị loại bỏ:** **Phương án A và Phương án D không được triển khai**.
   - Phương án A bị loại bỏ vì dễ dàng bị vô hiệu hóa khi khách và chủ nhà thông đồng bỏ cọc ngoài luồng, trong khi tiền phòng vẫn đi thẳng cho chủ nhà.
   - Phương án D bị loại bỏ vì biến relay thành điểm nghẽn tập trung và đi ngược lại nguyên tắc chống kiểm duyệt của Nostr.
4. **Ý nghĩa của mức ưu đãi 1% cho chủ nhà tiên phong:**
   - Mức ưu đãi 1% (100 pcm) cho chủ nhà tiên phong (Early Host quy định tại RFC-0002) được định nghĩa là **mức đóng góp gợi ý thấp hơn** (1% thay vì mức cơ sở 2%) dành cho các listing của chủ nhà đã được ghi danh hợp lệ, hoàn toàn **không phải là giảm giá dịch vụ**.
   - **Phân tích ý nghĩa theo từng phương án kiến trúc:**
     - *Trong Phương án B (Phí dịch vụ):* Ưu đãi 1% đóng vai trò là chính sách giảm giá phí dịch vụ (Service Fee Discount) đối với các dịch vụ bảo chứng (ví dụ giảm phí chứng nhận Proof-of-Stay hoặc giảm phí thụ lý trọng tài).
     - *Trong Phương án C (Đóng góp tự nguyện - Giai đoạn 1):* Ưu đãi 1% thể hiện qua **mức đóng góp gợi ý mặc định thấp hơn** (1% thay vì 2%) được hiển thị cho khách khi đặt phòng tại listing của host tiên phong; khách vẫn giữ toàn quyền điều chỉnh.
     - *Trong Phương án D (Relay Validator):* Ưu đãi 1% là tỷ lệ thu phí tối thiểu thấp hơn được cài đặt trên cổng relay kiểm định trước khi chấp nhận chuyển tiếp sự kiện booking.
5. **Phạm vi cam kết:**
   - Đây là quyết định về **hướng đi chiến lược** của giao thức, **chưa phải là cam kết về thời hạn cụ thể** để kích hoạt Giai đoạn 2 (Phương án B).

> **Ghi chú pháp lý quan trọng:** Mọi nhận định liên quan đến khía cạnh pháp lý, trung gian tài chính và thuế trong tài liệu này là đánh giá kỹ thuật ban đầu của nhóm phát triển phần mềm, tuyệt đối không phải là tư vấn pháp lý và chưa có ý kiến của luật sư độc lập. Mức độ an toàn pháp lý của từng phương án có thể giảm thiểu rủi ro nhưng vẫn phụ thuộc vào cách cơ quan quản lý tại từng khu vực tài phán phân loại mô hình.

---

## Vấn đề

Theo kết quả khảo sát mã nguồn chi tiết tại `docs/FEE_ENFORCEMENT_ANALYSIS.md`, hiện tại **hoàn toàn không có cơ chế nào ở tầng giao thức ép buộc thanh toán phí Treasury**.

Trong kiến trúc hiện hành (RFC-0016):
1. Việc tính toán phí giao thức (`protocolFeeSats`) được thực hiện hoàn toàn ở phía client của khách hàng (`calculateDynamicFee`).
2. Giao thức chia khoản thanh toán thành 2 hóa đơn Lightning độc lập (Dual-Invoice Model):
   - Hóa đơn 1 gửi tới địa chỉ Lightning của chủ nhà (Host).
   - Hóa đơn 2 gửi tới địa chỉ Quỹ Thưởng Hạ Tầng (Treasury).
3. Một client bị can thiệp mã nguồn độc hại (modified client / custom script) hoặc một bot tự tạo có thể dễ dàng bỏ qua hóa đơn Treasury (đặt `protocolFeeSats = 0` hoặc không thanh toán hóa đơn 2) trong khi vẫn thanh toán đủ tiền phòng cho chủ nhà.
4. Chủ nhà nhận đủ 100% tiền phòng trên ví cá nhân và sẵn sàng đón tiếp khách. Giao dịch vẫn diễn ra bình thường ngoài đời thực, nhưng Quỹ Hạ Tầng của giao thức không thu được một satoshi nào.

Nguyên nhân cốt lõi là hệ thống trước đây vận hành dựa trên giả định "Client lương thiện" (Honest Client Assumption). Cần một thiết kế cơ chế (mechanism design) thực tế, phù hợp với bản chất phi tập trung của Bitcoin/Lightning/Nostr, thay vì áp đặt các giả định không thể thực thi bằng mật mã học.

## Hiện trạng đang chạy (Current Operating Reality)

- Trong phiên bản hiện tại của CypherGuide, giao thức vận hành theo mô hình 2 hóa đơn Lightning độc lập (Dual-Invoice Model). Việc thanh toán hóa đơn phí Treasury hoàn toàn phụ thuộc vào việc client của người dùng có thực hiện lệnh thanh toán hay không.
- Về mặt bản chất thực tế, hệ thống hiện đang vận hành theo cơ chế **khách tự nguyện thanh toán trên tinh thần trung thực của client (honest client)** — hiệu quả vận hành thực tế tương đương với **Phương án C** (đóng góp tự nguyện).
- Khi triển khai theo quyết định của Chủ dự án, các nhãn hiển thị trên giao diện người dùng (ví dụ nhãn "Phí giao thức" trong hóa đơn đặt phòng) phải được cập nhật thành **"Đóng góp giao thức (không bắt buộc)"** nhằm phản ánh đúng bản chất, đảm bảo tính minh bạch và trung thực với người dùng.

## Các phương án đã cân nhắc

Tài liệu này ghi nhận 4 phương án kiến trúc đã được phân tích và đánh giá:

---

### Phương án A: Gộp một hóa đơn và ràng buộc hoàn cọc theo bằng chứng nộp phí (Escrow Proof-of-Fee Lock) - *[Đã bị loại bỏ]*

- **Cơ chế hoạt động:**
  - Khách chỉ thanh toán 1 hóa đơn tổng (tiền phòng + tiền cọc ký quỹ Escrow).
  - Khoản tiền cọc (Deposit Escrow qua Cashu NUT-11 Multisig hoặc HTLC) được cài đặt điều kiện khóa mở rộng: Tiền cọc chỉ được hoàn lại cho khách (hoặc giải tỏa một phần cho chủ nhà) khi xuất trình được preimage hợp lệ chứng minh hóa đơn phí Treasury đã được thanh toán (`verifyLightningPreimage(treasuryPreimage, treasuryPaymentHash)`).
- **Ưu điểm:**
  - Tận dụng cơ chế ký quỹ sẵn có của RFC-0003/RFC-0008.
  - Sử dụng ràng buộc toán học bằng mật mã học (cryptographic condition): Không có preimage nộp phí thì hợp đồng escrow không thể mở khóa.
- **Nhược điểm và Chỗ hở nghiêm trọng khiến phương án bị loại bỏ:**
  - **Khách và Chủ nhà thông đồng:** Nếu khách và chủ nhà thỏa thuận ngoài luồng (collusion) hoặc tự thỏa thuận "đặt phòng không qua cọc", thì không bên nào báo cáo giao dịch lên escrow và không ai nộp phí Treasury.
  - **Tiền phòng đi thẳng:** Do tiền phòng là giao dịch P2P trực tiếp từ khách sang ví của chủ nhà, giao thức không thể phong tỏa hay thu giữ tiền phòng nếu chủ nhà đã cầm tiền.
  - Tăng độ phức tạp cho luồng giải ngân cọc của người dùng bình thường.

---

### Phương án B: Phí là giá của dịch vụ, không phải thuế trên giao dịch (Fee as Service Price, not Transaction Tax) - *[Hướng đích Giai đoạn 2]*

- **Cơ chế hoạt động:**
  - Từ bỏ tư duy xem phí giao thức là một khoản "thuế bắt buộc" đánh lên toàn bộ giao dịch P2P (vốn không thể cưỡng chế trong mạng mở).
  - Thay vào đó, **phí giao thức là khoản thanh toán cho các dịch vụ gia tăng có thể kiểm soát và bảo chứng bằng mật mã**:
    1. **Dịch vụ trọng tài và bảo vệ cọc (BFT Escrow & Dispute Arbitration):** Chỉ những booking có nộp phí Treasury mới được bảo hiểm bởi Quỹ BFT (RFC-0001) và được Hội đồng Trọng tài thụ lý khi có tranh chấp mất cọc, hư hỏng phòng.
    2. **Chứng nhận Lưu trú Bất biến Đồng Ký (Co-Signed Cryptographic Proof-of-Stay - RFC-0003):** Sự kiện Proof-of-Stay chỉ được relay/attester giao thức ký bảo chứng khi có bằng chứng preimage phí giao thức. *Lưu ý kỹ thuật:* Trong mã nguồn (`src/utils/proofOfStay.ts`), Proof-of-Stay là sự kiện Nostr Kind 30078 đồng ký 2 bên (Khách ký claim, Host ký endorsement), **không phải là token NFT trên blockchain**. Không có chứng nhận bảo chứng này thì khách không thể xây dựng Danh tiếng Di động (Portable Reputation) và không thể viết đánh giá uy tín có xác thực trên Nostr.
    3. **Hiển thị và Xếp hạng Listing (Listing Discovery & Priority Relay Broadcast):** Các host đóng góp phí đều đặn được các relay của mạng lưới ưu tiên lập chỉ mục, đẩy lên đầu danh sách tìm kiếm và hiển thị huy hiệu xác thực.
    4. **Báo cáo tín nhiệm và phân tích (Reputation & Agent Audit Feeds):** Cung cấp dữ liệu API và báo cáo kiểm toán cho các Agent AI tự hành đặt phòng.
- **Ưu điểm:**
  - Hoàn toàn phù hợp với triết lý Cypherpunk: Không cưỡng chế bằng bạo lực hay kiểm duyệt, mà tạo ra giá trị dịch vụ thực tế để người dùng tự nguyện trả tiền.
  - Không thể bị "gian lận": Người dùng không trả phí thì đơn giản là không nhận được dịch vụ bảo chứng và bằng chứng lưu trú, trong khi giao dịch P2P thuần túy giữa 2 bên vẫn diễn ra tự do.
- **Nhược điểm:**
  - Các giao dịch đặt phòng giá trị nhỏ hoặc khách vãng lai không quan tâm đến điểm danh tiếng có thể chọn bỏ qua phí. Doanh thu Treasury sẽ phụ thuộc vào nhu cầu thực tế của các dịch vụ bảo chứng.

#### Điều kiện tiên quyết của Phương án B (Prerequisites for Option B)

Phương án B chỉ có thể vận hành trên thực tế khi các hạ tầng và dịch vụ đi kèm sau đây đã thực sự tồn tại. Khảo sát thực tế trong mã nguồn dự án cho thấy:
1. **Hội đồng Trọng tài & Cơ chế Escrow (Arbitration & Escrow):** Trong `src/utils/insuranceFund.ts` (dòng 55-77), `DEFAULT_ARBITRATOR_POOL` hiện gồm 3 public key tĩnh đóng vai trò placeholder phục vụ mô phỏng; chưa có trọng tài bên thứ ba độc lập nào nắm giữ private key thực tế (**chưa triển khai trọng tài thật**).
2. **Quỹ bảo hiểm BFT (BFT Insurance Fund - RFC-0001):** Mã nguồn hiện tại chỉ mô phỏng thuật toán đồng thuận BFT phía client; hợp đồng ký quỹ giữ tiền cọc thực tế (FROST multisig hoặc Cashu mint) **chưa triển khai**.
3. **Bên chứng nhận (Attester) cho Proof-of-Stay:** Trong `src/utils/proofOfStay.ts`, Proof-of-Stay hiện là thỏa thuận đồng ký trực tiếp giữa Khách và Chủ nhà; giao thức **chưa triển khai** dịch vụ attester hay relay ký xác nhận độc lập sau khi nhận phí.
4. **Cơ chế hiển thị và xếp hạng listing (Listing Discovery & Ranking):** Dữ liệu listing hiện lưu cục bộ trong client state (`useAppStore.ts`), giao thức **chưa triển khai** hệ thống relay lập chỉ mục và ưu tiên hiển thị listing dựa trên đóng góp phí.

---

### Phương án C: Đóng góp tự nguyện, có ghi nhận (Voluntary Contribution with On-Chain Recognition) - *[Đã chọn cho Giai đoạn 1]*

- **Cơ chế hoạt động:**
  - Phí giao thức được chuyển đổi hoàn toàn thành khoản **đóng góp tự nguyện** (Voluntary Donation / Protocol Contribution).
  - Khách hàng được hiển thị mức gợi ý mặc định (tính toán dựa trên công thức RFC-0002), kèm theo các lựa chọn tức thời: giữ mức gợi ý, đặt về 0 sats (1 chạm), hoặc nhập số sats tùy chỉnh.
  - Khi khách chọn mức 0 sats, giao thức không sinh hóa đơn Treasury và giao dịch đặt phòng vẫn hoàn tất bình thường.
  - Mọi khoản đóng góp vào Quỹ Hạ Tầng (Treasury) được ghi nhận công khai trên relay Nostr qua sự kiện NIP-57 (Zaps) hoặc NIP-58 (Badges).
- **Lưu ý bảo mật về quyền biểu quyết:**
  - Trong một số tài liệu sơ khởi có đề xuất trao quyền biểu quyết quản trị theo số tiền đóng góp. Cần ghi chú rõ ràng rằng việc gắn quyền biểu quyết trực tiếp với số satoshi đóng góp tiềm ẩn rủi ro nghiêm trọng về việc người giàu mua ảnh hưởng (plutocracy) hoặc kẻ tấn công tạo nhiều danh tính giả mạo (Sybil attack) để thâu tóm phiếu bầu.
  - Do đó, **tính năng quyền biểu quyết theo số sats đóng góp KHÔNG được triển khai trong Giai đoạn 1**, và được giữ lại như một câu hỏi mở cần quyết định riêng.
- **Ưu điểm:**
  - Cực kỳ minh bạch; được một số ý kiến kỹ thuật đánh giá là có thể giảm thiểu rủi ro môi giới tài chính trung gian, nhưng mức độ an toàn vẫn phụ thuộc vào cách cơ quan quản lý tại từng khu vực tài phán phân loại mô hình.
  - UX đơn giản nhất, hoàn toàn tôn trọng quyền tự quyết của người dùng.
- **Nhược điểm:**
  - Doanh thu không ổn định và có thể thấp (hiệu ứng "người đi nhờ xe" - free-rider problem).

---

### Phương án D: Máy chủ hoặc Relay xác minh tập trung hơn (Relay / Server-Enforced Validation) - *[Đã bị loại bỏ]*

- **Cơ chế hoạt động:**
  - Sử dụng mạng lưới Relay có cổng thanh toán (Gated/Validating Relays) hoặc Server trung chuyển của CypherGuide.
  - Khi một sự kiện Booking được gửi lên relay, Relay Validator kết nối trực tiếp với node Lightning của Treasury qua webhook/gRPC để xác nhận hóa đơn phí đã thanh toán thành công.
  - Nếu hóa đơn phí chưa thanh toán, Relay sẽ từ chối lưu trữ và phát sóng sự kiện booking.
- **Lý do bị loại bỏ:**
  - **Mất tính phi tập trung (Decentralization Compromise):** Đưa Relay/Server trở thành điểm nghẽn tập trung (chokepoint). Nếu server/node Treasury ngừng hoạt động, toàn bộ hệ thống đặt phòng bị tê liệt.
  - Đi ngược lại nguyên tắc chống kiểm duyệt của Nostr (người dùng có thể chuyển sang relay khác không kiểm tra phí).

---

## So sánh tổng hợp các phương án

| Tiêu chí | Phương án A (Cọc Escrow) | Phương án B (Giá dịch vụ) | Phương án C (Tự nguyện - Giai đoạn 1) | Phương án D (Relay Validator) |
|---|---|---|---|---|
| **Mức độ phi tập trung** | Cao | Rất cao | Tối đa | Trung bình - Thấp |
| **Tính khả thi kỹ thuật** | Trung bình (Dễ bị lách khi thông đồng) | Phụ thuộc 4 điều kiện tiên quyết (Hiện chưa triển khai) | Rất cao (Khả thi ngay, trung thực với hiện trạng) | Trung bình (Cần node chuyên dụng) |
| **Khả năng chống lách luật** | Kém (Thông đồng ngoài luồng) | Tự nhiên (Không trả phí = Không có quyền lợi) | Không chống (Chấp nhận tự do, khuyến khích tự nguyện) | Rất cao trên relay chính |
| **Trải nghiệm người dùng (UX)** | Phức tạp (Nhiều bước giải ngân cọc) | Mượt mà, rõ ràng về quyền lợi | Đơn giản, nhẹ nhàng, 1 chạm đặt về 0 | Bị phụ thuộc trạng thái relay |
| **Đánh giá pháp lý sơ bộ (đánh giá kỹ thuật, chưa có ý kiến luật sư)** | Trung bình (Liên quan giữ cọc) | Tùy thuộc cấu trúc bán dịch vụ phần mềm | Được đánh giá là giảm thiểu rủi ro môi giới nhất | Phức tạp (Kiểm duyệt giao dịch) |

## Đánh đổi bảo mật / phi tập trung

- **Tin tưởng ai:**
  - **Phương án A & B:** Không tin tưởng bên thứ ba tập trung nào; tin tưởng vào logic toán học của các hợp đồng mật mã (smart contracts/signatures) và động lực kinh tế tự nhiên của người tham gia.
  - **Phương án C:** Tin tưởng vào tinh thần cộng đồng Cypherpunk và văn hóa Value4Value của hệ sinh thái Bitcoin/Nostr.
  - **Phương án D:** Phải tin tưởng vào cụm Server/Relay kiểm định và node Lightning của Treasury.
- **Bên chứng nhận là một bên tin cậy mới (Áp dụng cho Phương án B):**
  - Trong Phương án B, việc yêu cầu *"relay giao thức ký bảo chứng (attested) khi có bằng chứng preimage phí"* đưa vào hệ thống một **giả định tin cậy mới (new trust assumption)** đối với bên chứng nhận (attester).
  - Nếu chỉ có 1 attester duy nhất: Tạo thành điểm nghẽn tập trung và điểm lỗi đơn lẻ (single point of failure / censorship risk).
  - Hậu quả nếu attester bị tấn công hoặc hành xử xấu: Nếu khóa attester bị kẻ xấu chiếm quyền, chúng có thể ký khống chứng nhận cho các booking không hề nộp phí; ngược lại, nếu attester bị tấn công từ chối dịch vụ (DoS) hoặc từ chối phục vụ, những khách hàng đã nộp phí đầy đủ sẽ không thể nhận được chứng nhận lưu trú hợp lệ.
  - Do đó, Phương án B đòi hỏi phải có mạng lưới nhiều attester độc lập vận hành theo cơ chế ngưỡng đồng thuận đa chữ ký (m-of-n threshold signatures). RFC này không tự ý ấn định số lượng attester cụ thể khi chưa có quyết định của Chủ dự án.

## Lộ trình đã chọn (Adopted Roadmap)

Căn cứ theo Quyết định của Chủ dự án (tháng 10/2026), lộ trình thực thi được xác lập như sau:
1. **Giai đoạn 1 (Hiện hành): Thực hiện Phương án C (Đóng góp tự nguyện có ghi nhận):**
   - Tôn trọng hiện trạng kỹ thuật: Giao thức không có khả năng ép nộp phí khi tiền phòng chuyển thẳng P2P cho chủ nhà.
   - Phần mềm, giao diện và tài liệu nói đúng bản chất: Khoản thanh toán Treasury là đóng góp tự nguyện (không bắt buộc), mức mặc định hiển thị là mức gợi ý tính toán theo RFC-0002.
   - Cho phép khách hàng tùy chỉnh linh hoạt: chọn mức gợi ý, đặt về 0 sats (1 chạm), hoặc nhập số sats tùy tâm mà không có dark patterns.
   - Khi khách chọn 0 sats, hệ thống không tạo hóa đơn Treasury, luồng thanh toán và đối soát hoàn tất chỉ với hóa đơn của chủ nhà.
2. **Giai đoạn 2 (Hướng đích tương lai): Chuyển sang Phương án B (Phí gắn liền với dịch vụ):**
   - Giao thức chỉ chuyển sang Giai đoạn 2 khi hội đủ 4 điều kiện tiên quyết đã khảo sát:
     1. Đã onboard Hội đồng Trọng tài thật nắm giữ các private key độc lập (thay thế 3 key placeholder hiện tại).
     2. Đã triển khai Quỹ bảo hiểm BFT và hợp đồng giữ cọc thực tế (FROST / Cashu mint).
     3. Đã xây dựng mạng lưới attester độc lập vận hành cơ chế đa chữ ký (m-of-n) để chứng thực Proof-of-Stay.
     4. Đã phát triển cơ chế relay lập chỉ mục và xếp hạng listing.
3. **Không triển khai Phương án A và D:** Phương án A bị loại bỏ do lỗ hổng thông đồng bỏ cọc; Phương án D bị loại bỏ do tạo điểm nghẽn tập trung trái tinh thần Nostr.

## Chỉ số thành công (Success Metrics)

1. **Tỷ lệ đóng góp tự nguyện (Voluntary Contribution Ratio):** Tỷ lệ số booking có đóng góp phí (khác 0) trên tổng số booking phát sinh.
2. **Doanh thu bền vững của Quỹ Hạ Tầng (Treasury Inflow):** Đủ bù đắp chi phí vận hành các node relay cộng đồng và bảo hiểm rủi ro.
3. **Mức đóng góp trung bình (Average Sats Contributed):** Số lượng sats trung bình mà khách tự nguyện đóng góp trên mỗi giao dịch.

## Các câu hỏi mở cần Chủ dự án quyết định

Tài liệu này khuyến nghị Chủ dự án xem xét các câu hỏi mở sau:
1. **Cách ghi nhận người đóng góp & Bảo vệ quyền riêng tư:** Phương thức ghi nhận người đóng góp (ví dụ: cấp huy hiệu NIP-58, phát sóng zap công khai, hoặc bảng danh dự trên relay) cần được thiết kế như thế nào để vừa vinh danh vừa bảo vệ quyền riêng tư cá nhân của khách (tránh làm lộ lịch sử du lịch, địa điểm lưu trú hoặc danh tính thật khi công khai dữ liệu thanh toán)?
2. **Mức đóng góp gợi ý theo giá trị phòng:** Có nên thiết lập mức đóng góp gợi ý phân tầng theo giá trị phòng (ví dụ: phòng bình dân giá thấp có tỷ lệ gợi ý khác so với villa/resort cao cấp) thay vì áp dụng tỷ lệ cố định 2% và 1%?
3. **Thời điểm và chỉ số chuyển sang Giai đoạn 2:** Khi nào chuyển sang Giai đoạn 2 (Phương án B) và đo bằng những chỉ số cụ thể nào (ví dụ: đạt tối thiểu bao nhiêu trọng tài độc lập, quy mô quỹ bảo hiểm đạt bao nhiêu BTC, hay tỷ lệ khách tự nguyện trả phí trong Giai đoạn 1)?
4. **Mô hình quản trị phi tập trung và rủi ro Plutocracy:** Thiết kế cơ chế biểu quyết thế nào để không rơi vào bẫy "người giàu mua quyền kiểm soát" nếu sau này cân nhắc gắn đóng góp với tiếng nói quản trị?
5. **Cấu trúc ưu đãi: Giữ tỷ lệ % hay chuyển sang phí cố định theo dịch vụ?** Khi hệ thống tiến tới Giai đoạn 2 (Phương án B), nên tiếp tục duy trì ưu đãi host tiên phong và mức thu theo tỷ lệ phần trăm (1% vs. 2% giá trị phòng) hay chuyển đổi sang mức phí cố định theo từng loại dịch vụ (ví dụ: 500 sats cho chứng nhận Proof-of-Stay, 1.000 sats cho dịch vụ bảo hiểm cọc Escrow, kèm chính sách miễn/giảm phí cố định cho host tiên phong)?
6. **Tư vấn pháp lý và thuế:** Khi giao thức chuyển từ mô hình phí sang mô hình đóng góp tự nguyện Value4Value, cần đánh giá từ chuyên gia pháp lý và thuế độc lập tại từng khu vực tài phán; RFC này là đánh giá kỹ thuật ban đầu, không đưa ra bất kỳ kết luận hay khẳng định tư vấn pháp lý nào.

## Maturity tier đề xuất sau khi triển khai

**Draft** (Giai đoạn 1 theo Phương án C đã được chọn; Giai đoạn 2 theo Phương án B là hướng đích, chưa cam kết thời hạn cụ thể).

## Thảo luận

*(Ghi nhận quyết định chiến lược của Chủ dự án tháng 10/2026).*
