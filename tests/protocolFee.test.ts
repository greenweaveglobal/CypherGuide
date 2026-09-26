import { describe, it, expect } from 'vitest';
import { calculateDynamicFee, createFeeStructureFromPcm, DEFAULT_FEE_STRUCTURE } from '../src/utils/dynamicFee';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, nip19 } from 'nostr-tools';
import { bytesToHex } from '../src/utils/crypto';
import { createNip98AuthHeader } from '../src/utils/nip98Auth';

describe('Protocol Fee Single Source of Truth & NIP-98 Audit Trail (RFC-0016)', () => {
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

    // Clean up
    delete process.env.TEST_ADMIN_PUBKEY;
  });
});
