// Client-side fallback lookup for Cypher Guide RFC Documentation

export interface DocsQueryResult {
  answer: string;
  success: boolean;
}

const RFC_KNOWLEDGE_BASE: Record<string, { vi: string; en: string }> = {
  donation: {
    vi: "Theo tài liệu kỹ thuật Cypher Guide (RFC-0005 & ARCHITECTURE.md), dự án chỉ có duy nhất MỘT địa chỉ quyên góp chính thức được xác thực:\n\n`npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qa...`\n\nLưu ý: Mọi tài khoản hay địa chỉ npub khác tự xưng là địa chỉ quyên góp chính thức của Cypher Guide đều là giả mạo.",
    en: "According to the official Cypher Guide documentation (RFC-0005 & ARCHITECTURE.md), Cypher Guide has exactly ONE verified official donation address:\n\n`npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qa...`\n\nNote: Any other npub claiming to be the donation address is impersonation."
  },
  fee: {
    vi: "Theo **RFC-0002 (Curves Phí Chiết Khấu Dựa Trên Uy Tín)**, phí nền tảng động được tính toán dựa trên đường cong chiết khấu logarit. Phí sẽ giảm dần khi điểm uy tín (Reputation Score) của người dùng tăng lên (được tính từ Proof of Stay), với giới hạn phí cơ sở và mức phí tối thiểu (floor fee).",
    en: "Based on **RFC-0002 (Reputation-Based Fee Discount Curve)**, the dynamic platform fee is calculated using a logarithmic discount curve that decreases as a user's reputation score (derived from Proof-of-Stay) increases, bounded by a base fee and a minimum floor."
  },
  guardian: {
    vi: "Theo **RFC-0001 (Quy Trình Chọn Hội Đồng Bảo Vệ - Guardian Council)**, các thành viên Hội đồng được đề xuất và bình chọn dựa trên thời gian vận hành node liên tục (Proof of Stay), đóng góp uy tín cho mạng lưới và cơ chế đồng thuận không cấp phép.",
    en: "According to **RFC-0001 (Guardian Council Selection Process)**, council members are nominated and selected based on continuous node operation longevity (Proof of Stay), reputation contributions, and permissionless consensus mechanisms."
  },
  stay: {
    vi: "Theo **RFC-0003 (Bằng Chứng Lưu Trú - Proof of Stay)**, cơ chế này xác thực sự hiện diện và duy trì hoạt động lâu dài của các nút (nodes) trong mạng lưới Cypher Guide mà không phụ thuộc vào Staking vốn. Điểm Proof of Stay được tích lũy theo thời gian Uptime và dùng để tính toán điểm uy tín khả di chuyển (Portable Reputation).",
    en: "According to **RFC-0003 (Proof of Stay)**, this mechanism verifies the long-term presence and operation of nodes in the Cypher Guide network without relying on capital staking. Proof of Stay points accumulate over uptime and are used to calculate portable reputation."
  },
  i18n: {
    vi: "Theo **RFC-0004 (Đa Ngôn Ngữ & Bản Địa Hóa - i18n)**, Cypher Guide hỗ trợ giao diện đa ngôn ngữ linh hoạt (mặc định là Tiếng Việt và Tiếng Anh) với cấu trúc tệp JSON bản địa hóa tĩnh.",
    en: "According to **RFC-0004 (Internationalization - i18n)**, Cypher Guide supports dynamic multi-language interface (defaulting to Vietnamese and English) with static JSON localization files."
  },
  dana: {
    vi: "Theo **RFC-0008 (Lưu Trú Dựa Trên Tùy Tâm - Dana-Based Stay)**, các homestay hoặc thiền viện có thể đăng ký mô hình `priceModel: 'dana'`, không thu phí cố định ban đầu và cho phép khách lưu trú gửi cúng dường tự nguyện sau kỳ nghỉ.",
    en: "According to **RFC-0008 (Dana-Based Stay)**, retreats and monasteries can operate under `priceModel: 'dana'` without upfront fixed pricing, enabling voluntary Lightning offerings after the stay."
  },
  edgeAI: {
    vi: "Theo **RFC-0009 (AI Phi Tập Trung Chạy Trên Thiết Bị Ngoại Biên)**, đây là tầm nhìn tách biệt node LoRa (chỉ truyền tải dữ liệu) và thiết bị biên mạnh hơn (SBC/Raspberry Pi/điện thoại) để chạy mô hình ngôn ngữ nhỏ (SLM) hoàn toàn cục bộ không cần internet.",
    en: "According to **RFC-0009 (Decentralized AI on Edge Devices)**, this visionary spec separates LoRa transport nodes from compute-capable edge devices (SBCs/phones) running small quantized language models locally without cloud APIs."
  },
  stillness: {
    vi: "Theo **RFC-0010 (Nghi Thức Tĩnh Tâm - Zen Stillness Ritual)**, nghi thức 369 giây cùng vòng tròn Ensō (0), nén nhang (1) và chuông Keisu đồng thau được thiết kế thuần túy client-side, chủ động từ chối phát hành Proof-of-Stillness hay gamification để giữ trọn tinh thần buông bỏ vô ngã.",
    en: "According to **RFC-0010 (Zen Stillness Ritual)**, the 369-second ritual with Ensō (0), incense (1), and Keisu bronze bell is strictly client-side and deliberately refuses proof generation or gamification to honor non-attachment."
  },
  boundary: {
    vi: "Theo **RFC-0011 (Ranh Giới Tài Chính Hóa - Financialization Boundary Principle)**, mọi hành vi trước khi sinh proof/uy tín/phí phải vượt qua 3 bài kiểm tra: 1. Khả năng xác minh khách quan (Verifiability), 2. Phục vụ tính toàn vẹn giao thức (Protocol-purpose), 3. Tương thích ý nghĩa gốc phi giao dịch (Original-meaning).",
    en: "According to **RFC-0011 (Financialization Boundary Principle)**, any behavior must pass 3 tests before generating proofs, reputation, or fee effects: 1. Verifiability Test, 2. Protocol-Purpose Test, and 3. Original-Meaning Test."
  },
  sovereignty: {
    vi: "Theo **RFC-0012 (Ranh Giới Chủ Quyền - Sovereignty Boundary Principle)** và tài liệu `HOST_LEGAL_REALITY.md`: Thanh toán bằng Lightning/Cashu chỉ giải quyết tầng công nghệ/thông tin, hoàn toàn KHÔNG miễn trừ host khỏi nghĩa vụ khai báo tạm trú, thuế, giấy phép an ninh trật tự hay PCCC theo chủ quyền pháp lý nước sở tại. Giao thức không đóng vai trò xác minh pháp lý mà cung cấp tài liệu chia sẻ kinh nghiệm thực tế do cộng đồng đóng góp.",
    en: "According to **RFC-0012 (Sovereignty Boundary Principle)** and `HOST_LEGAL_REALITY.md`: Paying through Lightning/Cashu operates strictly at the digital network layer and does NOT exempt hosts from residency declaration, tax, public order, or fire safety obligations under local national sovereignty. The protocol does not act as a compliance intermediary; rather, it maintains a non-authoritative, community-contributed legal reality reference."
  },
  nip46: {
    vi: "Theo **RFC-0003 Phụ lục (Addendum 2026-08-26 & Cập nhật 2026-08-28)**: Trình duyệt di động hệ thống (Chrome/Safari) thiếu NIP-07 extension, nhưng **trình duyệt tích hợp trong các app ví Nostr (như Amethyst)** đã tự động tiêm `window.nostr` cho phép dùng NIP-07 trực tiếp trên di động không cần dán NSEC. Đối với trình duyệt thông thường, hướng đi dài hạn vẫn là hỗ trợ NIP-46 (remote signer / bunker như Amber, nsec.app).",
    en: "According to **RFC-0003 Addendum (2026-08-26 & 2026-08-28 Update)**: Standard mobile browsers lack NIP-07, but **built-in in-app browsers inside mobile Nostr wallets (like Amethyst)** inject `window.nostr`, allowing full NIP-07 signing directly on mobile without raw NSEC. For standard browsers, the long-term roadmap remains NIP-46 (remote signers / bunkers like Amber, nsec.app)."
  },
  agentReady: {
    vi: "Theo **RFC-0013 (Lưu Trú Sẵn Sàng Cho Agent - Agent-Ready Stay)** (thay thế hoàn toàn bản nháp Compute-as-a-Stay cũ): CypherGuide khẳng định **khách luôn luôn là con người**, AI agent chỉ là hạ tầng/hành lý họ mang theo. Giao thức không trở thành chợ compute đối đầu với Akash hay io.net và không tạo danh tính/uy tín riêng cho bot. Thay vào đó, RFC-0013 chuẩn hóa tag tiện nghi **`AGENT-READY`** dành cho homestay đáp ứng đủ 3 tiêu chí kỹ thuật: 1. Có compute node riêng (SBC/mini-PC) không chia sẻ chung trong kỳ lưu trú; 2. Có Nostr relay riêng do host tự vận hành; 3. Cam kết sàn băng thông tối thiểu (Mbps) rõ ràng. Xác minh thông qua đo lường máy móc khách quan (uptime, ping) tương tự `VERIFIED_NODE`.",
    en: "According to **RFC-0013 (Agent-Ready Stay — An Amenity for the Cypher/Personal Business Crowd)** (fully replacing the earlier Compute-as-a-Stay draft): CypherGuide affirms that **the guest is always human**, while the AI agent is merely infrastructure/luggage brought along. The protocol avoids turning into a compute marketplace competing with Akash or io.net and creates no separate identity/reputation for bots. Instead, RFC-0013 defines a standardized **`AGENT-READY`** amenity tag requiring 3 mandatory criteria: 1. Dedicated, unshared compute node (SBC/mini-PC); 2. Host's own private Nostr relay; 3. Guaranteed sustained bandwidth floor (Mbps). Verified through objective machine metrics (uptime, ping) similar to `VERIFIED_NODE`."
  },
  positioning: {
    vi: "Theo **Bản Định Vị AI Cục Bộ (POSITIONING.md)**: CypherGuide không tham gia cuộc đua AI tập trung hóa nghìn tỷ đô. Dự án thử nghiệm câu hỏi: liệu một mô hình nhỏ (SLM như Qwen2.5 1.5B chạy trên Raspberry Pi - RFC-0009) có thể trả lời đủ tốt cho đúng nhu cầu hẹp của người dùng mà không cần đám mây trung gian. Như TS. Phạm Hy Hiếu (Head of AI Transformation tại Techcombank, cựu Google Brain/OpenAI/xAI) nhận định, compute là 'bài toán tầm quốc gia' — do đó CypherGuide không cố xây chợ compute phi tập trung mà tập trung giúp cá nhân làm chủ phần cứng nhỏ của chính họ (RFC-0009, RFC-0013), kiểm chứng bằng thử nghiệm công khai.",
    en: "According to the **Local AI Positioning Statement (POSITIONING.md)**: CypherGuide is not entering the trillion-dollar centralized AI race. Instead, it tests whether small language models (like Qwen2.5 1.5B on Raspberry Pi - RFC-0009) running on cheap user-owned hardware can answer well enough for narrow purposes without clouds. As independently noted by Dr. Phạm Hy Hiếu (Head of AI Transformation at Techcombank, ex-Google Brain/OpenAI/xAI), large-scale compute is a 'national-scale problem' — thus CypherGuide avoids building a compute marketplace and instead focuses on personal sovereignty over edge hardware, proven via public experiments."
  },
  nodeIncentive: {
    vi: "Theo **RFC-0016 (Khuyến Khích Nút Hạ Tầng - Infrastructure Node Incentive)**: Cơ chế thưởng cho relay/mesh node chuyển từ mô phỏng sang thực tế bằng cách giải quyết 2 bài toán:\n1. **Oracle đo lường chống gian lận**: Kết hợp Proof-of-Usage (D - client thật ghi nhận và ký báo cáo bằng Nostr) trong giai đoạn đầu và Witness Network (C - thách thức ngẫu nhiên đa bên) khi mạng lớn hơn. Loại bỏ PoW vì sai bản chất.\n2. **Dòng chảy thanh khoản Lightning**: Thưởng Sats được phân phối lại từ quỹ treasury (trích % phí booking theo RFC-0002) qua LNURL-pay / NWC, tích hợp circuit breaker ngắt nút claim khi quỹ không đủ.\n3. **Cảnh báo tập trung hóa kinh tế**: Giống bài học Helium/Filecoin, kẻ có vốn có thể lập trang trại node để độc chiếm thưởng; RFC đề xuất nghiên cứu hàm giảm biên tế (declining marginal returns) cho cluster node cùng chủ.\n4. **Rủi ro riêng tư qua phân tích đồ thị thanh toán (Payment Graph Analysis)**: Dùng địa chỉ treasury tĩnh lặp lại làm lộ nhịp độ và quy mô mạng lưới; RFC-0016 đề xuất hướng xoay vòng LNURL / BOLT12 offer theo chu kỳ và thanh toán theo lô (batch payouts).",
    en: "According to **RFC-0016 (Infrastructure Node Incentive — Proof-of-Relay + Lightning Payout Flow)**: The node incentive mechanism transitions from simulation to production by solving two distinct problems:\n1. **Fraud-Resistant Oracle**: Combines crowdsourced Proof-of-Usage (D - real clients logging and signing with Nostr keys) initially with Witness Networks (C - random challenges with quorum) as the network grows. Bitcoin-style PoW is rejected as a mismatch.\n2. **Lightning Payout Liquidity**: Sats rewards are redistributed from a dedicated treasury funded by a % of booking fees (RFC-0002) via LNURL-pay / NWC, with mandatory circuit breakers disabling claims when treasury funds are low.\n3. **Economic Centralization Risk**: Learning from Helium/Filecoin farming, well-capitalized actors could capture the reward pool; RFC proposes researching declining marginal returns per node cluster.\n4. **Payment Graph Analysis Privacy Risk**: Reusing a static treasury address leaks network activity maps and transaction cadence; RFC-0016 proposes rotating LNURL / BOLT12 offers per cycle and batch payouts."
  }
};

export async function clientDocsLookup(question: string, locale: string = 'vi'): Promise<DocsQueryResult> {
  const isEn = locale === 'en';
  const qLower = question.toLowerCase();

  if (qLower.includes('donation') || qLower.includes('quyên góp') || qLower.includes('địa chỉ') || qLower.includes('address') || qLower.includes('donate')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.donation.en : RFC_KNOWLEDGE_BASE.donation.vi, success: true };
  }
  if (qLower.includes('positioning') || qLower.includes('định vị') || qLower.includes('grant') || qLower.includes('tài trợ') || qLower.includes('phạm hy hiếu') || qLower.includes('hạ tầng ai') || qLower.includes('local ai') || qLower.includes('ai cục bộ') || qLower.includes('tiếng nói nhỏ')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.positioning.en : RFC_KNOWLEDGE_BASE.positioning.vi, success: true };
  }
  if (qLower.includes('fee') || qLower.includes('phí') || qLower.includes('rfc-0002') || qLower.includes('discount')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.fee.en : RFC_KNOWLEDGE_BASE.fee.vi, success: true };
  }
  if (qLower.includes('guardian') || qLower.includes('bảo vệ') || qLower.includes('council') || qLower.includes('hội đồng') || qLower.includes('rfc-0001')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.guardian.en : RFC_KNOWLEDGE_BASE.guardian.vi, success: true };
  }
  if (qLower.includes('stay') || qLower.includes('lưu trú') || qLower.includes('rfc-0003') || qLower.includes('proof of stay')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.stay.en : RFC_KNOWLEDGE_BASE.stay.vi, success: true };
  }
  if (qLower.includes('i18n') || qLower.includes('ngôn ngữ') || qLower.includes('language') || qLower.includes('rfc-0004')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.i18n.en : RFC_KNOWLEDGE_BASE.i18n.vi, success: true };
  }
  if (qLower.includes('dana') || qLower.includes('tùy tâm') || qLower.includes('rfc-0008')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.dana.en : RFC_KNOWLEDGE_BASE.dana.vi, success: true };
  }
  if (qLower.includes('edge') || qLower.includes('ngoại biên') || qLower.includes('rfc-0009')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.edgeAI.en : RFC_KNOWLEDGE_BASE.edgeAI.vi, success: true };
  }
  if (qLower.includes('stillness') || qLower.includes('tĩnh tâm') || qLower.includes('enso') || qLower.includes('nhang') || qLower.includes('rfc-0010')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.stillness.en : RFC_KNOWLEDGE_BASE.stillness.vi, success: true };
  }
  if (qLower.includes('boundary') || qLower.includes('financialization') || qLower.includes('tài chính hóa') || qLower.includes('rfc-0011')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.boundary.en : RFC_KNOWLEDGE_BASE.boundary.vi, success: true };
  }
  if (qLower.includes('sovereignty') || qLower.includes('chủ quyền') || qLower.includes('pháp lý') || qLower.includes('legal') || qLower.includes('tạm trú') || qLower.includes('thuế') || qLower.includes('282') || qLower.includes('rfc-0012')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.sovereignty.en : RFC_KNOWLEDGE_BASE.sovereignty.vi, success: true };
  }
  if (qLower.includes('nip-46') || qLower.includes('nip46') || qLower.includes('bunker') || qLower.includes('remote signer') || qLower.includes('amber') || qLower.includes('mobile signing')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.nip46.en : RFC_KNOWLEDGE_BASE.nip46.vi, success: true };
  }
  if (qLower.includes('agent-ready') || qLower.includes('agent ready') || qLower.includes('agentready') || qLower.includes('agent') || qLower.includes('compute') || qLower.includes('rfc-0013') || qLower.includes('rfc0013') || qLower.includes('moltbook') || qLower.includes('astra') || qLower.includes('băng thông sàn') || qLower.includes('bandwidth floor')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.agentReady.en : RFC_KNOWLEDGE_BASE.agentReady.vi, success: true };
  }
  if (qLower.includes('rfc-0016') || qLower.includes('rfc0016') || qLower.includes('incentive') || qLower.includes('khuyến khích') || qLower.includes('proof-of-relay') || qLower.includes('proof of relay') || qLower.includes('proof-of-usage') || qLower.includes('proof of usage') || qLower.includes('witness network') || qLower.includes('node reward') || qLower.includes('thưởng node') || qLower.includes('tập trung hóa kinh tế') || qLower.includes('economic centralization') || qLower.includes('payment graph') || qLower.includes('đồ thị thanh toán') || qLower.includes('bolt12 offer')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.nodeIncentive.en : RFC_KNOWLEDGE_BASE.nodeIncentive.vi, success: true };
  }

  return {
    answer: isEn 
      ? "There is no documentation about this yet" 
      : "Chưa có tài liệu về việc này",
    success: true
  };
}
