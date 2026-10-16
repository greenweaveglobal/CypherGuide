import { describe, it, expect, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'nostr-tools';
import { bytesToHex } from '../src/utils/crypto';
import {
  canonicalizeListingForSigning,
  createListingSignedEvent,
  verifyListingHostSignature,
  isEarlyHostEligible,
  calculateDynamicFee,
  DEFAULT_FEE_STRUCTURE,
  createFeeStructureFromPcm,
  LISTING_SIGNATURE_KIND,
  sha256Sync,
  normalizeToHexPubkey,
} from '../src/utils/dynamicFee';

describe('RFC-0019 Listing Signature & Dynamic Fee Verification (Task 2)', () => {
  // Generate test keys
  const hostSk = generateSecretKey();
  const hostPkHex = getPublicKey(hostSk);
  const hostNpub = nip19.npubEncode(hostPkHex);

  const coHostSk = generateSecretKey();
  const coHostPkHex = getPublicKey(coHostSk);
  const coHostNpub = nip19.npubEncode(coHostPkHex);

  const attackerSk = generateSecretKey();
  const attackerPkHex = getPublicKey(attackerSk);

  const baseListing = {
    id: 'listing_cypher_001',
    title: 'Cypherpunk Mountain Retreat',
    description: 'Off-grid mountain villa with satellite Lightning node.',
    priceSats: 5000,
    roomTypes: [
      { id: 'room_1', name: 'Standard Pod', priceSats: 5000 },
      { id: 'room_2', name: 'Deluxe Suite', priceSats: 9000 },
    ],
    coOwners: [
      { npub: hostNpub, share: 70, lightningAddress: 'host@pay.cypherguide.vn' },
      { npub: coHostNpub, share: 30, lightningAddress: 'cohost@pay.cypherguide.vn' },
    ],
    images: [
      { url: 'https://cdn.cypherguide.vn/img1.jpg', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      { url: 'https://cdn.cypherguide.vn/img2.jpg', hash: 'ca978112ca1bbdcafac231b39a23dc4da786081cd1e14dd6f6b3563297f0ce81' },
    ],
    createdAt: 1770000000000,
  };

  // 1. Ký rồi xác minh: hợp lệ
  it('signs and verifies listing successfully: valid === true', async () => {
    const { signedEventJson, canonicalJson, hash } = await createListingSignedEvent(baseListing, {
      pubKeyHex: hostPkHex,
      privKeyHex: bytesToHex(hostSk),
    });

    const listingWithSig = {
      ...baseListing,
      hostPubkey: hostPkHex,
      listingSignature: signedEventJson,
    };

    const result = verifyListingHostSignature(listingWithSig);
    expect(result.valid).toBe(true);
    expect(result.hostHex).toBe(hostPkHex);
    expect(result.canonicalHash).toBe(hash);
    expect(result.canonicalHash).toBe(sha256Sync(canonicalJson));
  });

  // 2. Đổi giá (500 so với 5000), địa chỉ Lightning của đồng sở hữu, mô tả, tỷ lệ chia,
  // danh sách loại phòng, ảnh (đổi url hoặc hash): mỗi trường hợp làm chữ ký không còn hợp lệ.
  describe('tamper detection: invalidates signature on any attribute mutation', () => {
    let validSignedListing: any;

    beforeEach(async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });
      validSignedListing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: signedEventJson,
      };
    });

    it('invalidates signature when price is changed (5000 -> 500)', () => {
      const tampered = { ...validSignedListing, priceSats: 500 };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });

    it('invalidates signature when co-owner lightning address is changed', () => {
      const tampered = {
        ...validSignedListing,
        coOwners: [
          { npub: hostNpub, share: 70, lightningAddress: 'attacker@evil.org' },
          { npub: coHostNpub, share: 30, lightningAddress: 'cohost@pay.cypherguide.vn' },
        ],
      };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });

    it('invalidates signature when description is changed', () => {
      const tampered = { ...validSignedListing, description: 'Tampered description with malicious links.' };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });

    it('invalidates signature when co-owner shares are modified', () => {
      const tampered = {
        ...validSignedListing,
        coOwners: [
          { npub: hostNpub, share: 10, lightningAddress: 'host@pay.cypherguide.vn' },
          { npub: coHostNpub, share: 90, lightningAddress: 'cohost@pay.cypherguide.vn' },
        ],
      };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });

    it('invalidates signature when roomTypes list is modified', () => {
      const tampered = {
        ...validSignedListing,
        roomTypes: [
          { id: 'room_1', name: 'Standard Pod Altered', priceSats: 5000 },
        ],
      };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });

    it('invalidates signature when image url is modified', () => {
      const tampered = {
        ...validSignedListing,
        images: [
          { url: 'https://attacker.com/fake.jpg', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
        ],
      };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });

    it('invalidates signature when image hash is modified', () => {
      const tampered = {
        ...validSignedListing,
        images: [
          { url: 'https://cdn.cypherguide.vn/img1.jpg', hash: '0000000000000000000000000000000000000000000000000000000000000000' },
        ],
      };
      const res = verifyListingHostSignature(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);
    });
  });

  // 3. Sai khóa, sai kind, sai thẻ d, thiếu thẻ x, sai thẻ v, content khác JSON chuẩn hóa, chữ ký bị sửa: bị từ chối
  describe('protocol verification checks on Nostr event structure', () => {
    it('rejects when event.pubkey does not match hostPubkey', async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: attackerPkHex,
        privKeyHex: bytesToHex(attackerSk),
      });

      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex, // Mismatched!
        listingSignature: signedEventJson,
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Event pubkey does not match hostPubkey');
    });

    it('rejects when event kind is not 30078', async () => {
      const createdAt = 1770000000000;
      const canonicalJson = canonicalizeListingForSigning(baseListing, { createdAt });
      const hash = sha256Sync(canonicalJson);

      const fakeTemplate = {
        kind: 1, // Regular note instead of 30078
        created_at: Math.floor(createdAt / 1000),
        tags: [
          ['d', `cypherguide:listing:${baseListing.id}`],
          ['v', '1'],
          ['x', hash],
          ['client', 'cypherguide'],
        ],
        content: canonicalJson,
      };

      const signedEvent = finalizeEvent(fakeTemplate, hostSk);
      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(signedEvent),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain(`Invalid event kind: expected ${LISTING_SIGNATURE_KIND}`);
    });

    it('rejects when identifier d tag is mismatched', async () => {
      const createdAt = 1770000000000;
      const canonicalJson = canonicalizeListingForSigning(baseListing, { createdAt });
      const hash = sha256Sync(canonicalJson);

      const fakeTemplate = {
        kind: LISTING_SIGNATURE_KIND,
        created_at: Math.floor(createdAt / 1000),
        tags: [
          ['d', 'cypherguide:listing:different_id'],
          ['v', '1'],
          ['x', hash],
          ['client', 'cypherguide'],
        ],
        content: canonicalJson,
      };

      const signedEvent = finalizeEvent(fakeTemplate, hostSk);
      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(signedEvent),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Identifier d tag mismatch');
    });

    it('rejects when content hash tag x is missing', async () => {
      const createdAt = 1770000000000;
      const canonicalJson = canonicalizeListingForSigning(baseListing, { createdAt });

      const fakeTemplate = {
        kind: LISTING_SIGNATURE_KIND,
        created_at: Math.floor(createdAt / 1000),
        tags: [
          ['d', `cypherguide:listing:${baseListing.id}`],
          ['v', '1'],
          ['client', 'cypherguide'],
        ],
        content: canonicalJson,
      };

      const signedEvent = finalizeEvent(fakeTemplate, hostSk);
      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(signedEvent),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Missing content hash tag (x)');
    });

    it('rejects when version tag v is invalid or unsupported', async () => {
      const createdAt = 1770000000000;
      const canonicalJson = canonicalizeListingForSigning(baseListing, { createdAt });
      const hash = sha256Sync(canonicalJson);

      const fakeTemplate = {
        kind: LISTING_SIGNATURE_KIND,
        created_at: Math.floor(createdAt / 1000),
        tags: [
          ['d', `cypherguide:listing:${baseListing.id}`],
          ['v', '99'], // Unsupported version
          ['x', hash],
          ['client', 'cypherguide'],
        ],
        content: canonicalJson,
      };

      const signedEvent = finalizeEvent(fakeTemplate, hostSk);
      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(signedEvent),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Unsupported signature version tag');
    });

    it('rejects when content differs from canonical listing JSON', async () => {
      const createdAt = 1770000000000;
      const canonicalJson = canonicalizeListingForSigning(baseListing, { createdAt });
      const hash = sha256Sync(canonicalJson);

      const fakeTemplate = {
        kind: LISTING_SIGNATURE_KIND,
        created_at: Math.floor(createdAt / 1000),
        tags: [
          ['d', `cypherguide:listing:${baseListing.id}`],
          ['v', '1'],
          ['x', hash],
          ['client', 'cypherguide'],
        ],
        content: canonicalJson + ' ', // extra trailing space alters exact content
      };

      const signedEvent = finalizeEvent(fakeTemplate, hostSk);
      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(signedEvent),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/(does not match signed hash|does not match canonical listing JSON)/);
    });

    it('rejects when Schnorr signature is tampered', async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });

      const parsed = JSON.parse(signedEventJson);
      // Alter the signature by replacing the last hex char
      const lastChar = parsed.sig.slice(-1);
      const tamperedChar = lastChar === 'a' ? 'b' : 'a';
      parsed.sig = parsed.sig.slice(0, -1) + tamperedChar;

      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(parsed),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid Schnorr signature');
    });
  });

  // 4. canonicalizeListingForSigning cho cùng kết quả khi đổi thứ tự khóa và khi npub viết dạng hex hay npub1....
  it('canonicalizeListingForSigning yields identical output regardless of key order and npub format (hex vs bech32)', () => {
    const listingKeyOrderA = {
      id: 'listing_order_test',
      title: 'Order Test Villa',
      description: 'Testing deterministic ordering',
      priceSats: 25000,
      roomTypes: [{ id: 'r1', name: 'Standard', priceSats: 25000 }],
      coOwners: [
        { npub: hostNpub, share: 60, lightningAddress: 'host@pay.vn' },
        { npub: coHostNpub, share: 40, lightningAddress: 'cohost@pay.vn' },
      ],
      createdAt: 1770000000000,
    };

    // Scramble key order and use hex pubkeys instead of npub1...
    const listingKeyOrderB = {
      createdAt: 1770000000000,
      priceSats: 25000,
      title: 'Order Test Villa',
      coOwners: [
        // Also inverted coOwner order to verify sorting
        { share: 40, npub: coHostPkHex, lightningAddress: 'cohost@pay.vn' },
        { lightningAddress: 'host@pay.vn', share: 60, npub: hostPkHex },
      ],
      id: 'listing_order_test',
      description: 'Testing deterministic ordering',
      roomTypes: [{ priceSats: 25000, name: 'Standard', id: 'r1' }],
    };

    const canonicalA = canonicalizeListingForSigning(listingKeyOrderA);
    const canonicalB = canonicalizeListingForSigning(listingKeyOrderB);

    expect(canonicalA).toBe(canonicalB);
    expect(sha256Sync(canonicalA)).toBe(sha256Sync(canonicalB));
  });

  // 5. Chữ ký cũ register_... (chuỗi thô và sự kiện JSON): bị từ chối
  describe('legacy register_ rejection', () => {
    it('rejects raw string register_ signature with re-sign message', () => {
      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: `register_${baseListing.id}_${baseListing.title}_${baseListing.priceSats}_coOwners:${hostNpub}:100`,
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cần ký lại bằng định dạng mới');
    });

    it('rejects JSON event containing register_ in content with re-sign message', () => {
      const legacyContent = `register_${baseListing.id}_${baseListing.title}_${baseListing.priceSats}`;
      const fakeTemplate = {
        kind: 30078,
        created_at: 1770000000,
        tags: [['d', `cypherguide:listing:${baseListing.id}`], ['v', '1'], ['x', sha256Sync(legacyContent)]],
        content: legacyContent,
      };
      const signedEvent = finalizeEvent(fakeTemplate, hostSk);

      const listing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: JSON.stringify(signedEvent),
      };

      const res = verifyListingHostSignature(listing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cần ký lại bằng định dạng mới');
    });
  });

  // 6. Kẻ tấn công ký listing của chính mình rồi gán hostPubkey của chủ nhà đã ghi danh: bị từ chối;
  // sao chép listing đã ký rồi đổi địa chỉ nhận tiền: bị từ chối.
  describe('security attack scenarios', () => {
    it('rejects attacker signing own listing and assigning enrolled host hostPubkey', async () => {
      // Attacker creates listing and signs with attacker's private key
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: attackerPkHex,
        privKeyHex: bytesToHex(attackerSk),
      });

      // Attacker fraudulently impersonates enrolled host's pubkey
      const spoofedListing = {
        ...baseListing,
        hostPubkey: hostPkHex, // Host is enrolled, attacker is not
        listingSignature: signedEventJson,
      };

      const res = verifyListingHostSignature(spoofedListing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Event pubkey does not match hostPubkey');

      // Also ensure isEarlyHostEligible rejects this spoofed listing
      const earlyHosts = [{ npub: hostNpub, enrolledAt: Date.now() - 10000, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(spoofedListing, earlyHosts)).toBe(false);
    });

    it('rejects attacker copying genuine signed listing and changing payout Lightning address', async () => {
      // Genuine host signs listing
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });

      // Attacker copies genuine listing and signature, but replaces Lightning address to steal funds
      const stolenListing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: signedEventJson,
        coOwners: [
          { npub: hostNpub, share: 70, lightningAddress: 'attacker@evil.org' },
          { npub: coHostNpub, share: 30, lightningAddress: 'attacker@evil.org' },
        ],
      };

      const res = verifyListingHostSignature(stolenListing);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match signed hash/);

      // Ineligible for early host discount
      const earlyHosts = [{ npub: hostNpub, enrolledAt: Date.now() - 10000, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(stolenListing, earlyHosts)).toBe(false);
    });
  });

  // 7. isEarlyHostEligible: chủ nhà đã ghi danh còn hạn có chữ ký hợp lệ được ưu đãi;
  // hết hạn, chưa ghi danh, hoặc chữ ký không hợp lệ thì không.
  describe('isEarlyHostEligible comprehensive conditions', () => {
    const now = 1770000000000;
    const enrolledTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago (active)
    const expiredTime = now - 400 * 24 * 60 * 60 * 1000; // 400 days ago (> 12 months)

    it('grants incentive if enrolled host is within 12 months and has valid RFC-0019 signature', async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });

      const validListing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: signedEventJson,
      };

      const earlyHosts = [{ npub: hostNpub, enrolledAt: enrolledTime, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(validListing, earlyHosts, now)).toBe(true);
    });

    it('denies incentive if enrollment is expired (> 12 months), even with valid signature', async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });

      const validListing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: signedEventJson,
      };

      const earlyHosts = [{ npub: hostNpub, enrolledAt: expiredTime, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(validListing, earlyHosts, now)).toBe(false);
    });

    it('denies incentive if host is not enrolled in earlyHosts registry', async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });

      const validListing = {
        ...baseListing,
        hostPubkey: hostPkHex,
        listingSignature: signedEventJson,
      };

      const earlyHosts = [{ npub: 'npub1otherperson000000000000000000000000000000000000000000000000', enrolledAt: enrolledTime, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(validListing, earlyHosts, now)).toBe(false);
    });

    it('denies incentive if signature is invalid or tampered, even if host is active enrolled', async () => {
      const { signedEventJson } = await createListingSignedEvent(baseListing, {
        pubKeyHex: hostPkHex,
        privKeyHex: bytesToHex(hostSk),
      });

      const tamperedListing = {
        ...baseListing,
        priceSats: 999999, // tampered
        hostPubkey: hostPkHex,
        listingSignature: signedEventJson,
      };

      const earlyHosts = [{ npub: hostNpub, enrolledAt: enrolledTime, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(tamperedListing, earlyHosts, now)).toBe(false);
    });

    it('denies incentive if listing lacks hostPubkey or listingSignature', () => {
      const unsignedListing = { ...baseListing };
      const earlyHosts = [{ npub: hostNpub, enrolledAt: enrolledTime, enrolledBy: 'admin' }];
      expect(isEarlyHostEligible(unsignedListing, earlyHosts, now)).toBe(false);
    });
  });

  // 8. minFeeSats: 1.000 sats ở mức strict cho phí 20 (cơ sở) và 10 (ưu đãi).
  describe('minFeeSats behavior at 1.000 sats amount under strict security level', () => {
    it('computes exactly 20 sats base fee and 10 sats early host incentive for 1.000 sats booking', () => {
      const amountSats = 1000;
      const feeStructure = DEFAULT_FEE_STRUCTURE; // base: 200 pcm, early: 100 pcm, minFeeSats: 10

      // Base fee calculation: 1000 * 200 / 10000 = 20 sats protocol fee
      const baseFee = calculateDynamicFee(amountSats, feeStructure, 1.0, 'strict', { isEarlyHost: false });
      expect(baseFee.appliedFeeRatePcm).toBe(200);
      expect(baseFee.protocolFeeSats).toBe(20);
      expect(baseFee.isEarlyHostDiscountApplied).toBe(false);

      // Early host fee calculation: 1000 * 100 / 10000 = 10 sats protocol fee (meets minFeeSats)
      const earlyFee = calculateDynamicFee(amountSats, feeStructure, 1.0, 'strict', { isEarlyHost: true });
      expect(earlyFee.appliedFeeRatePcm).toBe(100);
      expect(earlyFee.protocolFeeSats).toBe(10);
      expect(earlyFee.protocolFeeSats).toBe(feeStructure.minFeeSats);
      expect(earlyFee.isEarlyHostDiscountApplied).toBe(true);

      // Sub-1.000 sats booking: both rates floor at minFeeSats = 10
      const microAmountSats = 300;
      const microBaseFee = calculateDynamicFee(microAmountSats, feeStructure, 1.0, 'strict', { isEarlyHost: false });
      const microEarlyFee = calculateDynamicFee(microAmountSats, feeStructure, 1.0, 'strict', { isEarlyHost: true });
      expect(microBaseFee.protocolFeeSats).toBe(10);
      expect(microEarlyFee.protocolFeeSats).toBe(10);
    });
  });
});
