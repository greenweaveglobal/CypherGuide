# RFC-0019: Xác thực chủ nhà của listing (Listing Host Authentication)

- **Trạng thái:** Draft
- **Tác giả:** Chủ dự án + AI hỗ trợ soạn thảo
- **Ngày:** 2026-10-13
- **Module liên quan:** `src/types.ts`, `src/components/HostRegistrationModal.tsx`, `src/utils/dynamicFee.ts`, `api/protocol/early-hosts.ts`

## Vấn đề

Hiện tại, cơ chế xác định chủ nhà thụ hưởng ưu đãi phí "Early Host Incentive" (RFC-0002: 1.0% / 100 pcm thay vì mặc định 2.0% / 200 pcm) dựa vào hàm `getPrimaryHostNpub(listing)`. Hàm này trích xuất trường `coOwners[].npub` có tỷ lệ sở hữu (`share`) cao nhất trong danh sách đồng sở hữu của listing.

Tuy nhiên, trong `HostRegistrationModal.tsx`, danh sách `coOwners` được khởi tạo và nhập tự do bởi người tạo listing (`npub: ''`), không hề có cơ chế chứng minh quyền sở hữu khóa riêng tương ứng với `npub` đó tại thời điểm đăng ký. 

Do đó, lỗ hổng bảo mật phát sinh:
- Bất kỳ ai biết được `npub` công khai của một chủ nhà đã được quản trị viên ghi danh ưu đãi (Early Host) đều có thể tự tạo một listing mới, gõ `npub` của chủ nhà danh tiếng đó vào mục `coOwners` với `share: 100%`, và hưởng mức chiết khấu phí giao thức 1% mà chủ sở hữu thực sự của `npub` không hề hay biết hay ủy quyền.
- Nói cách khác, `getPrimaryHostNpub` hiện chỉ là một thuộc tính khai báo đơn phương (self-asserted string), hoàn toàn thiếu tính xác thực cryptographic (unauthenticated).

Vì sao hiện trạng không đủ tốt?
Chương trình ưu đãi Early Host được thiết kế để tri ân và thu hút các host tiên phong tham gia mạng lưới CypherGuide. Việc để lộ kẽ hở giả mạo npub để trục lợi phí giao thức làm xói mòn tính công bằng, vi phạm nguyên tắc bảo mật Cypherpunk ("Don't Trust, Verify"), và khiến việc kiểm soát hạn mức (cohort cap) của quản trị viên trở nên vô hiệu.

## Các phương án đã cân nhắc

### Phương án A (Đề xuất): Ký xác thực nội dung listing bằng khóa riêng của Host (Host Listing Signature)
Khi Host đăng ký listing qua `HostRegistrationModal`, ứng dụng sử dụng khóa của chính người đang đăng nhập (khóa trong Vault/session hoặc tiện ích mở rộng trình duyệt NIP-07) để ký cryptographic payload định danh của listing (bao gồm `id`, `title`, `priceSats`, `coOwners`, và thời điểm tạo). Listing lưu thêm trường `hostPubkey` (chuỗi hex 64 ký tự) và `listingSignature` (chữ ký Schnorr / Nostr event signature).
- **Ưu điểm:**
  - Xác thực trực tiếp quyền sở hữu khóa: Kẻ tấn công không thể giả mạo chữ ký nếu không nắm giữ khóa riêng (nsec hoặc NIP-07).
  - Không thể sửa đổi thông tin listing sau khi ký (ví dụ: tráo đổi `coOwners` hay đổi giá) mà không làm hỏng chữ ký (signature invalidation).
  - Hoạt động mượt mà cả với khóa cục bộ lẫn NIP-07 (Alby, nos2x).
  - Ưu đãi Early Host chỉ kích hoạt khi chữ ký hợp lệ VÀ `hostPubkey` nằm trong danh sách ghi danh còn hiệu lực.
- **Nhược điểm:**
  - Yêu cầu ứng dụng phải có bước ký khi đăng ký listing. Nếu người dùng từ chối cấp quyền ký NIP-07 hoặc không có khóa, listing sẽ không có chữ ký xác thực và do đó không đủ điều kiện hưởng ưu đãi Early Host.

### Phương án B: Ghi danh theo Listing ID cụ thể thay vì Host Pubkey
Thay vì ghi danh `npub` của chủ nhà, quản trị viên ghi danh trực tiếp từng mã listing (`listingId`, ví dụ: `list_ABC123`) vào danh sách ưu đãi thông qua API quản trị.
- **Ưu điểm:**
  - Cực kỳ đơn giản về mặt logic: Chỉ cần kiểm tra `listing.id` có nằm trong whitelist hay không.
  - Không cần thêm logic ký Schnorr phức tạp vào form listing.
- **Nhược điểm:**
  - Gắn chặt và cồng kềnh: Nếu một host tiên phong tạo 5 listing khác nhau, quản trị viên phải duyệt và ghi danh 5 lần riêng biệt.
  - Phụ thuộc hoàn toàn vào quản trị viên tập trung, làm mất tính linh hoạt và chủ quyền của Host.

### Phương án C: Thử thách ký Challenge-Response khi nhận ưu đãi kết hợp Phương án A
Khi khách tiến hành đặt phòng và tính phí, client của khách hoặc giao thức gửi một challenge ngẫu nhiên đến relay hoặc qua Nostr DM/ephemeral event tới Host, yêu cầu Host phản hồi chữ ký tức thời (proof of liveness and ownership).
- **Ưu điểm:**
  - Đảm bảo host đang hoạt động trực tuyến (online) và kiểm soát khóa tại đúng thời điểm booking diễn ra.
- **Nhược điểm:**
  - Phức tạp hóa luồng người dùng: Nếu host đang ngoại tuyến (offline), khách không thể hoàn tất tính phí và đặt phòng.
  - Độ trễ cao, dễ gặp lỗi mạng lưới trong môi trường phi tập trung / mesh.

## Đề xuất

Chọn **Phương án A**:
1. Lược đồ `Listing` trong `src/types.ts` bổ sung hai trường tùy chọn:
   - `hostPubkey?: string;` (dạng hex 64 ký tự)
   - `listingSignature?: string;` (chữ ký Schnorr / JSON event của Nostr)
2. Trong `HostRegistrationModal.tsx`, khi host nhấn tạo listing:
   - Hệ thống tự động tạo chuỗi payload đại diện cho listing (bao gồm `listingId`, `title`, `priceSats`, `coOwners`, và timestamp).
   - Dùng khóa định danh của host (`identity`) thực hiện ký cryptographic.
   - Gán `hostPubkey = identity.pubKeyHex` và `listingSignature = signature`.
   - Nếu host không có khóa hoặc từ chối ký, modal hiển thị cảnh báo rõ ràng rằng listing sẽ không đủ điều kiện hưởng ưu đãi Early Host.
3. Trong `src/utils/dynamicFee.ts`:
   - Hàm `isEarlyHostEligible` nhận thêm tham số `listing`.
   - Điều kiện hưởng ưu đãi 1.0%:
     - `listing` phải có `hostPubkey` và `listingSignature` hợp lệ (xác minh qua Schnorr/Nostr verification).
     - `hostPubkey` của chữ ký phải khớp với pubkey đã được ghi danh trong danh sách `earlyHosts` và còn trong thời hạn hiệu lực (365 ngày).
     - Bất kỳ hành vi sửa đổi dữ liệu listing sau khi ký đều làm mất hiệu lực ưu đãi.
   - Hàm `getPrimaryHostNpub` được giữ lại cho mục đích hiển thị giao diện, nhưng **không còn là nguồn chân lý (source of truth)** để xét duyệt ưu đãi phí.

## Giới hạn còn lại (Known Residual Limitations)

Cần nêu rõ hai giới hạn cố hữu còn tồn tại để đội ngũ nắm bắt:
1. **Phí được tính toán và thanh toán ở phía Client (Client-Side Dynamic Fee Calculation):**
   - Hiện tại, client của khách tự gọi `calculateDynamicFee` và tạo hóa đơn Lightning tới Treasury. Một phiên bản client bị can thiệp mã nguồn độc hại (modified client) trên lý thuyết vẫn có thể tự ý bỏ qua hóa đơn phí Treasury (xem chi tiết phân tích chuyên sâu tại Nhiệm vụ 5 - `docs/FEE_ENFORCEMENT_ANALYSIS.md`).
2. **Nguy cơ Sybil Attack (Một người tạo nhiều khóa/npub):**
   - Nostr là mạng không cần cấp phép (permissionless), một người có thể dễ dàng tạo ra hàng trăm cặp khóa `npub` khác nhau.
   - Giảm thiểu: Mạng lưới kiểm soát việc này thông qua việc quản trị viên (Admin) xét duyệt danh tính trước khi ghi danh qua NIP-98 API, kết hợp với trần số lượng nghiêm ngặt (`maxEarlyHosts` / `maxEnrolled`) và thời hạn ưu đãi (`durationDays`).

## Đánh đổi bảo mật / phi tập trung

- **Tin tưởng ai:**
  - Tin tưởng vào thuật toán mật mã học Schnorr (secp256k1) chuẩn Nostr: Không ai có thể tạo chữ ký giả mạo mà không có khóa riêng.
  - Tin tưởng vào quản trị viên giao thức (Guardian/Admin) trong việc thẩm định kỹ lưỡng khi ghi danh Host vào danh sách ưu đãi.
- **Điều gì xảy ra nếu bên được tin tưởng hành xử xấu:**
  - Nếu một Admin ghi danh nhầm một npub không phải host tiên phong: Người đó chỉ được hưởng tối đa 1 năm ưu đãi giảm 1% phí và chịu sự giám sát minh bạch thông qua NIP-98 Audit Trail trên relay công khai (Kind 27235).
  - Không một bên thứ ba nào có thể mạo danh bất kỳ host nào khác để chiếm đoạt quyền ưu đãi phí.

## Maturity tier đề xuất sau khi triển khai

**Beta** (Thử nghiệm trên toàn bộ các listing mới đăng ký và kiểm thử đơn vị hồi quy).

## Thảo luận

*(Chờ phản hồi và phê duyệt chính thức từ Chủ dự án trước khi triển khai mã nguồn Nhiệm vụ 1b).*
