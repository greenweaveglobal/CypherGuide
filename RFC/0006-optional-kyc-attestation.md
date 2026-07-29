# RFC-0006: Lớp KYC Tùy Chọn (Optional Attestation Layer)

- **Trạng thái:** Draft
- **Related modules:** `src/utils/proofOfStay.ts` (mở rộng khái niệm `proof_type`),
  RFC-0003 (Identity & Portable Reputation) là nền tảng bắt buộc phải đọc trước.

> **Lưu ý:** RFC này chỉ giải quyết phần **kiến trúc kỹ thuật** — làm sao thêm một lớp
> tuân thủ tùy chọn mà không phá vỡ phần còn lại của giao thức. Việc chọn đúng chuẩn
> pháp lý nào (FATF Travel Rule, luật VASP một quốc gia cụ thể...) nằm ngoài phạm vi
> một mô hình ngôn ngữ có thể quyết định — cần tư vấn pháp lý thật tại từng khu vực
> trước khi một verifier thật vận hành theo RFC này.

## Vấn đề

Khi luật định danh tài sản ảo/AML siết chặt, một số ứng dụng/host cụ thể (không phải
toàn bộ giao thức) sẽ cần cách chứng minh một npub đã qua KYC theo một chuẩn nào đó —
ví dụ để cho phép rút số tiền lớn, hoặc để lên sàn tuân thủ. Nhưng danh tính gốc (npub)
của Cypher Guide phải **luôn giữ ẩn danh theo mặc định** (Protocol Guarantee "User
Ownership" trong RFC-0003) — không được đặt KYC vào Layer 2 vì sẽ ép buộc mọi ứng dụng
tương lai (Learn/Build/Connect) phải theo, kể cả những nơi không cần.

## Các phương án đã cân nhắc

### Phương án A: Gắn KYC thẳng vào Identity ở Layer 2
- Ưu điểm: đơn giản, một lần xác thực dùng cho mọi nơi.
- Nhược điểm: **loại bỏ ngay** — phá trực tiếp 2 Protocol Guarantee của RFC-0003 (User
  Ownership, Application Neutrality). Một app không cần tuân thủ ở nơi khác cũng bị kéo
  theo gánh nặng này.

### Phương án B: `proof_type` mới — "kyc_attestation" (ĐỀ XUẤT)
Một Nostr event thật, cùng `kind` portable như Proof-of-Stay (RFC-0003), tag
`proof_type: "kyc_attestation"`, ký bởi một **verifier tùy chọn** (một VASP/tổ chức tuân
thủ luật, tự nguyện tham gia làm bên xác thực) — nội dung xác nhận "npub này đã qua KYC
theo chuẩn X", không tiết lộ giấy tờ/danh tính thật trong chính event đó.
- Ưu điểm: portable (đọc được ở mọi app theo RFC-0003), verify được bằng chữ ký thật,
  hoàn toàn opt-in — ai không cần thì lờ đi, ai cần (ví dụ khi rút tiền lớn) thì kiểm tra
  badge trước khi cho qua. Đúng nguyên tắc "mỗi ứng dụng tự diễn giải" đã có sẵn.
- Nhược điểm: verifier biết danh tính thật đằng sau npub — một điểm tin cậy tập trung
  cho riêng loại proof này (chấp nhận được vì opt-in, không ảnh hưởng ai không dùng).

### Phương án C: KYC ở tầng on/off-ramp (sàn giao dịch), không đụng gì tới giao thức
- Ưu điểm: giao thức hoàn toàn sạch, không phải sửa gì cả — sàn tự lo KYC theo luật của
  họ khi người dùng đổi sats ra VNĐ.
- Nhược điểm: không giải quyết được trường hợp một app/host cụ thể (không phải sàn)
  muốn biết trước npub đã qua KYC hay chưa, ví dụ trước khi nhận booking giá trị lớn.

## Đề xuất

**Phương án B**, xem như phần mở rộng của Phương án C chứ không thay thế nó — hầu hết
người dùng sẽ chạm Phương án C (KYC ở sàn) trước, Phương án B chỉ cần khi một app cụ thể
muốn kiểm tra badge mà không phụ thuộc vào sàn nào.

### Thiết kế

```
kind: 30388 (dùng chung với Proof-of-Stay, theo đúng nguyên tắc "1 kind, nhiều proof_type")
tags:
  ["d", "kyc_<id_duy_nhất>_<npub_rút_gọn>"]
  ["proof_type", "kyc_attestation"]
  ["v", "1"]
  ["subject_npub", "<npub được xác thực>"]
  ["verifier_standard", "<tên chuẩn, vd: FATF-TravelRule-2019>"]
  ["issued_at", "<unix_seconds>"]
  ["expires_at", "<unix_seconds, optional>"]   // attestation nên có hạn, không vĩnh viễn
  ["revocation_endpoint", "<optional, nơi kiểm tra thu hồi>"]
content: mô tả người-đọc-được, KHÔNG chứa giấy tờ/thông tin định danh thật
pubkey: khóa của VERIFIER (không phải của người được xác thực) — event do verifier ký
```

Verifier ký, không phải người dùng tự ký — vì đây là bên thứ ba xác nhận, khác hẳn
Proof-of-Stay (người dùng tự ký cho chính mình). App nào cần kiểm tra: đọc event có
`proof_type=kyc_attestation`, `subject_npub` khớp, `pubkey` (verifier) nằm trong danh
sách verifier họ tin tưởng, và `expires_at` chưa qua hạn.

### Danh sách verifier tin tưởng — do từng host tự khai báo, không có registry trung tâm

Không có danh sách verifier "được duyệt" nào của Cypher Guide. Mỗi listing tự khai báo
verifier họ chấp nhận:

- Trường mới trên `Listing`: `acceptedKycVerifiers: string[]` — mảng npub do host tự
  nhập tay (không phải chọn từ dropdown/danh sách gợi ý), validate bằng đúng logic
  bech32 checksum đã có sẵn trong `crypto.ts` (tái dùng, không viết hàm mới).
- Host có thể khai nhiều verifier cùng lúc (khách có attestation từ 1-trong-N là đủ) —
  vì các host khác nhau, hoặc cùng một host tại các thời điểm khác nhau, có thể tin
  các verifier khác nhau.
- App phía khách kiểm tra: `event.pubkey` (verifier đã ký attestation) có nằm trong
  `listing.acceptedKycVerifiers` của listing đang đặt hay không — chữ ký hợp lệ về mặt
  mật mã nhưng verifier không nằm trong danh sách của listing đó thì **không tính**.
- Ngưỡng áp dụng (`amount_sats` tối thiểu cần attestation) cũng là tham số riêng của
  từng listing, không phải cấu hình toàn giao thức.

Điều này áp đúng nguyên tắc "mỗi ứng dụng tự diễn giải" (RFC-0003) xuống tới tận cấp
**từng host**, không chỉ từng app — giống cách trình duyệt tự duy trì danh sách CA tin
cậy cho HTTPS, ở đây mỗi host tự duy trì danh sách verifier của riêng họ.

### Vì sao cần trường thu hồi/hết hạn

Khác với Proof-of-Stay (badge quá khứ, không cần thu hồi), một attestation KYC có thể
cần vô hiệu nếu giấy tờ hết hạn hoặc verifier phát hiện gian lận sau này — đây là lý do
Phương án B có thêm `expires_at`/`revocation_endpoint` mà Proof-of-Stay không cần.

## Đánh đổi bảo mật / phi tập trung

- **Không có registry trung tâm nào quyết định verifier nào "hợp lệ"** — đúng tinh thần
  permissionless. Cụ thể hóa ở mục Thiết kế: mỗi **host** (không phải mỗi app) tự khai
  báo danh sách verifier họ tin (`listing.acceptedKycVerifiers`, tự nhập tay, không có
  gợi ý/duyệt trước) — giống cách trình duyệt tự duy trì danh sách CA tin cậy cho HTTPS.
- **Verifier là điểm tập trung thật** cho riêng dữ liệu KYC — chấp nhận được vì đây là
  lớp hoàn toàn tùy chọn, tách biệt khỏi Layer 2 lõi; ai không tương tác với verifier nào
  thì không bị ảnh hưởng, danh tính gốc vẫn ẩn danh như cũ.
- **Không được để attestation này trở thành yêu cầu bắt buộc ở Layer 2** dưới bất kỳ hình
  thức nào trong tương lai — nếu có RFC sau muốn làm vậy, đó là thay đổi phá vỡ
  Protocol Guarantee "User Ownership", cần quy trình đồng thuận nghiêm ngặt hơn nhiều
  so với một RFC thường.

## Maturity tier đề xuất

**Experimental** — chưa có verifier thật nào triển khai, cần ít nhất một tổ chức thật
thí điểm trước khi bàn tới Beta/Stable.

## Thảo luận

(Mở — đặc biệt cần ý kiến từ người có chuyên môn pháp lý thật về việc chuẩn nào nên
tham chiếu ở tag `verifier_standard`, RFC này không tự quyết định thay được.)
