import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, lnurlRateLimiter } from "../lib/rateLimit";

describe("Rate Limiting & Fallback Resilience (Nhiệm vụ 1)", () => {
  let testLimiter: RateLimiter;

  beforeEach(() => {
    testLimiter = new RateLimiter({
      name: "unit_test_limiter",
      limit: 3,
      windowSeconds: 60,
      errorMessage: "Rate limit reached for test",
      useMemoryOnly: true
    });
    testLimiter.resetInMemory();
  });

  it("permits requests within the allowed threshold using in-memory fallback", async () => {
    const ip = "192.0.2.10";

    const res1 = await testLimiter.check(ip);
    expect(res1.success).toBe(true);

    const res2 = await testLimiter.check(ip);
    expect(res2.success).toBe(true);

    const res3 = await testLimiter.check(ip);
    expect(res3.success).toBe(true);
  });

  it("blocks requests that exceed the limit and returns positive retryAfter", async () => {
    const ip = "192.0.2.20";

    for (let i = 0; i < 3; i++) {
      const res = await testLimiter.check(ip);
      expect(res.success).toBe(true);
    }

    // 4th request exceeds limit
    const blockedRes = await testLimiter.check(ip);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.retryAfter).toBeGreaterThan(0);
    expect(blockedRes.retryAfter).toBeLessThanOrEqual(60);
  });

  it("tracks rate limits independently across different IP addresses", async () => {
    const ipA = "198.51.100.1";
    const ipB = "198.51.100.2";

    // Exhaust limit for ipA
    for (let i = 0; i < 3; i++) {
      await testLimiter.check(ipA);
    }
    const blockedA = await testLimiter.check(ipA);
    expect(blockedA.success).toBe(false);

    // ipB should still be permitted
    const resB = await testLimiter.check(ipB);
    expect(resB.success).toBe(true);
  });

  it("lnurlRateLimiter enforces 30 requests per minute configuration", () => {
    expect(lnurlRateLimiter.limit).toBe(30);
    expect(lnurlRateLimiter.windowSeconds).toBe(60);
    expect(lnurlRateLimiter.name).toBe("lnurl");
  });

  it("middleware sets HTTP 429 and Retry-After header on rejection", async () => {
    const ip = "203.0.113.88";
    const headers: Record<string, any> = {};
    let statusCode = 200;
    let jsonBody: any = null;
    let nextCalled = false;

    const mockReq = {
      ip,
      headers: {}
    };

    const mockRes: any = {
      setHeader(k: string, v: any) {
        headers[k] = v;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        jsonBody = body;
        return this;
      }
    };

    const middleware = testLimiter.middleware();

    // Consume all 3 tokens
    for (let i = 0; i < 3; i++) {
      nextCalled = false;
      await middleware(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    }

    // 4th call should hit 429
    nextCalled = false;
    await middleware(mockReq, mockRes, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(429);
    expect(headers["Retry-After"]).toBeDefined();
    expect(jsonBody.error).toBe("Rate limit reached for test");
  });
});
