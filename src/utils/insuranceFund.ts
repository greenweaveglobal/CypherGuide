import { finalizeEvent } from 'nostr-tools';
import { hexToBytes, sha256, verifySignature } from './crypto';

export interface Arbitrator {
  npub: string;
  pubKeyHex: string;
  privKeyHex?: string;
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
 */
export const DEFAULT_ARBITRATOR_POOL: Arbitrator[] = [
  {
    npub: 'npub17nldrj8qkk2hj6cn5xu3st256wknp2sad7g2mv70a3nv2kv9l9qs5l4cc6',
    pubKeyHex: 'f4fed1c8e0b595796b13a1b9182d54d3ad30aa1d6f90adb3cfec66c55985f941',
    privKeyHex: '8b51f7dddaa97bbe4bf367c2b42cacd034a1ef420e1ebef0b7e6853ecfea7db9',
    name: 'CypherpunkDAO Node #1',
    reputationScore: 90,
    isActive: true,
  },
  {
    npub: 'npub1fgrk9t9zkt5z228w80682znc3r3fk9m4x477grgm8etdhv4lmt3sy6f2qm',
    pubKeyHex: '4a0762aca2b2e82528ee3bf4750a7888e29b1775357de40d1b3e56dbb2bfdae3',
    privKeyHex: '4856e9db7d78115bc0534283ec1f35c5980b3dff818eb43ae71563fe2bf4db53',
    name: 'Meshnet Sentinel #2',
    reputationScore: 85,
    isActive: true,
  },
  {
    npub: 'npub1v22u564g0yxxk0xp9yeqce950qvwq32ttf72c2a3rhqaznx3tqnspqv2t3',
    pubKeyHex: '6295ca6aa8790c6b3cc129320c64b47818e0454b5a7cac2bb11dc1d14cd15827',
    privKeyHex: '4cd960f210cc1c7ff2f4abd4b773d04e23421b9dbb80b0fd404376f919ec3981',
    name: 'Nostr Escrow Trustee #3',
    reputationScore: 95,
    isActive: true,
  }
];

/**
  * Tạo một phiếu bầu Trọng tài được ký Schnorr mật mã thật bằng Nostr Event.
  */
export async function createSignedArbitratorVote(
  disputeCaseId: string,
  arbitrator: Arbitrator,
  decision: 'refund_guest' | 'pay_host' | 'partial_refund',
  refundPercent: number,
  timestamp: number = Date.now()
): Promise<ArbitratorVote> {
  if (!arbitrator.privKeyHex) {
    throw new Error(`Trọng tài ${arbitrator.name} không có privKeyHex để ký`);
  }

  const expectedMsg = `dispute_vote_${disputeCaseId}_${arbitrator.npub}_${decision}_${refundPercent}_${timestamp}`;
  const expectedHash = await sha256(expectedMsg);

  const sk = hexToBytes(arbitrator.privKeyHex);
  const signedEvent = finalizeEvent({
    kind: 1,
    created_at: Math.floor(timestamp / 1000),
    tags: [],
    content: expectedHash
  }, sk);

  return {
    arbitratorNpub: arbitrator.npub,
    arbitratorPubKeyHex: arbitrator.pubKeyHex,
    decision,
    refundPercent,
    signature: JSON.stringify(signedEvent),
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
