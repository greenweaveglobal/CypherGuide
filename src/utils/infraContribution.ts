/**
 * Cypher Protocol - Infrastructure Node Contribution Module
 * Ghi nhận đóng góp hạ tầng Meshnet/Relay Node và thưởng phí chia sẻ tài nguyên.
 */

export interface InfraNodeMetrics {
  nodePubKeyHex: string;
  alias: string;
  relayUptimeRatio: number; // 0.0 - 1.0
  messagesRelayedCount: number;
  bandwidthMb: number;
  rewardEarnedSats: number;
  lastPayoutTimestamp?: number;
}

/**
 * Tính thưởng Sats cho Nút hạ tầng Relay / Meshnet dựa trên lưu lượng và Uptime.
 */
export function calculateNodeIncentiveReward(metrics: InfraNodeMetrics): number {
  const baseRate = metrics.messagesRelayedCount * 0.1; // 0.1 sat per relayed message
  const bandwidthRate = metrics.bandwidthMb * 0.05; // 0.05 sat per MB
  const uptimeBonus = metrics.relayUptimeRatio >= 0.99 ? 200 : metrics.relayUptimeRatio >= 0.95 ? 100 : 20;
  
  return Math.round(baseRate + bandwidthRate + uptimeBonus);
}

/**
 * Thực thi phân phối thưởng đóng góp hạ tầng qua Lightning Network.
 */
export async function claimNodeIncentive(
  metrics: InfraNodeMetrics,
  nodeOperatorLnAddress: string
): Promise<{ success: boolean; rewardSats: number; txHash: string; message: string }> {
  const rewardSats = calculateNodeIncentiveReward(metrics);
  if (rewardSats <= 0) {
    return { success: false, rewardSats: 0, txHash: '', message: 'Chưa đủ điều kiện thưởng hạ tầng.' };
  }

  const mockTxHash = `node_payout_${Date.now()}_${metrics.nodePubKeyHex.slice(0, 8)}`;

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        rewardSats,
        txHash: mockTxHash,
        message: `Đã thanh toán ${rewardSats} Sats thưởng hạ tầng Relay Node [${metrics.alias}] tới [${nodeOperatorLnAddress}]`
      });
    }, 1200);
  });
}
