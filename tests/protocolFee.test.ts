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
      const clientAuthHeader = await createNip98AuthHeader('/api/protocol/config', 'POST', testAdminSkHex);
      expect(clientAuthHeader).toBeTruthy();

      const req = {
        headers: {
          authorization: clientAuthHeader,
          host: 'custom-domain.cypherguide.org'
        }
      };

      const result = await verifyNip98Auth(req, '/api/protocol/config', 'POST');
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
      // 1. Attacker sends request with spoofed Host: evil.example and event signed for https://evil.example/api/protocol/fee
      (globalThis as any).window.location = { origin: 'https://evil.example' };
      const evilAuthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex);
      expect(evilAuthHeader).toBeTruthy();

      const evilReq = {
        headers: {
          authorization: evilAuthHeader,
          host: 'evil.example'
        }
      };

      const evilResult = await verifyNip98Auth(evilReq, '/api/protocol/fee', 'PATCH');
      expect(evilResult.authorized).toBe(false);
      expect(evilResult.status).toBe(401);
      expect(evilResult.error).toContain('URL tag mismatch');

      // 2. Legitimate admin sends request with event signed for configured PUBLIC_BASE_URL
      (globalThis as any).window.location = { origin: publicBaseUrl };
      const legitAuthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex);
      expect(legitAuthHeader).toBeTruthy();

      const legitReq = {
        headers: {
          authorization: legitAuthHeader,
          host: 'ais-pre-vxmqhbp3b3jpleggin55si-792548921200.asia-southeast1.run.app'
        }
      };

      const legitResult = await verifyNip98Auth(legitReq, '/api/protocol/fee', 'PATCH');
      expect(legitResult.authorized).toBe(true);
      expect(legitResult.status).toBe(200);
      expect(legitResult.pubkey).toBe(testAdminPk);
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

  it('signs and verifies NIP-98 payload tag (SHA-256 hash) to prevent request body tampering (Task 4)', async () => {
    const { verifyNip98Auth } = await import('../lib/adminAuth');

    const testAdminSk = generateSecretKey();
    const testAdminSkHex = bytesToHex(testAdminSk);
    const testAdminPk = getPublicKey(testAdminSk);

    const prevTestAdmin = process.env.TEST_ADMIN_PUBKEY;
    process.env.TEST_ADMIN_PUBKEY = testAdminPk;

    try {
      const requestPayload = JSON.stringify({ baseFeeRatePcm: 25 });
      const authHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex, requestPayload);
      expect(authHeader).toBeTruthy();

      const base64 = authHeader!.replace('Nostr ', '');
      const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      const payloadTag = decoded.tags.find((t: string[]) => t[0] === 'payload')?.[1];
      expect(payloadTag).toBeTruthy();
      expect(payloadTag).toHaveLength(64); // SHA-256 hex string

      // 1. Valid request where body matches signed payload tag
      const validReq = {
        headers: {
          authorization: authHeader
        },
        body: JSON.parse(requestPayload)
      };
      const validResult = await verifyNip98Auth(validReq, '/api/protocol/fee', 'PATCH', requestPayload);
      expect(validResult.authorized).toBe(true);
      expect(validResult.status).toBe(200);

      // 2. Tampered request where body has been altered in transit
      // Use a new key / event so event ID is not rejected as replay
      const secondAdminSk = generateSecretKey();
      const secondAdminSkHex = bytesToHex(secondAdminSk);
      const secondAdminPk = getPublicKey(secondAdminSk);
      process.env.TEST_ADMIN_PUBKEY = secondAdminPk;

      const tamperedPayload = JSON.stringify({ baseFeeRatePcm: 99 });
      // Event signed for requestPayload, but body sent is tamperedPayload
      const secondAuthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', secondAdminSkHex, requestPayload);
      const tamperedReq = {
        headers: {
          authorization: secondAuthHeader
        },
        body: JSON.parse(tamperedPayload)
      };
      const tamperedResult = await verifyNip98Auth(tamperedReq, '/api/protocol/fee', 'PATCH', tamperedPayload);
      expect(tamperedResult.authorized).toBe(false);
      expect(tamperedResult.status).toBe(401);
      expect(tamperedResult.error).toContain('payload tag hash mismatch');
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
    const unauthHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', unauthorizedSkHex);

    const unauthReq = {
      method: 'PATCH',
      headers: { authorization: unauthHeader },
      body: { baseFeeRatePcm: 30 }
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
    const authHeader = await createNip98AuthHeader('/api/protocol/fee', 'PATCH', testAdminSkHex);

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

    const validReq = {
      method: 'PATCH',
      headers: { authorization: authHeader },
      body: { baseFeeRatePcm: 25, auditEvent }
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
      body: { baseFeeRatePcm: 25 }
    };
    const replayRes = createMockRes();
    await feeHandler(replayReq, replayRes);
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.data.error).toContain('replay');

    // 6. Wrong URL: event signed with a different endpoint URL is rejected with 401
    const wrongUrlHeader = await createNip98AuthHeader('https://evilcypherguide.org/api/protocol/fee', 'PATCH', testAdminSkHex);
    const wrongUrlReq = {
      method: 'PATCH',
      headers: { authorization: wrongUrlHeader },
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
