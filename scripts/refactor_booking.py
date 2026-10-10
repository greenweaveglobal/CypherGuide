import re

path = 'src/components/BookingModal.tsx'
content = open(path, encoding='utf-8').read()

replacements = [
    (
        "setPaymentLog(prev => [...prev, `[WebLN] Đang gửi yêu cầu thanh toán cho ${label}...`]);",
        "setPaymentLog(prev => [...prev, t('booking.weblnSendingPayment', { label })]);"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [WebLN] Chữ ký preimage không khớp payment_hash của ${label}!`]);",
        "setPaymentLog(prev => [...prev, t('booking.weblnPreimageMismatch', { label })]);"
    ),
    (
        "setErrorMsg(`Chữ ký preimage từ ví không khớp payment_hash của ${label}!`);",
        "setErrorMsg(t('booking.preimageMismatchError', { label }));"
    ),
    (
        "`✓ [WebLN] ${label} đã thanh toán & xác minh thành công!`,",
        "t('booking.weblnPaymentSuccess', { label }),"
    ),
    (
        "`⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats) để hoàn tất!`",
        "t('booking.partialPaidHost', { sats: protocolFeeSats.toLocaleString() })"
    ),
    (
        "`⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats) để hoàn tất!`",
        "t('booking.partialPaidTreasury', { sats: totalPriceSats.toLocaleString() })"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [WebLN] Lỗi thanh toán ${label}: ${result.error || 'Giao dịch bị từ chối'}`]);",
        "setPaymentLog(prev => [...prev, t('booking.weblnPaymentError', { label, error: result.error || t('booking.txRejected') })]);"
    ),
    (
        "setErrorMsg(result.error || `Thanh toán ${label} bị từ chối`);",
        "setErrorMsg(result.error || t('booking.paymentRejected', { label }));"
    ),
    (
        "const label = tab === 'host' ? `Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats)` : `Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats)`;",
        "const label = tab === 'host' ? t('booking.part1HostLabel', { sats: totalPriceSats.toLocaleString() }) : t('booking.part2TreasuryLabel', { sats: protocolFeeSats.toLocaleString() });"
    ),
    (
        "`⚡ [NWC NIP-47] Đang gửi yêu cầu thanh toán ${label}...`,",
        "t('booking.nwcSendingPayment', { label }),"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [NWC] Preimage không khớp payment_hash của ${label}!`]);",
        "setPaymentLog(prev => [...prev, t('booking.nwcPreimageMismatch', { label })]);"
    ),
    (
        "setErrorMsg(`Chữ ký preimage từ NWC không khớp payment_hash của ${label}!`);",
        "setErrorMsg(t('booking.nwcPreimageMismatchError', { label }));"
    ),
    (
        "`✓ [NWC] ${label} đã xác nhận thanh toán!`,",
        "t('booking.nwcConfirmedPayment', { label }),"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [NWC] Lỗi thanh toán ${label}: ${result.error}`]);",
        "setPaymentLog(prev => [...prev, t('booking.nwcPaymentError', { label, error: result.error || '' })]);"
    ),
    (
        "setErrorMsg(result.error || `Thanh toán ${label} qua NWC thất bại`);",
        "setErrorMsg(result.error || t('booking.nwcFailedLabel', { label }));"
    ),
    (
        "`⚡ [NWC NIP-47] Đang thanh toán Khoản 1: Tiền phòng Host (${totalPriceSats.toLocaleString()} Sats)...`",
        "t('booking.nwcPayingPart1', { sats: totalPriceSats.toLocaleString() })"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [NWC] Lỗi thanh toán Khoản 1 (Host): ${resH.error}`]);",
        "setPaymentLog(prev => [...prev, t('booking.nwcPart1Error', { error: resH.error || '' })]);"
    ),
    (
        "setErrorMsg(`Thanh toán Khoản 1 thất bại: ${resH.error}`);",
        "setErrorMsg(t('booking.nwcPart1Failed', { error: resH.error || '' }));"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [NWC] Preimage Khoản 1 không khớp payment_hash!`]);",
        "setPaymentLog(prev => [...prev, t('booking.nwcPart1PreimageMismatchLog')]);"
    ),
    (
        "setErrorMsg('Preimage Khoản 1 không khớp payment_hash!');",
        "setErrorMsg(t('booking.nwcPart1PreimageMismatch'));"
    ),
    (
        "`✓ [NWC] Khoản 1 (Host) đã thanh toán & xác minh thành công! (Preimage: ${resH.preimage?.slice(0, 24)}...)`",
        "t('booking.nwcPart1Success', { preimage: resH.preimage?.slice(0, 24) || '' })"
    ),
    (
        "`⚡ [NWC NIP-47] Đang thanh toán Khoản 2: Phí Treasury (${protocolFeeSats.toLocaleString()} Sats)...`",
        "t('booking.nwcPayingPart2', { sats: protocolFeeSats.toLocaleString() })"
    ),
    (
        "`❌ [NWC] Lỗi thanh toán Khoản 2 (Treasury): ${resT.error}`,\n          `⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Tiền phòng Host đã trả, nhưng phí Treasury thất bại! Vui lòng hoàn tất thanh toán Khoản 2.`",
        "t('booking.nwcPart2Error', { error: resT.error || '' }),\n          t('booking.partialPaidHostTreasuryFailed')"
    ),
    (
        "setErrorMsg(`Thanh toán Khoản 2 (Treasury) thất bại: ${resT.error}. Trạng thái giữ một phần!`);",
        "setErrorMsg(t('booking.nwcPart2FailedPartial', { error: resT.error || '' }));"
    ),
    (
        "setPaymentLog(prev => [...prev, `❌ [NWC] Preimage Khoản 2 không khớp payment_hash!`]);",
        "setPaymentLog(prev => [...prev, t('booking.nwcPart2PreimageMismatchLog')]);"
    ),
    (
        "setErrorMsg('Preimage Khoản 2 không khớp payment_hash! Trạng thái giữ một phần!');",
        "setErrorMsg(t('booking.nwcPart2PreimageMismatchPartial'));"
    ),
    (
        "`✓ [NWC] Khoản 2 (Treasury) đã thanh toán & xác minh thành công! (Preimage: ${resT.preimage?.slice(0, 24)}...)`",
        "t('booking.nwcPart2Success', { preimage: resT.preimage?.slice(0, 24) || '' })"
    ),
    (
        "setErrorMsg('Vui lòng dán mã Preimage (32 bytes hex) từ ví Lightning sau khi thanh toán.');",
        "setErrorMsg(t('booking.pastePreimagePrompt'));"
    ),
    (
        "const label = tab === 'host' ? `Khoản 1 (Tiền phòng: ${totalPriceSats.toLocaleString()} Sats)` : `Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats)`;",
        "const label = tab === 'host' ? t('booking.part1HostRoomLabel', { sats: totalPriceSats.toLocaleString() }) : t('booking.part2TreasuryLabel', { sats: protocolFeeSats.toLocaleString() });"
    ),
    (
        "`Kiểm tra Proof-of-Payment: Đang xác minh Preimage cho ${label}...`,",
        "t('booking.verifyingPreimageFor', { label }),"
    ),
    (
        "`❌ XÁC MINH THẤT BẠI: Preimage không khớp với payment_hash của ${label}!`,",
        "t('booking.verifyFailedPreimageMismatch', { label }),"
    ),
    (
        "setErrorMsg(`Xác minh mật mã thất bại: Preimage không khớp với payment_hash của ${label}!`);",
        "setErrorMsg(t('booking.verifyFailedPreimageMismatchError', { label }));"
    ),
    (
        "`✓ XÁC MINH MẬT MÃ THÀNH CÔNG: SHA-256(preimage) === payment_hash (${label})`,",
        "t('booking.verifySuccessSha256', { label }),"
    ),
    (
        "`  └─ Proof-of-Payment hợp lệ (Preimage: ${cleanPreimage.slice(0, 32)}...)`",
        "t('booking.proofOfPaymentValid', { preimage: cleanPreimage.slice(0, 32) })"
    ),
    (
        "onAddLog('lightning', `Xác nhận thanh toán ${label} thành công qua Preimage: ${cleanPreimage.slice(0, 16)}...`, targetHash);",
        "onAddLog('lightning', t('booking.paymentConfirmedLog', { label, preimage: cleanPreimage.slice(0, 16) }), targetHash);"
    ),
    (
        "`⚠️ TRẠNG THÁI MỘT PHẦN (1/2 HOÀN TẤT): Đã xác minh tiền phòng Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats) để hoàn tất đặt phòng.`",
        "t('booking.partialVerifiedHostPrompt', { sats: protocolFeeSats.toLocaleString() })"
    ),
    (
        "`⚠️ TRẠNG THÁI MỘT PHẦN (1/2 HOÀN TẤT): Đã xác minh phí Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats) để hoàn tất đặt phòng.`",
        "t('booking.partialVerifiedTreasuryPrompt', { sats: totalPriceSats.toLocaleString() })"
    ),
    (
        "`🎉 TẤT CẢ KHOẢN THANH TOÁN ĐÃ ĐƯỢC XÁC THỰC MẬT MÃ:`,",
        "t('booking.allPaymentsCryptographicallyVerified'),"
    ),
    (
        "`  ├─ Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats (Preimage: ${finalHostPreimage.slice(0, 24)}...)`,",
        "t('booking.hostRoomFeeLog', { sats: totalPriceSats.toLocaleString(), preimage: finalHostPreimage.slice(0, 24) }),"
    ),
    (
        "? `  └─ Phí Protocol: Đã gộp vào hóa đơn Host`",
        "? t('booking.protocolFeeMergedLog')"
    ),
    (
        ": `  └─ Phí Protocol Treasury: ${protocolFeeSats.toLocaleString()} Sats (Preimage: ${finalTreasuryPreimage.slice(0, 24)}...)`",
        ": t('booking.protocolFeeTreasuryLog', { sats: protocolFeeSats.toLocaleString(), preimage: finalTreasuryPreimage.slice(0, 24) })"
    ),
    (
        "// Trích thưởng 1% Referral Sats nếu đủ điều kiện (Chỉ áp dụng lượt Đặt Phòng Đầu Tiên)",
        "// 1% Referral Sats reward execution if eligible"
    ),
    (
        "Chọn Loại Phòng Lưu Trú",
        "{t('booking.selectRoomTypeTitle')}"
    ),
    (
        "Đổi loại phòng",
        "{t('booking.changeRoomType')}"
    ),
    (
        "Đã quét thanh toán từ ví ngoài (Zeus / Phoenix / Alby)?",
        "{t('booking.paidViaExternalWalletPrompt')}"
    ),
    (
        "Xác minh",
        "{t('booking.verifyBtn')}"
    ),
    (
        "Tiếp tục thanh toán",
        "{t('booking.continuePaymentBtn')}"
    ),
    (
        "Vẫn thoát",
        "{t('booking.exitAnywayBtn')}"
    )
]

for old, new in replacements:
    if old not in content:
        print('MISSING TARGET:', repr(old))
    else:
        content = content.replace(old, new, 1)

open(path, 'w', encoding='utf-8').write(content)
print('BookingModal script execution finished.')
