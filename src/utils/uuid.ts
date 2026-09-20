/**
 * Safe UUID v4 generator with fallbacks for non-secure contexts (HTTP, raw IP, older browsers).
 * crypto.randomUUID() is only available in Secure Contexts (HTTPS or localhost).
 */
export function safeRandomUUID(): string {
  // 1. Native crypto.randomUUID (available in secure contexts: HTTPS/localhost)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if blocked
    }
  }

  // 2. crypto.getRandomValues (available in most browsers even if randomUUID isn't)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set version (4) and variant (RFC 4122: 10xxxxxx)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fallback to Math.random
    }
  }

  // 3. Math.random fallback (RFC 4122 v4 compliant formatting)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
