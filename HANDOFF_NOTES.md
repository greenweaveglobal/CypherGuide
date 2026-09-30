# Bàn giao ngữ cảnh CypherGuide (rà soát mã nguồn 30/09/2026)

Thay thế `HANDOFF_NOTES.md` cũ (25/07/2026, đã lỗi thời: mô tả trạng thái trước audit). Dán file này vào đầu cửa sổ ngữ cảnh mới.

## 1. Dự án là gì
Giao thức + app lưu trú P2P phi tập trung. Khách/Host dùng Nostr (danh tính, tin nhắn, Proof-of-Stay) và Lightning (thanh toán). Repo công khai: `greenweaveglobal/CypherGuide`. Domain `cypherguide.org`, relay riêng `relay.cypherguide.org`.

- Stack: React 19 + Vite + Tailwind 4 + Zustand (IndexedDB) + `nostr-tools` + Express (`server.ts`) + hàm serverless Vercel (`api/`).
- Node >= 22.12. Test: `vitest` (8 file trong `tests/`). CI: `.github/workflows/ci.yml` (tsc, vitest, npm audit).
- Tài liệu: tiếng Việt là bản gốc, `.en.md` dịch theo. Sửa bản Việt trước, đồng bộ bản Anh trong cùng lần sửa.
- RFC 0001-0016 nằm trong `RFC/`. Số RFC tiếp theo: **0017**. Chỉ mục ở `RFC/README.md`.

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
- C3: kiểm magic-byte upload media (chặn SVG).
- C4: `isSimulatedInvoice()` luôn trả `false`; thanh toán yêu cầu `SHA-256(preimage) == payment_hash`.
- Xác thực NIP-98 (kind 27235) cho endpoint admin, cửa sổ ±60 giây, kiểm tag `u`/`method`, whitelist pubkey.
- NIP-49 vault, xác thực chữ ký KYC attestation, Proof-of-Stay đồng ký hai bên, chống SSRF LUD-06.

Còn mở (xếp theo mức ưu tiên đề xuất):
1. **Trọng tài 2-of-3 vẫn là placeholder.** Ba pubkey trong `DEFAULT_ARBITRATOR_POOL` (`insuranceFund.ts`) không có ai giữ private key. Escrow/tranh chấp không dùng được. Ba key cũ bị lộ trong repo công khai phải coi là bị lộ vĩnh viễn. Việc cần làm: onboard 3 trọng tài độc lập thật.
2. **Rate limit Upstash chưa nối vào `server.ts`.** Chỉ `api/docs-assistant/query.ts` (Vercel) dùng `@upstash/ratelimit`. `server.ts` dùng Map trong bộ nhớ, không đọc biến `UPSTASH_REDIS_*`. Nếu app chạy bằng `server.ts` (AI Studio/Cloud Run), việc đặt biến môi trường Upstash chưa có tác dụng. Cần nối Upstash vào `docsRateLimiter` của `server.ts`, giữ Map làm fallback.
3. **Lấy IP từ `x-forwarded-for` phần tử đầu** (cả `server.ts` lẫn `api/docs-assistant/query.ts`). Trong `server.ts` đã có `trust proxy = 1`, nên dùng `req.ip`. Nếu không, client tự đặt header để né limit.
4. **Ghi `data/protocol_config.json` bằng `fs` trong `api/protocol/{config,fee}.ts`.** Hệ thống file của hàm serverless Vercel là chỉ đọc, nên thay đổi phí/địa chỉ có thể lỗi 500 hoặc không lưu. Cần kiểm tra trên bản deploy thật; nếu đúng thì chuyển lưu trữ sang Upstash Redis (đã có sẵn dependency) hoặc KV.
5. **Danh sách admin pubkey lặp ở 4 nơi** (`server.ts`, `api/protocol/config.ts`, `api/protocol/fee.ts`, `GovernancePanel.tsx`). Nên gom vào một module dùng chung hoặc biến môi trường.
6. **NIP-98 chỉ chống replay bằng cửa sổ thời gian**, chưa lưu id event đã dùng; kiểm tag `u` bằng `includes/endsWith` khá lỏng. Cân nhắc cache id event trong cửa sổ 60 giây (Redis) và so khớp URL chính xác.
7. `TEST_ADMIN_PUBKEY` (env) thêm một admin. Đảm bảo không đặt biến này ở production.
8. CSP của helmet đang tắt (`contentSecurityPolicy: false`). CORS dùng `endsWith("cypherguide.org")` và `includes("run.app")` nên khớp cả domain lạ như `evilcypherguide.org`/`x.run.app`; nên so khớp chính xác danh sách origin.

## 4. Sai lệch tài liệu cần dọn
- `HANDOFF_NOTES.md` cũ: thay bằng file này.
- `MATURITY.md` ghi "7 suites/23 tests"; thực tế 8 file test, khoảng 35 case (đếm `it/test`). Cập nhật số.
- `ARCHITECTURE.md` ghi React 18; `package.json` dùng React 19.
- `package.json`: `repository.url` là `greenweave/cypherguide` (org thật: `greenweaveglobal`); `vite` khai báo cả ở dependencies lẫn devDependencies.
- Còn code demo/mock trong UI: `ListingDetail.tsx` (`mockVerifierIdentity`, nút "KYC mock mint" – theo MATURITY chỉ nên bật ở dev), `HostRegistrationModal.tsx` (nút giả lập tắt server chính – nhãn "dev/acceptance test"). Cần xác nhận chúng bị ẩn ở production (`import.meta.env.DEV`).

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
