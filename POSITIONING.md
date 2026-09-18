# CypherGuide & Local AI — Positioning Statement / Bản Định Vị AI Cục Bộ

> **Tài liệu dùng cho đơn xin tài trợ & giới thiệu dự án / For grant applications and project introductions**  
> 🌐 **Chọn ngôn ngữ / Select language:**  
> - 🇻🇳 **Tiếng Việt (Bản chuẩn gốc)**: [`POSITIONING.vi.md`](./POSITIONING.vi.md)
> - 🇬🇧 **English (Synchronized translation)**: [`POSITIONING.en.md`](./POSITIONING.en.md)

---

# 🇻🇳 Tiếng Việt: Bản Định Vị

## Một câu tóm tắt

CypherGuide không tham gia cuộc đua AI tập trung hóa quy mô nghìn tỷ đô — chúng tôi
đang thử nghiệm một câu hỏi nhỏ hơn, cụ thể hơn: **liệu một mô hình ngôn ngữ nhỏ, chạy
hoàn toàn trên phần cứng giá rẻ mà chính người dùng sở hữu, có thể trả lời đủ tốt cho
đúng nhu cầu của nó hay không** — không cần đám mây, không cần công ty nào đứng giữa.

## Vì sao nói "tiếng nói nhỏ", không phải "giải pháp lớn"

Chúng tôi không tuyên bố cạnh tranh được với Nvidia, OpenAI, hay bất kỳ hạ tầng AI tập
trung nào — quy mô hoàn toàn khác nhau, không có ý nghĩa gì khi so sánh. Điều chúng tôi
tin: **giá trị của AI cục bộ không nằm ở việc thắng cuộc đua quy mô, mà ở việc tồn tại
như một lựa chọn thay thế thật, kiểm chứng được**, cho những ai coi trọng quyền riêng
tư/chủ quyền dữ liệu hơn là sức mạnh tuyệt đối của mô hình.

## Xác nhận độc lập từ một chuyên gia không liên quan tới dự án

TS. Phạm Hy Hiếu — Giám đốc Khối Chuyển đổi Trí tuệ Nhân tạo tại Techcombank, từng làm
việc tại Google Brain, xAI, và OpenAI — mô tả AI hiện đại dựa trên 3 cột trụ:
**Algorithm** (đã phổ biến, ~20 thuật toán nền tảng ai cũng tiếp cận được), **Data**
(doanh nghiệp có thể tự làm chủ), và **Compute** — mà ông gọi thẳng là **"bài toán tầm
quốc gia"**, đòi hỏi đầu tư từ nhà nước hoặc các tập đoàn quy mô như FPT, Viettel,
GreenNode.

Đây là xác nhận độc lập, từ một người có thẩm quyền thật trong ngành, không biết gì về
CypherGuide, cho đúng kết luận dự án đã tự rút ra: **compute quy mô lớn không phải sân
chơi của một giao thức nhỏ.** Chúng tôi không cố cạnh tranh ở cột trụ đó — chúng tôi
chọn phần vừa sức: giúp cá nhân tận dụng đúng phần cứng nhỏ họ đã sở hữu, cho đúng nhu
cầu hẹp của họ, không mơ tới việc xây "trung tâm dữ liệu quốc gia phiên bản phi tập
trung".

## Bằng chứng cụ thể, không phải tuyên ngôn suông

- **RFC-0009**: bộ thử nghiệm thật (thiết kế đầy đủ, sẵn sàng chạy) đo xem một mô hình
  1.5B tham số (Qwen2.5) chạy trên Raspberry Pi có trả lời đúng câu hỏi về tài liệu dự
  án hay không — có cả câu hỏi bẫy để kiểm tra mô hình có bịa thông tin hay không. Kết
  quả sẽ được công bố dù đạt hay không đạt.
- **RFC-0013**: tiện nghi "Agent-Ready" cho listing — hạ tầng biên (edge) do host tự vận
  hành, phục vụ đúng nhu cầu thật của giới freelancer/cypherpunk mang theo agent AI khi
  di chuyển, không tạo ra một "chợ compute" cạnh tranh với hạ tầng tập trung đã có.
- **Từ chối rõ ràng những gì không phù hợp**: đã từ chối tích hợp AI agent tự chủ có
  quyền quyết định tài chính không giới hạn (đề xuất GPT-6 Astra), đã sửa lại toàn bộ
  hướng đi ban đầu của RFC-0013 khi phát hiện nó lệch khỏi nguyên tắc cốt lõi — và giữ
  nguyên quyết định đó ngay cả khi có đề xuất sau này thử đưa mô hình "chợ compute" quay
  lại dưới một cái tên kỹ thuật khác (NIP-90 DVM).

## Điều chúng tôi không hứa

Chúng tôi không hứa AI cục bộ sẽ "thắng" AI tập trung, không hứa mốc thời gian cụ thể
cho việc mở rộng. Maturity tier của RFC-0009/0013 vẫn là **Experimental** — sẽ chỉ nâng
lên khi có số liệu thật, không phải khi có nhu cầu marketing.

## Vì sao điều này đáng để tài trợ

Không phải vì quy mô lớn — mà vì đây là một trong số ít dự án **thực sự kiểm chứng
được bằng cách tự chạy thử nghiệm công khai**, ghi lại cả thất bại lẫn thành công, thay
vì chỉ tuyên bố. Toàn bộ RFC, kể cả những lần tự sửa sai giữa chừng, đều công khai
tại github.com/greenweaveglobal/cypherguide.

---

# 🇬🇧 English: Positioning Statement

## One-sentence summary

CypherGuide isn't entering the trillion-dollar centralized AI race — we're testing a
smaller, more specific question: **can a small language model, running entirely on
cheap hardware the user actually owns, answer well enough for its actual purpose** —
no cloud, no company standing in between.

## Why "a small voice," not "a big solution"

We don't claim to compete with Nvidia, OpenAI, or any centralized AI infrastructure —
the scales are incomparable, and there's no meaningful comparison to make. What we
believe: **the value of local AI isn't in winning the scale race, it's in existing as
a real, checkable alternative**, for people who value privacy/data sovereignty more
than raw model power.

## Independent confirmation from an expert unrelated to the project

Dr. Phạm Hy Hiếu — Head of AI Transformation at Techcombank, formerly at Google Brain,
xAI, and OpenAI — describes modern AI as resting on 3 pillars: **Algorithm** (already
commoditized, ~20 core algorithms anyone can access), **Data** (something enterprises
can own themselves), and **Compute** — which he calls outright **"a national-scale
problem,"** requiring state investment or corporations at the scale of FPT, Viettel,
GreenNode.

This is an independent confirmation, from someone with real authority in the field who
knows nothing about CypherGuide, arriving at exactly the conclusion the project already
reached on its own: **large-scale compute isn't a small protocol's arena.** We're not
trying to compete on that pillar — we're taking the part that fits our size: helping an
individual make good use of the small hardware they already own, for their own narrow
need, not dreaming of building a "decentralized version of a national data center."

## Concrete evidence, not a manifesto

- **RFC-0009**: a real test suite (fully designed, ready to run) measuring whether a
  1.5B-parameter model (Qwen2.5) running on a Raspberry Pi can correctly answer
  questions about the project's own documentation — including trap questions to check
  whether the model fabricates information. Results will be published whether they
  succeed or not.
- **RFC-0013**: an "Agent-Ready" listing amenity — edge infrastructure hosts run
  themselves, serving the real needs of freelancers/cypherpunks who travel with an AI
  agent, without creating a "compute marketplace" competing with existing centralized
  infrastructure.
- **Clear rejection of what doesn't fit**: we declined integrating an autonomous AI
  agent with unbounded financial decision authority (the GPT-6 Astra proposal), and
  fully rewrote RFC-0013's original direction after recognizing it drifted from core
  principles — and held that decision even when a later proposal tried bringing the
  "compute marketplace" model back under a different technical name (NIP-90 DVM).

## What we don't promise

We don't promise local AI will "beat" centralized AI, and we don't promise a specific
timeline for scaling up. RFC-0009/0013's maturity tier remains **Experimental** — it
only moves up when there's real data, not when there's a marketing need for it to.

## Why this is worth funding

Not because of scale — because this is one of the few projects that actually **proves
itself by running public experiments**, recording both failures and successes instead
of just asserting them. Every RFC, including the ones that were self-corrected mid-way,
is public at github.com/greenweaveglobal/cypherguide.
