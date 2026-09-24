import { describe, it, expect } from 'vitest';
import { 
  DEFAULT_ARBITRATOR_POOL, 
  verifyQuorumAndTally, 
  DisputeCase 
} from '../src/utils/insuranceFund';

describe('Insurance Fund & Arbitrator Pool Module', () => {
  it('contains valid default arbitrator pool with Nostr public keys', () => {
    expect(DEFAULT_ARBITRATOR_POOL.length).toBeGreaterThanOrEqual(1);
    for (const arb of DEFAULT_ARBITRATOR_POOL) {
      expect(arb.npub.startsWith('npub1')).toBe(true);
      expect(arb.pubKeyHex).toHaveLength(64);
      expect(arb.isActive).toBe(true);
    }
  });

  it('evaluates dispute case resolution based on valid arbitrator votes', async () => {
    const dispute: DisputeCase = {
      id: 'case_1',
      bookingId: 'bk_1',
      listingTitle: 'Mountain Studio',
      guestNpub: 'npub1guest...',
      hostNpub: 'npub1host...',
      amountSats: 200000,
      reason: 'Host cancelled unexpectedly',
      votes: [],
      status: 'open',
      createdAt: Date.now()
    };

    // With no votes, dispute does not have quorum
    const res = await verifyQuorumAndTally(dispute, DEFAULT_ARBITRATOR_POOL);
    expect(res.hasQuorum).toBe(false);
    expect(res.authorization).toBeNull();
  });
});
