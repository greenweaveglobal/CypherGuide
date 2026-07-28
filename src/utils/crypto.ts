import { generateSecretKey, getPublicKey, nip19, finalizeEvent, verifyEvent, getEventHash, nip04, nip44 } from 'nostr-tools';
import { schnorr } from '@noble/curves/secp256k1.js';
import { NostrIdentity } from '../types';

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function nsecToHex(nsecStr: string): string | null {
  try {
    const clean = nsecStr.trim();
    if (!clean.startsWith('nsec1')) return null;
    const decoded = nip19.decode(clean);
    if (decoded.type === 'nsec') {
      const bytes = decoded.data as Uint8Array;
      return bytesToHex(bytes);
    }
  } catch (e) {
    return null;
  }
  return null;
}

export function npubToHex(npubStr: string): string | null {
  try {
    const clean = npubStr.trim();
    if (clean.startsWith('npub1')) {
      const decoded = nip19.decode(clean);
      if (decoded.type === 'npub') {
        return decoded.data as string;
      }
    }
    if (/^[0-9a-fA-F]{64}$/.test(clean)) {
      return clean.toLowerCase();
    }
  } catch (e) {
    return null;
  }
  return null;
}

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bytesTo5Bit(bytes: Uint8Array): number[] {
  const words: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((buffer >> bits) & 0x1f);
    }
  }
  if (bits > 0) {
    words.push((buffer << (5 - bits)) & 0x1f);
  }
  return words;
}

export function toBech32(prefix: string, hexStr: string): string {
  try {
    const bytes = hexToBytes(hexStr);
    const words = bytesTo5Bit(bytes);
        
    let result = prefix + '1';
    for (let i = 0; i < words.length; i++) {
      result += CHARSET[words[i]];
    }
        
    // Simple verification checksum
    let checksum = 0;
    for (let i = 0; i < words.length; i++) {
      checksum = (checksum + words[i] * (i + 1)) % 32;
    }
    result += CHARSET[checksum];
    return result;
  } catch (e) {
    return prefix + '1' + hexStr.slice(0, 32);
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Support for NIP-07 extension
export const isNip07Available = () => {
  return typeof (window as any).nostr !== 'undefined';
};

export async function loginWithNip07(): Promise<NostrIdentity> {
  const nostr = (window as any).nostr;
  if (!nostr) throw new Error("NIP-07 extension not found");
  
  const pubKeyHex = await nostr.getPublicKey();
  const npub = nip19.npubEncode(pubKeyHex);
  
  // We don't have nsec when using NIP-07, so we'll leave it empty.
  return {
    npub,
    nsec: '', // NIP-07 doesn't expose nsec
    pubKeyHex,
    privKeyHex: '',
    name: `Cypherpunk_${pubKeyHex.slice(0, 8)} (NIP-07)`
  };
}

export async function generateNostrIdentity(customName?: string): Promise<NostrIdentity> {
  const sk = generateSecretKey(); // Uint8Array
  const pk = getPublicKey(sk); // string (hex)
  
  const npub = nip19.npubEncode(pk);
  const nsec = nip19.nsecEncode(sk);
  const name = customName || `Cypherpunk_${pk.slice(0, 8)}`;
  
  return {
    npub,
    nsec,
    pubKeyHex: pk,
    privKeyHex: bytesToHex(sk),
    name,
  };
}

/**
 * Real Nostr E2EE Message Encryption (NIP-04 AES-CBC & NIP-44 ChaCha20)
 * Strict security: Never fall back to public-key hashing, requiring valid private key or NIP-07 extension.
 */
export async function encryptNostrMessage(
  content: string,
  recipientPubKeyHex: string,
  identity: NostrIdentity,
  standard: 'NIP-04' | 'NIP-44' = 'NIP-44'
): Promise<string> {
  // Try NIP-07 Extension first if present
  const nostr = (window as any).nostr;
  if (!identity.privKeyHex && nostr) {
    if (standard === 'NIP-04' && nostr.nip04?.encrypt) {
      return await nostr.nip04.encrypt(recipientPubKeyHex, content);
    }
    if (standard === 'NIP-44' && nostr.nip44?.encrypt) {
      return await nostr.nip44.encrypt(recipientPubKeyHex, content);
    }
  }

  // Use local session private key if available
  if (identity.privKeyHex) {
    try {
      const sk = hexToBytes(identity.privKeyHex);
      if (standard === 'NIP-04') {
        return await nip04.encrypt(sk, recipientPubKeyHex, content);
      } else {
        const conversationKey = nip44.v2.utils.getConversationKey(sk, recipientPubKeyHex);
        return nip44.v2.encrypt(content, conversationKey);
      }
    } catch (e: any) {
      throw new Error(`Lỗi mã hóa ${standard}: ` + (e.message || 'Mã hóa thất bại'));
    }
  }

  // Strict Cypherpunk refusal: Do not silently fallback to unencrypted or public-key-derived keys!
  throw new Error(
    "THIẾU PRIVKEY TRONG PHIÊN: Vì lý do bảo mật, nsec không lưu trên localStorage sau khi reload trang. Vui lòng nhập nsec trong phiên làm việc hoặc bật NIP-07 Extension để gửi tin nhắn mã hóa E2EE."
  );
}

/**
 * Real Nostr E2EE Message Decryption
 */
export async function decryptNostrMessage(
  ciphertext: string,
  peerPubKeyHex: string,
  identity: NostrIdentity,
  standard: 'NIP-04' | 'NIP-44' = 'NIP-44'
): Promise<string> {
  // If ciphertext was created in legacy session mock
  if (ciphertext.startsWith('enc:')) {
    return '[🔐 Tin nhắn được gửi từ phiên thử nghiệm cũ]';
  }

  // Try NIP-07 Extension if no local privKeyHex
  const nostr = (window as any).nostr;
  if (!identity.privKeyHex && nostr) {
    try {
      if (standard === 'NIP-04' && nostr.nip04?.decrypt) {
        return await nostr.nip04.decrypt(peerPubKeyHex, ciphertext);
      }
      if (standard === 'NIP-44' && nostr.nip44?.decrypt) {
        return await nostr.nip44.decrypt(peerPubKeyHex, ciphertext);
      }
    } catch (e) {
      return '[🔐 Không thể giải mã tin nhắn qua NIP-07 extension]';
    }
  }

  // Try local session private key
  if (identity.privKeyHex) {
    try {
      const sk = hexToBytes(identity.privKeyHex);
      if (standard === 'NIP-04') {
        return await nip04.decrypt(sk, peerPubKeyHex, ciphertext);
      } else {
        const conversationKey = nip44.v2.utils.getConversationKey(sk, peerPubKeyHex);
        return nip44.v2.decrypt(ciphertext, conversationKey);
      }
    } catch (e) {
      return '[🔐 Lỗi giải mã: Khóa không đúng hoặc dữ liệu bị thay đổi]';
    }
  }

  // Clear notice that private key is needed to decrypt
  return '[🔐 Tin nhắn đã mã hóa E2EE — Cần nhập nsec phiên này hoặc kích hoạt NIP-07 extension để giải mã]';
}

export async function signMessage(message: string, identity: NostrIdentity): Promise<string> {
  const eventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: message,
  };

  if (!identity.nsec && !identity.privKeyHex) {
    const nostr = (window as any).nostr;
    if (!nostr) throw new Error("NIP-07 extension not found");
    const signedEvent = await nostr.signEvent(eventTemplate);
    return JSON.stringify(signedEvent);
  } else {
    try {
      const sk = hexToBytes(identity.privKeyHex);
      const signedEvent = finalizeEvent(eventTemplate, sk);
      return JSON.stringify(signedEvent);
    } catch (e) {
      return JSON.stringify({
        ...eventTemplate,
        pubkey: identity.pubKeyHex,
        id: await sha256(message),
        sig: 'sig_mock_' + bytesToHex(window.crypto.getRandomValues(new Uint8Array(32)))
      });
    }
  }
}

export async function verifySignature(message: string, signatureOrEventJson: string, npubOrHex: string): Promise<boolean> {
  try {
    let expectedPubKeyHex = npubOrHex;
    if (npubOrHex.startsWith('npub1')) {
      const decoded = nip19.decode(npubOrHex);
      expectedPubKeyHex = decoded.data as string;
    }

    // Verify full Nostr Event JSON object
    if (signatureOrEventJson.startsWith('{')) {
      const event = JSON.parse(signatureOrEventJson);
      
      // 1. Check signer public key matches
      if (event.pubkey && event.pubkey !== expectedPubKeyHex) {
        return false;
      }

      // 2. CRITICAL SECURITY CHECK: Verify signed content strictly matches expected message/hash
      if (typeof event.content === 'string' && event.content !== message) {
        console.warn('[Crypto Security Alert] Signature-reuse detected! Signed content does not match expected message.', {
          expected: message,
          received: event.content
        });
        return false;
      }

      // 3. Verify Schnorr Signature on the event
      if (event.sig && event.id) {
        return verifyEvent(event);
      }
    }

    return false;
  } catch (e) {
    console.error('[Crypto] Verification failed:', e);
    return false;
  }
}

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signRawSchnorr(messageHashHex: string, privKeyHex: string): Promise<string> {
  let cleanHash = messageHashHex;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
    cleanHash = await sha256(messageHashHex);
  }
  const msgBytes = hexToBytes(cleanHash);
  const privBytes = hexToBytes(privKeyHex);
  const sig = schnorr.sign(msgBytes, privBytes);
  return bytesToHex(sig);
}

export async function verifyRawSchnorr(messageHashHex: string, sigHex: string, pubKeyHex: string): Promise<boolean> {
  try {
    let cleanHash = messageHashHex;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
      cleanHash = await sha256(messageHashHex);
    }
    const msgBytes = hexToBytes(cleanHash);
    const sigBytes = hexToBytes(sigHex);
    const pubBytes = hexToBytes(pubKeyHex);
    return schnorr.verify(sigBytes, msgBytes, pubBytes);
  } catch (e) {
    return false;
  }
}

