import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { queryDocsAssistant } from "../../lib/docsAssistant";

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

export default async function handler(req: any, res: any) {
  // CORS configuration
  const origin = req.headers?.origin;
  const isAllowedOrigin = !origin || 
    origin.endsWith("cypherguide.org") || 
    origin.includes("localhost") || 
    origin.includes("127.0.0.1") ||
    origin.includes("run.app");

  if (isAllowedOrigin && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "https://cypherguide.org");
  }
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

    // Call unified docs assistant (M1/M2)
    const result = await queryDocsAssistant(question, locale);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error in Vercel api/docs-assistant/query:", error);
    return res.status(500).json({
      error: "Internal server error during documentation query.",
      message: error.message || String(error)
    });
  }
}
