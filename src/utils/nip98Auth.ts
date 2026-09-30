import { finalizeEvent } from 'nostr-tools';
import { hexToBytes } from './crypto';

export interface Nip98Event {
  id?: string;
  pubkey?: string;
  kind: 27235;
  created_at: number;
  tags: string[][];
  content: string;
  sig?: string;
}

/**
 * Tạo header Authorization NIP-98 (Kind 27235) để xác thực các request admin / bảo mật.
 */
export async function createNip98AuthHeader(
  url: string,
  method: string,
  privKeyHex?: string,
  body?: string | any
): Promise<string | null> {
  let targetUrl = url;
  if (targetUrl.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    targetUrl = new URL(targetUrl, window.location.origin).toString();
  }

  const normalizedMethod = method.toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ['u', targetUrl],
    ['method', normalizedMethod]
  ];

  if (body !== undefined && body !== null) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const subtle = (typeof window !== 'undefined' && window.crypto?.subtle) || (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle);
    if (subtle) {
      const buffer = new TextEncoder().encode(bodyStr);
      const hashBuf = await subtle.digest('SHA-256', buffer);
      const hashHex = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      tags.push(['payload', hashHex]);
    }
  }

  const template = {
    kind: 27235 as const,
    created_at: now,
    tags,
    content: ''
  };

  try {
    let signedEvent: any = null;

    if (privKeyHex) {
      const sk = hexToBytes(privKeyHex);
      signedEvent = finalizeEvent(template, sk);
    } else if (typeof window !== 'undefined' && (window as any).nostr) {
      signedEvent = await (window as any).nostr.signEvent(template);
    }

    if (!signedEvent || !signedEvent.sig) {
      return null;
    }

    const jsonStr = JSON.stringify(signedEvent);
    const base64 = typeof window !== 'undefined' 
      ? btoa(unescape(encodeURIComponent(jsonStr)))
      : Buffer.from(jsonStr).toString('base64');

    return `Nostr ${base64}`;
  } catch (err) {
    console.error('[NIP-98] Error creating auth header:', err);
    return null;
  }
}
