# RFC-0018: Chuẩn Hóa Lược Đồ Listing & Siêu Dữ Liệu Bảo Vệ Quyền Riêng Tư (Standardized Accommodation Schema & Privacy-Preserving Listing Metadata)

- **Trạng thái**: Draft
- **Tác giả**: CypherGuide Core Contributors & Architecture Working Group
- **Ngày tạo**: 2026-10-08
- **Kế thừa & Tuân thủ**: [RFC-0003](./0003-identity-portable-reputation.md), [RFC-0008](./0008-dana-based-stay.md), [RFC-0011](./0011-financialization-boundary-principle.md), [RFC-0012](./0012-sovereignty-boundary-principle.md), [RFC-0013](./0013-agent-ready-stay.md)

---

## 1. Tóm tắt (Summary)

RFC này chuẩn hóa lược đồ dữ liệu chỗ ở (Accommodation Listing Schema) trên CypherGuide, tham chiếu tính rõ ràng và trực quan của các nền tảng đặt phòng hiện đại (Booking.com, Airbnb) nhưng kiên định giữ vững các đặc tính cốt lõi của CypherGuide: **phi lưu ký (non-custodial), không KYC bắt buộc, thanh toán Bitcoin Lightning/Ecash, và bảo vệ quyền riêng tư tuyệt đối**.

Đặc tả này giải quyết 4 khoảng trống lớn của thẻ phòng trước đây:
1. **Thiếu thông tin vật lý cốt lõi**: Khách không biết loại giường, diện tích, giờ nhận/trả phòng, và số khách tối đa hiển thị rõ ràng.
2. **Không rõ ràng về chính sách hủy**: Chuẩn hóa 4 cấp độ hủy phòng có mốc thời gian và tỷ lệ hoàn tiền cụ thể.
3. **Vị trí lộ lọt quyền riêng tư**: Nghiêm cấm đưa địa chỉ chi tiết/tọa độ chính xác lên Nostr công khai; chỉ cho phép định vị thô cấp khu vực (Thành phố, Quận/Huyện).
4. **Minh bạch tài chính trước khi bấm Đặt phòng**: Thẻ phải thể hiện rõ giá gốc một đêm, tỷ lệ cọc hoàn lại 10%, và phí giao thức hiện hành.

---

## 2. Bốn Cấp Độ Chính Sách Hủy Phòng (Cancellation Policies)

Chủ dự án và hội đồng kiến trúc CypherGuide thống nhất 4 mức chính sách hủy phòng chuẩn hóa. Các mốc thời gian tính theo giờ địa phương của chỗ ở:

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

1. **Trên sự kiện Nostr công khai (Kind 30078 / Kind 31923)**:
   - Chỉ được ghi trường `locationLabel` ở mức khu vực địa lý thô (ví dụ: `"Đà Lạt, Lâm Đồng"`, `"Quận 1, TP. Hồ Chí Minh"`, `"Huyện Côn Đảo, Bà Rịa - Vũng Tàu"`).
   - Tuyệt đối **KHÔNG** đưa số nhà, tên ngõ/hẻm, tên tòa nhà cụ thể, hoặc tọa độ GPS chính xác (dưới bán kính 5km) vào nội dung công khai.
2. **Kênh truyền địa chỉ chi tiết**:
   - Địa chỉ thực tế, mã khóa cửa (Smart lock/PIN), và hướng dẫn tìm đường chi tiết chỉ được mã hóa đầu-cuối (E2EE qua NIP-04 hoặc NIP-44) và gửi riêng cho khách **SAU KHI** giao dịch Lightning/Ecash được xác nhận thành công.

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

## 5. Ánh Xạ Nostr Event Tags

Các trường thông tin mới được ánh xạ vào Nostr Event (Kind 30078 hoặc tương đương) dưới dạng tag mở rộng. Client cũ không nhận diện được các tag này sẽ tự động bỏ qua mà không làm vỡ giao diện:

```json
[
  ["d", "<listing_id>"],
  ["title", "Faraday Bunker & Bitcoin Mesh Lab"],
  ["location_label", "Quận 1, TP. Hồ Chí Minh"],
  ["cancel_policy", "flexible", "Hủy trước 24h hoàn 100%"],
  ["bed_type", "1 Giường King"],
  ["area_m2", "45"],
  ["check_in", "14:00"],
  ["check_out", "11:00"]
]
```

---

## 6. Minh Bạch Giá & Nghiêm Cấm Thủ Thuật Ép Giá (Anti-Dark-Patterns)

1. **Hiển thị giá trung thực**:
   - Thẻ listing phải hiển thị: `Từ X sats / đêm`.
   - Dòng phụ bắt buộc: `Chưa gồm phí protocol (~{feePercent}%) và cọc hoàn lại 10% khi đặt phòng`.
   - Đảm bảo khách hàng không bị bất ngờ khi mở `BookingModal`.
2. **Nghiêm cấm kỹ thuật tạo cảm giác khan hiếm giả (Anti-Slop / Anti-Urgency)**:
   - Nghiêm cấm hiển thị "Chỉ còn 1 phòng duy nhất!" nếu không có dữ liệu trạng thái phòng thực tế từ `RoomType.status`.
   - Nghiêm cấm đồng hồ đếm ngược thúc giục thanh toán.
   - Nghiêm cấm thông báo giả mạo "Đang có 15 người cùng xem chỗ nghỉ này".
