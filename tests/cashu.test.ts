import { describe, it, expect } from 'vitest';
import { 
  encodeCashuToken, 
  decodeCashuToken, 
  CashuToken, 
  calculateTotalEcashAmount,
  splitProofsForAmount
} from '../src/utils/cashu';

describe('Cashu Protocol Module (NUT-11 & Ecash)', () => {
  const sampleToken: CashuToken = {
    mint: 'https://mint.minibits.cash/Bitcoin',
    proofs: [
      { id: '001', amount: 8, secret: 'sec_1', C: '02_C1' },
      { id: '002', amount: 16, secret: 'sec_2', C: '02_C2' },
      { id: '003', amount: 32, secret: 'sec_3', C: '02_C3' }
    ],
    memo: 'Stay booking ecash deposit'
  };

  it('encodes and decodes standard Cashu V3 token strings', () => {
    const encoded = encodeCashuToken(sampleToken);
    expect(encoded.startsWith('cashuA')).toBe(true);

    const decoded = decodeCashuToken(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.mint).toBe(sampleToken.mint);
    expect(decoded?.proofs).toHaveLength(3);
    expect(decoded?.memo).toBe('Stay booking ecash deposit');
  });

  it('calculates total ecash balance accurately', () => {
    const total = calculateTotalEcashAmount(sampleToken.proofs);
    expect(total).toBe(8 + 16 + 32); // 56 sats
  });

  it('splits proofs correctly for targeted payment amounts', () => {
    const split = splitProofsForAmount(sampleToken.proofs, 24); // 8 + 16 = 24
    expect(split.targetProofs).toHaveLength(2);
    expect(calculateTotalEcashAmount(split.targetProofs)).toBe(24);
    expect(split.changeProofs).toHaveLength(1);
    expect(calculateTotalEcashAmount(split.changeProofs)).toBe(32);
  });
});
