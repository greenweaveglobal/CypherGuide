# RFC-0003: Identity & Portable Reputation

- **Trạng thái:** Draft — chỉ các **nguyên tắc cốt lõi** bên dưới được coi là gần như
  cố định ngay từ Draft này; mọi chi tiết schema khác (tag cụ thể, con số kind, công
  thức điểm) vẫn mở, chỉ "đóng băng"/Stable sau khi qua đủ các bước ở mục Lộ trình.
- **Module liên quan:** `src/utils/proofOfStay.ts`, `src/utils/insuranceFund.ts`
  (`computeReputationFromProofs`), và mọi ứng dụng tương lai (Learn/Build/Connect)
  sẽ đọc cùng dữ liệu này.

## Vấn đề

Cypher Guide không chỉ là một ứng dụng đặt phòng — nếu hệ sinh thái Learn/Build/
Stay/Connect thành hình, tất cả phải cùng đọc một lớp Identity + Reputation. Hiện
tại `proofOfStay.ts` định nghĩa một kind Nostr (30388) và bộ tag chỉ dành riêng cho
"đã lưu trú". Nếu Build/Learn/Connect sau này mỗi cái tự phát minh kind/tag riêng,
không app nào đọc được uy tín của app khác — quay lại đúng vấn đề "khóa người dùng
vào một sản phẩm" mà giao thức này đang cố tránh.

## Nguyên tắc cốt lõi (mục tiêu đóng băng sớm, không chờ đủ 4 bước)

Đây là phần **duy nhất** RFC này muốn đạt đồng thuận sớm — vì đây là cam kết với
người dùng, không phải chi tiết kỹ thuật có thể sửa sau:

1. **Danh tính thuộc về người dùng** — npub/nsec Nostr, không có tài khoản trung tâm.
2. **Uy tín là portable** — bất kỳ ứng dụng nào tuân theo schema này đều đọc được,
   không khóa vào riêng Cypher Guide.
3. **Uy tín không chuyển nhượng** — gắn chết với chữ ký của npub, không mua/bán/tặng
   được (khác hẳn NFT hay token điểm thưởng).
4. **Schema có version** — mọi proof event mang tag phiên bản, để thêm trường mới
   không phá dữ liệu cũ.
5. **Mỗi ứng dụng tự diễn giải** — không có một "điểm uy tín tổng" duy nhất do
   protocol quyết định; protocol chỉ phát ra tín hiệu thô, từng app tự tính theo nhu
   cầu của mình (xem Reputation Engine).
6. **Interpretation belongs to the application, not the protocol** — protocol chỉ
   nói "đây là một `proof_type=stay`", không nói "cộng 10 điểm" / "giảm 5% phí" /
   "được vay 100 sats". Ý nghĩa kinh tế/xã hội của một proof là việc của Stay, của
   Connect, của Learn — mỗi nơi diễn giải khác nhau cũng không sao. Nhờ vậy protocol
   không phải sửa chỉ vì một app đổi business logic.
7. **Tiến hóa bằng cách thêm, không thay thế (evolve by addition, not replacement)**
   — thêm tag mới thay vì đổi nghĩa tag cũ; thêm `v=2` khi cần mở rộng thay vì phá
   `v=1`; giữ khả năng đọc dữ liệu cũ càng lâu càng tốt. Đây là nguyên tắc đã được áp
   dụng ngay từ bản triển khai đầu tiên (badge thiếu `proof_type` mặc định là `"stay"`
   thay vì bị coi là không hợp lệ) — không phải lý thuyết suông.

## Thiết kế (Draft — còn thay đổi được)

### 1. Identity
- npub làm định danh chính, xác thực qua chữ ký Schnorr chuẩn NIP-01 (đã có, Stable).
- Profile (tên, avatar...) là optional, không bắt buộc để có uy tín.

### 2. Proof Objects — tổng quát hóa từ `kind` riêng sang `proof_type` chung

Thay vì mỗi tính năng một kind Nostr riêng, dùng **một kind chung** cho mọi "bằng
chứng đóng góp portable", phân biệt nhau bằng tag `proof_type`:

```
kind: 30388   (tạm giữ nguyên số hiện tại — CHƯA đóng băng, xem mục Lộ trình)
tags:
  ["d", "<id_duy_nhất_của_hành_động>_<npub_rút_gọn>"]
  ["proof_type", "stay" | "build" | "learn" | "connect" | ...]
  ["v", "1"]                      // version schema, bắt buộc từ bản này trở đi
  ["subject_npub", "<npub>"]      // ai được ghi nhận (thường = pubkey ký, nhưng
                                   // tách riêng để hỗ trợ trường hợp bên thứ ba
                                   // xác nhận hộ, ví dụ host xác nhận cho khách)
  ...tags riêng theo proof_type (Stay: listing/role/start/end/amount_sats — giữ
  nguyên như đã triển khai; Build: repo/pr_id; Learn: guide_id; Connect: —)
content: mô tả người-đọc-được, không bắt buộc máy đọc phải parse content
```

Lợi ích trực tiếp: sau này thêm `proof_type: "build"` hay `"learn"`, mọi code đọc
chung một kind vẫn hoạt động — không cần app khác biết trước danh sách proof_type.
Không dừng ở 4 loại ban đầu: `mentor`, `speaker`, `organizer`, `contributor`,
`reviewer`, `merchant`... đều dùng được cùng schema này mà không cần kind mới, miễn
tuân theo 7 nguyên tắc cốt lõi ở trên — đây chính là dấu hiệu schema đủ tổng quát.

### 3. Reputation Engine — nguồn tín hiệu thô, không phải điểm số tuyệt đối

Protocol chỉ đảm bảo: đọc được danh sách proof event thật, đã verify chữ ký, theo
từng `proof_type`. **Không** có một hàm `computeReputationScore()` duy nhất áp cho
mọi ứng dụng. Mỗi app tự quyết định trọng số:

- Stay quan tâm: đếm/suy giảm theo thời gian trên `proof_type=stay` (đã có, xem
  `computeReputationFromProofs` — cần sửa để lọc đúng `proof_type=stay`, hiện đang
  đếm mọi proof bất kể loại vì trước đây chỉ có một loại).
- Build (tương lai) quan tâm: đếm `proof_type=build` với tag `pr_status=merged`.
- Learn (tương lai) quan tâm: đếm `proof_type=learn`.

## Lộ trình trưởng thành (Draft → 2 app → cộng đồng → Stable → Frozen)

1. **RFC-0003 Draft** (văn bản này) — thống nhất 7 nguyên tắc cốt lõi + schema nháp.
2. **Triển khai trong Stay** — cập nhật `proofOfStay.ts` để phát `proof_type: "stay"`
   + tag `v` (đã triển khai cùng RFC này).
3. **Ít nhất một ứng dụng khác cùng đọc** — Learn hoặc Connect thật sự parse được
   proof event của Stay và ngược lại (chưa xảy ra — điều kiện để qua bước tiếp).
4. **Cộng đồng thật sự dùng** — không chỉ 2 app nội bộ đọc được nhau, mà người dùng
   ngoài dự án cũng tạo/đọc proof event theo schema này.
5. **Stable, rồi Frozen** — sau khi bước 3-4 chứng minh schema đủ dùng ở quy mô thật,
   mới khóa `kind` số cụ thể và các tag bắt buộc; version bump sau đó phải qua RFC
   riêng, và chỉ được thêm (nguyên tắc 7), không được đổi nghĩa tag đã Frozen.

## Đánh đổi bảo mật / phi tập trung

Không có registry trung tâm nào xác nhận `proof_type` nào "hợp lệ" — bất kỳ ứng dụng
nào cũng có thể tự phát minh một `proof_type` mới mà không cần xin phép, đúng tinh
thần permissionless. Rủi ro: hai dự án độc lập có thể chọn trùng tên `proof_type`
với ngữ nghĩa khác nhau (ví dụ hai app khác nhau cùng dùng `"build"` cho hai nghĩa
khác hẳn). Giảm thiểu bằng một file liệt kê không-bắt-buộc (`RFC/proof-types.md`,
tạo khi có proof_type thứ hai thật) — mang tính tham khảo, không phải cơ chế ép buộc,
đúng bản chất "mỗi ứng dụng tự diễn giải" ở nguyên tắc số 5.

## Protocol Guarantees

Đây là những cam kết cụ thể giao thức hứa với **mọi** ứng dụng đọc schema này — khác
với 7 nguyên tắc ở trên (vốn là triết lý thiết kế), đây là điều một ứng dụng có thể
*dựa vào* khi lập trình, và là điều RFC tương lai phải nêu lý do rõ ràng nếu muốn phá:

1. **Backward Compatibility** — proof hợp lệ của phiên bản cũ tiếp tục đọc được ở
   phiên bản mới, trừ khi một RFC sau tuyên bố rõ lý do không thể duy trì nữa.
2. **Application Neutrality** — protocol không ưu tiên Stay hơn Learn hay Build; mọi
   ứng dụng dùng chung một lớp dữ liệu, không có "app chính" và "app phụ".
3. **User Ownership** — danh tính và proof gắn với khóa Nostr của người dùng, không
   gắn với máy chủ hay tài khoản của Cypher Guide.
4. **Extensibility** — loại proof mới được thêm bằng mở rộng schema (tag mới,
   `proof_type` mới, `v` mới), không thay đổi ý nghĩa dữ liệu đã tồn tại.

## Bối cảnh kiến trúc: vì sao RFC này là Layer 2

```
Layer 3 — Applications      Stay · Learn · Build · Connect
Layer 2 — Protocol          RFC-0003: Identity · Proof · Reputation
Layer 1 — Infrastructure    Nostr · Lightning · Cashu
```

RFC-0003 định nghĩa đúng Layer 2 — lớp duy nhất mọi ứng dụng ở Layer 3 phải đồng ý
với nhau. Layer 3 đổi framework (React → Flutter), đổi UI, tách thành app di động
riêng — Layer 2 không cần đổi theo, miễn Protocol Guarantees ở trên còn được giữ.
Đây cũng là lý do RFC này, không phải bất kỳ file code nào, nên được coi là tài liệu
quan trọng nhất của dự án một khi có từ 2 ứng dụng trở lên cùng dựa vào nó: code
refactor được, đổi framework được, nhưng phá vỡ cam kết ở Layer 2 là phá vỡ khả năng
tương thích của toàn bộ hệ sinh thái, không chỉ một ứng dụng.

## Maturity tier

Toàn bộ RFC này: **Experimental** cho tới hết bước 4 của Lộ trình (cộng đồng thật sự
dùng). Không gắn Stable cho bất kỳ phần nào trước khi có ứng dụng thứ hai và người
dùng ngoài dự án cùng đọc chung schema.

## Thảo luận

(Mở.)
