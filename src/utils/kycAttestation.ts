import { sha256, npubToHex, hexToBytes } from './crypto';
import { NostrIdentity, KycAttestationRecord } from '../types';
import { nip19, finalizeEvent, verifyEvent } from 'nostr-tools';

// Sample valid verifier npub for demo purposes (derived from a known 64-hex pubkey)
export const DEMO_VERIFIER_HEX_1 = '1111111111111111111111111111111111111111111111111111111111111111';
export const DEMO_VERIFIER_NPUB_1 = nip19.npubEncode(DEMO_VERIFIER_HEX_1);

export const DEMO_VERIFIER_HEX_2 = '2222222222222222222222222222222222222222222222222222222222222222';
export const DEMO_VERIFIER_NPUB_2 = nip19.npubEncode(DEMO_VERIFIER_HEX_2);

/**
 * Validates whether an npub string is valid according to bech32 checksum.
 * Uses existing npubToHex helper from crypto.ts (no new parsers).
 */
export function isValidNpub(npubStr: string): boolean {
  if (!npubStr) return false;
  const hex = npubToHex(npubStr.trim());
  return hex !== null && hex.length === 64;
}

/**
 * Creates a standard signed KYC Attestation Record (Kind 30388 according to RFC-0006)
 * Signs using Nostr Schnorr signature via finalizeEvent or NIP-07 extension.
 */
export async function createKycAttestation(
  subjectNpub: string,
  verifierIdentity: NostrIdentity,
  verifierStandard: string = 'FATF-TravelRule-2019',
  validityDays: number = 365,
  revocationEndpoint?: string
): Promise<KycAttestationRecord> {
  const subjectHex = npubToHex(subjectNpub) || subjectNpub;
  const verifierHex = verifierIdentity.pubKeyHex || npubToHex(verifierIdentity.npub) || '';

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + validityDays * 86400;
  const dTag = `kyc_attestation_${subjectHex.slice(0, 16)}`;

  const eventPayload = {
    subjectNpub,
    verifierNpub: verifierIdentity.npub,
    verifierStandard,
    issuedAt,
    expiresAt,
    revocationEndpoint: revocationEndpoint || `https://${verifierIdentity.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.verifier.org/revoke`,
    proofType: 'kyc_attestation',
    version: '1.0'
  };

  const eventTemplate = {
    kind: 30388,
    created_at: issuedAt,
    tags: [
      ['d', dTag],
      ['p', subjectHex, 'subject'],
      ['verifier_standard', verifierStandard],
      ['issued_at', String(issuedAt)],
      ['expires_at', String(expiresAt)],
      ...(revocationEndpoint ? [['revocation_endpoint', revocationEndpoint]] : [])
    ],
    content: JSON.stringify(eventPayload)
  };

  let finalizedEvent: any;

  if (verifierIdentity.privKeyHex) {
    const sk = hexToBytes(verifierIdentity.privKeyHex);
    finalizedEvent = finalizeEvent(eventTemplate, sk);
  } else {
    const nostr = typeof window !== 'undefined' ? (window as any).nostr : null;
    if (!nostr?.signEvent) {
      throw new Error("Không tìm thấy khóa riêng tư hoặc tiện ích NIP-07 để ký chứng nhận KYC.");
    }
    finalizedEvent = await nostr.signEvent(eventTemplate);
  }

  const proofHash = finalizedEvent.id;

  return {
    id: `kyc_${proofHash.slice(0, 12)}`,
    subjectNpub,
    verifierNpub: verifierIdentity.npub,
    verifierStandard,
    issuedAt,
    expiresAt,
    revocationEndpoint: revocationEndpoint || `https://verifier.org/revoke/${proofHash.slice(0, 8)}`,
    signature: finalizedEvent.sig,
    kind: 30388,
    proofType: 'kyc_attestation',
    version: '1.0',
    rawNostrEventJson: JSON.stringify(finalizedEvent)
  };
}

/**
 * Validates if guest's KYC attestation satisfies the host's accepted verifiers list according to RFC-0006.
 * Checks:
 * 1. Attestation subject matches guestNpub
 * 2. Signature verification via real Schnorr verifyEvent()
 * 3. Cryptographic pubkey (event.pubkey) strictly matches 1-of-N acceptedKycVerifiers whitelist
 * 4. Attestation is not expired
 */
export async function validateKycAttestationForBooking(
  guestNpub: string,
  attestationList: KycAttestationRecord[],
  acceptedKycVerifiers: string[],
  bookingAmountSats?: number,
  kycThresholdSats?: number
): Promise<{ valid: boolean; matchedVerifier?: string; reason?: string }> {
  // If no verifiers specified or threshold not met, KYC is not required or satisfied
  if (!acceptedKycVerifiers || acceptedKycVerifiers.length === 0) {
    return { valid: true };
  }

  if (kycThresholdSats !== undefined && kycThresholdSats > 0 && bookingAmountSats !== undefined) {
    if (bookingAmountSats < kycThresholdSats) {
      return { valid: true }; // Below threshold, KYC is optional/exempt
    }
  }

  // Convert accepted verifier npubs to hex for 1-in-N matching
  const acceptedVerifierHexes = acceptedKycVerifiers
    .map(v => npubToHex(v))
    .filter((h): h is string => h !== null);

  if (acceptedVerifierHexes.length === 0) {
    return { valid: false, reason: 'Danh sách Verifier của Host không chứa npub hợp lệ.' };
  }

  const guestHex = npubToHex(guestNpub);
  const nowSec = Math.floor(Date.now() / 1000);

  for (const attestation of attestationList) {
    // 1. Check subject match
    const attSubjectHex = npubToHex(attestation.subjectNpub);
    if (attestation.subjectNpub !== guestNpub && attSubjectHex !== guestHex) {
      continue;
    }

    // 2. Check expiry
    if (attestation.expiresAt && attestation.expiresAt <= nowSec) {
      continue; // Expired attestation
    }

    // 3. Mandatory Nostr Cryptographic Verification (H2 Fix)
    if (!attestation.rawNostrEventJson) {
      continue;
    }

    let nostrEvent: any;
    try {
      nostrEvent = JSON.parse(attestation.rawNostrEventJson);
    } catch {
      continue;
    }

    // Must be a valid Nostr Event with Schnorr signature
    if (!verifyEvent(nostrEvent)) {
      continue;
    }

    // 4. Strict Whitelist Check: event.pubkey MUST be one of the host's accepted verifiers
    const signerPubkeyHex = nostrEvent.pubkey?.toLowerCase();
    if (!signerPubkeyHex || !acceptedVerifierHexes.includes(signerPubkeyHex)) {
      continue;
    }

    // 5. Subject verification within the event itself
    const pTag = nostrEvent.tags?.find((t: string[]) => t[0] === 'p')?.[1];
    if (pTag && guestHex && pTag.toLowerCase() !== guestHex.toLowerCase()) {
      continue;
    }

    const matchedNpub = nip19.npubEncode(signerPubkeyHex);
    return {
      valid: true,
      matchedVerifier: matchedNpub
    };
  }

  return {
    valid: false,
    reason: `Không tìm thấy chứng nhận KYC (Kind 30388) hợp lệ có chữ ký xác thực từ Verifier được chấp nhận.`
  };
}
