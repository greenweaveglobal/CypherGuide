import json

VI_PATH = 'src/locales/vi.json'
EN_PATH = 'src/locales/en.json'

vi_data = json.load(open(VI_PATH, encoding='utf-8'))
en_data = json.load(open(EN_PATH, encoding='utf-8'))

keys_vi = {
    'copiedShareLinkLog': 'Đã sao chép liên kết chia sẻ listing: {url}',
    'cannotCreateInvoiceLog': 'Lỗi: {error}',
    'hostServerError': 'Không thể tạo invoice từ máy chủ Host',
    'noHostLnConfiguredLog': 'Lỗi: Chưa cấu hình Lightning Address cho Host.',
    'priceFrom': 'Từ',
    'availableRoomTypes': '{count} loại phòng sẵn có',
    'policyFlexibleLabel': 'Linh hoạt (Flexible)',
    'policyModerateLabel': 'Vừa phải (Moderate)',
    'policyStrictLabel': 'Nghiêm ngặt (Strict)',
    'policyNonrefundableLabel': 'Không hoàn tiền (Nonrefundable)',
    'policyFlexibleDesc': 'Hủy miễn phí trước 24 giờ so với giờ nhận phòng (hoàn 100% tiền phòng). Hủy muộn tính phí 50% đêm đầu tiên.',
    'policyModerateDesc': 'Hủy miễn phí trước 5 ngày so với ngày nhận phòng (hoàn 100% tiền phòng). Hủy muộn tính phí 100% đêm đầu tiên.',
    'policyStrictDesc': 'Hủy miễn phí trước 14 ngày so với ngày nhận phòng (hoàn 100% tiền phòng). Hủy trong vòng 14 ngày không hoàn tiền phòng.',
    'policyNonrefundableDesc': 'Không áp dụng hoàn tiền phòng sau khi giao dịch đặt phòng được xác nhận.',
    'roomTypesListTitle': 'Danh Sách Loại Phòng ({count} loại)',
    'roomTypesListDesc': 'Chọn loại phòng phù hợp với nhu cầu và sức chứa của bạn',
    'roomOccupied': 'Đã có khách',
    'roomAvailable': 'Sẵn sàng',
    'roomSelected': 'Đang chọn',
    'maxGuests': 'Tối đa {count} khách',
    'perNight': '/ đêm',
    'bookThisRoom': 'Đặt phòng này',
    'selectRoomBtn': 'Chọn loại phòng',
    'soldOutBtn': 'Hết phòng',
    'auditTrailTitle': 'Lịch Sử Chỉnh Sửa Listing (Audit Trail)',
    'noAuditHistory': 'Chưa có lịch sử thay đổi nào được ghi nhận trên Nostr Relay.',
    'selectRoomTypeLabel': 'Chọn loại phòng',
    'roomOptionFormat': '{sats} Sats (tối đa {guests} khách){occupied}',
    'occupiedSuffix': ' [HẾT PHÒNG]',
    'roomTypeLabel': 'Loại phòng:',
    'unitPriceLabel': 'Đơn giá:',
    'satsPerNight': '{sats} Sats/đêm',
    'subtotalNightsLabel': 'Tạm tính ({count} đêm):',
    'nightlyPriceBreakdown': 'Chi tiết giá động từng đêm',
    'averageNightlyRate': 'TB: {sats} Sats/đêm',
}

keys_en = {
    'copiedShareLinkLog': 'Copied listing share link: {url}',
    'cannotCreateInvoiceLog': 'Error: {error}',
    'hostServerError': 'Cannot generate invoice from Host server',
    'noHostLnConfiguredLog': 'Error: No Lightning Address configured for Host.',
    'priceFrom': 'From',
    'availableRoomTypes': '{count} available room types',
    'policyFlexibleLabel': 'Flexible',
    'policyModerateLabel': 'Moderate',
    'policyStrictLabel': 'Strict',
    'policyNonrefundableLabel': 'Non-refundable',
    'policyFlexibleDesc': 'Free cancellation up to 24 hours before check-in (100% room refund). Late cancellations incur 50% first night fee.',
    'policyModerateDesc': 'Free cancellation up to 5 days before check-in (100% room refund). Late cancellations incur 100% first night fee.',
    'policyStrictDesc': 'Free cancellation up to 14 days before check-in (100% room refund). No refund within 14 days.',
    'policyNonrefundableDesc': 'No room refund applies after booking transaction confirmation.',
    'roomTypesListTitle': 'Available Room Types ({count})',
    'roomTypesListDesc': 'Select a room type matching your preferences and group size',
    'roomOccupied': 'Occupied',
    'roomAvailable': 'Available',
    'roomSelected': 'Selected',
    'maxGuests': 'Up to {count} guests',
    'perNight': '/ night',
    'bookThisRoom': 'Book this room',
    'selectRoomBtn': 'Select room',
    'soldOutBtn': 'Sold out',
    'auditTrailTitle': 'Listing Edit History (Audit Trail)',
    'noAuditHistory': 'No change history recorded on Nostr Relays yet.',
    'selectRoomTypeLabel': 'Select room type',
    'roomOptionFormat': '{sats} Sats (up to {guests} guests){occupied}',
    'occupiedSuffix': ' [SOLD OUT]',
    'roomTypeLabel': 'Room type:',
    'unitPriceLabel': 'Unit price:',
    'satsPerNight': '{sats} Sats/night',
    'subtotalNightsLabel': 'Subtotal ({count} nights):',
    'nightlyPriceBreakdown': 'Dynamic Nightly Price Breakdown',
    'averageNightlyRate': 'Avg: {sats} Sats/night',
}

for k, v in keys_vi.items(): vi_data['listingDetail'][k] = v
for k, v in keys_en.items(): en_data['listingDetail'][k] = v

json.dump(vi_data, open(VI_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(en_data, open(EN_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

file_path = 'src/components/ListingDetail.tsx'
content = open(file_path, encoding='utf-8').read()

replacements = [
    (
        "// Khởi tạo loại phòng mặc định: Chọn loại phòng có giá thấp nhất còn trống để khớp với giá \"Từ ...\" ngoài danh sách",
        "// Initialize default room type: pick lowest priced available room"
    ),
    (
        "onAddLog('relay', `Đã sao chép liên kết chia sẻ listing: ${url.toString()}`);",
        "onAddLog('relay', t('listingDetail.copiedShareLinkLog', { url: url.toString() }));"
    ),
    (
        "addPaymentLog(`Lỗi: ${resolved.error || 'Không thể tạo invoice từ máy chủ Host'}`);",
        "addPaymentLog(t('listingDetail.cannotCreateInvoiceLog', { error: resolved.error || t('listingDetail.hostServerError') }));"
    ),
    (
        "addPaymentLog(`Lỗi: Chưa cấu hình Lightning Address cho Host.`);",
        "addPaymentLog(t('listingDetail.noHostLnConfiguredLog'));"
    ),
    (
        "// Kiểm tra & Xử lý thưởng 1% Referral Sats (Gọi hàm audit checkReferralEligibility)",
        "// 1% Referral Sats bonus processing"
    ),
    (
        '<span className="text-xs font-mono text-text-secondary uppercase">Từ</span>',
        '<span className="text-xs font-mono text-text-secondary uppercase">{t(\'listingDetail.priceFrom\')}</span>'
    ),
    (
        '{roomTypes.length} loại phòng sẵn có',
        '{t(\'listingDetail.availableRoomTypes\', { count: roomTypes.length })}'
    ),
    (
        "{listing.cancellationPolicy === 'flexible' && 'Linh hoạt (Flexible)'}",
        "{listing.cancellationPolicy === 'flexible' && t('listingDetail.policyFlexibleLabel')}"
    ),
    (
        "{listing.cancellationPolicy === 'moderate' && 'Vừa phải (Moderate)'}",
        "{listing.cancellationPolicy === 'moderate' && t('listingDetail.policyModerateLabel')}"
    ),
    (
        "{listing.cancellationPolicy === 'strict' && 'Nghiêm ngặt (Strict)'}",
        "{listing.cancellationPolicy === 'strict' && t('listingDetail.policyStrictLabel')}"
    ),
    (
        "{(!listing.cancellationPolicy || listing.cancellationPolicy === 'nonrefundable') && 'Không hoàn tiền (Nonrefundable)'}",
        "{(!listing.cancellationPolicy || listing.cancellationPolicy === 'nonrefundable') && t('listingDetail.policyNonrefundableLabel')}"
    ),
    (
        "{listing.cancellationPolicy === 'flexible' && 'Hủy miễn phí trước 24 giờ so với giờ nhận phòng (hoàn 100% tiền phòng). Hủy muộn tính phí 50% đêm đầu tiên.'}",
        "{listing.cancellationPolicy === 'flexible' && t('listingDetail.policyFlexibleDesc')}"
    ),
    (
        "{listing.cancellationPolicy === 'moderate' && 'Hủy miễn phí trước 5 ngày so với ngày nhận phòng (hoàn 100% tiền phòng). Hủy muộn tính phí 100% đêm đầu tiên.'}",
        "{listing.cancellationPolicy === 'moderate' && t('listingDetail.policyModerateDesc')}"
    ),
    (
        "{listing.cancellationPolicy === 'strict' && 'Hủy miễn phí trước 14 ngày so với ngày nhận phòng (hoàn 100% tiền phòng). Hủy trong vòng 14 ngày không hoàn tiền phòng.'}",
        "{listing.cancellationPolicy === 'strict' && t('listingDetail.policyStrictDesc')}"
    ),
    (
        "{(!listing.cancellationPolicy || listing.cancellationPolicy === 'nonrefundable') && 'Không áp dụng hoàn tiền phòng sau khi giao dịch đặt phòng được xác nhận.'}",
        "{(!listing.cancellationPolicy || listing.cancellationPolicy === 'nonrefundable') && t('listingDetail.policyNonrefundableDesc')}"
    ),
    (
        'Danh Sách Loại Phòng ({roomTypes.length} loại)',
        '{t(\'listingDetail.roomTypesListTitle\', { count: roomTypes.length })}'
    ),
    (
        'Chọn loại phòng phù hợp với nhu cầu và sức chứa của bạn',
        '{t(\'listingDetail.roomTypesListDesc\')}'
    ),
    (
        'Đã có khách',
        '{t(\'listingDetail.roomOccupied\')}'
    ),
    (
        'Sẵn sàng',
        '{t(\'listingDetail.roomAvailable\')}'
    ),
    (
        'Đang chọn',
        '{t(\'listingDetail.roomSelected\')}'
    ),
    (
        'Tối đa {rt.maxGuests} khách',
        '{t(\'listingDetail.maxGuests\', { count: rt.maxGuests })}'
    ),
    (
        '<span className="text-[11px] text-text-disabled font-mono block">/ đêm</span>',
        '<span className="text-[11px] text-text-disabled font-mono block">{t(\'listingDetail.perNight\')}</span>'
    ),
    (
        'Đặt phòng này',
        '{t(\'listingDetail.bookThisRoom\')}'
    ),
    (
        "{isAvailable ? 'Chọn loại phòng' : 'Hết phòng'}",
        "{isAvailable ? t('listingDetail.selectRoomBtn') : t('listingDetail.soldOutBtn')}"
    ),
    (
        '<span>Lịch Sử Chỉnh Sửa Listing (Audit Trail)</span>',
        '<span>{t(\'listingDetail.auditTrailTitle\')}</span>'
    ),
    (
        'Chưa có lịch sử thay đổi nào được ghi nhận trên Nostr Relay.',
        '{t(\'listingDetail.noAuditHistory\')}'
    ),
    (
        '<label className="text-xs font-mono text-text-secondary uppercase">Chọn loại phòng</label>',
        '<label className="text-xs font-mono text-text-secondary uppercase">{t(\'listingDetail.selectRoomTypeLabel\')}</label>'
    ),
    (
        "{rt.name} - {rt.priceSats.toLocaleString()} Sats (tối đa {rt.maxGuests} khách){rt.status === 'occupied' ? ' [HẾT PHÒNG]' : ''}",
        "{rt.name} - {t('listingDetail.roomOptionFormat', { sats: rt.priceSats.toLocaleString(), guests: rt.maxGuests, occupied: rt.status === 'occupied' ? t('listingDetail.occupiedSuffix') : '' })}"
    ),
    (
        '{/* Tóm tắt loại phòng đang chọn & giá tạm tính */}',
        '{/* Selected room type summary & subtotal */}'
    ),
    (
        '<span>Loại phòng:</span>',
        '<span>{t(\'listingDetail.roomTypeLabel\')}</span>'
    ),
    (
        '<span className="text-text-secondary">Đơn giá:</span>',
        '<span className="text-text-secondary">{t(\'listingDetail.unitPriceLabel\')}</span>'
    ),
    (
        '<span className="text-warning font-bold">{currentRoom.priceSats.toLocaleString()} Sats/đêm</span>',
        '<span className="text-warning font-bold">{t(\'listingDetail.satsPerNight\', { sats: currentRoom.priceSats.toLocaleString() })}</span>'
    ),
    (
        '<span className="text-text-primary">Tạm tính ({effectiveNights} đêm):</span>',
        '<span className="text-text-primary">{t(\'listingDetail.subtotalNightsLabel\', { count: effectiveNights })}</span>'
    ),
    (
        '<span>Chi tiết giá động từng đêm</span>',
        '<span>{t(\'listingDetail.nightlyPriceBreakdown\')}</span>'
    ),
    (
        '<span>TB: {stayPriceCalc.averageNightlySats.toLocaleString()} Sats/đêm</span>',
        '<span>{t(\'listingDetail.averageNightlyRate\', { sats: stayPriceCalc.averageNightlySats.toLocaleString() })}</span>'
    )
]

for old, new in replacements:
    if old not in content:
        print('MISSING TARGET:', repr(old[:50]))
    else:
        content = content.replace(old, new, 1)

open(file_path, 'w', encoding='utf-8').write(content)
print('Finished updating ListingDetail.tsx!')
