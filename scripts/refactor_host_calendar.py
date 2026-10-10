import json

VI_PATH = 'src/locales/vi.json'
EN_PATH = 'src/locales/en.json'

vi_data = json.load(open(VI_PATH, encoding='utf-8'))
en_data = json.load(open(EN_PATH, encoding='utf-8'))

keys_vi = {
    'newRoomDefaultName': 'Loại phòng mới {n}',
    'createdRoomNotice': 'Đã tạo {name}. Bạn có thể cấu hình giá, quy tắc mùa và ký xác nhận.',
    'errMinOneRoom': 'Cơ sở lưu trú phải duy trì ít nhất 1 loại phòng.',
    'removedRoomDraftNotice': 'Đã xóa loại phòng khỏi danh sách nháp. Hãy ký để áp dụng.',
    'notOwnerWarning': 'Bạn không phải chủ sở hữu listing này — chỉ npub {npub} mới có quyền chỉnh sửa trực tiếp.',
    'diffRoomTypesList': 'Danh sách loại phòng',
    'diffCountRooms': '{count} loại',
    'diffAddRoom': 'Thêm loại phòng: {name}',
    'diffNotSet': 'Chưa có',
    'diffRoomSummary': '{sats} Sats, {guests} khách',
    'diffRoomName': 'Tên phòng ({name})',
    'diffBasePrice': 'Giá cơ sở ({name})',
    'diffPriceRules': 'Quy tắc giá ({name})',
    'diffRulesCount': '{count} quy tắc',
    'diffRoomStatus': 'Trạng thái phòng ({name})',
    'diffRoomSpecs': 'Tiện nghi phòng ({name})',
    'diffNone': 'Không',
    'diffTitle': 'Tiêu đề Homestay',
    'diffCoverImg': 'Ảnh đại diện Homestay',
    'diffDesc': 'Mô tả Homestay',
    'diffKycThreshold': 'Ngưỡng KYC bắt buộc',
    'diffKycVerifiers': 'Danh sách KYC Verifiers',
    'auditLogPrefix': 'Extranet Audit Trail (Nhóm A/B)',
    'auditLogProposal': 'Đã tạo đề xuất quản trị Extranet mới cho "{title}". Đang chờ các co-owners khác biểu quyết.',
    'auditProposalNotice': 'Đã tạo Đề xuất Quản trị mới! Do homestay có nhiều Co-Owners, đề xuất cần được các thành viên biểu quyết đạt >50% để áp dụng.',
    'errSchnorrSign': 'Lỗi khi ký Schnorr: {msg}',
    'noListingFound': 'Không tìm thấy cơ sở lưu trú nào để quản lý lịch và giá.',
    'selectListingLabel': 'Chọn cơ sở:',
    'ownershipMechanism': 'CƠ CHẾ SỞ HỮU',
    'soloHost100': 'Solo Host (100% Cổ phần)',
    'soloHostViewOnly': 'Solo Host (Chỉ xem)',
    'groupARuleSolo': 'Nhóm A: Ký 1 lần áp dụng ngay. Nhóm B: Tự động lưu vết Governance.',
    'groupARuleMulti': 'Mọi thay đổi Nhóm A & B đều tạo Đề xuất Quản trị cần biểu quyết >50%.',
    'basePriceAndRules': 'GIÁ CƠ SỞ & QUY TẮC',
    'satsPerNight': '{sats} Sats / đêm',
    'configuringRules': 'Đang cấu hình <span className="text-white font-bold">{count}</span> quy tắc giá theo ngày/mùa.',
    'activeBookingStatus': 'TRẠNG THÁI BOOKING ACTIVE',
    'activeBookingsCount': '{count} Đang hoạt động',
    'readyZeroActive': 'Sẵn sàng (0 active)',
    'groupBLockedReason': 'Nhóm B bị khóa để bảo vệ khách có booking chưa hoàn tất.',
    'groupBEditableReason': 'Các trường Nhóm B có thể chỉnh sửa an toàn.',
    'roomTypesHeading': 'Quản Lý Loại Phòng Trong Cơ Sở ({count} loại phòng)',
    'addNewRoomType': 'Thêm loại phòng mới',
    'maxGuests': 'Tối đa {count} khách',
    'statusOpen': 'Đang mở',
    'statusClosed': 'Tạm đóng',
    'deleteRoomTitle': 'Xóa loại phòng này',
    'seasonalRulesCount': '{count} quy tắc mùa',
    'fixedPrice': 'Giá cố định',
    'priceCalendarTitle': 'Lịch Giá:',
    'monthFormat': 'Tháng {month} / {year}',
    'legendBasePrice': 'Giá cơ sở (Mặc định)',
    'legendDynamicRule': 'Áp dụng quy tắc động',
    'legendToday': 'Hôm nay',
    'pricingRulesTitle': 'Quy Tắc Giá:',
    'closeRuleForm': 'Đóng',
    'addRuleForm': 'Thêm quy tắc',
    'setupNewRule': 'Thiết Lập Quy Tắc Giá Mới',
    'ruleNameLabel': 'Tên Quy Tắc / Nhãn:',
    'ruleNamePlaceholder': 'Ví dụ: Tết 2026, Cuối tuần VIP...',
    'ruleTypeLabel': 'Loại Quy Tắc:',
    'ruleTypeDayOfWeek': 'Thứ trong tuần',
    'ruleTypeDateRange': 'Khoảng ngày cụ thể',
    'ruleTypeRecurringMonth': 'Tháng định kỳ',
    'priorityLabel': 'Độ Ưu Tiên (Priority):',
    'selectDaysOfWeek': 'Chọn các thứ áp dụng:',
    'btnWeekend': '+ Cuối tuần (T7, CN)',
    'btnWeekdays': '+ Ngày thường (T2-T6)',
    'fromDateLabel': 'Từ ngày:',
    'toDateLabel': 'Đến ngày:',
    'fromMonthLabel': 'Từ tháng:',
    'toMonthLabel': 'Đến tháng:',
    'monthOption': 'Tháng {month}',
    'absolutePriceLabel': 'Giá Tuyệt Đối (Sats/đêm):',
    'btnCancel': 'Hủy',
    'btnSaveRule': 'Lưu vào danh sách',
    'noRulesNotice': 'Chưa có quy tắc giá theo ngày nào. Giá phòng sẽ áp dụng mức cố định cơ sở ({sats} Sats).',
    'ruleDayOfWeekDesc': 'Thứ: {days}',
    'ruleRecurringMonthDesc': 'Tháng {start} - {end} hàng năm',
    'deleteRuleTitle': 'Xóa quy tắc',
    'directEditLockedTitle': 'Quyền Chỉnh Sửa Trực Tiếp Bị Khóa',
    'directEditLockedDesc': 'Listing này được bảo vệ theo cơ chế xác thực Cypher BFT. Chỉ danh tính Nostr sở hữu 100% quyền quản trị ({npub}) mới có quyền chỉnh sửa trực tiếp dữ liệu cơ sở lưu trú.',
    'riskGroupingTitle': 'Phân Quyền Sửa Dữ Liệu Theo Nhóm Rủi Ro',
    'riskGroupingDesc': 'Phân loại rõ ràng các trường dữ liệu theo chính sách giao thức BFT của Cypher Travel.',
    'groupATitle': 'Nhóm A',
    'groupASubtitle': 'Tức Thời (Low Risk)',
    'groupASoloAccess': 'Solo: Ký 1 lần & Áp dụng ngay',
    'groupAMultiAccess': 'Multi: Qua Governance đề xuất',
    'labelRoomName': 'Tên loại phòng đang chọn (Room Name):',
    'phRoomName': 'Ví dụ: Lều Glamping, Bungalow...',
    'labelBasePrice': 'Giá cơ sở phòng này (Base Sats/đêm):',
    'labelCapacity': 'Sức chứa loại phòng này (Khách):',
    'labelRoomStatus': 'Trạng thái nhận khách của phòng:',
    'optAvailable': 'Available (Đang mở nhận khách)',
    'optOccupied': 'Occupied / Đóng cửa (Tạm dừng nhận khách)',
    'labelRoomSpecs': 'Tiện nghi riêng của loại phòng (phân tách dấu phẩy):',
    'phRoomSpecs': 'Lồng Faraday, Ban công view rừng, Khóa Nostr tử tế...',
    'labelCoverUrl': 'URL Ảnh Đại Diện Homestay:',
    'labelDesc': 'Mô tả Tổng quan Homestay:',
    'groupBTitle': 'Nhóm B',
    'groupBSubtitle': 'Cẩn Trọng (Medium Risk)',
    'groupBDesc': 'Luôn qua Governance Audit Trail. Chặn sửa nếu có booking active.',
    'groupBLockedActiveNotice': 'Đang có {count} booking đang hoạt động trên listing này. Nhóm B tạm thời bị khóa để bảo vệ khách theo giao thức.',
    'labelListingTitle': 'Tiêu đề Homestay (Title):',
    'labelKycVerifiers': 'Danh sách KYC Verifiers (npub phân tách bằng dấu phẩy):',
    'labelKycThreshold': 'Ngưỡng KYC bắt buộc (Sats, 0 = không bắt buộc):',
    'groupCTitle': 'Nhóm C',
    'groupCSubtitle': 'Khóa Cứng (Immutable / Council Only)',
    'groupCDesc': 'Không thể sửa qua Extranet',
    'labelMeshCoords': 'Tọa độ Meshnet Coordinates:',
    'noteMeshImmutable': '*Bất biến: Phải tạo listing mới nếu di dời vị trí vật lý.',
    'labelCoOwnersShares': 'Danh sách Cổ đông & Tỷ lệ Share:',
    'noteCouncilProposal': '*Chỉ thay đổi qua Đề xuất BFT Council tại Tab Quản trị.',
    'pendingChangesSummary': 'Tổng kết {count} thay đổi đang chờ ký:',
    'noChangesNotice': 'Chưa có thay đổi nào so với dữ liệu listing hiện tại.',
    'signingSchnorr': 'Đang ký Schnorr...',
    'signSoloApply': 'Ký Schnorr & Áp Dụng Ngay (Solo Host)',
    'signMultiProposal': 'Ký & Tạo Đề Xuất Quản Trị (Multi-Owner)',
}

keys_en = {
    'newRoomDefaultName': 'New Room Type {n}',
    'createdRoomNotice': 'Created {name}. You can now configure rates, seasonal rules, and sign to commit.',
    'errMinOneRoom': 'The property must maintain at least 1 room type.',
    'removedRoomDraftNotice': 'Removed room type from draft. Sign to apply.',
    'notOwnerWarning': 'You are not the owner of this listing — only npub {npub} has direct edit rights.',
    'diffRoomTypesList': 'Room types list',
    'diffCountRooms': '{count} types',
    'diffAddRoom': 'Add room type: {name}',
    'diffNotSet': 'None',
    'diffRoomSummary': '{sats} Sats, {guests} guests',
    'diffRoomName': 'Room name ({name})',
    'diffBasePrice': 'Base price ({name})',
    'diffPriceRules': 'Price rules ({name})',
    'diffRulesCount': '{count} rules',
    'diffRoomStatus': 'Room status ({name})',
    'diffRoomSpecs': 'Room amenities ({name})',
    'diffNone': 'None',
    'diffTitle': 'Homestay Title',
    'diffCoverImg': 'Homestay Cover Image',
    'diffDesc': 'Homestay Description',
    'diffKycThreshold': 'Mandatory KYC Threshold',
    'diffKycVerifiers': 'KYC Verifiers List',
    'auditLogPrefix': 'Extranet Audit Trail (Group A/B)',
    'auditLogProposal': 'Created new Extranet governance proposal for "{title}". Awaiting co-owner voting.',
    'auditProposalNotice': 'Created new Governance Proposal! Since the property has multiple co-owners, the proposal requires >50% approval to apply.',
    'errSchnorrSign': 'Schnorr signing error: {msg}',
    'noListingFound': 'No property found to manage calendar and rates.',
    'selectListingLabel': 'Select property:',
    'ownershipMechanism': 'OWNERSHIP MECHANISM',
    'soloHost100': 'Solo Host (100% Equity)',
    'soloHostViewOnly': 'Solo Host (View Only)',
    'groupARuleSolo': 'Group A: 1-click sign & apply instantly. Group B: Logged via Governance.',
    'groupARuleMulti': 'All Group A & B changes create a Governance Proposal requiring >50% vote.',
    'basePriceAndRules': 'BASE PRICE & RULES',
    'satsPerNight': '{sats} Sats / night',
    'configuringRules': 'Configuring <span className="text-white font-bold">{count}</span> seasonal/daily price rules.',
    'activeBookingStatus': 'ACTIVE BOOKING STATUS',
    'activeBookingsCount': '{count} Active',
    'readyZeroActive': 'Ready (0 active)',
    'groupBLockedReason': 'Group B is locked to safeguard guests with active bookings.',
    'groupBEditableReason': 'Group B fields can be safely updated.',
    'roomTypesHeading': 'Property Room Types Management ({count} types)',
    'addNewRoomType': 'Add new room type',
    'maxGuests': 'Up to {count} guests',
    'statusOpen': 'Open',
    'statusClosed': 'Closed',
    'deleteRoomTitle': 'Delete this room type',
    'seasonalRulesCount': '{count} seasonal rules',
    'fixedPrice': 'Fixed price',
    'priceCalendarTitle': 'Price Calendar:',
    'monthFormat': 'Month {month} / {year}',
    'legendBasePrice': 'Base Price (Default)',
    'legendDynamicRule': 'Dynamic Rule Applied',
    'legendToday': 'Today',
    'pricingRulesTitle': 'Pricing Rules:',
    'closeRuleForm': 'Close',
    'addRuleForm': 'Add rule',
    'setupNewRule': 'Configure New Pricing Rule',
    'ruleNameLabel': 'Rule Name / Label:',
    'ruleNamePlaceholder': 'E.g., Lunar New Year, VIP Weekend...',
    'ruleTypeLabel': 'Rule Type:',
    'ruleTypeDayOfWeek': 'Day of week',
    'ruleTypeDateRange': 'Specific date range',
    'ruleTypeRecurringMonth': 'Recurring month',
    'priorityLabel': 'Priority Level:',
    'selectDaysOfWeek': 'Select applicable days:',
    'btnWeekend': '+ Weekend (Sat, Sun)',
    'btnWeekdays': '+ Weekdays (Mon-Fri)',
    'fromDateLabel': 'From date:',
    'toDateLabel': 'To date:',
    'fromMonthLabel': 'From month:',
    'toMonthLabel': 'To month:',
    'monthOption': 'Month {month}',
    'absolutePriceLabel': 'Absolute Rate (Sats/night):',
    'btnCancel': 'Cancel',
    'btnSaveRule': 'Save to list',
    'noRulesNotice': 'No date pricing rules configured. Room defaults to base rate ({sats} Sats).',
    'ruleDayOfWeekDesc': 'Days: {days}',
    'ruleRecurringMonthDesc': 'Month {start} - {end} annually',
    'deleteRuleTitle': 'Delete rule',
    'directEditLockedTitle': 'Direct Edit Permission Locked',
    'directEditLockedDesc': 'This listing is protected by Cypher BFT authentication. Only the Nostr identity with 100% governance rights ({npub}) can edit property data directly.',
    'riskGroupingTitle': 'Risk-Stratified Data Edit Permissions',
    'riskGroupingDesc': 'Clear data field classification under Cypher Travel BFT protocol policies.',
    'groupATitle': 'Group A',
    'groupASubtitle': 'Instant (Low Risk)',
    'groupASoloAccess': 'Solo: 1-click sign & apply',
    'groupAMultiAccess': 'Multi: Via Governance proposal',
    'labelRoomName': 'Selected Room Type Name:',
    'phRoomName': 'E.g., Glamping Tent, Bungalow...',
    'labelBasePrice': 'Base price for this room (Sats/night):',
    'labelCapacity': 'Capacity for this room type (Guests):',
    'labelRoomStatus': 'Room reception status:',
    'optAvailable': 'Available (Accepting guests)',
    'optOccupied': 'Occupied / Closed (Temporarily paused)',
    'labelRoomSpecs': 'Specific room amenities (comma-separated):',
    'phRoomSpecs': 'Faraday cage, Forest view balcony, Nostr smart lock...',
    'labelCoverUrl': 'Homestay Cover Image URL:',
    'labelDesc': 'Homestay General Description:',
    'groupBTitle': 'Group B',
    'groupBSubtitle': 'Careful (Medium Risk)',
    'groupBDesc': 'Always logged via Governance Audit Trail. Editing blocked if active bookings exist.',
    'groupBLockedActiveNotice': 'There are {count} active bookings on this listing. Group B is temporarily locked to safeguard guests.',
    'labelListingTitle': 'Homestay Title:',
    'labelKycVerifiers': 'KYC Verifiers List (comma-separated npubs):',
    'labelKycThreshold': 'Mandatory KYC Threshold (Sats, 0 = optional):',
    'groupCTitle': 'Group C',
    'groupCSubtitle': 'Immutable (Council Only)',
    'groupCDesc': 'Cannot be edited via Extranet',
    'labelMeshCoords': 'Meshnet Coordinates:',
    'noteMeshImmutable': '*Immutable: Must create a new listing if physical location changes.',
    'labelCoOwnersShares': 'Co-Owners List & Shares:',
    'noteCouncilProposal': '*Can only be modified via BFT Council Proposal in Governance Tab.',
    'pendingChangesSummary': 'Summary of {count} pending changes awaiting signature:',
    'noChangesNotice': 'No changes detected compared to current listing data.',
    'signingSchnorr': 'Signing Schnorr...',
    'signSoloApply': 'Sign Schnorr & Apply Instantly (Solo Host)',
    'signMultiProposal': 'Sign & Create Governance Proposal (Multi-Owner)',
}

vi_data['hostCalendar'] = keys_vi
en_data['hostCalendar'] = keys_en

json.dump(vi_data, open(VI_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(en_data, open(EN_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('Updated locales with hostCalendar keys!')

# Now refactor HostCalendarPricing.tsx
file_path = 'src/components/HostCalendarPricing.tsx'
content = open(file_path, encoding='utf-8').read()

replacements = [
    (
        "name: `Loại phòng mới ${draftRoomTypes.length + 1}`,",
        "name: t('hostCalendar.newRoomDefaultName', { n: draftRoomTypes.length + 1 }),"
    ),
    (
        "message: `Đã tạo ${newRoom.name}. Bạn có thể cấu hình giá, quy tắc mùa và ký xác nhận.`,",
        "message: t('hostCalendar.createdRoomNotice', { name: newRoom.name }),"
    ),
    (
        "setStatusNotice({ message: 'Cơ sở lưu trú phải duy trì ít nhất 1 loại phòng.', type: 'error' });",
        "setStatusNotice({ message: t('hostCalendar.errMinOneRoom'), type: 'error' });"
    ),
    (
        "setStatusNotice({ message: 'Đã xóa loại phòng khỏi danh sách nháp. Hãy ký để áp dụng.', type: 'success' });",
        "setStatusNotice({ message: t('hostCalendar.removedRoomDraftNotice'), type: 'success' });"
    ),
    (
        "message: `Bạn không phải chủ sở hữu listing này — chỉ npub ${soloOwnerShortNpub} mới có quyền chỉnh sửa trực tiếp.`,",
        "message: t('hostCalendar.notOwnerWarning', { npub: soloOwnerShortNpub }),"
    ),
    (
        "label: 'Danh sách loại phòng',\n        oldVal: `${originalRoomTypes.length} loại`,\n        newVal: `${currentFullRoomTypes.length} loại`",
        "label: t('hostCalendar.diffRoomTypesList'),\n        oldVal: t('hostCalendar.diffCountRooms', { count: originalRoomTypes.length }),\n        newVal: t('hostCalendar.diffCountRooms', { count: currentFullRoomTypes.length })"
    ),
    (
        "label: `Thêm loại phòng: ${rt.name}`,\n          oldVal: 'Chưa có',\n          newVal: `${rt.priceSats.toLocaleString()} Sats, ${rt.maxGuests} khách`",
        "label: t('hostCalendar.diffAddRoom', { name: rt.name }),\n          oldVal: t('hostCalendar.diffNotSet'),\n          newVal: t('hostCalendar.diffRoomSummary', { sats: rt.priceSats.toLocaleString(), guests: rt.maxGuests })"
    ),
    (
        "label: `Tên phòng (${orig.name})`,",
        "label: t('hostCalendar.diffRoomName', { name: orig.name }),"
    ),
    (
        "label: `Giá cơ sở (${rt.name})`,",
        "label: t('hostCalendar.diffBasePrice', { name: rt.name }),"
    ),
    (
        "label: `Quy tắc giá (${rt.name})`,\n          oldVal: `${(orig.priceRules || []).length} quy tắc`,\n          newVal: `${(rt.priceRules || []).length} quy tắc`",
        "label: t('hostCalendar.diffPriceRules', { name: rt.name }),\n          oldVal: t('hostCalendar.diffRulesCount', { count: (orig.priceRules || []).length }),\n          newVal: t('hostCalendar.diffRulesCount', { count: (rt.priceRules || []).length })"
    ),
    (
        "label: `Trạng thái phòng (${rt.name})`,",
        "label: t('hostCalendar.diffRoomStatus', { name: rt.name }),"
    ),
    (
        "label: `Tiện nghi phòng (${rt.name})`,\n          oldVal: (orig.securitySpecs || []).join(', ') || 'Không',\n          newVal: (rt.securitySpecs || []).join(', ') || 'Không'",
        "label: t('hostCalendar.diffRoomSpecs', { name: rt.name }),\n          oldVal: (orig.securitySpecs || []).join(', ') || t('hostCalendar.diffNone'),\n          newVal: (rt.securitySpecs || []).join(', ') || t('hostCalendar.diffNone')"
    ),
    (
        "label: 'Tiêu đề Homestay',",
        "label: t('hostCalendar.diffTitle'),"
    ),
    (
        "label: 'Ảnh đại diện Homestay',",
        "label: t('hostCalendar.diffCoverImg'),"
    ),
    (
        "label: 'Mô tả Homestay',",
        "label: t('hostCalendar.diffDesc'),"
    ),
    (
        "label: 'Ngưỡng KYC bắt buộc',",
        "label: t('hostCalendar.diffKycThreshold'),"
    ),
    (
        "label: 'Danh sách KYC Verifiers',",
        "label: t('hostCalendar.diffKycVerifiers'),"
    ),
    (
        "`Extranet Audit Trail (Nhóm A/B) của ${identity.npub.slice(0, 12)}:\\n${[...changes.listA, ...changes.listB].map(c => `- ${c.label}: ${c.oldVal} → ${c.newVal}`).join('\\n')}`",
        "`${t('hostCalendar.auditLogPrefix')} [${identity.npub.slice(0, 12)}]:\\n${[...changes.listA, ...changes.listB].map(c => `- ${c.label}: ${c.oldVal} → ${c.newVal}`).join('\\n')}`"
    ),
    (
        "`Đã tạo đề xuất quản trị Extranet mới cho \"${selectedListing.title}\". Đang chờ các co-owners khác biểu quyết.`",
        "t('hostCalendar.auditLogProposal', { title: selectedListing.title })"
    ),
    (
        "message: 'Đã tạo Đề xuất Quản trị mới! Do homestay có nhiều Co-Owners, đề xuất cần được các thành viên biểu quyết đạt >50% để áp dụng.',",
        "message: t('hostCalendar.auditProposalNotice'),"
    ),
    (
        "setStatusNotice({ message: `Lỗi khi ký Schnorr: ${err.message || err}`, type: 'error' });",
        "setStatusNotice({ message: t('hostCalendar.errSchnorrSign', { msg: err.message || err }), type: 'error' });"
    ),
    (
        "Không tìm thấy cơ sở lưu trú nào để quản lý lịch và giá.",
        "{t('hostCalendar.noListingFound')}"
    ),
    (
        '<span className="text-xs font-mono text-text-secondary shrink-0">Chọn cơ sở:</span>',
        '<span className="text-xs font-mono text-text-secondary shrink-0">{t(\'hostCalendar.selectListingLabel\')}</span>'
    ),
    (
        '<span>CƠ CHẾ SỞ HỮU</span>',
        '<span>{t(\'hostCalendar.ownershipMechanism\')}</span>'
    ),
    (
        '<Check className="w-4 h-4" /> Solo Host (100% Cổ phần)',
        '<Check className="w-4 h-4" /> {t(\'hostCalendar.soloHost100\')}'
    ),
    (
        '<Lock className="w-4 h-4" /> Solo Host (Chỉ xem)',
        '<Lock className="w-4 h-4" /> {t(\'hostCalendar.soloHostViewOnly\')}'
    ),
    (
        "Bạn không phải chủ sở hữu listing này — chỉ npub {soloOwnerShortNpub} mới có quyền chỉnh sửa trực tiếp.",
        "{t('hostCalendar.notOwnerWarning', { npub: soloOwnerShortNpub })}"
    ),
    (
        "Nhóm A: Ký 1 lần áp dụng ngay. Nhóm B: Tự động lưu vết Governance.",
        "{t('hostCalendar.groupARuleSolo')}"
    ),
    (
        "Mọi thay đổi Nhóm A & B đều tạo Đề xuất Quản trị cần biểu quyết &gt;50%.",
        "{t('hostCalendar.groupARuleMulti')}"
    ),
    (
        "<span>GIÁ CƠ SỞ & QUY TẮC</span>",
        "<span>{t('hostCalendar.basePriceAndRules')}</span>"
    ),
    (
        "{draftPriceSats.toLocaleString()} Sats / đêm",
        "{t('hostCalendar.satsPerNight', { sats: draftPriceSats.toLocaleString() })}"
    ),
    (
        'Đang cấu hình <span className="text-white font-bold">{draftRules.length}</span> quy tắc giá theo ngày/mùa.',
        '<span dangerouslySetInnerHTML={{ __html: t(\'hostCalendar.configuringRules\', { count: draftRules.length }) }} />'
    ),
    (
        '<span>TRẠNG THÁI BOOKING ACTIVE</span>',
        '<span>{t(\'hostCalendar.activeBookingStatus\')}</span>'
    ),
    (
        '<AlertCircle className="w-4 h-4" /> {activeBookings.length} Đang hoạt động',
        '<AlertCircle className="w-4 h-4" /> {t(\'hostCalendar.activeBookingsCount\', { count: activeBookings.length })}'
    ),
    (
        '<Check className="w-4 h-4" /> Sẵn sàng (0 active)',
        '<Check className="w-4 h-4" /> {t(\'hostCalendar.readyZeroActive\')}'
    ),
    (
        "? 'Nhóm B bị khóa để bảo vệ khách có booking chưa hoàn tất.'\n                    : 'Các trường Nhóm B có thể chỉnh sửa an toàn.'}",
        "? t('hostCalendar.groupBLockedReason')\n                    : t('hostCalendar.groupBEditableReason')}"
    ),
    (
        "Quản Lý Loại Phòng Trong Cơ Sở ({draftRoomTypes.length} loại phòng)",
        "{t('hostCalendar.roomTypesHeading', { count: draftRoomTypes.length })}"
    ),
    (
        "Thêm loại phòng mới",
        "{t('hostCalendar.addNewRoomType')}"
    ),
    (
        "<span>Tối đa {displayGuests} khách</span>",
        "<span>{t('hostCalendar.maxGuests', { count: displayGuests })}</span>"
    ),
    (
        "{displayStatus === 'available' ? 'Đang mở' : 'Tạm đóng'}",
        "{displayStatus === 'available' ? t('hostCalendar.statusOpen') : t('hostCalendar.statusClosed')}"
    ),
    (
        'title="Xóa loại phòng này"',
        'title={t(\'hostCalendar.deleteRoomTitle\')}'
    ),
    (
        '<span className="text-[9px] font-normal text-text-secondary">/đêm</span>',
        '<span className="text-[9px] font-normal text-text-secondary">/ {t(\'hostReg.perNight\') || \'đêm\'}</span>'
    ),
    (
        "{displayRules.length > 0 ? `${displayRules.length} quy tắc mùa` : 'Giá cố định'}",
        "{displayRules.length > 0 ? t('hostCalendar.seasonalRulesCount', { count: displayRules.length }) : t('hostCalendar.fixedPrice')}"
    ),
    (
        'Lịch Giá: <span className="text-primary">{draftRoomName || \'Loại phòng\'}</span>',
        '{t(\'hostCalendar.priceCalendarTitle\')} <span className="text-primary">{draftRoomName || t(\'listingDetail.roomTypeLabel\')}</span>'
    ),
    (
        "Tháng {currentDate.getMonth() + 1} / {currentDate.getFullYear()}",
        "{t('hostCalendar.monthFormat', { month: currentDate.getMonth() + 1, year: currentDate.getFullYear() })}"
    ),
    (
        '<span>Giá cơ sở (Mặc định)</span>',
        '<span>{t(\'hostCalendar.legendBasePrice\')}</span>'
    ),
    (
        '<span>Áp dụng quy tắc động</span>',
        '<span>{t(\'hostCalendar.legendDynamicRule\')}</span>'
    ),
    (
        '<span>Hôm nay</span>',
        '<span>{t(\'hostCalendar.legendToday\')}</span>'
    ),
    (
        'Quy Tắc Giá: <span className="text-warning">{draftRoomName || \'Loại phòng\'}</span>',
        '{t(\'hostCalendar.pricingRulesTitle\')} <span className="text-warning">{draftRoomName || t(\'listingDetail.roomTypeLabel\')}</span>'
    ),
    (
        "{showAddRuleForm ? 'Đóng' : 'Thêm quy tắc'}",
        "{showAddRuleForm ? t('hostCalendar.closeRuleForm') : t('hostCalendar.addRuleForm')}"
    ),
    (
        '<span>Thiết Lập Quy Tắc Giá Mới</span>',
        '<span>{t(\'hostCalendar.setupNewRule\')}</span>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Tên Quy Tắc / Nhãn:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.ruleNameLabel\')}</label>'
    ),
    (
        'placeholder="Ví dụ: Tết 2026, Cuối tuần VIP..."',
        'placeholder={t(\'hostCalendar.ruleNamePlaceholder\')}'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Loại Quy Tắc:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.ruleTypeLabel\')}</label>'
    ),
    (
        '<option value="day_of_week">Thứ trong tuần</option>',
        '<option value="day_of_week">{t(\'hostCalendar.ruleTypeDayOfWeek\')}</option>'
    ),
    (
        '<option value="date_range">Khoảng ngày cụ thể</option>',
        '<option value="date_range">{t(\'hostCalendar.ruleTypeDateRange\')}</option>'
    ),
    (
        '<option value="recurring_month">Tháng định kỳ</option>',
        '<option value="recurring_month">{t(\'hostCalendar.ruleTypeRecurringMonth\')}</option>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Độ Ưu Tiên (Priority):</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.priorityLabel\')}</label>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block">Chọn các thứ áp dụng:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block">{t(\'hostCalendar.selectDaysOfWeek\')}</label>'
    ),
    (
        '+ Cuối tuần (T7, CN)',
        '{t(\'hostCalendar.btnWeekend\')}'
    ),
    (
        '+ Ngày thường (T2-T6)',
        '{t(\'hostCalendar.btnWeekdays\')}'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Từ ngày:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.fromDateLabel\')}</label>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Đến ngày:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.toDateLabel\')}</label>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Từ tháng:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.fromMonthLabel\')}</label>'
    ),
    (
        '<option key={m} value={m}>Tháng {m}</option>',
        '<option key={m} value={m}>{t(\'hostCalendar.monthOption\', { month: m })}</option>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Đến tháng:</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.toMonthLabel\')}</label>'
    ),
    (
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">Giá Tuyệt Đối (Sats/đêm):</label>',
        '<label className="text-[10px] text-text-secondary uppercase block mb-1">{t(\'hostCalendar.absolutePriceLabel\')}</label>'
    ),
    (
        '<button\n                        type="button"\n                        onClick={() => setShowAddRuleForm(false)}\n                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-secondary text-xs rounded font-mono transition-colors"\n                      >\n                        Hủy\n                      </button>',
        '<button\n                        type="button"\n                        onClick={() => setShowAddRuleForm(false)}\n                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-secondary text-xs rounded font-mono transition-colors"\n                      >\n                        {t(\'hostCalendar.btnCancel\')}\n                      </button>'
    ),
    (
        '<button\n                        type="button"\n                        onClick={handleAddRule}\n                        className="px-3 py-1.5 bg-primary text-black font-bold text-xs rounded font-mono hover:bg-primary/90 transition-colors"\n                      >\n                        Lưu vào danh sách\n                      </button>',
        '<button\n                        type="button"\n                        onClick={handleAddRule}\n                        className="px-3 py-1.5 bg-primary text-black font-bold text-xs rounded font-mono hover:bg-primary/90 transition-colors"\n                      >\n                        {t(\'hostCalendar.btnSaveRule\')}\n                      </button>'
    ),
    (
        "Chưa có quy tắc giá theo ngày nào. Giá phòng sẽ áp dụng mức cố định cơ sở ({draftPriceSats.toLocaleString()} Sats).",
        "{t('hostCalendar.noRulesNotice', { sats: draftPriceSats.toLocaleString() })}"
    ),
    (
        "{rule.type === 'day_of_week' && `Thứ: ${rule.daysOfWeek?.join(', ')}`}",
        "{rule.type === 'day_of_week' && t('hostCalendar.ruleDayOfWeekDesc', { days: rule.daysOfWeek?.join(', ') || '' })}"
    ),
    (
        "{rule.type === 'recurring_month' && `Tháng ${rule.startMonth} - ${rule.endMonth} hàng năm`}",
        "{rule.type === 'recurring_month' && t('hostCalendar.ruleRecurringMonthDesc', { start: rule.startMonth, end: rule.endMonth })}"
    ),
    (
        'title="Xóa quy tắc"',
        'title={t(\'hostCalendar.deleteRuleTitle\')}'
    ),
    (
        '<h4 className="text-base font-bold font-mono text-white">Quyền Chỉnh Sửa Trực Tiếp Bị Khóa</h4>',
        '<h4 className="text-base font-bold font-mono text-white">{t(\'hostCalendar.directEditLockedTitle\')}</h4>'
    ),
    (
        "Listing này được bảo vệ theo cơ chế xác thực Cypher BFT. Chỉ danh tính Nostr sở hữu 100% quyền quản trị ({soloOwnerShortNpub}) mới có quyền chỉnh sửa trực tiếp dữ liệu cơ sở lưu trú.",
        "{t('hostCalendar.directEditLockedDesc', { npub: soloOwnerShortNpub })}"
    ),
    (
        '<span>Phân Quyền Sửa Dữ Liệu Theo Nhóm Rủi Ro</span>',
        '<span>{t(\'hostCalendar.riskGroupingTitle\')}</span>'
    ),
    (
        'Phân loại rõ ràng các trường dữ liệu theo chính sách giao thức BFT của Cypher Travel.',
        '{t(\'hostCalendar.riskGroupingDesc\')}'
    ),
    (
        '<span className="text-[10px] font-mono text-cyber-green bg-cyber-green/10 px-2 py-0.5 rounded border border-cyber-green/30 font-bold shrink-0">Nhóm A</span>',
        '<span className="text-[10px] font-mono text-cyber-green bg-cyber-green/10 px-2 py-0.5 rounded border border-cyber-green/30 font-bold shrink-0">{t(\'hostCalendar.groupATitle\')}</span>'
    ),
    (
        '<span className="text-xs font-bold font-mono text-white uppercase">Tức Thời (Low Risk)</span>',
        '<span className="text-xs font-bold font-mono text-white uppercase">{t(\'hostCalendar.groupASubtitle\')}</span>'
    ),
    (
        "{hasDirectEditAccess ? 'Solo: Ký 1 lần & Áp dụng ngay' : 'Multi: Qua Governance đề xuất'}",
        "{hasDirectEditAccess ? t('hostCalendar.groupASoloAccess') : t('hostCalendar.groupAMultiAccess')}"
    ),
    (
        '<label className="text-text-secondary block mb-1">Tên loại phòng đang chọn (Room Name):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelRoomName\')}</label>'
    ),
    (
        'placeholder="Ví dụ: Lều Glamping, Bungalow..."',
        'placeholder={t(\'hostCalendar.phRoomName\')}'
    ),
    (
        '<label className="text-text-secondary block mb-1">Giá cơ sở phòng này (Base Sats/đêm):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelBasePrice\')}</label>'
    ),
    (
        '<label className="text-text-secondary block mb-1">Sức chứa loại phòng này (Khách):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelCapacity\')}</label>'
    ),
    (
        '<label className="text-text-secondary block mb-1">Trạng thái nhận khách của phòng:</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelRoomStatus\')}</label>'
    ),
    (
        '<option value="available">Available (Đang mở nhận khách)</option>',
        '<option value="available">{t(\'hostCalendar.optAvailable\')}</option>'
    ),
    (
        '<option value="occupied">Occupied / Đóng cửa (Tạm dừng nhận khách)</option>',
        '<option value="occupied">{t(\'hostCalendar.optOccupied\')}</option>'
    ),
    (
        '<label className="text-text-secondary block mb-1">Tiện nghi riêng của loại phòng (phân tách dấu phẩy):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelRoomSpecs\')}</label>'
    ),
    (
        'placeholder="Lồng Faraday, Ban công view rừng, Khóa Nostr tử tế..."',
        'placeholder={t(\'hostCalendar.phRoomSpecs\')}'
    ),
    (
        '<label className="text-text-secondary block mb-1">URL Ảnh Đại Diện Homestay:</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelCoverUrl\')}</label>'
    ),
    (
        '<label className="text-text-secondary block mb-1">Mô tả Tổng quan Homestay:</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelDesc\')}</label>'
    ),
    (
        '<span className="text-[10px] font-mono text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/30 font-bold shrink-0">Nhóm B</span>',
        '<span className="text-[10px] font-mono text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/30 font-bold shrink-0">{t(\'hostCalendar.groupBTitle\')}</span>'
    ),
    (
        '<span className="text-xs font-bold font-mono text-white uppercase">Cẩn Trọng (Medium Risk)</span>',
        '<span className="text-xs font-bold font-mono text-white uppercase">{t(\'hostCalendar.groupBSubtitle\')}</span>'
    ),
    (
        'Luôn qua Governance Audit Trail. Chặn sửa nếu có booking active.',
        '{t(\'hostCalendar.groupBDesc\')}'
    ),
    (
        "Đang có {activeBookings.length} booking đang hoạt động trên listing này. Nhóm B tạm thời bị khóa để bảo vệ khách theo giao thức.",
        "{t('hostCalendar.groupBLockedActiveNotice', { count: activeBookings.length })}"
    ),
    (
        '<label className="text-text-secondary block mb-1">Tiêu đề Homestay (Title):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelListingTitle\')}</label>'
    ),
    (
        '<label className="text-text-secondary block mb-1">Danh sách KYC Verifiers (npub phân tách bằng dấu phẩy):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelKycVerifiers\')}</label>'
    ),
    (
        '<label className="text-text-secondary block mb-1">Ngưỡng KYC bắt buộc (Sats, 0 = không bắt buộc):</label>',
        '<label className="text-text-secondary block mb-1">{t(\'hostCalendar.labelKycThreshold\')}</label>'
    ),
    (
        '<span className="text-[10px] font-mono text-text-disabled bg-white/5 px-2 py-0.5 rounded border border-white/10 font-bold flex items-center gap-1 shrink-0"><Lock className="w-3 h-3" /> Nhóm C</span>',
        '<span className="text-[10px] font-mono text-text-disabled bg-white/5 px-2 py-0.5 rounded border border-white/10 font-bold flex items-center gap-1 shrink-0"><Lock className="w-3 h-3" /> {t(\'hostCalendar.groupCTitle\')}</span>'
    ),
    (
        '<span className="text-xs font-bold font-mono text-white uppercase">Khóa Cứng (Immutable / Council Only)</span>',
        '<span className="text-xs font-bold font-mono text-white uppercase">{t(\'hostCalendar.groupCSubtitle\')}</span>'
    ),
    (
        'Không thể sửa qua Extranet',
        '{t(\'hostCalendar.groupCDesc\')}'
    ),
    (
        '<span className="text-[10px] uppercase text-text-disabled block mb-1">Tọa độ Meshnet Coordinates:</span>',
        '<span className="text-[10px] uppercase text-text-disabled block mb-1">{t(\'hostCalendar.labelMeshCoords\')}</span>'
    ),
    (
        '*Bất biến: Phải tạo listing mới nếu di dời vị trí vật lý.',
        '{t(\'hostCalendar.noteMeshImmutable\')}'
    ),
    (
        '<span className="text-[10px] uppercase text-text-disabled block mb-1">Danh sách Cổ đông & Tỷ lệ Share:</span>',
        '<span className="text-[10px] uppercase text-text-disabled block mb-1">{t(\'hostCalendar.labelCoOwnersShares\')}</span>'
    ),
    (
        '*Chỉ thay đổi qua Đề xuất BFT Council tại Tab Quản trị.',
        '{t(\'hostCalendar.noteCouncilProposal\')}'
    ),
    (
        '<span>Tổng kết {changes.listA.length + changes.listB.length} thay đổi đang chờ ký:</span>',
        '<span>{t(\'hostCalendar.pendingChangesSummary\', { count: changes.listA.length + changes.listB.length })}</span>'
    ),
    (
        '<span className="text-success font-bold block">[Nhóm A] {c.label}</span>',
        '<span className="text-success font-bold block">[{t(\'hostCalendar.groupATitle\')}] {c.label}</span>'
    ),
    (
        '<span className="text-warning font-bold block">[Nhóm B] {c.label}</span>',
        '<span className="text-warning font-bold block">[{t(\'hostCalendar.groupBTitle\')}] {c.label}</span>'
    ),
    (
        'Chưa có thay đổi nào so với dữ liệu listing hiện tại.',
        '{t(\'hostCalendar.noChangesNotice\')}'
    ),
    (
        '<span>Đang ký Schnorr...</span>',
        '<span>{t(\'hostCalendar.signingSchnorr\')}</span>'
    ),
    (
        '<span>Ký Schnorr & Áp Dụng Ngay (Solo Host)</span>',
        '<span>{t(\'hostCalendar.signSoloApply\')}</span>'
    ),
    (
        '<span>Ký & Tạo Đề Xuất Quản Trị (Multi-Owner)</span>',
        '<span>{t(\'hostCalendar.signMultiProposal\')}</span>'
    )
]

for old, new in replacements:
    if old not in content:
        print('MISSING TARGET:', repr(old[:50]))
    else:
        content = content.replace(old, new, 1)

open(file_path, 'w', encoding='utf-8').write(content)
print('Finished updating HostCalendarPricing.tsx!')
