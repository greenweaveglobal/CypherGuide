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
  privKeyHex?: string
): Promise<string | null> {
  const normalizedMethod = method.toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  const template = {
    kind: 27235 as const,
    created_at: now,
    tags: [
      ['u', url],
      ['method', normalizedMethod]
    ],
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
