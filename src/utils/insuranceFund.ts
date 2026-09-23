import { finalizeEvent } from 'nostr-tools';
import { hexToBytes, sha256, verifySignature } from './crypto';

export interface Arbitrator {
  npub: string;
  pubKeyHex: string;
  name: string;
  reputationScore: number; // e.g., 1 to 100
  isActive: boolean;
}

export interface ArbitratorVote {
  arbitratorNpub: string;
  arbitratorPubKeyHex?: string;
  decision: 'refund_guest' | 'pay_host' | 'partial_refund';
  refundPercent: number; // 0 for pay_host, 100 for refund_guest, 1..99 for partial
  signature: string; // Schnorr / Nostr signed event
  timestamp: number;
}

export interface DisputeCase {
  id: string;
  bookingId: string;
  listingTitle: string;
  guestNpub: string;
  hostNpub: string;
  amountSats: number;
  reason: string;
  votes: ArbitratorVote[];
  status: 'open' | 'resolved' | 'rejected';
  createdAt: number;
  resolvedAt?: number;
}

export interface EscrowReleaseAuthorization {
  caseId: string;
  decision: 'refund_guest' | 'pay_host' | 'partial_refund';
  approvedRefundPercent: number;
  payoutSatsToGuest: number;
  payoutSatsToHost: number;
  validVotes: ArbitratorVote[];
  totalArbitratorWeight: number;
  validVotesWeight: number;
  authorizationHash: string;
  timestamp: number;
}

/**
 * Mẫu Trọng tài mặc định trong Cypher Protocol (Arbitrator Pool)
 * Sử dụng Public Key Hex 64 ký tự tiêu chuẩn Nostr (Schnorr over Secp256k1)
 * LƯU Ý BẢO MẬT: Private key trọng tài KHÔNG BAO GIỜ được lưu trong codebase!
 * Trọng tài chỉ ký qua NIP-07 extension hoặc hardware/remote bunker signer độc lập.
 */
export const DEFAULT_ARBITRATOR_POOL: Arbitrator[] = [
  {
    npub: 'npub1zx89hptyxhket9facdl22lntxk9emeymn6ywnp98p9j58tu28xcsa76xmz',
    pubKeyHex: '118e5b856435ed95953dc37ea57e6b358b9de49b9e88e984a7096543af8a39b1',
    name: 'CypherpunkDAO Node #1',
    reputationScore: 90,
    isActive: true,
  },
  {
    npub: 'npub169ztqjcxwu0a8vz7y6tv0rqvrgkk02qzwaqwgll43veewn8sluas065lv8',
    pubKeyHex: 'd144b04b06771fd3b05e2696c78c0c1a2d67a8027740e47ff58b33974cf0ff3b',
    name: 'Meshnet Sentinel #2',
    reputationScore: 85,
    isActive: true,
  },
  {
    npub: 'npub1j7tjv8ttdlv943grv056svev8r27xltmhlq4d30fln99pwd8vjqq4hey34',
    pubKeyHex: '9797261d6b6fd85ac50363e9a8332c38d5e37d7bbfc156c5e9fcca50b9a76480',
    name: 'Nostr Escrow Trustee #3',
    reputationScore: 95,
    isActive: true,
  }
];

/**
 * Tạo một phiếu bầu Trọng tài được ký Schnorr mật mã thật bằng Nostr Event.
 * Chấp nhận ký qua NIP-07 (window.nostr) hoặc hàm signer bên ngoài.
 */
export async function createSignedArbitratorVote(
  disputeCaseId: string,
  arbitrator: Arbitrator,
  decision: 'refund_guest' | 'pay_host' | 'partial_refund',
  refundPercent: number,
  timestamp: number = Date.now(),
  externalSigner?: (contentHash: string) => Promise<string>
): Promise<ArbitratorVote> {
  const expectedMsg = `dispute_vote_${disputeCaseId}_${arbitrator.npub}_${decision}_${refundPercent}_${timestamp}`;
  const expectedHash = await sha256(expectedMsg);

  let signature = '';

  if (externalSigner) {
    signature = await externalSigner(expectedHash);
  } else if (typeof window !== 'undefined' && (window as any).nostr) {
    const template = {
      kind: 1,
      created_at: Math.floor(timestamp / 1000),
      tags: [],
      content: expectedHash
    };
    const signedEvent = await (window as any).nostr.signEvent(template);
    signature = JSON.stringify(signedEvent);
  } else {
    throw new Error(`Trọng tài ${arbitrator.name} cần kết nối NIP-07 Nostr extension để ký phiếu bầu bảo mật.`);
  }

  return {
    arbitratorNpub: arbitrator.npub,
    arbitratorPubKeyHex: arbitrator.pubKeyHex,
    decision,
    refundPercent,
    signature,
    timestamp
  };
}

/**
 * BFT Quorum Threshold Ratio (mặc định 2/3 = 66.67% tổng trọng số uy tín pool)
 */
export const BFT_QUORUM_RATIO = 0.66;

/**
 * Tách và verify độc lập toàn bộ chữ ký trong dispute case.
 * Loại bỏ toàn bộ phiếu bị thao túng hoặc phiếu ngoài arbitrator pool.
 * 
 * Lưu ý kiến trúc: Hàm này tạo ra EscrowReleaseAuthorization - chứng nhận chi tiền
 * đã qua xác thực chữ ký BFT. Khi kết nối hạ tầng thật, authorization này chính là
 * witness / threshold signature payload truyền sang Cashu mint hoặc FROST Lightning threshold signer.
 */
export async function verifyQuorumAndTally(
  disputeCase: DisputeCase,
  arbitratorPool: Arbitrator[] = DEFAULT_ARBITRATOR_POOL
): Promise<{
  hasQuorum: boolean;
  authorization: EscrowReleaseAuthorization | null;
  invalidVotesCount: number;
  reason?: string;
}> {
  const activePool = arbitratorPool.filter(a => a.isActive);
  const totalPoolWeight = activePool.reduce((sum, a) => sum + a.reputationScore, 0);

  const validVotes: ArbitratorVote[] = [];
  let invalidVotesCount = 0;

  for (const vote of disputeCase.votes) {
    const arb = activePool.find(a => a.npub === vote.arbitratorNpub || (vote.arbitratorPubKeyHex && a.pubKeyHex === vote.arbitratorPubKeyHex));
    if (!arb) {
      invalidVotesCount++;
      continue;
    }

    // Tái dựng message hash của vote để kiểm tra Schnorr event
    const expectedMsg = `dispute_vote_${disputeCase.id}_${vote.arbitratorNpub}_${vote.decision}_${vote.refundPercent}_${vote.timestamp}`;
    const expectedHash = await sha256(expectedMsg);

    // Re-verify chữ ký độc lập với public key của Trọng tài
    const isValidSig = await verifySignature(expectedHash, vote.signature, arb.pubKeyHex || arb.npub);
    
    // Nếu signature không hợp lệ (ví dụ bị chèn local state không ký thật hoặc sai key), loại bỏ ngay
    if (!isValidSig) {
      invalidVotesCount++;
      continue;
    }

    validVotes.push({
      ...vote,
      arbitratorPubKeyHex: arb.pubKeyHex
    });
  }

  // Tính tổng trọng số uy tín của các phiếu HỢP LỆ
  const validVotesWeight = validVotes.reduce((sum, v) => {
    const arb = activePool.find(a => a.npub === v.arbitratorNpub || a.pubKeyHex === v.arbitratorPubKeyHex);
    return sum + (arb ? arb.reputationScore : 0);
  }, 0);

  // Kiểm tra điều kiện Quorum BFT 2/3
  const requiredWeight = totalPoolWeight * BFT_QUORUM_RATIO;
  if (validVotesWeight < requiredWeight) {
    return {
      hasQuorum: false,
      authorization: null,
      invalidVotesCount,
      reason: `Chưa đủ Quorum 2/3 BFT. Trọng số hợp lệ: ${validVotesWeight}/${totalPoolWeight} (Cần tối thiểu: ${Math.ceil(requiredWeight)})`
    };
  }

  // Phân bổ quyết định theo trọng số hợp lệ
  let refundWeight = 0;
  let payHostWeight = 0;
  let partialWeight = 0;
  const partialPercents: number[] = [];

  for (const v of validVotes) {
    const arb = activePool.find(a => a.npub === v.arbitratorNpub || a.pubKeyHex === v.arbitratorPubKeyHex);
    const weight = arb ? arb.reputationScore : 1;

    if (v.decision === 'refund_guest') {
      refundWeight += weight;
    } else if (v.decision === 'pay_host') {
      payHostWeight += weight;
    } else {
      partialWeight += weight;
      partialPercents.push(v.refundPercent);
    }
  }

  let finalDecision: 'refund_guest' | 'pay_host' | 'partial_refund' = 'refund_guest';
  let approvedRefundPercent = 100;

  if (refundWeight >= payHostWeight && refundWeight >= partialWeight) {
    finalDecision = 'refund_guest';
    approvedRefundPercent = 100;
  } else if (payHostWeight >= refundWeight && payHostWeight >= partialWeight) {
    finalDecision = 'pay_host';
    approvedRefundPercent = 0;
  } else {
    finalDecision = 'partial_refund';
    if (partialPercents.length > 0) {
      const sorted = [...partialPercents].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      approvedRefundPercent = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      approvedRefundPercent = 50;
    }
  }

  const payoutSatsToGuest = Math.floor((disputeCase.amountSats * approvedRefundPercent) / 100);
  const payoutSatsToHost = disputeCase.amountSats - payoutSatsToGuest;
  const now = Date.now();

  const authPayloadStr = JSON.stringify({
    caseId: disputeCase.id,
    decision: finalDecision,
    percent: approvedRefundPercent,
    payoutGuest: payoutSatsToGuest,
    payoutHost: payoutSatsToHost,
    votesCount: validVotes.length,
    timestamp: now
  });

  const authorizationHash = await sha256(authPayloadStr);

  const authorization: EscrowReleaseAuthorization = {
    caseId: disputeCase.id,
    decision: finalDecision,
    approvedRefundPercent,
    payoutSatsToGuest,
    payoutSatsToHost,
    validVotes,
    totalArbitratorWeight: totalPoolWeight,
    validVotesWeight,
    authorizationHash,
    timestamp: now
  };

  return {
    hasQuorum: true,
    authorization,
    invalidVotesCount
  };
}

/**
 * Cho phép bất kỳ node / bên thứ 3 nào kiểm tra lại (reverify) một chứng nhận giải ngân đã xuất
 */
export async function reverifyEscrowAuthorization(
  authorization: EscrowReleaseAuthorization,
  arbitratorPool: Arbitrator[] = DEFAULT_ARBITRATOR_POOL
): Promise<boolean> {
  try {
    const activePool = arbitratorPool.filter(a => a.isActive);
    let checkedWeight = 0;

    for (const vote of authorization.validVotes) {
      const arb = activePool.find(a => a.npub === vote.arbitratorNpub || (vote.arbitratorPubKeyHex && a.pubKeyHex === vote.arbitratorPubKeyHex));
      if (!arb) return false;

      const expectedMsg = `dispute_vote_${authorization.caseId}_${vote.arbitratorNpub}_${vote.decision}_${vote.refundPercent}_${vote.timestamp}`;
      const expectedHash = await sha256(expectedMsg);

      const isValid = await verifySignature(expectedHash, vote.signature, arb.pubKeyHex || arb.npub);
      if (!isValid) return false;

      checkedWeight += arb.reputationScore;
    }

    const totalWeight = activePool.reduce((sum, a) => sum + a.reputationScore, 0);
    return checkedWeight >= totalWeight * BFT_QUORUM_RATIO;
  } catch (e) {
    return false;
  }
}
