/**
 * Cypher Protocol - Proof of Stay Module (Compliant with RFC-0003 & Nostr NIP-78 / Kind 30078 Specification)
 * Tạo và xác minh Bằng chứng Lưu trú Mật mã (Cryptographic Proof-of-Stay Hash / Nostr Badge).
 */

import { sha256, signMessage, verifySignature, npubToHex } from './crypto';
import { NostrIdentity } from '../types';

export interface ProofOfStayRecord {
  id: string;
  bookingId: string;
  guestNpub: string;
  hostNpub: string;
  checkInTimestamp: number;
  checkOutTimestamp: number;
  proofHash: string;
  signature: string;
  kind: number; // 30078 (NIP-78 App Data)
  proofType: 'cryptographic_checkout' | 'beacon_proximity';
  version: string; // "1.0.0"
  verificationStatus: 'verified' | 'unverified' | 'tampered';
  rawNostrEventJson?: string;
}

/**
 * Mật mã hóa Bằng chứng Lưu trú khi Khách Checkout theo đúng chuẩn RFC-0003 (Nostr Kind 30078).
 */
export async function createProofOfStay(
  bookingId: string,
  guestIdentity: NostrIdentity,
  hostNpub: string,
  checkInTimestamp: number,
  checkOutTimestamp: number = Date.now()
): Promise<ProofOfStayRecord> {
  const guestPubkeyHex = npubToHex(guestIdentity.npub) || guestIdentity.pubKeyHex;
  const hostPubkeyHex = npubToHex(hostNpub) || hostNpub;

  const dTag = `proof_of_stay_${bookingId}`;
  const version = '1.0.0';
  const proofType = 'cryptographic_checkout';

  // Dữ liệu nội dung chuẩn hóa RFC-0003
  const eventPayload = {
    bookingId,
    guestNpub: guestIdentity.npub,
    hostNpub,
    checkInTimestamp,
    checkOutTimestamp,
    version,
    proofType
  };

  const contentJson = JSON.stringify(eventPayload);
  const rawData = `proof_of_stay_${bookingId}_${guestIdentity.npub}_${hostNpub}_${checkInTimestamp}_${checkOutTimestamp}_${version}`;
  const proofHash = await sha256(rawData);

  // Ký bằng Nostr Identity của Khách
  const signature = await signMessage(proofHash, guestIdentity);

  const rawNostrEvent = {
    kind: 30078,
    pubkey: guestPubkeyHex,
    created_at: Math.floor(checkOutTimestamp / 1000),
    tags: [
      ['d', dTag],
      ['p', guestPubkeyHex, 'guest'],
      ['p', hostPubkeyHex, 'host'],
      ['proof_type', proofType],
      ['v', version],
      ['check_in', String(checkInTimestamp)],
      ['check_out', String(checkOutTimestamp)],
      ['hash', proofHash]
    ],
    content: contentJson,
    sig: signature
  };

  return {
    id: `pos_${proofHash.slice(0, 12)}`,
    bookingId,
    guestNpub: guestIdentity.npub,
    hostNpub,
    checkInTimestamp,
    checkOutTimestamp,
    proofHash,
    signature,
    kind: 30078,
    proofType: 'cryptographic_checkout',
    version,
    verificationStatus: 'verified',
    rawNostrEventJson: JSON.stringify(rawNostrEvent)
  };
}

/**
 * Xác minh Bằng chứng Lưu trú Mật mã chuẩn RFC-0003 & Nostr NIP-78 Event
 */
export async function verifyProofOfStay(record: ProofOfStayRecord): Promise<boolean> {
  try {
    const version = record.version || '1.0.0';
    const rawData = `proof_of_stay_${record.bookingId}_${record.guestNpub}_${record.hostNpub}_${record.checkInTimestamp}_${record.checkOutTimestamp}_${version}`;
    const expectedHash = await sha256(rawData);

    if (expectedHash !== record.proofHash) {
      console.warn('[ProofOfStay] Hash mismatch in proof payload!');
      return false;
    }

    // Nếu có rawNostrEventJson, kiểm tra các tags NIP-78
    if (record.rawNostrEventJson) {
      const event = JSON.parse(record.rawNostrEventJson);
      if (event.kind !== 30078) return false;

      const dTag = event.tags?.find((t: string[]) => t[0] === 'd');
      if (!dTag || dTag[1] !== `proof_of_stay_${record.bookingId}`) return false;

      const vTag = event.tags?.find((t: string[]) => t[0] === 'v');
      if (!vTag || vTag[1] !== version) return false;
    }

    // Xác minh chữ ký với pubKeyHex tương ứng của guestNpub
    return await verifySignature(expectedHash, record.signature, record.guestNpub);
  } catch (err) {
    console.error('[ProofOfStay] Verification failed:', err);
    return false;
  }
}
