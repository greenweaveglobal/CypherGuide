import { describe, it, expect, beforeAll } from 'vitest';
import { generateNostrIdentity } from '../src/utils/crypto';
import { createKycAttestation, validateKycAttestationForBooking } from '../src/utils/kycAttestation';
import { NostrIdentity } from '../src/types';

describe('KYC Attestation Module (H2 Security)', () => {
  let verifier: NostrIdentity;
  let fakeVerifier: NostrIdentity;
  let guest: NostrIdentity;

  beforeAll(async () => {
    verifier = await generateNostrIdentity('OfficialVerifier');
    fakeVerifier = await generateNostrIdentity('AttackerVerifier');
    guest = await generateNostrIdentity('GuestAlice');
  });

  it('validates authentic signed KYC attestation when verifier is whitelisted', async () => {
    const attestation = await createKycAttestation(
      guest.npub,
      verifier,
      'FATF-TravelRule-2019',
      30
    );

    const result = await validateKycAttestationForBooking(
      guest.npub,
      [attestation],
      [verifier.npub], // Host whitelisted verifier
      50000,
      10000
    );

    expect(result.valid).toBe(true);
    expect(result.matchedVerifier).toBe(verifier.npub);
  });

  it('rejects attestation signed by non-whitelisted verifier', async () => {
    const fakeAttestation = await createKycAttestation(
      guest.npub,
      fakeVerifier,
      'Fake-Standard',
      30
    );

    const result = await validateKycAttestationForBooking(
      guest.npub,
      [fakeAttestation],
      [verifier.npub], // Only verifier is whitelisted, not fakeVerifier
      50000,
      10000
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Không tìm thấy chứng nhận KYC');
  });

  it('rejects tampered or corrupted rawNostrEventJson', async () => {
    const attestation = await createKycAttestation(
      guest.npub,
      verifier,
      'FATF-TravelRule-2019',
      30
    );

    // Tamper with the event content
    const parsedEvent = JSON.parse(attestation.rawNostrEventJson!);
    parsedEvent.content = JSON.stringify({ tampered: true });
    // Keep the old signature, which will no longer match the altered content
    const tamperedAttestation = {
      ...attestation,
      rawNostrEventJson: JSON.stringify(parsedEvent)
    };

    const result = await validateKycAttestationForBooking(
      guest.npub,
      [tamperedAttestation],
      [verifier.npub],
      50000,
      10000
    );

    expect(result.valid).toBe(false);
  });

  it('exempts bookings below the KYC amount threshold', async () => {
    const result = await validateKycAttestationForBooking(
      guest.npub,
      [],
      [verifier.npub],
      5000, // booking amount is 5,000 sats
      10000 // threshold is 10,000 sats
    );

    expect(result.valid).toBe(true);
  });
});
