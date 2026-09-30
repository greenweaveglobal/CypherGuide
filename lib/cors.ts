/**
 * CORS Configuration and Enforcement Utility
 * 
 * Strict origin verification to prevent unauthorized cross-origin requests from arbitrary
 * domains (e.g. evilcypherguide.org or malicious *.run.app domains).
 */

const STATIC_ALLOWED_ORIGINS = new Set([
  "https://cypherguide.org",
  "https://www.cypherguide.org",
  "https://media.cypherguide.org"
]);

export function getAllowedOrigins(): Set<string> {
  const allowed = new Set(STATIC_ALLOWED_ORIGINS);

  // Extra origins configurable via environment (e.g. Cloud Run, AI Studio dev instance)
  const extra = process.env.CORS_EXTRA_ORIGINS;
  if (extra) {
    extra.split(",").map(o => o.trim()).filter(Boolean).forEach(o => allowed.add(o));
  }

  return allowed;
}

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) {
    // Non-browser or same-origin requests (e.g. curl, server-to-server, curl without Origin header)
    return true;
  }

  const trimmed = origin.trim();

  // 1. Check exact matches in production whitelist (and extra origins)
  if (getAllowedOrigins().has(trimmed)) {
    return true;
  }

  // 2. Allow localhost and 127.0.0.1 ONLY in non-production environments
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return true;
      }
    } catch {
      // Invalid URL syntax
      return false;
    }
  }

  return false;
}

/**
 * Applies strict CORS headers to a response object (supports Express Response and Vercel Serverless Response).
 * Returns true if the request was an OPTIONS preflight and was handled (ended).
 */
export function applyCorsHeaders(
  req: any,
  res: any,
  methods: string = "GET, POST, PATCH, OPTIONS"
): boolean {
  const origin = req.headers?.origin || req.headers?.Origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin.trim());
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  } else {
    // When origin is invalid or unauthorized: DO NOT set Access-Control-Allow-Origin header
  }

  if (req.method === "OPTIONS") {
    if (res.status && typeof res.status === "function") {
      res.status(200).end();
    } else if (res.sendStatus && typeof res.sendStatus === "function") {
      res.sendStatus(200);
    } else {
      res.end();
    }
    return true;
  }

  return false;
}

/**
 * Express middleware for CORS enforcement
 */
export function corsMiddleware(methods: string = "GET, POST, PATCH, OPTIONS") {
  return (req: any, res: any, next: any) => {
    const isOptionsHandled = applyCorsHeaders(req, res, methods);
    if (isOptionsHandled) {
      return;
    }
    next();
  };
}
