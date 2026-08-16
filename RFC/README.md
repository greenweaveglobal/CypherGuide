# RFC Index

Quy trình: xem `../CONTRIBUTING.md`. Template: `0000-template.md`. Tổng quan kiến trúc
(không phải RFC): `../ARCHITECTURE.md`.

Mỗi tài liệu có bản `.en.md` song song (ví dụ `0003-....md` + `0003-....en.md`) — tiếng
Việt là bản gốc/nguồn (source of truth), tiếng Anh dịch theo. Khi sửa nội dung, sửa bản
Việt trước rồi đồng bộ bản Anh trong cùng PR — đừng để 2 bản lệch nhau (đúng bài học đã
từng gặp với chính bộ tài liệu này).

**RFC-0003 là tài liệu nền tảng nhất khi có từ 2 ứng dụng trở lên cùng dùng chung
Identity/Proof/Reputation** — code có thể refactor/đổi framework, nhưng phá cam kết
ở RFC-0003 là phá khả năng tương thích của cả hệ sinh thái, không chỉ một app.

| # | Tiêu đề | Trạng thái | Module |
|---|---|---|---|
| 0001 | Cách chọn Guardian Council cho Quỹ Bảo Hiểm | Draft | `utils/insuranceFund.ts` |
| 0002 | Đường cong giảm phí theo uy tín | Draft | `utils/dynamicFee.ts` |
| 0003 | Identity & Portable Reputation | Draft | `utils/proofOfStay.ts` |
| 0004 | Internationalization (i18n) cho giao diện | Draft | `src/components/*.tsx`, `src/locales/` |
| 0005 | Trợ Lý Tra Cứu Dựa Trên Tài Liệu (Grounded Docs Assistant) | Draft | `src/components/DocsAssistant.tsx` |
| 0006 | Lớp KYC Tùy Chọn (Optional Attestation Layer) | Draft | `utils/proofOfStay.ts` (mở rộng `proof_type`) |
| 0007 | Mô Thức AI Phi Tập Trung (Decentralized AI over Mesh) | Draft (visionary) | `DocsAssistant.tsx`, `server.ts` (RFC-0005) |
| 0008 | Lưu Trú Dựa Trên Tùy Tâm (Dana-Based Stay) | Draft | `types.ts`, `ListingDetail.tsx`, `depositEscrow.ts` |
| 0009 | AI Phi Tập Trung Chạy Trên Thiết Bị Ngoại Biên (Decentralized AI on Edge Devices) | Draft (visionary) | `MeshNeighborhood.tsx` (RFC-0007 mở rộng) |
| 0010 | Nghi Thức Tĩnh Tâm — Vòng Tròn, Nén Nhang, 369 Giây (Zen Stillness Ritual) | Draft | `StillnessRitual.tsx` (mới), `ListingDetail.tsx` |

Số RFC tiếp theo: **0011**.

## Quy ước đặt tên (đã thống nhất lại)

`NNNN-slug-ngan-gon.md`, số 4 chữ số, tăng dần, không trùng. Một RFC = một quyết định
đơn lẻ kèm các phương án đã cân nhắc + đánh đổi bảo mật (xem `0000-template.md`). Tài
liệu tổng quan nhiều chủ đề (kiến trúc chung, roadmap...) **không** đánh số RFC — đặt ở
root repo (ví dụ `ARCHITECTURE.md`) và RFC tham chiếu ngược lại nó khi cần, không phải
ngược lại.
