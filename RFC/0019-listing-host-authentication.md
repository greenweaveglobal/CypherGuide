# RFC-0019: Xác thực chủ nhà của listing (Listing Host Authentication)

- **Trạng thái:** Draft
- **Tác giả:** Chủ dự án + AI hỗ trợ soạn thảo
- **Ngày:** 2026-10-13 (Cập nhật chuẩn hóa: 2026-10-16)
- **Module liên quan:** `src/types.ts`, `src/components/HostRegistrationModal.tsx`, `src/components/HostDashboard.tsx`, `src/components/ListingDetail.tsx`, `src/utils/dynamicFee.ts`, `api/protocol/early-hosts.ts`

## Vấn đề

Trước đây, cơ chế xác định chủ nhà thụ hưởng ưu đãi phí "Early Host Incentive" (RFC-0002: 1.0% / 100 pcm thay vì mặc định 2.0% / 200 pcm) chỉ dựa vào hàm `getPrimaryHostNpub(listing)`. Hàm này trích xuất trường `coOwners[].npub` có tỷ lệ sở hữu (`share`) cao nhất trong danh sách đồng sở hữu của listing.

Tuy nhiên, danh sách `coOwners` có thể được nhập tự do bởi bất kỳ ai tạo listing, không hề có cơ chế chứng minh quyền sở hữu khóa riêng tương ứng với `npub` đó tại thời điểm đăng ký.

Do đó, lỗ hổng bảo mật phát sinh:
- Bất kỳ ai biết được `npub` công khai của một chủ nhà đã được quản trị viên ghi danh ưu đãi (Early Host) đều có thể tự tạo một listing mới, gõ `npub` của chủ nhà danh tiếng đó vào mục `coOwners` với `share: 100%`, và hưởng mức chiết khấu phí giao thức 1% mà chủ sở hữu thực sự của `npub` không hề hay biết hay ủy quyền.
- Nói cách khác, `getPrimaryHostNpub` chỉ là một thuộc tính khai báo đơn phương (self-asserted string), hoàn toàn thiếu tính xác thực cryptographic (unauthenticated).
- Nhánh xác minh cũ dựa trên tiền tố thô `register_<id>_<title>_<price>_coOwners:...` chỉ kiểm tra chuỗi đơn giản, không bao phủ mô tả, loại phòng, ảnh, và đặc biệt là địa chỉ nhận tiền Lightning, khiến kẻ tấn công có thể sao chép listing rồi đổi địa chỉ nhận tiền mà vẫn giữ được ưu đãi.

## Quy chuẩn định dạng chữ ký NIP-78 Kind 30078 đã cài đặt

Hệ thống đã triển khai toàn diện chuẩn ký số sự kiện Nostr theo NIP-78 Kind 30078:

### 1. Cấu trúc sự kiện Nostr (Event Structure)
- **Kind:** `30078` (NIP-78 Arbitrary Custom App Data).
- **Pubkey:** Phải trùng khớp chính xác với `hostPubkey` dạng hex 64 ký tự.
- **Created_at:** Timestamp thời điểm ký (tính bằng giây).
- **Tags bắt buộc:**
  - `["d", "cypherguide:listing:<id>"]`: Định danh duy nhất của listing.
  - `["v", "1"]`: Phiên bản định dạng chữ ký.
  - `["x", "<sha256_hash>"]`: Mã băm SHA-256 của chuỗi JSON listing chuẩn hóa (canonical JSON).
  - `["client", "cypherguide"]`: Thẻ nhận diện ứng dụng.
- **Content:** Bằng đúng chuỗi JSON chuẩn hóa (`canonicalJson`). Không chứa khoảng trắng thừa, các khóa được sắp xếp theo bảng chữ cái ở mọi cấp độ (`deterministicStringify`).

### 2. Các trường dữ liệu được bao phủ trong chữ ký (`canonicalizeListingForSigning`)
Chữ ký bao phủ toàn diện 9 trường trọng yếu:
1. `version`: Phiên bản dữ liệu (hiện tại là `1`).
2. `id`: Mã định danh listing.
3. `title`: Tiêu đề cơ sở lưu trú.
4. `description`: Mô tả chi tiết.
5. `priceSats`: Giá cơ sở mỗi đêm.
6. `roomTypes`: Danh sách các loại phòng (`id`, `name`, `priceSats`).
7. `coOwners`: Danh sách đồng sở hữu đã được chuẩn hóa (khóa `npub` được giải mã thành hex 64 ký tự chữ thường, tỷ lệ `share`, và `lightningAddress` nhận tiền viết thường). Mảng `coOwners` được sắp xếp theo thứ tự `npub` để đảm bảo tính bất biến khi đổi thứ tự nhập liệu.
8. `batchPayloadHash`: Mã băm SHA-256 của danh sách ảnh (bao gồm URL và hash ảnh NIP-94).
9. `createdAt`: Thời điểm khởi tạo hoặc sửa đổi listing.

### 3. Quy trình xác minh bằng so khớp chính xác
Hàm `verifyListingHostSignature(listing)` thực hiện xác minh nghiêm ngặt:
1. Kiểm tra sự tồn tại của `hostPubkey` và `listingSignature`. Chuẩn hóa `hostPubkey` sang hex.
2. Phân tích cú pháp JSON `listingSignature`. Từ chối chữ ký chuỗi thô cũ với thông báo rõ ràng "cần ký lại bằng định dạng mới".
3. Kiểm tra `event.pubkey === hostPubkey` (hex).
4. Xác thực chữ ký Schnorr của Nostr bằng `verifyEvent(event)`.
5. Kiểm tra `event.kind === 30078`.
6. Kiểm tra thẻ `d` khớp `cypherguide:listing:<listing.id>`, thẻ `v === '1'`, và thẻ `x` có mặt.
7. Chuẩn hóa lại listing hiện tại bằng `canonicalizeListingForSigning` và tính SHA-256.
8. So khớp: `computedHash === hashTag` VÀ `event.content === expectedCanonical`. Nếu có bất kỳ sự sai lệch nào, trả về `valid: false`.

Nhánh xác minh kiểu cũ dựa trên tiền tố `register_` (cả chuỗi thô và sự kiện JSON chứa tiền tố này) đã bị xóa hoàn toàn khỏi hệ thống mã nguồn.

## Bảng ma trận kịch bản tấn công đã xem xét

| Kịch bản tấn công | Hành vi của kẻ tấn công | Cơ chế mật mã ngăn chặn | Kết quả xác minh |
|---|---|---|---|
| **1. Đổi địa chỉ nhận tiền (Lightning Address Substitution)** | Kẻ tấn công sao chép listing đã ký của chủ nhà uy tín, nhưng sửa `coOwners[].lightningAddress` thành địa chỉ ví của mình nhằm chiếm đoạt tiền thanh toán phòng của khách. | Trường `lightningAddress` của mọi co-owner đều được bao phủ trong JSON chuẩn hóa và mã băm SHA-256 (thẻ `x`). | **Bị từ chối (Invalid):** Dữ liệu không khớp mã băm đã ký (`Listing data does not match signed hash`). Ưu đãi Early Host bị hủy bỏ ngay lập tức. |
| **2. Gian lận sửa giá hoặc nội dung (Price / Room Tampering)** | Sửa giá phòng (ví dụ 50,000 thành 500 Sats), thay đổi mô tả, thêm/bớt loại phòng hoặc thay đổi URL/hash của ảnh sau khi đã ký. | `priceSats`, `roomTypes`, `description` và `batchPayloadHash` đều nằm trong đối tượng JSON chuẩn hóa. | **Bị từ chối (Invalid):** Bất kỳ thay đổi ký tự nào cũng làm thay đổi mã băm SHA-256 và hỏng tính toàn vẹn. |
| **3. Sao chép nguyên văn (Verbatim Replay Attack)** | Kẻ tấn công sao chép nguyên văn toàn bộ nội dung listing kèm chữ ký hợp lệ của host khác để đăng lên relay. | Do chữ ký khóa cứng địa chỉ Lightning và các khóa `npub` của host thật, tiền khách thanh toán vẫn được định tuyến chính xác về ví Lightning của host thật. | **Vô hại về kinh tế:** Kẻ sao chép không thể nhận được tiền phòng hay tiền cọc; hành vi sao chép không mang lại lợi ích tài chính. |
| **4. Mạo danh khóa ký (Key Spoofing / Impersonation)** | Kẻ tấn công tự tạo listing, dùng khóa riêng của mình để ký, nhưng điền `hostPubkey` là pubkey của một Host tiên phong đã được ghi danh. | Quy trình xác minh kiểm tra ràng buộc: `event.pubkey === hostPubkey`. | **Bị từ chối (Invalid):** Khóa công khai của người ký sự kiện khác với `hostPubkey` khai báo. |
| **5. Sử dụng chữ ký định dạng cũ (Legacy Signature Replay)** | Sử dụng chuỗi thô `register_...` hoặc sự kiện JSON cũ để đòi quyền ưu đãi. | Nhánh xác minh tiền tố đã bị gỡ bỏ; bắt buộc kiểm tra NIP-78 kind 30078 với thẻ `d`, `v=1`, `x`. | **Bị từ chối (Invalid):** Trả về lỗi rõ ràng yêu cầu chủ nhà ký lại bằng định dạng mới. |

## Giới hạn còn lại (Known Residual Limitations)

Cần nêu rõ ba giới hạn cố hữu còn tồn tại:
1. **Sao chép nguyên văn:** Mặc dù kẻ sao chép không thể đổi địa chỉ nhận tiền để cướp doanh thu, chúng vẫn có thể làm loãng kết quả tìm kiếm trên relay nếu relay không có cơ chế dedup theo `d` tag.
2. **Listing giả hoàn toàn mới:** Chữ ký số chỉ chứng minh tính toàn vẹn nội dung do chủ sở hữu khóa tạo ra; nó không thể ngăn chặn một người lạ tự tạo một listing giả hoàn toàn mới bằng khóa riêng của họ. Tính xác thực thực tế của cơ sở lưu trú phụ thuộc vào danh tiếng di động (RFC-0003), đánh giá Proof-of-Stay và sự kiểm chứng thực tế.
3. **Quyền ghi danh:** Việc đưa một Host vào danh sách hưởng ưu đãi `earlyHosts` vẫn do quản trị viên (Admin) phê duyệt thông qua NIP-98 Audit Trail (RFC-0016), chưa hoàn toàn tự động hóa phi tập trung.

## Đánh đổi bảo mật / phi tập trung

- **Tin tưởng ai:**
  - Tin tưởng vào mật mã học Schnorr (secp256k1) chuẩn Nostr: Bất khả xâm phạm về mặt toán học.
  - Tin tưởng vào việc quản trị viên kiểm tra kỹ lưỡng danh tính trước khi thêm host vào danh sách ưu đãi.
- **Điều gì xảy ra nếu bên được tin tưởng hành xử xấu:**
  - Nếu admin ghi danh sai: Người được ghi danh chỉ được hưởng ưu đãi giảm phí trong tối đa 12 tháng và mọi hành động của admin đều được ghi nhận vĩnh viễn trên relay công khai qua NIP-98 event kind 27235.
  - Không ai có thể mạo danh chữ ký của bất kỳ host nào khác để trục lợi.

## Trải nghiệm người dùng và cơ chế ký lại (Re-signing UX)

- Khi chủ nhà chỉnh sửa thông tin listing (Extranet / Sửa giá), chữ ký cũ hết hiệu lực là hành vi **đúng chủ ý** (by design).
- Hệ thống cung cấp nút **"Xác thực lại listing"** trong `ListingDetail` (khi host đang xem) và `HostDashboard` (thẻ My Listings).
- Dòng nhắc cảnh báo chỉ hiển thị cho chủ nhà khi chữ ký bị lệch hoặc ở định dạng cũ. Khách đặt phòng không thấy huy hiệu này, và listing chưa có chữ ký hợp lệ sẽ không được áp dụng mức phí ưu đãi.
- Nếu host từ chối ký qua tiện ích NIP-07, giao diện hiển thị thông báo rõ ràng và tuyệt đối không làm mất hay xóa listing của người dùng.

## Maturity tier đề xuất sau khi triển khai

**Beta** (Đã triển khai hoàn chỉnh mã nguồn, đã có bộ kiểm thử 26 test cases xác thực toàn diện, chờ quản trị viên phê duyệt để kích hoạt ghi danh chủ nhà thực tế).

## Thảo luận

*(Chờ phản hồi và phê duyệt chính thức từ Chủ dự án).*
