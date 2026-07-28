import { GovernanceAct, NostrIdentity } from '../types';
import { sha256, verifySignature, signMessage } from './crypto';

/**
 * Cypher Governance Schema (NIP-Kind-1 Overlay)
 * Defines the structure for decentralized voting and proposals via Nostr.
 */

/**
 * Kiểm tra xem một payload có tuân thủ cấu trúc Governance Act của Cypher Protocol hay không.
 */
export const validateGovernanceAct = (payload: any): payload is GovernanceAct => {
  if (!payload || typeof payload !== 'object') return false;

  const validActions = ['vote', 'propose', 'execute'];
  const validDecisions = ['approve', 'reject'];

  const hasAction = validActions.includes(payload.action);
  const hasProposalId = typeof payload.proposal_id === 'string' && payload.proposal_id.length > 0;
  const hasReputationProof = typeof payload.reputation_proof === 'string';
  const hasTimestamp = typeof payload.timestamp === 'number';

  // Quyết định là bắt buộc nếu hành động là 'vote'
  const isDecisionValid = payload.action === 'vote' 
    ? validDecisions.includes(payload.decision)
    : true;

  return hasAction && hasProposalId && hasReputationProof && hasTimestamp && isDecisionValid;
};

/**
 * Xác thực chữ ký cryptographic Nostr cho một Governance Act.
 * Đảm bảo mọi phiếu vote / hành động đều do đúng pubkey chủ sở hữu ký thật.
 */
export async function verifyGovernanceAct(act: GovernanceAct): Promise<boolean> {
  if (!validateGovernanceAct(act)) return false;
  if (!act.pubkey || !act.signature) {
    // Không chấp nhận GovernanceAct thiếu chữ ký cryptographic!
    return false;
  }

  const expectedMsg = `gov_act_${act.proposal_id}_${act.action}_${act.decision || ''}_${act.timestamp}`;
  const expectedHash = await sha256(expectedMsg);

  return await verifySignature(expectedHash, act.signature, act.pubkey);
}

/**
 * Tạo một payload Governance Act chuẩn hóa và ký tự động bằng Nostr Identity nếu có.
 */
export const createGovernancePayload = async (
  action: 'vote' | 'propose' | 'execute',
  proposalId: string,
  reputationProof: string,
  decision?: 'approve' | 'reject',
  payload?: any,
  identity?: NostrIdentity | null
): Promise<GovernanceAct> => {
  const timestamp = Math.floor(Date.now() / 1000);
  const act: GovernanceAct = {
    action,
    proposal_id: proposalId,
    decision,
    payload,
    reputation_proof: reputationProof,
    timestamp,
    pubkey: identity?.pubKeyHex
  };

  if (identity) {
    const expectedMsg = `gov_act_${proposalId}_${action}_${decision || ''}_${timestamp}`;
    const expectedHash = await sha256(expectedMsg);
    act.signature = await signMessage(expectedHash, identity);
  }

  return act;
};

/**
 * Trích xuất Governance Act từ nội dung một tin nhắn Nostr Kind 1.
 * Thường nội dung sẽ được bọc trong một mã định danh hoặc format JSON.
 */
export const parseGovernanceContent = (content: string): GovernanceAct | null => {
  try {
    // Tìm kiếm block JSON trong content (hỗ trợ markdown hoặc raw text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (validateGovernanceAct(parsed)) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
};
