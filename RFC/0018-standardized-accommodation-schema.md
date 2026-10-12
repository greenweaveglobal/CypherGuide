# RFC-0018: Chuẩn Hóa Lược Đồ Listing & Siêu Dữ Liệu Bảo Vệ Quyền Riêng Tư (Standardized Accommodation Schema & Privacy-Preserving Listing Metadata)

- **Trạng thái**: Draft
- **Tác giả**: Chủ dự án + AI hỗ trợ soạn thảo, cần cộng đồng bổ sung
- **Ngày tạo**: 2026-10-08
- **Cập nhật**: 2026-10 (chủ dự án đã duyệt bảng mốc hủy ở mục 2)
- **Kế thừa & Tuân thủ**: [RFC-0003](./0003-identity-portable-reputation.md), [RFC-0008](./0008-dana-based-stay.md), [RFC-0011](./0011-financialization-boundary-principle.md), [RFC-0012](./0012-sovereignty-boundary-principle.md), [RFC-0013](./0013-agent-ready-stay.md)

---

## 1. Tóm tắt (Summary)

RFC này chuẩn hóa lược đồ dữ liệu chỗ ở (Accommodation Listing Schema) trên CypherGuide, tham chiếu tính rõ ràng và trực quan của các nền tảng đặt phòng hiện đại (Booking.com, Airbnb) nhưng kiên định giữ vững các đặc tính cốt lõi của CypherGuide: **phi lưu ký (non-custodial), không KYC bắt buộc, thanh toán Bitcoin Lightning/Ecash, và bảo vệ quyền riêng tư tuyệt đối**.

Đặc tả này giải quyết 4 khoảng trống lớn của thẻ phòng trước đây:
1. **Thiếu thông tin vật lý cốt lõi**: Khách không biết loại giường, diện tích, giờ nhận/trả phòng, và số khách tối đa hiển thị rõ ràng.
2. **Không rõ ràng về chính sách hủy**: Chuẩn hóa 4 tên mức hủy phòng (`flexible`, `moderate`, `strict`, `nonrefundable`).
3. **Vị trí lộ lọt quyền riêng tư**: Nghiêm cấm đưa địa chỉ chi tiết/tọa độ chính xác lên Nostr công khai; chỉ cho phép định vị thô cấp khu vực (Thành phố, Quận/Huyện).
4. **Minh bạch tài chính trước khi bấm Đặt phòng**: Thẻ phải thể hiện rõ giá gốc một đêm, tỷ lệ cọc hoàn lại 10%, và phí giao thức hiện hành.

---

## 2. Bốn Mức Chính Sách Hủy Phòng (Cancellation Policies)

Chủ dự án đã chốt **4 tên mức** chính sách hủy phòng chuẩn hóa:
- `flexible` (Linh hoạt)
- `moderate` (Vừa phải)
- `strict` (Nghiêm ngặt)
- `nonrefundable` (Không hoàn tiền phòng)

### Mốc thời gian & tỷ lệ phạt (Đã được chủ dự án duyệt, 2026-10; hệ thống chưa tự thực thi)

Chủ dự án đã **duyệt** bảng dưới đây làm cam kết chuẩn mà chủ nhà áp dụng khi chọn mức tương ứng. Vì hệ thống **chưa tự thực thi hoàn tiền** (xem mục 6), đây là cam kết của chủ nhà đối với khách, chưa phải cơ chế tự động. Mọi thay đổi các mốc về sau cần cập nhật RFC này:

| Mức Chính Sách (`cancellationPolicy`) | Mốc Thời Gian Hủy Miễn Phí | Tỷ Lệ Hoàn Tiền Phòng Khi Hủy Đúng Hạn | Quy Tắc Khi Hủy Muộn |
| :--- | :--- | :--- | :--- |
| `flexible` (Linh hoạt) | Trước **24 giờ** so với giờ nhận phòng (`checkInTime`) | Hoàn lại **100%** tiền phòng | Tính phí 50% tiền phòng của đêm đầu tiên; hoàn lại phần còn lại |
| `moderate` (Vừa phải) | Trước **5 ngày** so với ngày nhận phòng | Hoàn lại **100%** tiền phòng | Tính phí 100% đêm đầu tiên; hoàn lại các đêm tiếp theo |
| `strict` (Nghiêm ngặt) | Trước **14 ngày** so với ngày nhận phòng | Hoàn lại **100%** tiền phòng | Không hoàn lại tiền phòng nếu hủy trong vòng 14 ngày |
| `nonrefundable` (Không hoàn tiền) | Không áp dụng hủy miễn phí | Không hoàn lại tiền phòng | Toàn bộ tiền phòng thuộc về Host sau khi xác nhận đặt |

### Nguyên Tắc Bất Di Bất Dịch Về Tiền Cọc Bảo Đảm (Security Deposit)
Trong **toàn bộ 4 mức trên**, khoản cọc hoàn lại **10%** (`REFUNDABLE_CHECKOUT_DEPOSIT_RATE`) **LUÔN ĐƯỢC HOÀN LẠI 100% CHO KHÁCH** nếu hủy phòng trước giờ nhận phòng. Tiền cọc là tài sản ký quỹ độc lập bảo vệ chống hư hại vật chất, tuyệt đối **không phải doanh thu của Host** và không bao giờ bị khấu trừ theo tỷ lệ phạt hủy phòng.

---

## 3. Nguyên Tắc Vị Trí Bảo Vệ Quyền Riêng Tư (Coarse Location Privacy Principle)

Tuân thủ nghiêm ngặt [RFC-0012 (Ranh Giới Chủ Quyền)](./0012-sovereignty-boundary-principle.md):

1. **Trên giao diện công khai và siêu dữ liệu phát tán công khai**:
   - Chỉ được ghi trường `locationLabel` ở mức khu vực địa lý thô (ví dụ: `"Đà Lạt, Lâm Đồng"`, `"Quận 1, TP. Hồ Chí Minh"`, `"Huyện Côn Đảo, Bà Rịa - Vũng Tàu"`).
   - Nếu chỗ nghỉ chưa cập nhật `locationLabel`, giao diện hiển thị `"Chưa cập nhật khu vực"`, tuyệt đối **KHÔNG** hiển thị chuỗi tọa độ `mesh:` hoặc tọa độ GPS thay thế.
   - Tuyệt đối **KHÔNG** đưa số nhà, tên ngõ/hẻm, tên tòa nhà cụ thể, hoặc tọa độ GPS chính xác (dưới bán kính 5km) vào nội dung công khai.
   - Nếu cần lưu trữ tọa độ để hỗ trợ tìm kiếm khoảng cách theo vùng, hệ thống bắt buộc làm tròn tọa độ về mức khu vực thô (tối đa 1 chữ số thập phân, bán kính bảo vệ ~11km) trước khi đưa vào bất kỳ truy vấn hay chỉ mục công khai nào.
2. **Kênh truyền địa chỉ chi tiết**:
   - Địa chỉ thực tế, mã khóa cửa (Smart lock/PIN), và hướng dẫn tìm đường chi tiết chỉ được mã hóa đầu-cuối (E2EE qua NIP-44 hoặc NIP-17; không dùng NIP-04 đã lỗi thời do rò rỉ metadata) và gửi riêng cho khách **SAU KHI** giao dịch Lightning/Ecash được xác nhận thành công.

---

## 4. Đặc Tả Lược Đồ Dữ Liệu TypeScript (Listing Schema)

```typescript
export type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'nonrefundable';

export interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  images?: Nip94Image[];
  meshCoordinates: string;
  
  // RFC-0018 Các trường mới bổ sung (Tùy chọn để tương thích ngược)
  locationLabel?: string;            // Vị trí thô (Thành phố, Quận/Huyện)
  cancellationPolicy?: CancellationPolicy; // flexible | moderate | strict | nonrefundable
  cancellationNote?: string;        // Ghi chú ngắn từ Host (tối đa 100 ký tự)
  bedType?: string;                 // Loại giường (vd: "1 Giường King", "2 Giường đơn Twin")
  areaM2?: number;                  // Diện tích phòng (m²)
  checkInTime?: string;             // Giờ nhận phòng tiêu chuẩn (vd: "14:00")
  checkOutTime?: string;            // Giờ trả phòng tiêu chuẩn (vd: "12:00")
  
  roomTypes: RoomType[];
  priceSats: number;
  priceModel?: 'fixed' | 'dana';
  priceRules?: PriceRule[];
  maxGuests?: number;
  securitySpecs: string[];
  coOwners: CoOwner[];
  acceptedKycVerifiers?: string[];
  kycThresholdSats?: number;
  status: 'available' | 'occupied';
  reviews: Review[];
  editHistory?: EditHistoryEntry[];
}
```

---

## 5. Ánh Xạ Nostr Event Tags (Thiết Kế Tương Lai)

*Lưu ý về hiện trạng mã nguồn*: Hiện tại dữ liệu Listing của CypherGuide được lưu trữ cục bộ (Zustand + IndexedDB) và nạp mẫu ban đầu từ `src/data.ts`. Các sự kiện Nostr trên mạng hiện tại chỉ triển khai cho Proof-of-Stay (Kind 30078, `src/utils/proofOfStay.ts`), KYC Attestation (Kind 30388), NIP-98 Admin Auth (Kind 27235), và Audit Trail thay đổi phí. 

Ánh xạ tag dưới đây là **thiết kế định hướng cho tương lai** khi mở rộng phát hành Listing công khai lên các Nostr Relay, chưa ấn định cứng mã kind cố định:

```json
[
  ["d", "<listing_id>"],
  ["title", "Faraday Bunker & Bitcoin Mesh Lab"],
  ["location_label", "Quận 1, TP. Hồ Chí Minh"],
  ["cancel_policy", "flexible"],
  ["bed_type", "1 Giường King"],
  ["area_m2", "45"],
  ["check_in", "14:00"],
  ["check_out", "11:00"]
]
```

---

## 6. Giới Hạn Hiện Tại & Trạng Thái Thực Thi (Implementation Limitations)

1. **Hệ thống chưa tự động thực thi hoàn tiền theo chính sách hủy**: Hiện tại luồng đặt phòng (`BookingModal.tsx`) và hợp đồng ký quỹ (`depositEscrow.ts`) không có logic tự động tính toán hoàn tiền phòng khi khách yêu cầu hủy.
2. **Cam kết của chủ nhà**: Chính sách hủy phòng hiển thị trên thẻ listing và trang chi tiết hiện tại là **cam kết của chủ nhà**, hệ thống chưa tự động thực thi hoàn tiền phòng qua Lightning/Ecash.
3. **Nhãn cảnh báo bắt buộc trên UI**: Giao diện người dùng bắt buộc hiển thị nhãn phụ: *"Cam kết của chủ nhà, hệ thống chưa tự thực thi hoàn tiền"* bên cạnh tên chính sách hủy để tránh hiểu lầm cho khách hàng.

---

## 7. Câu Hỏi Mở (Open Questions)

1. **Điều chỉnh theo mùa hoặc loại phòng**: Các mốc (24 giờ, 5 ngày, 14 ngày) và tỷ lệ phạt đêm đầu **đã được chủ dự án duyệt** (2026-10). Câu hỏi còn lại: có cần biến thể theo mùa cao điểm hoặc loại phòng không, và dựa trên dữ liệu vận hành nào để điều chỉnh.
2. **Cách xử lý tranh chấp khi hủy**: Khi phát sinh tranh chấp về thời điểm thông báo hủy hoặc hoàn tiền phòng giữa khách và host, quy trình nộp bằng chứng và phân xử qua Hội đồng Trọng tài (RFC-0001) sẽ diễn ra như thế nào?
3. **Cơ chế thực thi kỹ thuật**: Cần áp dụng cơ chế mật mã nào (Hold Invoices LND/CLN, Discreet Log Contracts DLC, hay Cashu NUT-11 multisig escrow) để tự động hóa hoàn trả tiền phòng mà không giữ tiền tập trung (non-custodial)?

---

## 8. Minh Bạch Giá & Nghiêm Cấm Thủ Thuật Ép Giá (Anti-Dark-Patterns)

1. **Hiển thị giá trung thực**:
   - Thẻ listing phải hiển thị: `Từ X sats / đêm`.
   - Dòng phụ bắt buộc: `Chưa gồm phí protocol (~{feePercent}%) và cọc hoàn lại 10% khi đặt phòng`.
   - Đảm bảo khách hàng không bị bất ngờ khi mở `BookingModal`.
2. **Nghiêm cấm kỹ thuật tạo cảm giác khan hiếm giả (Anti-Slop / Anti-Urgency)**:
   - Nghiêm cấm hiển thị "Chỉ còn 1 phòng duy nhất!" nếu không có dữ liệu trạng thái phòng thực tế từ `RoomType.status`.
   - Nghiêm cấm đồng hồ đếm ngược thúc giục thanh toán.
   - Nghiêm cấm thông báo giả mạo "Đang có 15 người cùng xem chỗ nghỉ này".
