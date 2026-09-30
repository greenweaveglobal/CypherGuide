import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAllowedOrigin, applyCorsHeaders } from "../lib/cors";

describe("Strict CORS Enforcement (Nhiệm vụ 3)", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalExtra = process.env.CORS_EXTRA_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalExtra !== undefined) {
      process.env.CORS_EXTRA_ORIGINS = originalExtra;
    } else {
      delete process.env.CORS_EXTRA_ORIGINS;
    }
  });

  it("permits canonical production domains", () => {
    expect(isAllowedOrigin("https://cypherguide.org")).toBe(true);
    expect(isAllowedOrigin("https://www.cypherguide.org")).toBe(true);
    expect(isAllowedOrigin("https://media.cypherguide.org")).toBe(true);
  });

  it("strictly rejects malicious lookalike domains and arbitrary cloud domains", () => {
    // Lookalike domain that would bypass endsWith("cypherguide.org")
    expect(isAllowedOrigin("https://evilcypherguide.org")).toBe(false);
    expect(isAllowedOrigin("https://notcypherguide.org")).toBe(false);
    expect(isAllowedOrigin("https://attacker-cypherguide.org")).toBe(false);

    // Arbitrary Google Cloud Run / app domains that would bypass includes("run.app")
    expect(isAllowedOrigin("https://malicious-app.run.app")).toBe(false);
    expect(isAllowedOrigin("https://evil.run.app")).toBe(false);
  });

  it("permits localhost only when NODE_ENV !== production", () => {
    process.env.NODE_ENV = "development";
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5173")).toBe(true);

    process.env.NODE_ENV = "production";
    expect(isAllowedOrigin("http://localhost:3000")).toBe(false);
    expect(isAllowedOrigin("http://127.0.0.1:5173")).toBe(false);
  });

  it("permits explicit CORS_EXTRA_ORIGINS when configured", () => {
    process.env.CORS_EXTRA_ORIGINS = "https://preview.cypherguide.internal, https://ais-preview-xyz.run.app";
    expect(isAllowedOrigin("https://preview.cypherguide.internal")).toBe(true);
    expect(isAllowedOrigin("https://ais-preview-xyz.run.app")).toBe(true);
    expect(isAllowedOrigin("https://other-unauthorized.run.app")).toBe(false);
  });

  it("does NOT set Access-Control-Allow-Origin header for rejected origins", () => {
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      end() {}
    };

    const req = {
      method: "GET",
      headers: {
        origin: "https://evilcypherguide.org"
      }
    };

    applyCorsHeaders(req, res);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("sets Access-Control-Allow-Origin header for authorized origins", () => {
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      end() {}
    };

    const req = {
      method: "GET",
      headers: {
        origin: "https://cypherguide.org"
      }
    };

    applyCorsHeaders(req, res);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://cypherguide.org");
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
  });
});
