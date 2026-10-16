import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { DOCS_KNOWLEDGE_BASE } from "./docsKnowledgeBase.js";

// In-memory cache for documentation content (H5 - read once on cold start)
let cachedDocs: string | null = null;
let warnedMissingApiKey = false;

/**
 * Tra cứu kho kiến thức tĩnh nội bộ (static local index)
 */
export function searchLocalKnowledgeBase(question: string, userLocale: 'vi' | 'en'): { matched: boolean; answer: string } {
  const qLower = question.toLowerCase();
  for (const topic of Object.values(DOCS_KNOWLEDGE_BASE)) {
    if (topic.keywords && topic.keywords.some((kw: string) => qLower.includes(kw.toLowerCase()))) {
      return {
        matched: true,
        answer: userLocale === 'en' ? topic.en : topic.vi
      };
    }
  }
  return {
    matched: false,
    answer: userLocale === 'en' 
      ? "There is no documentation about this yet" 
      : "Chưa có tài liệu về việc này"
  };
}

export function loadProjectDocs(): string {
  if (cachedDocs !== null) {
    return cachedDocs;
  }

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

  cachedDocs = docs.join("\n\n");
  return cachedDocs;
}

export type DocsAssistantSource = "gemini" | "local-index" | "fallback-default";

export interface DocsQueryResult {
  answer: string;
  success: boolean;
  source?: DocsAssistantSource;
  degraded?: boolean;
  error?: string;
}

/**
 * Unified Documentation Assistant Query Handler (M1/M2)
 * Ensures 100% identical behavior across Express and Vercel serverless functions.
 */
export async function queryDocsAssistant(question: string, rawLocale?: string): Promise<DocsQueryResult> {
  const userLocale = rawLocale === 'en' ? 'en' : 'vi';
  const fallbackPhrase = userLocale === 'en' 
    ? "There is no documentation about this yet" 
    : "Chưa có tài liệu về việc này";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (!warnedMissingApiKey) {
      console.warn("[docs-assistant] GEMINI_API_KEY is not configured. Falling back to static local RFC index in degraded mode.");
      warnedMissingApiKey = true;
    }

    const { matched, answer } = searchLocalKnowledgeBase(question, userLocale);
    if (matched) {
      return {
        answer,
        success: true,
        source: "local-index",
        degraded: true
      };
    }

    return {
      answer,
      success: false,
      source: "fallback-default",
      degraded: true
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const docsContent = loadProjectDocs();

  const systemInstruction = `You are the Cypher Guide Documentation Lookup Assistant (Trợ Lý Tra Cứu Tài Liệu Cypher Guide).
Your ONLY task is to look up and answer questions based strictly on the official project documentation provided below.

STRICT MANDATORY RULES YOU MUST FOLLOW WITHOUT EXCEPTION:
1. Answer strictly and only based on the provided official documentation context.
2. IF A QUESTION CANNOT BE ANSWERED DIRECTLY FROM THE PROVIDED DOCUMENTATION (or asks about features, policies, code, or topics not mentioned in the documentation), YOU MUST RESPOND EXACTLY WITH:
"${fallbackPhrase}"
3. DO NOT speculate, assume, guess, or invent any features, protocols, algorithms, dates, policies, or mechanisms that are not explicitly documented.
4. DO NOT present yourself as an official representative, spokesperson, or decision-maker of the Cypher Guide project. You are purely an automated document lookup index tool.
5. Provide clear, direct, concise, and truthful answers with reference to the specific RFCs or Architecture section where applicable.
6. LANGUAGE MANDATE: ${userLocale === 'en' ? 'Respond in English.' : 'ALWAYS respond in Vietnamese (Tiếng Việt). Translate concepts into clear Vietnamese where appropriate while keeping RFC citations in English filenames.'}

--- OFFICIAL PROJECT DOCUMENTATION CONTEXT ---
${docsContent}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: question,
      config: {
        systemInstruction
      }
    });

    const rawOutput = (response as any).text ?? "";
    const trimmed = rawOutput.trim();

    if (!trimmed || trimmed === fallbackPhrase) {
      return { answer: fallbackPhrase, success: false, source: "fallback-default", degraded: true };
    }

    return { answer: trimmed, success: true, source: "gemini" };
  } catch (err: any) {
    console.error("[docs-assistant] Gemini query error, falling back to static RFC index:", err);
    const { matched, answer } = searchLocalKnowledgeBase(question, userLocale);
    if (matched) {
      return {
        answer,
        success: true,
        source: "local-index",
        degraded: true
      };
    }

    return {
      answer,
      success: false,
      source: "fallback-default",
      degraded: true
    };
  }
}
