path = 'src/components/BookingModal.tsx'
content = open(path, encoding='utf-8').read()

# 1. line 176
content = content.replace(
    "setErrorMsg('Listing này chưa có Lightning Address hợp lệ của Host để nhận thanh toán.');",
    "setErrorMsg(t('booking.listingNoHostLightningAddress'));"
)

# 2. line 198
content = content.replace(
    "setErrorMsg(hostResolved.error || `Không thể tạo invoice từ máy chủ Lightning của Host (${targetLightningAddress}).`);",
    "setErrorMsg(hostResolved.error || t('booking.cannotCreateHostInvoice', { address: targetLightningAddress }));"
)

# 3. line 230
content = content.replace(
    "setErrorMsg(`Số tiền invoice Host (${parsedH.amountSats} Sats) không khớp với tiền phòng (${finalHostSats} Sats)!`);",
    "setErrorMsg(t('booking.hostAmountMismatch', { invoiceSats: parsedH.amountSats, expectedSats: finalHostSats }));"
)

# 4. line 236
content = content.replace(
    "setErrorMsg(`Số tiền invoice Treasury (${parsedT.amountSats} Sats) không khớp với phí protocol (${finalTreasurySats} Sats)!`);",
    "setErrorMsg(t('booking.treasuryAmountMismatch', { invoiceSats: parsedT.amountSats, expectedSats: finalTreasurySats }));"
)

# 5. Fix cashu lines 268-273 if needed
bad_cashu = """    if (paymentMethod === 'cashu') {
      setPaymentLog([
        t('booking.cashuLogInit', { sats: totalWithFee.toLocaleString() })t('booking.weblnPaymentSuccess', { label })t('booking.nwcConfirmedPayment', { label })t('booking.verifyFailedPreimageMismatch', { label })t('booking.verifySuccessSha256', { label }),
      t('booking.proofOfPaymentValid', { preimage: cleanPreimage.slice(0, 32) })  `[Cashu NIP-61] Mint server: https://mint.cashu.space (Chaumian Blind Signature)`,
        t('booking.cashuLogToken')
      ]);"""
good_cashu = """    if (paymentMethod === 'cashu') {
      setPaymentLog([
        t('booking.cashuLogInit', { sats: totalWithFee.toLocaleString() }),
        `[Cashu NIP-61] Mint server: https://mint.cashu.space (Chaumian Blind Signature)`,
        t('booking.cashuLogToken')
      ]);"""
if bad_cashu in content:
    content = content.replace(bad_cashu, good_cashu)

# 6. shouldMerge and dual invoice lines 276-291
bad_block = """    } else if (shouldMerge) {
      setPaymentLog([
        t('booking.lnLogBolt11', { sats: finalHostSats.toLocaleString() }),
        `ℹ️ [RFC-0016] Phí protocol (${protocolFeeSats} Sats) được gộp vào hóa đơn Host (${targetLightningAddress}) do quá nhỏ để tách riêng (< 1 Sat) hoặc yêu cầu minSendable từ treasury.`,
        `Hóa đơn Host: ${hostResolved.invoice.slice(0, 32)}...`,
        t('booking.lnLogTracking')
      ]);
      onAddLog('lightning', `Hóa đơn thanh toán Host: ${finalHostSats} Sats (đã gộp phí protocol)`, parsedHHash);
    } else {
      setPaymentLog([
        `⚡ [RFC-0016 Lightning Payout Flow] Khởi tạo 2 hóa đơn Lightning phân tách độc lập:`,
        `  ├─ Hóa đơn 1 (Host): ${finalHostSats.toLocaleString()} Sats -> ${targetLightningAddress}`,
        `  └─ Hóa đơn 2 (Treasury Quỹ Thưởng): ${finalTreasurySats.toLocaleString()} Sats -> ${treasuryAddress}`,
        `⚠️ TIÊU CHUẨN MẬT MÃ: Cả hai hóa đơn đều phải được xác nhận bằng Preimage SHA-256 mới kích hoạt booking.`,
        `Trạng thái: 0/2 Hoàn tất. Đang chờ thanh toán Khoản 1...`
      ]);
      onAddLog('lightning', `Khởi tạo thanh toán 2 invoice: Host (${finalHostSats} Sats) + Treasury (${finalTreasurySats} Sats)`, parsedHHash);
    }"""

good_block = """    } else if (shouldMerge) {
      setPaymentLog([
        t('booking.lnLogBolt11', { sats: finalHostSats.toLocaleString() }),
        t('booking.protocolFeeMergedLogDetail', { sats: protocolFeeSats, address: targetLightningAddress }),
        t('booking.hostInvoiceLog', { invoice: hostResolved.invoice.slice(0, 32) }),
        t('booking.lnLogTracking')
      ]);
      onAddLog('lightning', t('booking.hostRoomFeeMergedLog', { sats: finalHostSats }), parsedHHash);
    } else {
      setPaymentLog([
        t('booking.rfc0016DualInvoiceInit'),
        t('booking.rfc0016Invoice1Log', { sats: finalHostSats.toLocaleString(), address: targetLightningAddress }),
        t('booking.rfc0016Invoice2Log', { sats: finalTreasurySats.toLocaleString(), address: treasuryAddress }),
        t('booking.rfc0016CryptoStandardNote'),
        t('booking.rfc0016StatusWaitingPart1')
      ]);
      onAddLog('lightning', t('booking.rfc0016InitTwoInvoicesLog', { hostSats: finalHostSats, treasurySats: finalTreasurySats }), parsedHHash);
    }"""

if bad_block in content:
    content = content.replace(bad_block, good_block)

# 7. line 306
content = content.replace(
    "onAddLog('lightning', `  ├─ RFC-0016 Treasury: ${protocolFeeSats.toLocaleString()} Sats -> Ví Quỹ Thưởng Hạ Tầng: ${treasuryAddress}`);",
    "onAddLog('lightning', t('booking.rfc0016TreasuryLogShare', { sats: protocolFeeSats.toLocaleString(), address: treasuryAddress }));"
)

# 8. line 382
content = content.replace(
    "const label = tab === 'host' ? `Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats)` : `Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats)`;",
    "const label = tab === 'host' ? t('booking.part1HostLabel', { sats: totalPriceSats.toLocaleString() }) : t('booking.part2TreasuryLabel', { sats: protocolFeeSats.toLocaleString() });"
)

# 9. line 388
bad_388 = "`⚡ [NWC NIP-47] Đang gửi yêu cầu thanh toán ${label}...`t('booking.nwcSendingPayment', { label }),"
if bad_388 in content:
    content = content.replace(bad_388, "t('booking.nwcSendingPayment', { label }),")

# 10. lines 418 & 431
content = content.replace(
    "`⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats) để hoàn tất!`",
    "t('booking.partialPaidHost', { sats: protocolFeeSats.toLocaleString() })"
)
content = content.replace(
    "`⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats) để hoàn tất!`",
    "t('booking.partialPaidTreasury', { sats: totalPriceSats.toLocaleString() })"
)

# 11. line 579
content = content.replace(
    "setErrorMsg(`{t('booking.verifyBtn')} mật mã thất bại: Preimage không khớp với payment_hash của ${label}!`);",
    "setErrorMsg(t('booking.verifyFailedPreimageMismatchError', { label }));"
)

open(path, 'w', encoding='utf-8').write(content)
print('BookingModal fixed cleanly.')
