import { describe, it, expect } from 'vitest';
import { verifyLightningPreimage, sha256 } from '../src/utils/crypto';
import { parseBolt11, isSimulatedInvoice } from '../src/utils/lightning';

describe('Lightning Mutinynet Testnet & Preimage Verification (C4/H4 Hardening)', () => {
  it('validates authentic 32-byte preimage matching expected SHA-256 payment_hash', async () => {
    // Generate known 32-byte preimage (64 hex characters)
    const preimage = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    
    // Simulate Lightning payment_hash = SHA-256(preimage)
    const expectedPaymentHash = await sha256(preimage);

    // Cryptographic verification must pass
    const isValid = await verifyLightningPreimage(preimage, expectedPaymentHash);
    expect(isValid).toBe(true);
  });

  it('strictly rejects incorrect or tampered preimage', async () => {
    const preimage = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const wrongPreimage = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    const expectedPaymentHash = await sha256(preimage);

    const isValid = await verifyLightningPreimage(wrongPreimage, expectedPaymentHash);
    expect(isValid).toBe(false);
  });

  it('strictly rejects empty or invalid preimage inputs', async () => {
    const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(await verifyLightningPreimage('', paymentHash)).toBe(false);
    expect(await verifyLightningPreimage('   ', paymentHash)).toBe(false);
    expect(await verifyLightningPreimage('short', paymentHash)).toBe(false);
  });

  it('rejects treating authentic testnet/mutinynet invoices without _sim as simulated', () => {
    // Real testnet invoice (starts with lntb)
    const realTestnetInvoice = 'lntb210u1pn...real_invoice_without_sim_suffix';
    expect(isSimulatedInvoice(realTestnetInvoice)).toBe(false);

    // Real regtest / mutinynet signet invoice (starts with lnbcrt)
    const realMutinynetInvoice = 'lnbcrt210u1pn...voltage_mutinynet_real_invoice';
    expect(isSimulatedInvoice(realMutinynetInvoice)).toBe(false);
  });

  it('returns null on invalid or empty bolt11 invoice', () => {
    expect(parseBolt11('')).toBeNull();
    expect(parseBolt11('invalid_garbage_invoice')).toBeNull();
  });
});
