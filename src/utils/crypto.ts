import { generateSecretKey, getPublicKey, nip19, finalizeEvent, verifyEvent, getEventHash, nip04, nip44 } from 'nostr-tools';
import * as nip49 from 'nostr-tools/nip49';
import { schnorr } from '@noble/curves/secp256k1.js';
import { NostrIdentity } from '../types';

/**
 * NIP-49 Encrypted Vault using scrypt key derivation.
 * Eliminates weak 4-6 digit PIN brute-force risk.
 */
export function encryptAndStoreNip49Vault(privKeyHex: string, passphrase: string): string {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Mật khẩu bảo vệ (Passphrase) phải có ít nhất 8 ký tự.');
  }

  const sk = hexToBytes(privKeyHex);
  const encrypted = nip49.encrypt(sk, passphrase);

  if (typeof window !== 'undefined') {
    localStorage.setItem('cg_nip49_vault', encrypted);
    // Remove legacy PIN vault once migrated
    localStorage.removeItem('cg_encrypted_vault');
    // Ensure raw private key is completely wiped from sessionStorage
    sessionStorage.removeItem('cg_session_privkey');
  }

  return encrypted;
}

/**
 * Legacy PBKDF2 vault unlock for migration backwards compatibility.
 */
export async function unlockWithLegacyPin(pin: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const vault = localStorage.getItem('cg_encrypted_vault');
  if (!vault) return null;
  try {
    const { salt, iv, data } = JSON.parse(vault);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(data)
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return null;
  }
}

/**
 * Unlocks either NIP-49 vault (preferred) or Legacy PIN vault (with migration flag).
 */
export async function unlockVault(passphraseOrPin: string): Promise<{ privKeyHex: string; isLegacyMigrated: boolean } | null> {
  if (typeof window === 'undefined') return null;

  // 1. Try NIP-49 scrypt-based vault first
  const nip49Vault = localStorage.getItem('cg_nip49_vault');
  if (nip49Vault) {
    try {
      const sk = nip49.decrypt(nip49Vault, passphraseOrPin);
      const privKeyHex = bytesToHex(sk);
      return { privKeyHex, isLegacyMigrated: false };
    } catch (e) {
      return null;
    }
  }

  // 2. Fallback to Legacy PIN vault for smooth user migration
  const legacyVault = localStorage.getItem('cg_encrypted_vault');
  if (legacyVault) {
    const legacyKey = await unlockWithLegacyPin(passphraseOrPin);
    if (legacyKey) {
      return { privKeyHex: legacyKey, isLegacyMigrated: true };
    }
  }

  return null;
}

export function hasVault(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('cg_nip49_vault') || localStorage.getItem('cg_encrypted_vault'));
}

export function hasLegacyVault(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('cg_encrypted_vault') && !localStorage.getItem('cg_nip49_vault'));
}

export function removeVault(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('cg_nip49_vault');
  localStorage.removeItem('cg_encrypted_vault');
  sessionStorage.removeItem('cg_session_privkey');
}

// Backward-compatible alias for existing callers
export const encryptAndStoreKey = (privKeyHex: string, pinOrPass: string) => {
  if (pinOrPass.length >= 8) {
    return encryptAndStoreNip49Vault(privKeyHex, pinOrPass);
  }
  // If legacy 4-6 pin provided during migration/fallback
  return encryptAndStoreNip49Vault(privKeyHex, pinOrPass);
};

export const unlockWithPin = unlockWithLegacyPin;

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
  const privKeyHex = identity.privKeyHex;

  // Try NIP-07 Extension first if present and no local privKey
  const nostr = (window as any).nostr;
  if (!privKeyHex && nostr) {
    if (standard === 'NIP-04' && nostr.nip04?.encrypt) {
      return await nostr.nip04.encrypt(recipientPubKeyHex, content);
    }
    if (standard === 'NIP-44' && nostr.nip44?.encrypt) {
      return await nostr.nip44.encrypt(recipientPubKeyHex, content);
    }
  }

  // Use in-memory private key if available
  if (privKeyHex) {
    try {
      const sk = hexToBytes(privKeyHex);
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
    "THIẾU PRIVKEY TRONG PHIÊN: Vì lý do bảo mật, nsec không lưu trên trình duyệt sau khi tải lại trang. Vui lòng mở khóa Vault bằng Passphrase hoặc bật NIP-07 Extension để gửi tin nhắn mã hóa E2EE."
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

  const privKeyHex = identity.privKeyHex;

  // Try NIP-07 Extension if no local privKeyHex
  const nostr = (window as any).nostr;
  if (!privKeyHex && nostr) {
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
  if (privKeyHex) {
    try {
      const sk = hexToBytes(privKeyHex);
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
  return '[🔐 Tin nhắn đã mã hóa E2EE — Cần mở khóa Vault hoặc kích hoạt NIP-07 extension để giải mã]';
}

export async function signMessage(message: string, identity: NostrIdentity): Promise<string> {
  const eventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: message,
  };

  const privKeyHex = identity.privKeyHex;

  if (!identity.nsec && !privKeyHex) {
    const nostr = (window as any).nostr;
    if (!nostr) {
      throw new Error("Không có khóa riêng tư trong bộ nhớ. Vui lòng mở khóa Vault bằng Passphrase hoặc kết nối extension NIP-07.");
    }
    const signedEvent = await nostr.signEvent(eventTemplate);
    return JSON.stringify(signedEvent);
  } else if (privKeyHex) {
    const sk = hexToBytes(privKeyHex);
    const signedEvent = finalizeEvent(eventTemplate, sk);
    return JSON.stringify(signedEvent);
  } else {
    throw new Error("Không thể ký thông điệp: Thiếu khóa riêng tư hợp lệ.");
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

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Xác minh bằng chứng thanh toán Lightning (Preimage Verification):
 * Kiểm tra SHA256(preimage_bytes) === payment_hash
 */
export async function verifyLightningPreimage(preimageHex: string, expectedPaymentHashHex: string): Promise<boolean> {
  if (!preimageHex || !expectedPaymentHashHex) return false;
  try {
    const cleanPreimage = preimageHex.trim().toLowerCase();
    const cleanExpected = expectedPaymentHashHex.trim().toLowerCase();

    // Chuẩn Lightning: Preimage là 32 bytes (64 hex characters)
    if (/^[0-9a-f]{64}$/.test(cleanPreimage)) {
      const bytes = hexToBytes(cleanPreimage);
      const computedHash = await sha256Bytes(bytes);
      if (computedHash.toLowerCase() === cleanExpected) {
        return true;
      }
    }

    // Fallback: nếu preimage là chuỗi text UTF-8
    const textHash = await sha256(cleanPreimage);
    return textHash.toLowerCase() === cleanExpected;
  } catch (err) {
    console.error('[Crypto] Preimage verification error:', err);
    return false;
  }
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

