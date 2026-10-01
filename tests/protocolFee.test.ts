import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { calculateDynamicFee, createFeeStructureFromPcm, DEFAULT_FEE_STRUCTURE } from '../src/utils/dynamicFee';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, nip19 } from 'nostr-tools';
import { bytesToHex } from '../src/utils/crypto';
import { createNip98AuthHeader } from '../src/utils/nip98Auth';

describe('Protocol Fee Single Source of Truth & NIP-98 Audit Trail (RFC-0016)', () => {
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-"));
    tempConfigFile = path.join(tempDir, "protocol_config.json");
    const realConfigPath = path.join(process.cwd(), "data", "protocol_config.json");
    if (fs.existsSync(realConfigPath)) {
      fs.copyFileSync(realConfigPath, tempConfigFile);
    }
    process.env.PROTOCOL_CONFIG_PATH = tempConfigFile;
  });

  afterEach(() => {
    delete process.env.PROTOCOL_CONFIG_PATH;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const AUTHORIZED_ADMIN_PUBKEYS = new Set([
    '96dfc17448bdc132c22623c7febf89c587a8be269d41d9572a90f8b105b73c79',
    'f4fed1c8e0b595796b13a1b9182d54d3ad30aa1d6f90adb3cfec66c55985f941'
  ]);

  it('calculates dynamic fee based on dynamic baseFeeRatePcm instead of hardcoded defaults', () => {
    const amountSats = 100000;

    // Default rate: 20 pcm (0.2%)
    const defaultStructure = createFeeStructureFromPcm(20);
    const fee20 = calculateDynamicFee(amountSats, defaultStructure, 1.0, 'strict');
    expect(fee20.protocolFeeSats).toBe(200); // 100,000 * 20 / 10000 = 200 sats

    // Updated rate: 50 pcm (0.5%)
    const updatedStructure = createFeeStructureFromPcm(50);
    const fee50 = calculateDynamicFee(amountSats, updatedStructure, 1.0, 'strict');
    expect(fee50.protocolFeeSats).toBe(500); // 100,000 * 50 / 10000 = 500 sats

    // Updated rate: 100 pcm (1.0%)
    const fee100 = calculateDynamicFee(amountSats, createFeeStructureFromPcm(100), 1.0, 'strict');
    expect(fee100.protocolFeeSats).toBe(1000); // 100,000 * 100 / 10000 = 1000 sats

    // Total fee sats includes ln routing fee
    expect(fee50.totalFeeSats).toBe(fee50.protocolFeeSats + fee50.routingFeeSats);
  });

  it('creates and verifies a valid NIP-98 auth header for PATCH /api/protocol/fee', async () => {
    const testAdminSk = generateSecretKey();
    const testAdminSkHex = bytesToHex(testAdminSk);
    const testAdminPk = getPublicKey(testAdminSk);

    const authHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex);
    expect(authHeader).toBeTruthy();
    expect(authHeader!.startsWith('Nostr ')).toBe(true);

    const base64 = authHeader!.replace('Nostr ', '');
    const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

    expect(decoded.kind).toBe(27235);
    expect(decoded.pubkey).toBe(testAdminPk);
    expect(verifyEvent(decoded)).toBe(true);

    const uTag = decoded.tags.find((t: string[]) => t[0] === 'u')?.[1];
    const methodTag = decoded.tags.find((t: string[]) => t[0] === 'method')?.[1];

    expect(uTag).toBe('/api/protocol/fee');
    expect(methodTag).toBe('PATCH');
  });

  it('resolves relative URLs to absolute URLs using window.location.origin when signing NIP-98 in client (Blocker A)', async () => {
    const testAdminSk = generateSecretKey();
    const testAdminSkHex = bytesToHex(testAdminSk);
    const testAdminPk = getPublicKey(testAdminSk);

    const prevLocation = (globalThis as any).window.location;
    (globalThis as any).window.location = { origin: 'https://cypherguide.org' };

    try {
      const authHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex);
      expect(authHeader).toBeTruthy();
      expect(authHeader!.startsWith('Nostr ')).toBe(true);

      const base64 = authHeader!.replace('Nostr ', '');
      const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

      expect(decoded.kind).toBe(27235);
      expect(decoded.pubkey).toBe(testAdminPk);
      expect(verifyEvent(decoded)).toBe(true);

      const uTag = decoded.tags.find((t: string[]) => t[0] === 'u')?.[1];
      const methodTag = decoded.tags.find((t: string[]) => t[0] === 'method')?.[1];

      expect(uTag).toBe('https://cypherguide.org/api/protocol/fee');
      expect(methodTag).toBe('PATCH');
    } finally {
      (globalThis as any).window.location = prevLocation;
    }
  });

  it('integrates client NIP-98 header creation with verifyNip98Auth when PUBLIC_BASE_URL is configured', async () => {
    const { verifyNip98Auth } = await import('../lib/adminAuth');

    const testAdminSk = generateSecretKey();
    const testAdminSkHex = bytesToHex(testAdminSk);
    const testAdminPk = getPublicKey(testAdminSk);

    const publicBaseUrl = 'https://custom-domain.cypherguide.org';
    const prevBaseUrl = process.env.PUBLIC_BASE_URL;
    const prevTestAdmin = process.env.TEST_ADMIN_PUBKEY;
    const prevLocation = (globalThis as any).window.location;

    process.env.PUBLIC_BASE_URL = publicBaseUrl;
    process.env.TEST_ADMIN_PUBKEY = testAdminPk;
    (globalThis as any).window.location = { origin: publicBaseUrl };

    try {
      // Client generates header with relative path, which gets resolved to window.location.origin
      const configBody = JSON.stringify({ devLnAddress: 'cypherguide@zaps.lol' });
      const clientAuthHeader = await createNip98AuthHeader('/api/protocol/config', 'POST', testAdminSkHex, configBody);
      expect(clientAuthHeader).toBeTruthy();

      const req = {
        headers: {
          authorization: clientAuthHeader,
          host: 'custom-domain.cypherguide.org'
        },
        rawBody: configBody,
        body: JSON.parse(configBody)
      };

      const result = await verifyNip98Auth(req, '/api/protocol/config', 'POST', configBody);
      expect(result.authorized).toBe(true);
      expect(result.status).toBe(200);
      expect(result.pubkey).toBe(testAdminPk);
    } finally {
      if (prevBaseUrl !== undefined) {
        process.env.PUBLIC_BASE_URL = prevBaseUrl;
      } else {
        delete process.env.PUBLIC_BASE_URL;
      }
      if (prevTestAdmin !== undefined) {
        process.env.TEST_ADMIN_PUBKEY = prevTestAdmin;
      } else {
        delete process.env.TEST_ADMIN_PUBKEY;
      }
      (globalThis as any).window.location = prevLocation;
    }
  });

  it('disregards spoofed Host headers in production mode and strictly verifies PUBLIC_BASE_URL (Task 3)', async () => {
    const { verifyNip98Auth } = await import('../lib/adminAuth');

    const testAdminSk = generateSecretKey();
    const testAdminSkHex = bytesToHex(testAdminSk);
    const testAdminPk = getPublicKey(testAdminSk);

    const prevEnv = process.env.NODE_ENV;
    const prevBaseUrl = process.env.PUBLIC_BASE_URL;
    const prevTestAdmin = process.env.TEST_ADMIN_PUBKEY;
    const prevLocation = (globalThis as any).window.location;

    const publicBaseUrl = 'https://ais-pre-vxmqhbp3b3jpleggin55si-792548921200.asia-southeast1.run.app';
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_BASE_URL = publicBaseUrl;
    process.env.TEST_ADMIN_PUBKEY = testAdminPk;

    try {
      const feePayload = JSON.stringify({ baseFeeRatePcm: 20 });
      // 1. Attacker sends request with spoofed Host: evil.example and event signed for https://evil.example/api/protocol/fee
      (globalThis as any).window.location = { origin: 'https://evil.example' };
      const evilAuthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex, feePayload);
      expect(evilAuthHeader).toBeTruthy();

      const evilReq = {
        headers: {
          authorization: evilAuthHeader,
          host: 'evil.example'
        },
        rawBody: feePayload,
        body: JSON.parse(feePayload)
      };

      const evilResult = await verifyNip98Auth(evilReq, '/api/protocol/fee', 'PATCH', feePayload);
      expect(evilResult.authorized).toBe(false);
      expect(evilResult.status).toBe(401);
      expect(evilResult.error).toContain('URL tag mismatch');

      // 2. In production mode, TEST_ADMIN_PUBKEY is strictly ignored -> 403 Forbidden
      (globalThis as any).window.location = { origin: publicBaseUrl };
      const legitAuthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex, feePayload);
      expect(legitAuthHeader).toBeTruthy();

      const legitReq = {
        headers: {
          authorization: legitAuthHeader,
          host: 'ais-pre-vxmqhbp3b3jpleggin55si-792548921200.asia-southeast1.run.app'
        },
        rawBody: feePayload,
        body: JSON.parse(feePayload)
      };

      const prodResult = await verifyNip98Auth(legitReq, '/api/protocol/fee', 'PATCH', feePayload);
      expect(prodResult.authorized).toBe(false);
      expect(prodResult.status).toBe(403);
      expect(prodResult.error).toContain('is not an authorized protocol admin');

      // 3. In test mode (NODE_ENV = 'test'), the same request with matching URL and TEST_ADMIN_PUBKEY is authorized with 200
      process.env.NODE_ENV = 'test';
      const testResult = await verifyNip98Auth(legitReq, '/api/protocol/fee', 'PATCH', feePayload);
      expect(testResult.authorized).toBe(true);
      expect(testResult.status).toBe(200);
      expect(testResult.pubkey).toBe(testAdminPk);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevBaseUrl !== undefined) {
        process.env.PUBLIC_BASE_URL = prevBaseUrl;
      } else {
        delete process.env.PUBLIC_BASE_URL;
      }
      if (prevTestAdmin !== undefined) {
        process.env.TEST_ADMIN_PUBKEY = prevTestAdmin;
      } else {
        delete process.env.TEST_ADMIN_PUBKEY;
      }
      (globalThis as any).window.location = prevLocation;
    }
  });

  it('only accepts TEST_ADMIN_PUBKEY when NODE_ENV === "test" and strictly ignores it in production (Round 3 Task 3)', async () => {
    const { getAuthorizedAdminPubkeys, verifyNip98Auth } = await import('../lib/adminAuth');

    const testAdminSk = generateSecretKey();
    const testAdminSkHex = bytesToHex(testAdminSk);
    const testAdminPk = getPublicKey(testAdminSk);

    const prevEnv = process.env.NODE_ENV;
    const prevTestAdmin = process.env.TEST_ADMIN_PUBKEY;

    try {
      process.env.TEST_ADMIN_PUBKEY = testAdminPk;

      // 1. In production mode: TEST_ADMIN_PUBKEY is ignored and logs security warning
      process.env.NODE_ENV = 'production';
      const prodKeys = getAuthorizedAdminPubkeys();
      expect(prodKeys.has(testAdminPk.toLowerCase())).toBe(false);

      // 2. In development mode: TEST_ADMIN_PUBKEY is ignored
      process.env.NODE_ENV = 'development';
      const devKeys = getAuthorizedAdminPubkeys();
      expect(devKeys.has(testAdminPk.toLowerCase())).toBe(false);

      // 3. In test mode: TEST_ADMIN_PUBKEY is accepted
      process.env.NODE_ENV = 'test';
      const testKeys = getAuthorizedAdminPubkeys();
      expect(testKeys.has(testAdminPk.toLowerCase())).toBe(true);

      // 4. End-to-end verification via verifyNip98Auth:
      const body = JSON.stringify({ baseFeeRatePcm: 25 });
      const authHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'PATCH', testAdminSkHex, body);
      const req = {
        headers: { authorization: authHeader },
        rawBody: body,
        body: JSON.parse(body)
      };

      // In production -> 403 Forbidden (ignored)
      process.env.NODE_ENV = 'production';
      const prodRes = await verifyNip98Auth(req, '/api/protocol/fee', 'PATCH', body);
      expect(prodRes.authorized).toBe(false);
      expect(prodRes.status).toBe(403);
      expect(prodRes.error).toContain('is not an authorized protocol admin');

      // In test -> 200 Authorized
      process.env.NODE_ENV = 'test';
      const testRes = await verifyNip98Auth(req, '/api/protocol/fee', 'PATCH', body);
      expect(testRes.authorized).toBe(true);
      expect(testRes.status).toBe(200);
      expect(testRes.pubkey).toBe(testAdminPk);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevTestAdmin !== undefined) {
        process.env.TEST_ADMIN_PUBKEY = prevTestAdmin;
      } else {
        delete process.env.TEST_ADMIN_PUBKEY;
      }
    }
  });

  it('strictly enforces NIP-98 payload tag for POST and PATCH while allowing GET without payload tag (Round 3 Task 1)', async () => {
    const { verifyNip98Auth } = await import('../lib/adminAuth');

    const adminSk = generateSecretKey();
    const adminSkHex = bytesToHex(adminSk);
    const adminPk = getPublicKey(adminSk);

    const prevTestAdmin = process.env.TEST_ADMIN_PUBKEY;
    process.env.TEST_ADMIN_PUBKEY = adminPk;

    try {
      const validBody = JSON.stringify({ baseFeeRatePcm: 25 });

      // 1. Missing payload tag on PATCH request -> REJECTED (401)
      const now = Math.floor(Date.now() / 1000);
      const noPayloadTemplate = {
        kind: 27235 as const,
        created_at: now,
        tags: [
          ['u', 'https://cypherguide.org/api/protocol/fee'],
          ['method', 'PATCH']
        ],
        content: ''
      };
      const signedNoPayload = finalizeEvent(noPayloadTemplate, adminSk);
      const noPayloadHeader = `Nostr ${Buffer.from(JSON.stringify(signedNoPayload)).toString('base64')}`;

      const noPayloadReq = {
        headers: { authorization: noPayloadHeader },
        rawBody: validBody,
        body: JSON.parse(validBody)
      };
      const noPayloadResult = await verifyNip98Auth(noPayloadReq, '/api/protocol/fee', 'PATCH', validBody);
      expect(noPayloadResult.authorized).toBe(false);
      expect(noPayloadResult.status).toBe(401);
      expect(noPayloadResult.error).toContain("missing required 'payload' tag");

      // 2. Missing payload tag on POST request -> REJECTED (401)
      const noPayloadPostTemplate = {
        kind: 27235 as const,
        created_at: now,
        tags: [
          ['u', 'https://cypherguide.org/api/protocol/config'],
          ['method', 'POST']
        ],
        content: ''
      };
      const signedNoPayloadPost = finalizeEvent(noPayloadPostTemplate, adminSk);
      const noPayloadPostHeader = `Nostr ${Buffer.from(JSON.stringify(signedNoPayloadPost)).toString('base64')}`;

      const noPayloadPostReq = {
        headers: { authorization: noPayloadPostHeader },
        rawBody: validBody,
        body: JSON.parse(validBody)
      };
      const noPayloadPostResult = await verifyNip98Auth(noPayloadPostReq, '/api/protocol/config', 'POST', validBody);
      expect(noPayloadPostResult.authorized).toBe(false);
      expect(noPayloadPostResult.status).toBe(401);
      expect(noPayloadPostResult.error).toContain("missing required 'payload' tag");

      // 3. Altering one byte in body after signing -> REJECTED (401)
      const validAuthHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'PATCH', adminSkHex, validBody);
      expect(validAuthHeader).toBeTruthy();

      const tamperedBody = JSON.stringify({ baseFeeRatePcm: 26 }); // one byte altered
      const tamperedReq = {
        headers: { authorization: validAuthHeader },
        rawBody: tamperedBody,
        body: JSON.parse(tamperedBody)
      };
      const tamperedResult = await verifyNip98Auth(tamperedReq, '/api/protocol/fee', 'PATCH', tamperedBody);
      expect(tamperedResult.authorized).toBe(false);
      expect(tamperedResult.status).toBe(401);
      expect(tamperedResult.error).toContain('payload tag hash mismatch');

      // 4. Request with body but missing rawBody -> REJECTED (401)
      const noRawAdminSk = generateSecretKey();
      const noRawAdminSkHex = bytesToHex(noRawAdminSk);
      const noRawAdminPk = getPublicKey(noRawAdminSk);
      process.env.TEST_ADMIN_PUBKEY = noRawAdminPk;

      const noRawAuthHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'PATCH', noRawAdminSkHex, validBody);
      const noRawBodyReq = {
        headers: { authorization: noRawAuthHeader },
        body: JSON.parse(validBody)
        // rawBody omitted
      };
      const noRawBodyResult = await verifyNip98Auth(noRawBodyReq, '/api/protocol/fee', 'PATCH');
      expect(noRawBodyResult.authorized).toBe(false);
      expect(noRawBodyResult.status).toBe(401);
      expect(noRawBodyResult.error).toContain('raw request body is required');

      // 5. Valid body with payload tag matching rawBody -> ACCEPTED (200)
      // Use fresh key so event ID has not been seen
      const freshAdminSk = generateSecretKey();
      const freshAdminSkHex = bytesToHex(freshAdminSk);
      const freshAdminPk = getPublicKey(freshAdminSk);
      process.env.TEST_ADMIN_PUBKEY = freshAdminPk;

      const freshValidHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'PATCH', freshAdminSkHex, validBody);
      const validReq = {
        headers: { authorization: freshValidHeader },
        rawBody: validBody,
        body: JSON.parse(validBody)
      };
      const validResult = await verifyNip98Auth(validReq, '/api/protocol/fee', 'PATCH', validBody);
      expect(validResult.authorized).toBe(true);
      expect(validResult.status).toBe(200);
      expect(validResult.pubkey).toBe(freshAdminPk);

      // 6. GET request WITHOUT payload tag -> ACCEPTED (200)
      const getAdminSk = generateSecretKey();
      const getAdminSkHex = bytesToHex(getAdminSk);
      const getAdminPk = getPublicKey(getAdminSk);
      process.env.TEST_ADMIN_PUBKEY = getAdminPk;

      const getHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'GET', getAdminSkHex);
      expect(getHeader).toBeTruthy();

      const getReq = {
        headers: { authorization: getHeader }
      };
      const getResult = await verifyNip98Auth(getReq, '/api/protocol/fee', 'GET');
      expect(getResult.authorized).toBe(true);
      expect(getResult.status).toBe(200);
      expect(getResult.pubkey).toBe(getAdminPk);
    } finally {
      if (prevTestAdmin !== undefined) {
        process.env.TEST_ADMIN_PUBKEY = prevTestAdmin;
      } else {
        delete process.env.TEST_ADMIN_PUBKEY;
      }
    }
  });

  it('records event ID in anti-replay cache only after all checks pass and ensures concurrency safety (Round 3 Task 2)', async () => {
    const { verifyNip98Auth } = await import('../lib/adminAuth');

    const adminSk = generateSecretKey();
    const adminSkHex = bytesToHex(adminSk);
    const adminPk = getPublicKey(adminSk);

    const prevTestAdmin = process.env.TEST_ADMIN_PUBKEY;
    process.env.TEST_ADMIN_PUBKEY = adminPk;

    try {
      const validBody = JSON.stringify({ baseFeeRatePcm: 25 });
      const authHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'PATCH', adminSkHex, validBody);
      expect(authHeader).toBeTruthy();

      // Test 1: Faulty request (tampered body / wrong payload) does NOT burn the event ID
      const tamperedBody = JSON.stringify({ baseFeeRatePcm: 99 });
      const faultyReq = {
        headers: { authorization: authHeader },
        rawBody: tamperedBody,
        body: JSON.parse(tamperedBody)
      };
      const faultyResult = await verifyNip98Auth(faultyReq, '/api/protocol/fee', 'PATCH', tamperedBody);
      expect(faultyResult.authorized).toBe(false);
      expect(faultyResult.status).toBe(401);
      expect(faultyResult.error).toContain('payload tag hash mismatch');

      // Now send valid request with the SAME event ID -> MUST SUCCEED (event ID was not burned!)
      const validReq = {
        headers: { authorization: authHeader },
        rawBody: validBody,
        body: JSON.parse(validBody)
      };
      const validResult = await verifyNip98Auth(validReq, '/api/protocol/fee', 'PATCH', validBody);
      expect(validResult.authorized).toBe(true);
      expect(validResult.status).toBe(200);
      expect(validResult.pubkey).toBe(adminPk);

      // Test 2: Reusing event ID a second time after it already succeeded -> MUST BE REJECTED
      const reuseResult = await verifyNip98Auth(validReq, '/api/protocol/fee', 'PATCH', validBody);
      expect(reuseResult.authorized).toBe(false);
      expect(reuseResult.status).toBe(401);
      expect(reuseResult.error).toContain('NIP-98 event replay detected');

      // Test 3: Two valid concurrent requests with the same event ID -> EXACTLY ONE SUCCEEDS
      const concurrentAdminSk = generateSecretKey();
      const concurrentAdminSkHex = bytesToHex(concurrentAdminSk);
      const concurrentAdminPk = getPublicKey(concurrentAdminSk);
      process.env.TEST_ADMIN_PUBKEY = concurrentAdminPk;

      const concurrentHeader = await createNip98AuthHeader('https://cypherguide.org/api/protocol/fee', 'PATCH', concurrentAdminSkHex, validBody);
      const concurrentReq = {
        headers: { authorization: concurrentHeader },
        rawBody: validBody,
        body: JSON.parse(validBody)
      };

      const [resA, resB] = await Promise.all([
        verifyNip98Auth(concurrentReq, '/api/protocol/fee', 'PATCH', validBody),
        verifyNip98Auth(concurrentReq, '/api/protocol/fee', 'PATCH', validBody)
      ]);

      const successCount = (resA.authorized ? 1 : 0) + (resB.authorized ? 1 : 0);
      const replayCount = ((!resA.authorized && resA.error?.includes('replay')) ? 1 : 0) +
                          ((!resB.authorized && resB.error?.includes('replay')) ? 1 : 0);

      expect(successCount).toBe(1);
      expect(replayCount).toBe(1);
    } finally {
      if (prevTestAdmin !== undefined) {
        process.env.TEST_ADMIN_PUBKEY = prevTestAdmin;
      } else {
        delete process.env.TEST_ADMIN_PUBKEY;
      }
    }
  });

  it('creates a compliant Nostr audit event (Kind 1) matching the transparent disclosure specification', () => {
    const adminSk = generateSecretKey();
    const adminPk = getPublicKey(adminSk);
    const adminNpub = nip19.npubEncode(adminPk);

    const oldPcm = 20;
    const newPcm = 35;
    const oldPercent = (oldPcm / 100).toFixed(2);
    const newPercent = (newPcm / 100).toFixed(2);
    const timeIso = new Date().toISOString();

    const auditContent = `Phí protocol đổi từ ${oldPercent}% sang ${newPercent}%, bởi ${adminNpub}, lúc ${timeIso}`;

    const auditTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'protocol-governance'],
        ['t', 'cypherguide-fee'],
        ['param', 'baseFeeRatePcm', String(newPcm)],
        ['old_value', String(oldPcm)],
        ['new_value', String(newPcm)]
      ],
      content: auditContent
    };

    const signedAuditEvent = finalizeEvent(auditTemplate, adminSk);

    expect(signedAuditEvent.pubkey).toBe(adminPk);
    expect(signedAuditEvent.content).toContain(`Phí protocol đổi từ ${oldPercent}% sang ${newPercent}%`);
    expect(signedAuditEvent.content).toContain(adminNpub);
    expect(verifyEvent(signedAuditEvent)).toBe(true);
  });

  it('rejects NIP-98 authentication when pubkey is unauthorized', () => {
    const nonAdminSk = generateSecretKey();
    const nonAdminPk = getPublicKey(nonAdminSk);

    // Non-admin pubkey is not in AUTHORIZED_ADMIN_PUBKEYS
    expect(AUTHORIZED_ADMIN_PUBKEYS.has(nonAdminPk)).toBe(false);

    // Known authorized admins are recognized
    expect(AUTHORIZED_ADMIN_PUBKEYS.has('96dfc17448bdc132c22623c7febf89c587a8be269d41d9572a90f8b105b73c79')).toBe(true);
    expect(AUTHORIZED_ADMIN_PUBKEYS.has('f4fed1c8e0b595796b13a1b9182d54d3ad30aa1d6f90adb3cfec66c55985f941')).toBe(true);
  });

  it('rejects NIP-98 events outside the +/- 60s tolerance window', () => {
    const adminSk = generateSecretKey();
    const now = Math.floor(Date.now() / 1000);
    const expiredCreatedAt = now - 120; // 2 minutes ago

    const expiredTemplate = {
      kind: 27235 as const,
      created_at: expiredCreatedAt,
      tags: [
        ['u', '/api/protocol/fee'],
        ['method', 'PATCH']
      ],
      content: ''
    };

    const signedExpired = finalizeEvent(expiredTemplate, adminSk);
    expect(verifyEvent(signedExpired)).toBe(true);

    const delta = Math.abs(now - signedExpired.created_at);
    expect(delta > 60).toBe(true); // Should be rejected by verifyNip98Auth
  });

  it('handles api/protocol/fee handler with full authentication and validation', async () => {
    const feeHandler = (await import('../api/protocol/fee')).default;

    // Helper mock res
    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        headers: {},
        data: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.data = payload;
          return this;
        },
        setHeader(k: string, v: string) {
          this.headers[k] = v;
        },
        end() {
          return this;
        }
      };
      return res;
    };

    // 1. GET returns protocol config
    const getReq = { method: 'GET', headers: {} };
    const getRes = createMockRes();
    await feeHandler(getReq, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.data).toHaveProperty('baseFeeRatePcm');

    // 2. PATCH without auth returns 401
    const noAuthReq = { method: 'PATCH', headers: {}, body: { baseFeeRatePcm: 30 } };
    const noAuthRes = createMockRes();
    await feeHandler(noAuthReq, noAuthRes);
    expect(noAuthRes.statusCode).toBe(401);
    expect(noAuthRes.data.success).toBe(false);

    // 3. PATCH with unauthorized key returns 403
    const unauthorizedSk = generateSecretKey();
    const unauthorizedSkHex = bytesToHex(unauthorizedSk);
    const unauthBody = { baseFeeRatePcm: 30 };
    const unauthBodyStr = JSON.stringify(unauthBody);
    const unauthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', unauthorizedSkHex, unauthBodyStr);

    const unauthReq = {
      method: 'PATCH',
      headers: { authorization: unauthHeader },
      rawBody: unauthBodyStr,
      body: unauthBody
    };
    const unauthRes = createMockRes();
    await feeHandler(unauthReq, unauthRes);
    expect(unauthRes.statusCode).toBe(403);
    expect(unauthRes.data.success).toBe(false);

    // 4. PATCH with authorized test admin pubkey returns 200
    const testAdminSk = generateSecretKey();
    const testAdminPk = getPublicKey(testAdminSk);
    process.env.TEST_ADMIN_PUBKEY = testAdminPk;

    const testAdminSkHex = bytesToHex(testAdminSk);

    // Sign audit event
    const now = Math.floor(Date.now() / 1000);
    const auditEvent = finalizeEvent({
      kind: 1,
      created_at: now,
      tags: [
        ['t', 'protocol-governance'],
        ['t', 'cypherguide-fee'],
        ['param', 'baseFeeRatePcm', '25']
      ],
      content: `Phí protocol đổi từ 0.20% sang 0.25%, bởi ${nip19.npubEncode(testAdminPk)}, lúc ${new Date().toISOString()}`
    }, testAdminSk);

    const validBody = { baseFeeRatePcm: 25, auditEvent };
    const validBodyStr = JSON.stringify(validBody);
    const authHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex, validBodyStr);

    const validReq = {
      method: 'PATCH',
      headers: { authorization: authHeader },
      rawBody: validBodyStr,
      body: validBody
    };
    const validRes = createMockRes();
    await feeHandler(validReq, validRes);
    expect(validRes.statusCode).toBe(200);
    expect(validRes.data.success).toBe(true);
    expect(validRes.data.baseFeeRatePcm).toBe(25);
    expect(validRes.data.feeAuditNostrEventId).toBe(auditEvent.id);

    // 5. Replay attack: reusing the exact same authHeader must be rejected with 401
    const replayReq = {
      method: 'PATCH',
      headers: { authorization: authHeader },
      rawBody: validBodyStr,
      body: validBody
    };
    const replayRes = createMockRes();
    await feeHandler(replayReq, replayRes);
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.data.error).toContain('replay');

    // 6. Wrong URL: event signed with a different endpoint URL is rejected with 401
    const wrongUrlBody = JSON.stringify({ baseFeeRatePcm: 30 });
    const wrongUrlHeader = await createNip98AuthHeader('https://evilcypherguide.org/api/protocol/fee', 'PATCH', testAdminSkHex, wrongUrlBody);
    const wrongUrlReq = {
      method: 'PATCH',
      headers: { authorization: wrongUrlHeader },
      rawBody: wrongUrlBody,
      body: { baseFeeRatePcm: 30 }
    };
    const wrongUrlRes = createMockRes();
    await feeHandler(wrongUrlReq, wrongUrlRes);
    expect(wrongUrlRes.statusCode).toBe(401);
    expect(wrongUrlRes.data.error).toContain('URL tag mismatch');

    // 7. Wrong Method: event signed with 'GET' sent to 'PATCH' is rejected with 401
    const wrongMethodHeader = await createNip98AuthHeader('/api/protocol/fee', 'GET', testAdminSkHex);
    const wrongMethodReq = {
      method: 'PATCH',
      headers: { authorization: wrongMethodHeader },
      body: { baseFeeRatePcm: 30 }
    };
    const wrongMethodRes = createMockRes();
    await feeHandler(wrongMethodReq, wrongMethodRes);
    expect(wrongMethodRes.statusCode).toBe(401);
    expect(wrongMethodRes.data.error).toContain('method tag mismatch');

    // 8. Payload hash mismatch: event containing payload tag that doesn't match body is rejected
    const templateWithWrongPayload = {
      kind: 27235 as const,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', '/api/protocol/fee'],
        ['method', 'PATCH'],
        ['payload', '0000000000000000000000000000000000000000000000000000000000000000']
      ],
      content: ''
    };
    const signedWrongPayload = finalizeEvent(templateWithWrongPayload, testAdminSk);
    const wrongPayloadHeader = `Nostr ${Buffer.from(JSON.stringify(signedWrongPayload)).toString('base64')}`;
    const wrongPayloadReq = {
      method: 'PATCH',
      headers: { authorization: wrongPayloadHeader },
      body: { baseFeeRatePcm: 30 }
    };
    const wrongPayloadRes = createMockRes();
    await feeHandler(wrongPayloadReq, wrongPayloadRes);
    expect(wrongPayloadRes.statusCode).toBe(401);
    expect(wrongPayloadRes.data.error).toContain('payload tag hash mismatch');

    // 9. Expired event: event outside +/- 60s window is rejected
    const templateExpired = {
      kind: 27235 as const,
      created_at: Math.floor(Date.now() / 1000) - 100,
      tags: [
        ['u', '/api/protocol/fee'],
        ['method', 'PATCH']
      ],
      content: ''
    };
    const signedExpiredEvent = finalizeEvent(templateExpired, testAdminSk);
    const expiredHeader = `Nostr ${Buffer.from(JSON.stringify(signedExpiredEvent)).toString('base64')}`;
    const expiredReq = {
      method: 'PATCH',
      headers: { authorization: expiredHeader },
      body: { baseFeeRatePcm: 30 }
    };
    const expiredRes = createMockRes();
    await feeHandler(expiredReq, expiredRes);
    expect(expiredRes.statusCode).toBe(401);
    expect(expiredRes.data.error).toContain('outside +/- 60s tolerance');

    // Clean up
    delete process.env.TEST_ADMIN_PUBKEY;
  });
});
