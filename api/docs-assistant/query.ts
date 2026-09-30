import { queryDocsAssistant } from "../../lib/docsAssistant";
import { applyCorsHeaders } from "../../lib/cors";
import { getClientIp } from "../../lib/clientIp";
import { docsRateLimiter } from "../../lib/rateLimit";

export default async function handler(req: any, res: any) {
  // Strict CORS configuration
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, POST, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  // Extract client IP address reliably (supporting Vercel Edge / proxies)
  const ip = getClientIp(req);

  // Enforce distributed Upstash / in-memory rate limiting (20 req / 15 min / IP)
  const rateLimitResult = await docsRateLimiter.check(ip);
  if (!rateLimitResult.success) {
    if (rateLimitResult.retryAfter) {
      res.setHeader("Retry-After", rateLimitResult.retryAfter);
    }
    return res.status(429).json({
      error: docsRateLimiter.errorMessage,
      retryAfter: rateLimitResult.retryAfter
    });
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
