import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp } from "./clientIp";

export interface RateLimitResult {
  success: boolean;
  retryAfter?: number; // seconds
}

export interface RateLimiterOptions {
  name: string;
  limit: number;
  windowSeconds: number;
  prefix?: string;
  errorMessage?: string;
  useMemoryOnly?: boolean;
}

export class RateLimiter {
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly prefix: string;
  readonly errorMessage: string;
  readonly useMemoryOnly: boolean;

  private upstashLimiter: Ratelimit | null = null;
  private fallbackCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions) {
    this.name = options.name;
    this.limit = options.limit;
    this.windowSeconds = options.windowSeconds;
    this.prefix = options.prefix || `cg_ratelimit_${options.name}`;
    this.errorMessage = options.errorMessage || "Too many requests. Please try again later.";
    this.useMemoryOnly = Boolean(options.useMemoryOnly);

    if (!this.useMemoryOnly) {
      this.initUpstash();
    }

    // In-memory periodic cleanup every 5 minutes to avoid memory leaks
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of this.fallbackCounts.entries()) {
          if (now > record.resetTime) {
            this.fallbackCounts.delete(ip);
          }
        }
      }, 5 * 60 * 1000);
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  private initUpstash() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      try {
        const redis = new Redis({ url, token });
        this.upstashLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(this.limit, `${this.windowSeconds} s`),
          analytics: true,
          prefix: this.prefix
        });
      } catch (err) {
        console.error(`[RateLimit:${this.name}] Failed to initialize Upstash Redis:`, err);
        this.upstashLimiter = null;
      }
    } else {
      this.upstashLimiter = null;
    }
  }

  /**
   * Checks rate limit for a given client IP address.
   * Uses Upstash if configured, with graceful in-memory fallback on missing config or error.
   */
  async check(ip: string): Promise<RateLimitResult> {
    const safeIp = (ip || "unknown").trim();

    // Check if Upstash is available or needs re-init (e.g. if env vars set at runtime)
    if (!this.useMemoryOnly && !this.upstashLimiter && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.initUpstash();
    }

    if (this.upstashLimiter) {
      try {
        const { success, reset } = await this.upstashLimiter.limit(safeIp);
        if (!success) {
          const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
          return { success: false, retryAfter };
        }
        return { success: true };
      } catch (err) {
        console.error(`[RateLimit:${this.name}] Upstash check failed, falling back to in-memory:`, err);
        // Fall through to in-memory check
      }
    }

    // In-memory fallback
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const record = this.fallbackCounts.get(safeIp);

    if (!record || now > record.resetTime) {
      this.fallbackCounts.set(safeIp, { count: 1, resetTime: now + windowMs });
      return { success: true };
    }

    if (record.count >= this.limit) {
      const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      return { success: false, retryAfter };
    }

    record.count++;
    return { success: true };
  }

  /**
   * Express middleware adapter
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      const ip = getClientIp(req);
      const result = await this.check(ip);

      if (!result.success) {
        if (result.retryAfter) {
          res.setHeader("Retry-After", result.retryAfter);
        }
        return res.status(429).json({
          error: this.errorMessage,
          retryAfter: result.retryAfter
        });
      }

      next();
    };
  }

  // Testing helper to reset in-memory state
  resetInMemory() {
    this.fallbackCounts.clear();
  }
}

// Pre-configured rate limiters according to specification
export const docsRateLimiter = new RateLimiter({
  name: "docs",
  limit: 20,
  windowSeconds: 15 * 60, // 20 requests per 15 minutes
  prefix: "cg_ratelimit_docs",
  errorMessage: "Too many documentation queries. Please wait a few minutes."
});

export const uploadRateLimiter = new RateLimiter({
  name: "upload",
  limit: 30,
  windowSeconds: 15 * 60, // 30 uploads per 15 minutes
  prefix: "cg_ratelimit_upload",
  errorMessage: "Too many upload requests. Please try again later to prevent disk abuse."
});

export const lnurlRateLimiter = new RateLimiter({
  name: "lnurl",
  limit: 30,
  windowSeconds: 60, // 30 requests per minute
  prefix: "cg_ratelimit_lnurl",
  errorMessage: "Too many Lightning invoice resolution requests. Please wait a minute."
});
