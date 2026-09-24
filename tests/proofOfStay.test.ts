import { describe, it, expect, beforeAll } from 'vitest';
import { generateNostrIdentity } from '../src/utils/crypto';
import { createProofOfStay, verifyProofOfStay, createHostEndorsementEvent } from '../src/utils/proofOfStay';
import { NostrIdentity } from '../src/types';

describe('Proof of Stay Module (H3 Security)', () => {
  let guest: NostrIdentity;
  let host: NostrIdentity;
  let thirdParty: NostrIdentity;

  beforeAll(async () => {
    guest = await generateNostrIdentity('GuestAlice');
    host = await generateNostrIdentity('HostBob');
    thirdParty = await generateNostrIdentity('IntruderEve');
  });

  it('rejects Proof-of-Stay that only has guest signature without host endorsement', async () => {
    const singleSignedProof = await createProofOfStay(
      'booking_123',
      guest,
      host.npub,
      Date.now() - 86400000,
      Date.now()
      // hostIdentity is omitted
    );

    expect(singleSignedProof.verificationStatus).toBe('pending_host_signature');
    expect(singleSignedProof.hostEndorsementEventJson).toBeUndefined();

    // Verification must fail when host endorsement is missing (H3 criteria)
    const isValid = await verifyProofOfStay(singleSignedProof);
    expect(isValid).toBe(false);
  });

  it('verifies successfully when co-signed by both guest and host', async () => {
    const dualSignedProof = await createProofOfStay(
      'booking_456',
      guest,
      host.npub,
      Date.now() - 86400000,
      Date.now(),
      host // Provided host identity for dual signing
    );

    expect(dualSignedProof.verificationStatus).toBe('verified');
    expect(dualSignedProof.hostEndorsementEventJson).toBeDefined();

    const isValid = await verifyProofOfStay(dualSignedProof);
    expect(isValid).toBe(true);
  });

  it('rejects when host endorsement is forged by an unauthorized third party', async () => {
    const baseProof = await createProofOfStay(
      'booking_789',
      guest,
      host.npub, // Real host is hostBob
      Date.now() - 86400000,
      Date.now()
    );

    // IntruderEve signs an endorsement instead of hostBob
    const fakeGuestEvent = JSON.parse(baseProof.guestEventJson);
    const forgedEndorsement = await createHostEndorsementEvent(
      'booking_789',
      fakeGuestEvent,
      thirdParty // Wrong identity
    );

    const forgedProof = {
      ...baseProof,
      hostEndorsementEventJson: JSON.stringify(forgedEndorsement)
    };

    const isValid = await verifyProofOfStay(forgedProof);
    expect(isValid).toBe(false);
  });
});
