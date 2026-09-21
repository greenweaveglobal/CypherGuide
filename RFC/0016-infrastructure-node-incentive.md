# RFC-0016: Infrastructure Node Incentive (Proof-of-Relay + Lightning Payout Flow)

- **Trạng thái:** Draft
- **Tác giả:** (điền npub/tên)
- **Ngày:** 2026-09-21
- **Module liên quan:** `src/utils/infraContribution.ts`, `src/store/useAppStore.ts`, `src/components/MeshNeighborhood.tsx`

## Vấn đề

Tính năng "Infrastructure Node Incentives Program" hiện tại (`claimNodeIncentive`) là mô phỏng thuần túy:

- Danh sách node (`nodeIncentives`) là dữ liệu hardcode trong store, không nối với danh sách relay thật (`relays`) mà người vận hành tự thêm vào Mesh tab.
- Uptime/packets routed là số cố định, không đo từ hoạt động thật.
- `claimNodeIncentive()` tạo `mockTxHash` giả, không gọi Lightning invoice/NWC/LNURL nào — luôn `success: true`.

Điều này đủ cho mục đích demo/pitch, nhưng không dùng được cho hạ tầng relay/mesh thật (ví dụ `relay.cypherguide.org`) mà một người vận hành độc lập vừa dựng lên. Cần một cơ chế thật giải quyết 2 bài toán tách biệt:

1. **Bài toán Oracle (đo lường chống gian lận):** làm sao biết một node *thật sự* online/route traffic mà không cần tin tưởng chính node đó tự báo cáo số liệu — vì node operator có động cơ khai khống để nhận thưởng nhiều hơn.
2. **Bài toán dòng chảy thanh khoản LN (payout thật):** tiền Sats trả thưởng lấy từ đâu, trả qua kênh nào, xử lý ra sao khi quỹ không đủ hoặc thanh toán thất bại.

## Các phương án đã cân nhắc

### Phương án A: Self-reported metrics (hiện trạng)
- Ưu điểm: đơn giản, không cần hạ tầng phụ, dễ demo.
- Nhược điểm: hoàn toàn không chống gian lận — node operator tự khai số liệu tùy ý. Không thể dùng trong production.

### Phương án B: Proof-of-Work kiểu Bitcoin mining
Cân nhắc vì người dùng hỏi liệu có nên áp dụng mô hình đào Bitcoin/Sats.
- Ưu điểm: cơ chế đã được kiểm chứng, chống Sybil tốt qua chi phí điện toán.
- Nhược điểm: **sai bản chất bài toán.** PoW thưởng cho việc đốt điện toán vô nghĩa (giải hash ngẫu nhiên) để bảo vệ 1 sổ cái toàn cục dùng chung — hoàn toàn không xác minh việc node có *thực sự relay tin nhắn* hay giữ uptime thật hay không. Một node có thể "đào" rất mạnh nhưng chưa từng route nổi 1 gói tin nào. Áp PoW vào đây = thưởng nhầm hành vi (đốt điện) thay vì hành vi cần khuyến khích (phục vụ mạng lưới). Loại bỏ.

### Phương án C: Witness Network / Proof-of-Coverage (kiểu Helium)
- Cơ chế: các node khác trong mạng (hoặc một tập "witness" độc lập) định kỳ gửi challenge ngẫu nhiên (nonce) tới node cần xác minh, đo thời gian phản hồi, rồi ký attestation. Cần quorum (nhiều witness độc lập) đồng thuận mới tính là hợp lệ, tránh 1 witness đơn lẻ thông đồng.
- Ưu điểm: mô hình đã chứng minh hiệu quả ở quy mô lớn (Helium), phù hợp bản chất "chứng minh dịch vụ hạ tầng thật" hơn PoW.
- Nhược điểm: cần một tập witness đủ lớn, đủ độc lập — với mạng lưới nhỏ (giai đoạn đầu CypherGuide) rất dễ bị thông đồng giữa vài node ít ỏi (collusion risk cao khi N nhỏ).

### Phương án D: Crowdsourced Client Attestation (Proof-of-Usage)
- Cơ chế: chính client app của người dùng thật (khi họ dùng CypherGuide, book phòng, nhắn tin...) ghi lại ẩn danh: đã kết nối relay nào, latency bao nhiêu, thành công hay lỗi — gửi báo cáo tổng hợp định kỳ (không cần tin tưởng riêng lẻ, dùng số đông để lọc nhiễu).
- Ưu điểm: khó gian lận hơn self-report vì đến từ nhiều client độc lập không do node operator kiểm soát; đo đúng thứ cần đo (relay có thực sự hữu ích cho người dùng thật hay không, chứ không chỉ "còn sống").
- Nhược điểm: giai đoạn đầu ít user thật → dữ liệu thưa, dễ nhiễu; cần cơ chế chống 1 người tự tạo nhiều client giả (Sybil ở phía client).

## Đề xuất

Kết hợp **C + D** theo từng giai đoạn, không chọn 1 mô hình cố định ngay từ đầu:

- **Giai đoạn Experimental (mạng nhỏ):** dùng D (Proof-of-Usage) làm nguồn chính — vì witness network (C) chưa đủ lớn để chống collusion. Client app ghi nhận tương tác thật với relay, gửi báo cáo ký bằng khóa Nostr của user (chống giả mạo nguồn), tổng hợp theo cửa sổ thời gian (vd 24h).
- **Khi mạng đủ lớn (>N node độc lập đã verify):** bật thêm C (witness challenge) làm lớp xác minh chéo, giảm phụ thuộc hoàn toàn vào D.
- Loại hẳn phương án B (PoW) — sai bản chất như phân tích ở trên; nếu muốn dùng khái niệm "mining" chỉ nên dùng như phép ẩn dụ marketing, không nên là cơ chế kỹ thuật thật.
- Công thức thưởng giữ tinh thần hiện tại (`baseRate theo message routed + bandwidth + uptime bonus`) nhưng input phải đến từ D/C thay vì số hardcode.

### Dòng chảy thanh toán Lightning (payout thật)

Đây là câu hỏi thứ 2 của bạn — **không phải "đào ra Sats mới"** như Bitcoin mining (Bitcoin tạo cung mới qua block reward). Ở đây Sats thưởng phải đến từ **một quỹ có sẵn (treasury)**, tức là bài toán *phân phối lại* dòng tiền đã tồn tại, không phải tạo ra tiền mới:

- **Nguồn quỹ:** trích % phí giao dịch booking (liên hệ RFC-0002 Dynamic Fee Curve đã có) vào 1 treasury Lightning address/node riêng cho infra rewards — không dùng chung ví dev-donation hiện tại.
- **Cơ chế trả:** khi claim hợp lệ (đủ điều kiện theo C/D ở trên) → gọi LNURL-pay hoặc NWC `pay_invoice` thật tới `nodeOperatorLnAddress`, có retry/backoff khi invoice fail hoặc hết hạn.
- **Circuit breaker bắt buộc:** nếu số dư treasury dưới ngưỡng an toàn → khóa nút Claim, hiển thị trạng thái "quỹ tạm hết", KHÔNG được để `claimNodeIncentive` trả `success: true` giả khi thực tế chưa trả được (khác hẳn code giả lập hiện tại).
- **Batch payout** (gộp nhiều claim nhỏ trả 1 lần theo chu kỳ, vd hàng ngày) nên cân nhắc thay vì trả tức thời từng claim, để giảm phí routing LN khi mạng lưới node lớn dần.

## Đánh đổi bảo mật / phi tập trung

- **Tin ai, tin đến mức nào:** ở giai đoạn D (Proof-of-Usage), hệ thống tin vào *số đông client thật* thay vì tin node operator — nhưng vẫn cần threshold tối thiểu số client báo cáo trước khi tính thưởng, nếu không 1 client (kể cả của chính operator) tự báo cáo giả vẫn qua được.
- **Rủi ro Sybil ở witness (giai đoạn C):** nếu tập witness quá nhỏ, chính operator có thể tự dựng nhiều witness giả để tự chứng thực cho mình — cần yêu cầu witness có lịch sử/reputation tối thiểu (liên hệ RFC-0003 Identity Portable Reputation) trước khi được tính vào quorum.
- **Rủi ro treasury:** ai giữ khóa ví treasury quyết định trực tiếp ai được trả — cần làm rõ đây là multisig hay 1 khóa đơn, và cơ chế audit số dư/lịch sử payout công khai (có thể chính là Nostr events, nhất quán với nguyên tắc "no centralized storage" của protocol).

## Maturity tier đề xuất sau khi triển khai

Experimental — cần thử nghiệm với mạng lưới node thật quy mô nhỏ trước khi tính Beta, đặc biệt phải kiểm chứng khả năng chống gian lận của D trước khi mở rộng.

## Thảo luận

(Để trống khi mới tạo — cập nhật khi có phản hồi từ cộng đồng.)
