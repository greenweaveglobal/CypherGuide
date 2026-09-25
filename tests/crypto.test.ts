import { describe, it, expect, beforeEach } from 'vitest';
import { 
  generateNostrIdentity, 
  encryptAndStoreNip49Vault, 
  unlockVault, 
  hasVault, 
  removeVault,
  verifyLightningPreimage,
  sha256 
} from '../src/utils/crypto';
import { parseBolt11, isSimulatedInvoice } from '../src/utils/lightning';

describe('NIP-49 Vault & Cryptographic Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('generates a valid Nostr identity with npub and nsec', async () => {
    const identity = await generateNostrIdentity('Alice');
    expect(identity.npub.startsWith('npub1')).toBe(true);
    expect(identity.nsec?.startsWith('nsec1')).toBe(true);
    expect(identity.pubKeyHex).toHaveLength(64);
    expect(identity.privKeyHex).toHaveLength(64);
  });

  it('encrypts private key into NIP-49 vault and unlocks with passphrase', async () => {
    const identity = await generateNostrIdentity('Bob');
    const passphrase = 'SuperSecurePassphrase123!';

    const ncryptsec = encryptAndStoreNip49Vault(identity.privKeyHex!, passphrase);
    expect(ncryptsec.startsWith('ncryptsec1')).toBe(true);
    expect(hasVault()).toBe(true);

    // CRITICAL (H1 Check): sessionStorage MUST NOT contain any raw private key!
    expect(sessionStorage.getItem('cg_session_privkey')).toBeNull();

    // Unlock with valid passphrase
    const unlocked = await unlockVault(passphrase);
    expect(unlocked).not.toBeNull();
    expect(unlocked?.privKeyHex).toBe(identity.privKeyHex);
    expect(unlocked?.isLegacyMigrated).toBe(false);

    // Fail with wrong passphrase
    const failedUnlock = await unlockVault('WrongPassword456!');
    expect(failedUnlock).toBeNull();
  });

  it('rejects weak passphrases under 8 characters', async () => {
    const identity = await generateNostrIdentity('Charlie');
    expect(() => {
      encryptAndStoreNip49Vault(identity.privKeyHex!, '1234');
    }).toThrow('Mật khẩu bảo vệ (Passphrase) phải có ít nhất 8 ký tự.');
  });

  it('cleans up all stored keys when removeVault is called', async () => {
    const identity = await generateNostrIdentity('Dave');
    encryptAndStoreNip49Vault(identity.privKeyHex!, 'StrongPassphrase888#');
    expect(hasVault()).toBe(true);

    removeVault();
    expect(hasVault()).toBe(false);
    expect(localStorage.getItem('cg_nip49_vault')).toBeNull();
    expect(sessionStorage.getItem('cg_session_privkey')).toBeNull();
  });
});

describe('Lightning Preimage Verification & BOLT-11 Utilities (C4/H4 Hardening)', () => {
  it('validates authentic 32-byte preimage matching expected SHA-256 payment_hash', async () => {
    const preimage = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const expectedPaymentHash = await sha256(preimage);

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

  it('ensures isSimulatedInvoice always returns false in production environment', () => {
    expect(isSimulatedInvoice('lnbc210u1pn...real_invoice')).toBe(false);
    expect(isSimulatedInvoice('lntb210u1pn...invoice')).toBe(false);
    expect(isSimulatedInvoice('invoice_sim')).toBe(false);
  });

  it('returns null on invalid or empty bolt11 invoice', () => {
    expect(parseBolt11('')).toBeNull();
    expect(parseBolt11('invalid_garbage_invoice')).toBeNull();
  });
});
