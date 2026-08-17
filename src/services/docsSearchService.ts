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
  }
};

export async function clientDocsLookup(question: string, locale: string = 'vi'): Promise<DocsQueryResult> {
  const isEn = locale === 'en';
  const qLower = question.toLowerCase();

  if (qLower.includes('donation') || qLower.includes('quyên góp') || qLower.includes('địa chỉ') || qLower.includes('address') || qLower.includes('donate')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.donation.en : RFC_KNOWLEDGE_BASE.donation.vi, success: true };
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
  if (qLower.includes('boundary') || qLower.includes('financialization') || qLower.includes('tài chính hóa') || qLower.includes('ranh giới') || qLower.includes('rfc-0011')) {
    return { answer: isEn ? RFC_KNOWLEDGE_BASE.boundary.en : RFC_KNOWLEDGE_BASE.boundary.vi, success: true };
  }

  return {
    answer: isEn 
      ? "There is no documentation about this yet" 
      : "Chưa có tài liệu về việc này",
    success: true
  };
}
