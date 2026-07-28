/**
 * Cypher Protocol - Core Protocol Governance Module
 * Tích hợp hệ thống quản trị tham số mạng lưới BFT, đề xuất tài chính và đồng thuận Quadratic Voting.
 */

import { GovernanceAct } from '../types';
import { verifyGovernanceAct } from './governanceSchema';

export interface ProtocolGovernanceState {
  version: string;
  securityLevel: 'paranoid' | 'strict' | 'relaxed';
  minArbitratorQuorum: number;
  protocolFeePcm: number;
  activeProposalsCount: number;
  lastUpdated: number;
  governanceQuorumRatio: number; // 0.67 (2/3 BFT Quorum)
}

export const INITIAL_PROTOCOL_GOVERNANCE: ProtocolGovernanceState = {
  version: '1.1.0-Cypher',
  securityLevel: 'strict',
  minArbitratorQuorum: 2,
  protocolFeePcm: 20, // 0.2%
  activeProposalsCount: 1,
  lastUpdated: Date.now(),
  governanceQuorumRatio: 0.67,
};

/**
 * Tính toán trọng số biểu quyết Quadratic Weighting theo thời gian giữ khóa.
 */
export function calculateQuadraticVotePower(satsStaked: number, lockDurationMonths: number): number {
  const baseSatsScore = Math.sqrt(Math.max(0, satsStaked));
  const durationMultiplier = 1 + Math.log2(1 + Math.max(0, lockDurationMonths));
  return Math.round(baseSatsScore * durationMultiplier);
}

/**
 * Xử lý cập nhật tham số giao thức qua quy trình BFT Consensus & Quorum verification.
 * KHÔNG áp dụng cho các đề xuất đơn lẻ thiếu Quorum!
 */
export async function processConsensusAndApplyAct(
  act: GovernanceAct,
  currentState: ProtocolGovernanceState,
  validArbitratorSigsCount: number = 0,
  totalArbitrators: number = 3
): Promise<{ updatedState: ProtocolGovernanceState; applied: boolean; reason: string }> {
  // BẮT BUỘC Step 1: Xác minh chữ ký Nostr Event của GovernanceAct
  const isValidSig = await verifyGovernanceAct(act);
  if (!isValidSig) {
    return {
      updatedState: currentState,
      applied: false,
      reason: 'Chữ ký Nostr của đề xuất quản trị không hợp lệ.',
    };
  }

  // BẮT BUỘC Step 2: Kiểm tra Quorum BFT (≥ 2/3 tổng số Trọng tài)
  const requiredQuorum = Math.ceil(totalArbitrators * currentState.governanceQuorumRatio);
  if (validArbitratorSigsCount < requiredQuorum) {
    return {
      updatedState: currentState,
      applied: false,
      reason: `Chưa đạt Quorum BFT tối thiểu! Cần ít nhất ${requiredQuorum}/${totalArbitrators} chữ ký Trọng tài (hiện có: ${validArbitratorSigsCount}).`,
    };
  }

  if (act.action !== 'execute') {
    return {
      updatedState: currentState,
      applied: false,
      reason: 'Hành động đề xuất chưa ở trạng thái sẵn sàng thực thi (execute).',
    };
  }

  const updated = { ...currentState, lastUpdated: Date.now() };

  if (act.effect) {
    if (act.effect.type === 'security_level') {
      updated.securityLevel = act.effect.value;
    } else if (act.effect.type === 'fee_structure') {
      updated.protocolFeePcm = Number(act.effect.value);
    }
  }

  return {
    updatedState: updated,
    applied: true,
    reason: `Đã thực thi thành công BFT Consensus cho đề xuất [${act.proposal_id}] (Đạt ${validArbitratorSigsCount}/${totalArbitrators} Quorum).`,
  };
}
