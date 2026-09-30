import { describe, it, expect } from "vitest";
import { getClientIp } from "../lib/clientIp";

describe("Client IP Extraction Security (Nhiệm vụ 2)", () => {
  it("prioritizes req.ip when Express trust proxy has evaluated the socket", () => {
    const req = {
      ip: "198.51.100.1",
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        "x-real-ip": "1.2.3.4"
      }
    };
    expect(getClientIp(req)).toBe("198.51.100.1");
  });

  it("prioritizes x-real-ip on Vercel Edge / Serverless when req.ip is absent", () => {
    const req = {
      headers: {
        "x-real-ip": "203.0.113.42",
        "x-forwarded-for": "1.1.1.1, 203.0.113.42"
      }
    };
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("extracts the LAST element of x-forwarded-for to defeat client IP spoofing", () => {
    // Untrusted client sends spoofed IP '1.2.3.4' in x-forwarded-for,
    // reverse proxy appends authentic remote IP '198.51.100.99' at the end.
    const req = {
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.5, 198.51.100.99"
      }
    };
    expect(getClientIp(req)).toBe("198.51.100.99");
  });

  it("falls back to socket.remoteAddress if headers are absent", () => {
    const req = {
      headers: {},
      socket: {
        remoteAddress: "192.0.2.1"
      }
    };
    expect(getClientIp(req)).toBe("192.0.2.1");
  });

  it("returns unknown when request has no identifiable IP information", () => {
    expect(getClientIp({})).toBe("unknown");
    expect(getClientIp(null)).toBe("unknown");
  });
});
