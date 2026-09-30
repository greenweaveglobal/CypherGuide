/**
 * Client IP Extraction Utility
 * 
 * In reverse proxy architectures (Cloud Run, Vercel, Cloudflare, AWS ALB):
 * - An untrusted client can send an arbitrary 'x-forwarded-for: 1.2.3.4, 5.6.7.8' header
 *   to spoof their IP address if the server naively takes the first IP in the list.
 * - In Vercel Edge / Serverless, 'x-real-ip' is set by Vercel's edge network to the verified
 *   connecting client IP. Alternatively, the proxy appends the true remote IP to the end
 *   of the 'x-forwarded-for' chain.
 * - In Express with 'app.set("trust proxy", 1)', Express automatically evaluates the trusted
 *   hop and populates 'req.ip' with the authentic client address.
 */
export function getClientIp(req: any): string {
  if (!req) return "unknown";

  // 1. If Express already evaluated the trusted hop via trust proxy, use req.ip
  if (typeof req.ip === "string" && req.ip.trim().length > 0) {
    return req.ip.trim();
  }

  const headers = req.headers || {};

  // 2. Vercel edge verified IP header
  const realIp = headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim().length > 0) {
    return realIp.trim();
  }

  // 3. Fallback to x-forwarded-for: take the LAST element appended by the trusted edge proxy
  // Reason: Clients can prepend spoofed IPs to x-forwarded-for, but trusted reverse proxies
  // append the true incoming socket address to the end of the header.
  const forwardedFor = headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    const parts = forwardedFor.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  // 4. Direct socket address fallback
  if (req.socket?.remoteAddress && typeof req.socket.remoteAddress === "string") {
    return req.socket.remoteAddress.trim();
  }

  if (req.connection?.remoteAddress && typeof req.connection.remoteAddress === "string") {
    return req.connection.remoteAddress.trim();
  }

  return "unknown";
}
