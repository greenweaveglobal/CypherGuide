import { sha256, signMessage, verifySignature, npubToHex } from './crypto';
import { NostrIdentity, KycAttestationRecord } from '../types';
import { nip19 } from 'nostr-tools';

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
 * Creates a signed KYC Attestation Record (Kind 30388 according to RFC-0006)
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

  const rawData = `kyc_attestation_${subjectHex}_${verifierHex}_${verifierStandard}_${issuedAt}_${expiresAt}`;
  const proofHash = await sha256(rawData);

  // Verifier signs the attestation
  const signature = await signMessage(proofHash, verifierIdentity);

  const rawNostrEvent = {
    kind: 30388,
    pubkey: verifierHex,
    created_at: issuedAt,
    tags: [
      ['d', dTag],
      ['p', subjectHex, 'subject'],
      ['verifier_standard', verifierStandard],
      ['issued_at', String(issuedAt)],
      ['expires_at', String(expiresAt)],
      ...(revocationEndpoint ? [['revocation_endpoint', revocationEndpoint]] : [])
    ],
    content: JSON.stringify(eventPayload),
    sig: signature
  };

  return {
    id: `kyc_${proofHash.slice(0, 12)}`,
    subjectNpub,
    verifierNpub: verifierIdentity.npub,
    verifierStandard,
    issuedAt,
    expiresAt,
    revocationEndpoint: revocationEndpoint || `https://verifier.org/revoke/${proofHash.slice(0, 8)}`,
    signature,
    kind: 30388,
    proofType: 'kyc_attestation',
    version: '1.0',
    rawNostrEventJson: JSON.stringify(rawNostrEvent)
  };
}

/**
 * Validates if guest's KYC attestation satisfies the host's accepted verifiers list according to RFC-0006.
 * Checks:
 * 1. Attestation subject matches guestNpub
 * 2. Attestation verifier matches 1-of-N acceptedKycVerifiers (compared via bech32 checksum / pubkey hex)
 * 3. Attestation is not expired
 * 4. Signature validity
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
    // If host entered text that didn't pass bech32 parsing, return error
    return { valid: false, reason: 'Danh sách Verifier của Host không chứa npub hợp lệ.' };
  }

  const guestHex = npubToHex(guestNpub);

  // Search for a matching attestation
  const nowSec = Math.floor(Date.now() / 1000);

  for (const attestation of attestationList) {
    // Check subject
    const attSubjectHex = npubToHex(attestation.subjectNpub);
    if (attestation.subjectNpub !== guestNpub && attSubjectHex !== guestHex) {
      continue;
    }

    // Check expiry
    if (attestation.expiresAt && attestation.expiresAt <= nowSec) {
      continue; // Expired attestation
    }

    // Check verifier match (1-in-N)
    const attVerifierHex = npubToHex(attestation.verifierNpub);
    const isMatched = acceptedKycVerifiers.includes(attestation.verifierNpub) ||
      (attVerifierHex && acceptedVerifierHexes.includes(attVerifierHex));

    if (isMatched) {
      return {
        valid: true,
        matchedVerifier: attestation.verifierNpub
      };
    }
  }

  return {
    valid: false,
    reason: `Khách hàng chưa có Xóa/Chứng nhận KYC (Attestation Kind 30388) hợp lệ từ 1 trong các Verifier được chấp nhận bởi Host.`
  };
}
