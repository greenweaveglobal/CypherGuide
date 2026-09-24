/**
 * Cypher Protocol - Proof of Stay Module (Compliant with RFC-0003 & Nostr NIP-78 / Kind 30078 Specification)
 * Tạo và xác minh Bằng chứng Lưu trú Mật mã Đồng Ký Khách + Host (Dual-signed Cryptographic Proof-of-Stay).
 */

import { sha256, npubToHex, hexToBytes } from './crypto';
import { NostrIdentity } from '../types';
import { finalizeEvent, verifyEvent } from 'nostr-tools';

export interface ProofOfStayRecord {
  id: string;
  bookingId: string;
  guestNpub: string;
  hostNpub: string;
  checkInTimestamp: number;
  checkOutTimestamp: number;
  proofHash: string;
  signature: string; // guest signature
  hostSignature?: string; // host signature
  kind: number; // 30078 (NIP-78 App Data)
  proofType: 'cryptographic_checkout' | 'beacon_proximity';
  version: string; // "2.0.0"
  verificationStatus: 'verified' | 'unverified' | 'pending_host_signature' | 'tampered';
  guestEventJson: string;
  hostEndorsementEventJson?: string;
  rawNostrEventJson?: string; // backwards compatibility alias for guestEventJson
}

/**
 * Creates standard Nostr Kind 30078 Event for Guest Stay Claim.
 */
export async function createGuestClaimEvent(
  bookingId: string,
  guestIdentity: NostrIdentity,
  hostPubkeyHex: string,
  checkInTimestamp: number,
  checkOutTimestamp: number
): Promise<any> {
  const guestPubkeyHex = npubToHex(guestIdentity.npub) || guestIdentity.pubKeyHex;
  const dTag = `proof_of_stay_${bookingId}`;
  const version = '2.0.0';
  const proofType = 'cryptographic_checkout';

  const eventPayload = {
    bookingId,
    guestNpub: guestIdentity.npub,
    hostPubkeyHex,
    checkInTimestamp,
    checkOutTimestamp,
    version,
    proofType
  };

  const eventTemplate = {
    kind: 30078,
    created_at: Math.floor(checkOutTimestamp / 1000),
    tags: [
      ['d', dTag],
      ['p', guestPubkeyHex, 'guest'],
      ['p', hostPubkeyHex, 'host'],
      ['booking', bookingId],
      ['proof_type', proofType],
      ['v', version],
      ['check_in', String(checkInTimestamp)],
      ['check_out', String(checkOutTimestamp)]
    ],
    content: JSON.stringify(eventPayload)
  };

  if (guestIdentity.privKeyHex) {
    const sk = hexToBytes(guestIdentity.privKeyHex);
    return finalizeEvent(eventTemplate, sk);
  }

  const nostr = typeof window !== 'undefined' ? (window as any).nostr : null;
  if (nostr?.signEvent) {
    return await nostr.signEvent(eventTemplate);
  }

  throw new Error("Không thể ký Proof-of-Stay: Thiếu khóa riêng tư hoặc tiện ích NIP-07 của khách.");
}

/**
 * Host co-signs and endorses the guest's Proof-of-Stay claim event.
 */
export async function createHostEndorsementEvent(
  bookingId: string,
  guestEvent: any,
  hostIdentity: NostrIdentity
): Promise<any> {
  const hostPubkeyHex = npubToHex(hostIdentity.npub) || hostIdentity.pubKeyHex;
  const guestPubkeyHex = guestEvent.pubkey;

  const endorsementTemplate = {
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `pos_endorsement_${guestEvent.id}`],
      ['e', guestEvent.id, 'pos_guest_claim'],
      ['p', guestPubkeyHex, 'guest'],
      ['p', hostPubkeyHex, 'host'],
      ['booking', bookingId],
      ['status', 'confirmed'],
      ['v', '2.0.0']
    ],
    content: JSON.stringify({
      action: 'endorse_proof_of_stay',
      bookingId,
      guestEventId: guestEvent.id,
      confirmedAt: Math.floor(Date.now() / 1000)
    })
  };

  if (hostIdentity.privKeyHex) {
    const sk = hexToBytes(hostIdentity.privKeyHex);
    return finalizeEvent(endorsementTemplate, sk);
  }

  const nostr = typeof window !== 'undefined' ? (window as any).nostr : null;
  if (nostr?.signEvent) {
    return await nostr.signEvent(endorsementTemplate);
  }

  throw new Error("Không thể đồng ký Proof-of-Stay: Thiếu khóa riêng tư hoặc tiện ích NIP-07 của host.");
}

/**
 * Creates a Dual-Signed Proof-of-Stay Record (Compliant with RFC-0003 & H3 requirements)
 * Requires both Guest Claim and Host Endorsement signatures.
 */
export async function createProofOfStay(
  bookingId: string,
  guestIdentity: NostrIdentity,
  hostNpub: string,
  checkInTimestamp: number,
  checkOutTimestamp: number = Date.now(),
  hostIdentity?: NostrIdentity
): Promise<ProofOfStayRecord> {
  const hostPubkeyHex = npubToHex(hostNpub) || hostNpub;
  const guestEvent = await createGuestClaimEvent(
    bookingId,
    guestIdentity,
    hostPubkeyHex,
    checkInTimestamp,
    checkOutTimestamp
  );

  let hostEndorsement: any = null;
  if (hostIdentity) {
    hostEndorsement = await createHostEndorsementEvent(bookingId, guestEvent, hostIdentity);
  }

  const proofHash = guestEvent.id;
  const guestEventJson = JSON.stringify(guestEvent);
  const hostEndorsementEventJson = hostEndorsement ? JSON.stringify(hostEndorsement) : undefined;

  return {
    id: `pos_${proofHash.slice(0, 12)}`,
    bookingId,
    guestNpub: guestIdentity.npub,
    hostNpub,
    checkInTimestamp,
    checkOutTimestamp,
    proofHash,
    signature: guestEvent.sig,
    hostSignature: hostEndorsement?.sig,
    kind: 30078,
    proofType: 'cryptographic_checkout',
    version: '2.0.0',
    verificationStatus: hostEndorsement ? 'verified' : 'pending_host_signature',
    guestEventJson,
    hostEndorsementEventJson,
    rawNostrEventJson: guestEventJson
  };
}

/**
 * Xác minh Bằng chứng Lưu trú Mật mã chuẩn RFC-0003:
 * BẮT BUỘC ĐỒNG KÝ 2 BÊN (Khách + Host).
 * Event chỉ có chữ ký khách (thiếu xác nhận host) bị từ chối.
 */
export async function verifyProofOfStay(record: ProofOfStayRecord): Promise<boolean> {
  try {
    const guestPubkeyHex = npubToHex(record.guestNpub);
    const hostPubkeyHex = npubToHex(record.hostNpub);

    if (!guestPubkeyHex || !hostPubkeyHex) {
      console.warn('[ProofOfStay] Invalid npub encoding');
      return false;
    }

    // 1. Verify Guest Claim Event
    const guestJson = record.guestEventJson || record.rawNostrEventJson;
    if (!guestJson) {
      console.warn('[ProofOfStay] Missing guest event JSON');
      return false;
    }

    const guestEvent = JSON.parse(guestJson);
    if (guestEvent.kind !== 30078) return false;
    if (guestEvent.pubkey.toLowerCase() !== guestPubkeyHex.toLowerCase()) return false;
    if (!verifyEvent(guestEvent)) {
      console.warn('[ProofOfStay] Invalid guest Schnorr signature');
      return false;
    }

    // 2. Strict Requirement (H3): Host Endorsement is MANDATORY
    if (!record.hostEndorsementEventJson) {
      console.warn('[ProofOfStay] REJECTED: Proof-of-stay requires both guest and host signatures. Missing host confirmation.');
      return false;
    }

    const hostEvent = JSON.parse(record.hostEndorsementEventJson);
    if (hostEvent.kind !== 30078) return false;
    if (hostEvent.pubkey.toLowerCase() !== hostPubkeyHex.toLowerCase()) return false;
    if (!verifyEvent(hostEvent)) {
      console.warn('[ProofOfStay] Invalid host Schnorr signature');
      return false;
    }

    // Verify cross-reference tag ['e', guestEvent.id]
    const eTag = hostEvent.tags?.find((t: string[]) => t[0] === 'e')?.[1];
    if (eTag !== guestEvent.id) {
      console.warn('[ProofOfStay] Host endorsement does not reference guest event id');
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ProofOfStay] Verification error:', err);
    return false;
  }
}
