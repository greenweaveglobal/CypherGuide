import { resolveLightningInvoice } from "../../lib/lnurlResolver";
import { applyCorsHeaders } from "../../lib/cors";
import { getClientIp } from "../../lib/clientIp";
import { lnurlRateLimiter } from "../../lib/rateLimit";

export default async function handler(req: any, res: any) {
  // Strict CORS configuration
  const isOptionsHandled = applyCorsHeaders(req, res, "GET, OPTIONS");
  if (isOptionsHandled) {
    return;
  }

  // Rate limiting (30 requests / minute / IP)
  const ip = getClientIp(req);
  const rateLimitResult = await lnurlRateLimiter.check(ip);
  if (!rateLimitResult.success) {
    if (rateLimitResult.retryAfter) {
      res.setHeader("Retry-After", rateLimitResult.retryAfter);
    }
    return res.status(429).json({
      error: lnurlRateLimiter.errorMessage,
      retryAfter: rateLimitResult.retryAfter
    });
  }

  try {
    const address = (req.query.address as string || "").trim().toLowerCase();
    const amountSats = parseInt(req.query.amount as string) || 21000;

    const result = await resolveLightningInvoice(address, amountSats);
    if (!result.success) {
      const statusCode = result.fallback ? 502 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to resolve Lightning Address",
      fallback: true
    });
  }
}
