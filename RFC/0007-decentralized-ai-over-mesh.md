# RFC-0007: Mô Thức AI Phi Tập Trung (Decentralized AI over Mesh)

- **Trạng thái:** Draft — RFC này mang tính **tầm nhìn dài hạn (visionary)**, không phải
  đặc tả triển khai ngay. Tách riêng khỏi RFC-0005 (Trợ Lý Tra Cứu — bản triển khai cụ
  thể, đang chạy thật với server proxy) vì đây là một **mô thức khác hẳn về nguyên tắc
  bảo mật cốt lõi** (loại bỏ hẳn nhu cầu backend, không phải chấp nhận ngoại lệ có ý
  thức như RFC-0005 đang làm) — không phải bản vá nhỏ cho RFC-0005.
- **Related modules:** `src/components/DocsAssistant.tsx`, `server.ts`/`api/` (RFC-0005,
  đối tượng sẽ được RFC này dần thay thế nếu khả thi), `src/utils/proofOfStay.ts`
  (RFC-0003, nền tảng tag/kind dùng chung).

## Vấn đề

RFC-0005 giải quyết được bài toán "trợ lý tra cứu tài liệu", nhưng tự thân nó thừa nhận
một đánh đổi chưa giải quyết: cần một server proxy nhỏ để giấu API key Gemini — một
**ngoại lệ có ý thức** đối với nguyên tắc "không backend" xuyên suốt toàn dự án. RFC này
đặt câu hỏi xa hơn: liệu có thể xây một mô thức AI mà **không cần ngoại lệ đó nữa**,
đồng thời tận dụng đúng hạ tầng mesh (LoRa/relay) đã có sẵn thay vì để nó chỉ đóng vai
trò hiển thị (`MeshNeighborhood.tsx` hiện tại là UI thuần, không có logic thật)?

Đây không phải nhu cầu cấp bách — RFC-0005 vẫn hoạt động tốt ở tier Experimental hiện
tại. RFC này ghi lại một hướng đi dài hạn để "thai nghén" dần, không phải để triển khai
ngay.

## Mô hình 3 lớp đề xuất

```
Lớp 1 — LoRa/Relay (Infrastructure)
  Vai trò: KHÔNG chạy suy luận AI. Chỉ lưu trữ + lan truyền dữ liệu đã gắn tag,
  dùng đúng cơ chế Nostr event/relay sẵn có (không phát minh giao thức phân tán mới).
  Ví dụ: publish nội dung RFC/tài liệu dưới dạng event với proof_type mới,
  ví dụ "doc_index" — mesh tự lan truyền như mọi event khác.

Lớp 2 — Browser Client (Retrieval)
  Vai trò: tìm đoạn tài liệu liên quan bằng tag/từ khóa (lexical search) NGAY
  trên thiết bị người dùng — không cần AI, không cần gọi ra ngoài cho bước này.
  Thay thế cách làm hiện tại của RFC-0005 (nhét toàn bộ tài liệu vào mỗi request,
  đã được Copilot cảnh báo rủi ro vượt giới hạn token) bằng việc chỉ gửi đúng
  phần liên quan sang Lớp 3.

Lớp 3 — API (Diễn đạt tự nhiên, chỉ khi cần)
  Vai trò: người dùng TỰ cắm API key riêng của họ (nhập vào ô, lưu local trên
  máy họ, gọi thẳng từ client) — không phải key chung của dự án giữ trên server.
  Loại bỏ hoàn toàn nhu cầu server proxy của RFC-0005.
```

## Các phương án đã cân nhắc

### Phương án A: Giữ nguyên RFC-0005 (server proxy giữ key chung)
- Ưu điểm: đã chạy thật, trải nghiệm liền mạch — người dùng không cần tự có API key.
- Nhược điểm: vẫn còn "ngoại lệ có ý thức" — một backend nhỏ, dù tách biệt Layer 2,
  vẫn là điểm tập trung duy nhất (nếu proxy đó sập, tính năng chết theo, đúng bài học
  từ vụ AI Studio sập server vừa trải qua).

### Phương án B: Mô hình 3 lớp trên, API key do người dùng tự cắm (ĐỀ XUẤT DÀI HẠN)
- Ưu điểm: loại bỏ hoàn toàn nhu cầu backend cho tính năng này — đúng tuyệt đối nguyên
  tắc cốt lõi của cả giao thức. Retrieval ở Lớp 2 còn giảm token/chi phí, tăng độ chính
  xác (không pha loãng ngữ cảnh bằng tài liệu không liên quan).
- Nhược điểm: mất trải nghiệm "dùng ngay không cần cài gì" — rào cản cho người dùng phổ
  thông không có/không biết cách lấy API key riêng. Cần cân nhắc UX kỹ trước khi coi đây
  là thay thế hoàn toàn cho RFC-0005, không chỉ bổ sung.

### Phương án C: Chạy mô hình ngôn ngữ nhỏ ngay trên từng node LoRa/relay
- Ưu điểm: "phi tập trung" theo đúng nghĩa đen nhất — suy luận diễn ra tại chính hạ tầng
  mesh, không chỉ lưu trữ.
- Nhược điểm: **chưa khả thi với hạ tầng LoRa/relay hiện tại** — các thiết bị này thường
  có tài nguyên rất hạn chế (điện năng thấp, CPU/RAM nhỏ), không đủ chạy một mô hình
  ngôn ngữ có ích thực sự. Đây là hướng "mơ xa" cần công nghệ phần cứng/mô hình nhỏ gọn
  hơn nhiều so với hiện tại mới khả thi — ghi nhận như một hướng tương lai xa, không đưa
  vào đề xuất chính của RFC này.

## Đề xuất

Ghi nhận **Phương án B** như hướng dài hạn để tiếp tục "thai nghén" — không thay thế
RFC-0005 ngay lập tức. Lộ trình gợi ý:

1. Giữ RFC-0005 (Phương án A) làm bản chạy thật hiện tại, không vội gỡ bỏ.
2. Thử nghiệm Lớp 2 (retrieval lexical phía client) như một cải tiến độc lập cho chính
   RFC-0005 trước — giảm được rủi ro token limit mà không cần đổi mô hình key.
3. Thử nghiệm Lớp 3 (tự cắm API key) như một **chế độ tùy chọn song song** với server
   proxy — người dùng chọn "dùng key chung của dự án" (qua proxy, tiện) hoặc "dùng key
   riêng của tôi" (không qua proxy, không backend) — không ép buộc một trong hai.
4. Lớp 1 (mesh thật sự chứa dữ liệu tag hóa) là hướng xa nhất, phụ thuộc vào việc
   `MeshNeighborhood.tsx` có logic relay thật (hiện tại chỉ là UI hiển thị).

## Đánh đổi bảo mật / phi tập trung

- **Chế độ "tự cắm API key" đặt toàn bộ trách nhiệm bảo mật key vào tay người dùng** —
  nếu họ dán key vào một trình duyệt không an toàn, rủi ro là của họ, không phải của dự
  án — cần ghi rõ cảnh báo UI khi họ chọn chế độ này, tương tự cảnh báo đã có ở NWC.
- **Retrieval lexical phía client (Lớp 2) không có rủi ro bảo mật mới** — chỉ là tìm
  kiếm cục bộ, không gửi gì ra ngoài cho tới bước gọi API.
- **Không được âm thầm loại bỏ RFC-0005** trước khi Phương án B chứng minh được UX chấp
  nhận được ở quy mô thật — hai RFC nên tồn tại song song một thời gian, đúng nguyên tắc
  "evolve by addition" đã áp dụng xuyên suốt dự án.

## Maturity tier đề xuất

**Experimental** — đây là RFC tầm nhìn, chưa có dòng code nào triển khai. Không nâng
tier cho tới khi ít nhất Lớp 2 (retrieval phía client) được thử nghiệm thật trên
RFC-0005 hiện có.

## Thảo luận

(Mở — đây là RFC dài hơi, dự kiến sẽ được bổ sung/tinh chỉnh qua nhiều vòng thay vì
chốt nhanh như các RFC triển khai cụ thể khác.)
