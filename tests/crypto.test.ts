import { describe, it, expect, beforeEach } from 'vitest';
import { 
  generateNostrIdentity, 
  encryptAndStoreNip49Vault, 
  unlockVault, 
  hasVault, 
  removeVault 
} from '../src/utils/crypto';

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
