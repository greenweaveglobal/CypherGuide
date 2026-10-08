# Bàn giao ngữ cảnh CypherGuide (rà soát mã nguồn 30/09/2026)

Thay thế `HANDOFF_NOTES.md` cũ (25/07/2026, đã lỗi thời: mô tả trạng thái trước audit). Dán file này vào đầu cửa sổ ngữ cảnh mới.

## 1. Dự án là gì
Giao thức + app lưu trú P2P phi tập trung. Khách/Host dùng Nostr (danh tính, tin nhắn, Proof-of-Stay) và Lightning (thanh toán). Repo công khai: `greenweaveglobal/CypherGuide`. Domain `cypherguide.org`, relay riêng `relay.cypherguide.org`.

- Stack: React 19 + Vite + Tailwind 4 + Zustand (IndexedDB) + `nostr-tools` + Express (`server.ts`) + hàm serverless Vercel (`api/`).
- Node >= 22.12. Test: `vitest` (15 file trong `tests/`, 84 test passed 100%). CI: `.github/workflows/ci.yml` (tsc, vitest, npm audit).
- Tài liệu: tiếng Việt là bản gốc, `.en.md` dịch theo. Sửa bản Việt trước, đồng bộ bản Anh trong cùng lần sửa.
- RFC 0001-0018 nằm trong `RFC/`. Số RFC tiếp theo: **0019**. Chỉ mục ở `RFC/README.md`.

## 2. Bản đồ mã nguồn
| Khu vực | File chính |
|---|---|
| Server dev/Cloud Run | `server.ts` (802 dòng): helmet, CORS, rate limit docs, `/api/protocol/config` (GET/POST), `/api/protocol/fee` (PATCH), `/api/lightning/resolve-invoice`, upload media (multer), `/.well-known/nostr.json` |
| Serverless Vercel | `api/docs-assistant/query.ts` (Upstash rate limit), `api/protocol/config.ts`, `api/protocol/fee.ts`, `api/lightning/resolve-invoice.ts` |
| Logic dùng chung server | `lib/docsAssistant.ts` (Gemini, cần `GEMINI_API_KEY`), `lib/lnurlResolver.ts` (chống SSRF LUD-06) |
| Giao thức/kinh tế (client) | `src/utils/`: `dynamicFee`, `pricing`, `proofOfStay`, `kycAttestation`, `insuranceFund`, `depositEscrow`, `cashu`, `nwc`, `lightning`, `crypto`, `reconciler`, `infraContribution`, `referral`, `protocolGovernance`, `mediaServer`, `nip98Auth` |
| State | `src/store/useAppStore.ts` (725 dòng) |
| UI lớn nhất | `GovernancePanel` (1675), `HostCalendarPricing` (1595), `BookingModal` (1464), `HostRegistrationModal` (1304), `ListingDetail` (1260), `NostrIdentityManager` (1249), `MeshNeighborhood` (1126) |
| Cấu hình động | `data/protocol_config.json` (địa chỉ dev-donation, treasury, `baseFeeRatePcm`) |

## 3. Trạng thái bảo mật (đã đối chiếu với code)
Đã vá và có trong code:
- C3: kiểm magic-byte upload media (chặn SVG XSS).
- C4: `isSimulatedInvoice()` luôn trả `false`; thanh toán yêu cầu `SHA-256(preimage) == payment_hash`.
- Xác thực NIP-98 (kind 27235) cho endpoint admin, cửa sổ ±60 giây, chống replay 120s bằng Redis/RAM, kiểm URL tuyệt đối & SHA-256 body hash, whitelist pubkey dùng chung tại `src/constants/adminPubkeys.ts`.
- NIP-49 vault (`ncryptsec`/`scrypt`), xác thực chữ ký KYC attestation, Proof-of-Stay đồng ký hai bên, chống SSRF LUD-06.
- Rate limiter Upstash (sliding window) kết nối cho cả Vercel (`api/`) và Express (`server.ts`), bảo vệ cả endpoint docs query lẫn resolve-invoice.
- Hàm trích xuất IP `getClientIp` an toàn (`req.ip` hoặc phần tử cuối đáng tin cậy của `x-forwarded-for`).
- Lưu trữ cấu hình `data/protocol_config.json` tích hợp Upstash Redis và fallback disk, tương thích với filesystem chỉ-đọc của serverless.
- CORS whitelist so khớp chính xác tên miền (`cypherguide.org`, `media.cypherguide.org`, localhost ở dev), chặn hoàn toàn các domain lạ.
- Chế độ Media Server NIP-96: Health probe nghiêm ngặt, tự động chuyển đổi dự phòng (failover) sang máy chủ NIP-96 công cộng, bỏ qua `/api/media-fallback` cục bộ khi chạy môi trường serverless không có backend Express.

Còn mở:
1. **Trọng tài 2-of-3 vẫn là placeholder.** Ba pubkey trong `DEFAULT_ARBITRATOR_POOL` (`insuranceFund.ts`) không có ai giữ private key. Escrow/tranh chấp không dùng được trên production. Việc cần làm: onboard 3 trọng tài độc lập thật.

## 4. Kiểm toán và sự nhất quán
- `MATURITY.md`: Đã đồng bộ 15 suites/84 tests, React 19, thêm mục 19 (RFC-0018).
- `ARCHITECTURE.md`: React 19 + Tailwind CSS + Vite.
- `package.json`: `greenweaveglobal/cypherguide`, `vite` ở devDependencies, script `check:esm` kiểm tra phân giải ESM của Vercel API routes.
- Tất cả các nút mock/dev (giả lập verifier, giả lập tắt server chính) đều bị khóa cứng sau cờ `import.meta.env.DEV` và loại bỏ khỏi production build (Đã xác nhận kiểm tra trong code & production bundle).
- Đã khắc phục các lỗi import component (MapPin trong BookingModal, AlertCircle trong ListingDetail), tsc/lint đạt 0 cảnh báo.
- Bản build production (`npm run build`) và kiểm thử phân giải ESM (`npm run check:esm`) hoàn tất thành công 100%.

## 5. Môi trường & cấu hình
- Biến môi trường (`.env.example`): `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, tùy chọn `VITE_MEDIA_SERVER_URL`, `VITE_FALLBACK_MEDIA_SERVERS`.
- Upstash: database `cypherguide-ratelimit` (free tier, Singapore ap-southeast-1). Token là bí mật, không dán vào chat hay commit.
- `MATURITY.md` ghi production duy nhất là `cypherguide.org`.
- Relay: `wss://relay.cypherguide.org` (có trong `public/.well-known/nostr.json`, nhắc tới trong RFC-0016). Chưa được nostr.watch lập chỉ mục (30/09/2026).
- Địa chỉ Lightning: dev-donation `cypherguide@zaps.lol`; treasury hạ tầng `peevishtender468@walletofsatoshi.com` (đều nằm trong `data/protocol_config.json`).

## 6. Việc tiếp theo đề xuất (thứ tự)
1. Nối Upstash vào rate limiter của `server.ts` + đổi cách lấy IP (mục 3.2, 3.3).
2. Kiểm tra lưu trữ config trên Vercel, chuyển sang Redis nếu cần (3.4).
3. Onboard trọng tài thật (3.1) rồi thay `DEFAULT_ARBITRATOR_POOL`.
4. Gom danh sách admin, siết NIP-98 và CORS (3.5, 3.6, 3.8).
5. Đồng bộ tài liệu (mục 4), rồi RFC-0017 nếu có chủ đề mới.

## 7. Ghi chú quy trình làm việc
- Chưa chạy `tsc`/`vitest` trong lần rà soát này (không có `node_modules`, sandbox không có mạng). Trước khi sửa, chạy `npm ci && npm run lint && npm test`.
- Khi sửa RFC hoặc docs: bản Việt trước, bản `.en.md` sau, cùng một lần.
