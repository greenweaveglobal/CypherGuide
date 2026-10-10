import json

VI_PATH = 'src/locales/vi.json'
EN_PATH = 'src/locales/en.json'

vi_data = json.load(open(VI_PATH, encoding='utf-8'))
en_data = json.load(open(EN_PATH, encoding='utf-8'))

keys_vi = {
    'uploadedViaServer': 'Đã tải ảnh thành công qua máy chủ: {server}',
    'errUploadCoverNostr': 'Lỗi khi tải ảnh bìa lên máy chủ Nostr.',
    'errMax10Images': 'Chỉ chọn tối đa 10 ảnh mỗi lần, vui lòng chọn ít hơn.',
    'errNoMediaServer': 'Không tìm thấy server media khả dụng',
    'errCompressImg': 'Lỗi nén ảnh: {msg}',
    'errUploadImg': 'Lỗi tải ảnh',
    'detailPrefix': 'Chi tiết',
    'mediaServerLabel': 'Máy chủ Media (NIP-96):',
    'checkingConn': 'Đang kiểm tra kết nối...',
    'fallbackBadge': ' [Dự phòng]',
    'notChecked': 'Chưa kiểm tra',
    'simulateOfflineTooltip': 'Mô phỏng máy chủ chính bị tắt để kiểm tra tính năng tự động chuyển sang máy chủ dự phòng',
    'simPrimaryOffline': '🧪 Server chính: ĐANG TẮT (Giả lập)',
    'simPrimaryAction': '🧪 Giả lập tắt server chính',
    'redirectWarning': 'Cảnh báo chuyển hướng',
    'compressingCover': 'Nén ảnh bìa...',
    'uploadingProgress': 'Đang tải lên {progress}%',
    'changeCoverFromFile': 'Đổi ảnh bìa từ tệp',
    'presetDataSaver': 'Tiết kiệm dữ liệu',
    'presetBalanced': 'Cân bằng',
    'presetHighQuality': 'Chất lượng cao',
    'processingUpload': 'Đang xử lý tải ảnh...',
    'queueProgress': 'Tiến trình từng ảnh ({done}/{total}):',
    'uploadingSequential': 'Đang tải lên tuần tự...',
    'queueWaiting': 'Đang chờ...',
    'queueCompressing': 'Nén ảnh...',
    'queueDone': 'Đã xong ✓',
    'clearErrorTooltip': 'Xóa thông báo lỗi này',
    'physicalSpecsTitle': 'Thông số phòng thực tế (RFC-0018)',
    'summaryPolicyFlexible': 'Hủy trước 24h: 100%',
    'summaryPolicyModerate': 'Hủy trước 5 ngày: 100%',
    'summaryPolicyStrict': 'Hủy trước 14 ngày: 100%',
    'summaryPolicyNonrefundable': 'Không hoàn tiền',
    'uploadingImagesBtn': 'Đang tải ảnh...',
}

keys_en = {
    'uploadedViaServer': 'Image uploaded successfully via server: {server}',
    'errUploadCoverNostr': 'Error uploading cover image to Nostr media server.',
    'errMax10Images': 'Please select at most 10 images at once.',
    'errNoMediaServer': 'No available media server found',
    'errCompressImg': 'Image compression error: {msg}',
    'errUploadImg': 'Image upload error',
    'detailPrefix': 'Details',
    'mediaServerLabel': 'Media Server (NIP-96):',
    'checkingConn': 'Checking connectivity...',
    'fallbackBadge': ' [Fallback]',
    'notChecked': 'Not checked',
    'simulateOfflineTooltip': 'Simulate primary server outage to test automated failover',
    'simPrimaryOffline': '🧪 Primary Server: OFFLINE (Simulated)',
    'simPrimaryAction': '🧪 Simulate primary server outage',
    'redirectWarning': 'Redirect Warning',
    'compressingCover': 'Compressing cover image...',
    'uploadingProgress': 'Uploading {progress}%',
    'changeCoverFromFile': 'Change cover from file',
    'presetDataSaver': 'Data Saver',
    'presetBalanced': 'Balanced',
    'presetHighQuality': 'High Quality',
    'processingUpload': 'Processing upload...',
    'queueProgress': 'Image Queue Progress ({done}/{total}):',
    'uploadingSequential': 'Uploading sequentially...',
    'queueWaiting': 'Waiting...',
    'queueCompressing': 'Compressing...',
    'queueDone': 'Done ✓',
    'clearErrorTooltip': 'Dismiss this error message',
    'physicalSpecsTitle': 'Physical Stay Specifications (RFC-0018)',
    'summaryPolicyFlexible': 'Cancel > 24h: 100%',
    'summaryPolicyModerate': 'Cancel > 5 days: 100%',
    'summaryPolicyStrict': 'Cancel > 14 days: 100%',
    'summaryPolicyNonrefundable': 'Non-refundable',
    'uploadingImagesBtn': 'Uploading images...',
}

for k, v in keys_vi.items(): vi_data['hostReg'][k] = v
for k, v in keys_en.items(): en_data['hostReg'][k] = v

json.dump(vi_data, open(VI_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(en_data, open(EN_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# Now refactor HostRegistrationModal.tsx
modal_path = 'src/components/HostRegistrationModal.tsx'
content = open(modal_path, encoding='utf-8').read()

replacements = [
    (
        "const msg = t('hostReg.errImgOver10MB') || 'Dung lượng ảnh vượt quá 10MB! Vui lòng chọn ảnh nhỏ hơn.';",
        "const msg = t('hostReg.errImgOver10MB');"
    ),
    (
        "warning: server.isPrimary ? undefined : `Đã tải ảnh thành công qua máy chủ: ${server.name}`",
        "warning: server.isPrimary ? undefined : t('hostReg.uploadedViaServer', { server: server.name })"
    ),
    (
        "const errMsg = err.message || 'Lỗi khi tải ảnh bìa lên máy chủ Nostr.';",
        "const errMsg = err.message || t('hostReg.errUploadCoverNostr');"
    ),
    (
        "setErrorMsg('Chỉ chọn tối đa 10 ảnh mỗi lần, vui lòng chọn ít hơn.');",
        "setErrorMsg(t('hostReg.errMax10Images'));"
    ),
    (
        "error: isOverSize ? (t('hostReg.errImgOver10MB') || 'Kích thước vượt quá 10MB') : undefined",
        "error: isOverSize ? t('hostReg.errImgOver10MB') : undefined"
    ),
    (
        "return { ...item, status: 'error', error: serverErr.message || 'Không tìm thấy server media khả dụng' };",
        "return { ...item, status: 'error', error: serverErr.message || t('hostReg.errNoMediaServer') };"
    ),
    (
        "setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: 'Lỗi nén ảnh: ' + compErr.message } : q));",
        "setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: t('hostReg.errCompressImg', { msg: compErr.message }) } : q));"
    ),
    (
        "setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: uploadErr.message || 'Lỗi tải ảnh' } : q));",
        "setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: uploadErr.message || t('hostReg.errUploadImg') } : q));"
    ),
    (
        "setErrorMsg(`${t('hostReg.errSigning')} — Chi tiết: ${detail}`);",
        "setErrorMsg(`${t('hostReg.errSigning')} — ${t('hostReg.detailPrefix')}: ${detail}`);"
    ),
    (
        '<span className="text-[10px] uppercase font-bold text-gray-400">Máy chủ Media (NIP-96):</span>',
        '<span className="text-[10px] uppercase font-bold text-gray-400">{t(\'hostReg.mediaServerLabel\')}</span>'
    ),
    (
        '<Loader2 className="w-3 h-3 animate-spin" /> Đang kiểm tra kết nối...',
        '<Loader2 className="w-3 h-3 animate-spin" /> {t(\'hostReg.checkingConn\')}'
    ),
    (
        "{activeServerInfo.isFallback && ' [Dự phòng]'}",
        "{activeServerInfo.isFallback && t('hostReg.fallbackBadge')}"
    ),
    (
        '<span className="text-[10px] text-gray-500">Chưa kiểm tra</span>',
        '<span className="text-[10px] text-gray-500">{t(\'hostReg.notChecked\')}</span>'
    ),
    (
        'title="Mô phỏng máy chủ chính bị tắt để kiểm tra tính năng tự động chuyển sang máy chủ dự phòng"',
        'title={t(\'hostReg.simulateOfflineTooltip\')}'
    ),
    (
        "<span>{simulateOffline ? '🧪 Server chính: ĐANG TẮT (Giả lập)' : '🧪 Giả lập tắt server chính'}</span>",
        "<span>{simulateOffline ? t('hostReg.simPrimaryOffline') : t('hostReg.simPrimaryAction')}</span>"
    ),
    (
        '<span className="font-bold">Cảnh báo chuyển hướng:</span> {activeServerInfo.warning}',
        '<span className="font-bold">{t(\'hostReg.redirectWarning\')}:</span> {activeServerInfo.warning}'
    ),
    (
        '<span>Nén ảnh bìa...</span>',
        '<span>{t(\'hostReg.compressingCover\')}</span>'
    ),
    (
        '<span>Đang tải lên {coverUploadState.progress}%</span>',
        '<span>{t(\'hostReg.uploadingProgress\', { progress: coverUploadState.progress })}</span>'
    ),
    (
        "<span>{imageUrl ? 'Đổi ảnh bìa từ tệp' : t('hostReg.uploadFromFile')}</span>",
        "<span>{imageUrl ? t('hostReg.changeCoverFromFile') : t('hostReg.uploadFromFile')}</span>"
    ),
    (
        'Tiết kiệm dữ liệu',
        '{t(\'hostReg.presetDataSaver\')}'
    ),
    (
        'Cân bằng',
        '{t(\'hostReg.presetBalanced\')}'
    ),
    (
        'Chất lượng cao',
        '{t(\'hostReg.presetHighQuality\')}'
    ),
    (
        '<span>Đang xử lý tải ảnh...</span>',
        '<span>{t(\'hostReg.processingUpload\')}</span>'
    ),
    (
        'Tiến trình từng ảnh ({uploadQueue.filter(q => q.status === \'done\').length}/{uploadQueue.length}):',
        '{t(\'hostReg.queueProgress\', { done: uploadQueue.filter(q => q.status === \'done\').length, total: uploadQueue.length })}'
    ),
    (
        'Đang tải lên tuần tự...',
        '{t(\'hostReg.uploadingSequential\')}'
    ),
    (
        '<Clock className="w-3 h-3" /> Đang chờ...',
        '<Clock className="w-3 h-3" /> {t(\'hostReg.queueWaiting\')}'
    ),
    (
        '<Loader2 className="w-3 h-3 animate-spin" /> Nén ảnh...',
        '<Loader2 className="w-3 h-3 animate-spin" /> {t(\'hostReg.queueCompressing\')}'
    ),
    (
        '<span>Đang tải lên {item.progress}%</span>',
        '<span>{t(\'hostReg.uploadingProgress\', { progress: item.progress })}</span>'
    ),
    (
        '<CheckCircle2 className="w-3 h-3" /> Đã xong ✓',
        '<CheckCircle2 className="w-3 h-3" /> {t(\'hostReg.queueDone\')}'
    ),
    (
        "<AlertTriangle className=\"w-3 h-3 shrink-0\" /> {item.error || 'Lỗi tải ảnh'}",
        "<AlertTriangle className=\"w-3 h-3 shrink-0\" /> {item.error || t('hostReg.errUploadImg')}"
    ),
    (
        'title="Xóa thông báo lỗi này"',
        'title={t(\'hostReg.clearErrorTooltip\')}'
    ),
    (
        'Thông số phòng thực tế (RFC-0018)',
        '{t(\'hostReg.physicalSpecsTitle\')}'
    ),
    (
        "{policy === 'flexible' && 'Hủy trước 24h: 100%'}",
        "{policy === 'flexible' && t('hostReg.summaryPolicyFlexible')}"
    ),
    (
        "{policy === 'moderate' && 'Hủy trước 5 ngày: 100%'}",
        "{policy === 'moderate' && t('hostReg.summaryPolicyModerate')}"
    ),
    (
        "{policy === 'strict' && 'Hủy trước 14 ngày: 100%'}",
        "{policy === 'strict' && t('hostReg.summaryPolicyStrict')}"
    ),
    (
        "{policy === 'nonrefundable' && 'Không hoàn tiền'}",
        "{policy === 'nonrefundable' && t('hostReg.summaryPolicyNonrefundable')}"
    ),
    (
        "{isSubmitting ? t('hostReg.signingBtn') : (isBatchProcessing || coverUploadState.status === 'uploading') ? 'Đang tải ảnh...' : t('hostReg.signAndBroadcast')}",
        "{isSubmitting ? t('hostReg.signingBtn') : (isBatchProcessing || coverUploadState.status === 'uploading') ? t('hostReg.uploadingImagesBtn') : t('hostReg.signAndBroadcast')}"
    ),
    (
        "{/* Cổ đông Multisig (Co-Owners) */}",
        "{/* Multisig Co-Owners */}"
    )
]

for old, new in replacements:
    if old not in content:
        print('MISSING TARGET:', repr(old[:50]))
    else:
        content = content.replace(old, new, 1)

open(modal_path, 'w', encoding='utf-8').write(content)
print('Finished updating HostRegistrationModal.tsx!')
