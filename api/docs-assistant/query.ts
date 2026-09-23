import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash Redis Distributed Rate Limiter (20 requests / 15 minutes / IP)
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "15 m"),
      analytics: true,
      prefix: "cg_ratelimit_docs"
    });
  } catch (err) {
    console.error("[RateLimit] Error initializing Upstash Redis client:", err);
  }
}

// In-memory fallback if Upstash environment variables are not configured
const fallbackCounts = new Map<string, { count: number; resetTime: number }>();
const FALLBACK_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function loadProjectDocs(): string {
  const docs: string[] = [];
  const filesToRead = [
    "ARCHITECTURE.md",
    "ARCHITECTURE.vi.md",
    "ARCHITECTURE.en.md",
    "MATURITY.md",
    "MATURITY.vi.md",
    "MATURITY.en.md",
    "CONTRIBUTING.md",
    "CONTRIBUTING.vi.md",
    "CONTRIBUTING.en.md",
    "HOST_LEGAL_REALITY.md",
    "HOST_LEGAL_REALITY.vi.md",
    "HOST_LEGAL_REALITY.en.md",
    "POSITIONING.md",
    "POSITIONING.vi.md",
    "POSITIONING.en.md",
    "HANDOFF_NOTES.md"
  ];

  for (const relPath of filesToRead) {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        docs.push(`=== FILE: ${relPath} ===\n${content}`);
      } catch (err) {
        console.error(`Error reading ${relPath}:`, err);
      }
    }
  }

  const rfcDir = path.join(process.cwd(), "RFC");
  if (fs.existsSync(rfcDir)) {
    try {
      const rfcFiles = fs.readdirSync(rfcDir);
      for (const file of rfcFiles) {
        if (file.endsWith(".md")) {
          const fullPath = path.join(rfcDir, file);
          const content = fs.readFileSync(fullPath, "utf-8");
          docs.push(`=== FILE: RFC/${file} ===\n${content}`);
        }
      }
    } catch (err) {
      console.error("Error reading RFC dir:", err);
    }
  }

  return docs.join("\n\n");
}

export default async function handler(req: any, res: any) {
  // CORS configuration
  const origin = req.headers?.origin || "";
  const isAllowedOrigin = origin.endsWith("cypherguide.org") || origin.includes("localhost") || origin.includes("127.0.0.1");
  res.setHeader("Access-Control-Allow-Origin", isAllowedOrigin ? origin : "https://cypherguide.org");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Extract client IP address reliably (supporting Vercel Edge / proxies)
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress) || "unknown";

  // Enforce distributed Upstash rate limiting (20 req / 15 min / IP)
  if (ratelimit) {
    try {
      const { success, reset } = await ratelimit.limit(ip);
      if (!success) {
        const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader("Retry-After", retryAfterSeconds);
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfter: retryAfterSeconds
        });
      }
    } catch (err) {
      console.error("[RateLimit] Error executing Upstash rate check:", err);
    }
  } else {
    // In-memory fallback for local dev / environments missing Upstash credentials
    const now = Date.now();
    const record = fallbackCounts.get(ip);
    if (!record || now > record.resetTime) {
      fallbackCounts.set(ip, { count: 1, resetTime: now + FALLBACK_WINDOW_MS });
    } else if (record.count >= MAX_REQUESTS_PER_WINDOW) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: retryAfterSeconds
      });
    } else {
      record.count++;
    }
  }

  try {
    const question = req.body?.question || req.query?.question;
    const locale = req.body?.locale || req.query?.locale;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing or invalid question parameter." });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: "Question exceeds maximum allowed length of 500 characters." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        answer: locale === 'en'
          ? "Error: GEMINI_API_KEY environment variable is not configured on the server."
          : "Lỗi: GEMINI_API_KEY chưa được thiết lập trong hằng số môi trường của server.",
        success: false
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const docsContent = loadProjectDocs();
    const userLocale = locale === 'en' ? 'en' : 'vi';

    const systemInstruction = `You are the Cypher Guide Documentation Lookup Assistant (Trợ Lý Tra Cứu Tài Liệu Cypher Guide).
Your ONLY task is to look up and answer questions based strictly on the official project documentation provided below.

STRICT MANDATORY RULES YOU MUST FOLLOW WITHOUT EXCEPTION:
1. Answer strictly and only based on the provided official documentation context.
2. IF A QUESTION CANNOT BE ANSWERED DIRECTLY FROM THE PROVIDED DOCUMENTATION (or asks about features, policies, code, or topics not mentioned in the documentation), YOU MUST RESPOND EXACTLY WITH:
${userLocale === 'en' ? '"There is no documentation about this yet"' : '"Chưa có tài liệu về việc này"'}
3. DO NOT speculate, assume, guess, or invent any features, protocols, algorithms, dates, policies, or mechanisms that are not explicitly documented.
4. DO NOT present yourself as an official representative, spokesperson, or decision-maker of the Cypher Guide project. You are purely an automated document lookup index tool.
5. Provide clear, direct, concise, and truthful answers with reference to the specific RFCs or Architecture section where applicable.
6. LANGUAGE MANDATE: ${userLocale === 'en' ? 'Respond in English.' : 'ALWAYS respond in Vietnamese (Tiếng Việt). Translate concepts into clear Vietnamese where appropriate while keeping RFC codes intact.'}

--- OFFICIAL PROJECT DOCUMENTATION CONTEXT ---
${docsContent}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: question,
      config: {
        systemInstruction
      }
    });

    const textOutput = response.text ? response.text.trim() : (userLocale === 'en' ? "There is no documentation about this yet" : "Chưa có tài liệu về việc này");

    return res.status(200).json({
      answer: textOutput,
      success: true
    });
  } catch (error: any) {
    console.error("Error in Vercel api/docs-assistant/query:", error);
    return res.status(500).json({
      error: "Internal server error during documentation query.",
      message: error.message || String(error)
    });
  }
}
