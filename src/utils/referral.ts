/**
 * Cypher Protocol - Referral & Incentive Distribution Module
 * Quản lý liên kết giới thiệu mật mã (Referral) và thưởng Sats trên mạng Lightning.
 */

import { sha256, npubToHex } from './crypto';

export interface ReferralReward {
  id: string;
  referrerNpub: string;
  refereeNpub: string;
  bookingId: string;
  rewardSats: number;
  status: 'pending' | 'claimed' | 'expired';
  createdAt: number;
  txHash?: string;
  lnAddress?: string;
}

/**
 * Kiểm tra định dạng chuỗi Nostr npub hợp lệ.
 */
export function isValidNpub(npubStr?: string | null): boolean {
  if (!npubStr) return false;
  const clean = npubStr.trim();
  if (!clean.startsWith('npub1') || clean.length < 50) return false;
  return npubToHex(clean) !== null;
}

/**
 * Kiểm tra điều kiện đủ để nhận thưởng Referral (Chỉ thưởng duy nhất cho lượt Đặt Phòng Đầu Tiên của Referee).
 */
export function checkReferralEligibility(
  referrerNpub: string | null | undefined,
  refereeNpub: string | null | undefined,
  existingReferrals: Array<{ refereeNpub: string }>
): { eligible: boolean; reason?: string } {
  if (!referrerNpub || !isValidNpub(referrerNpub)) {
    return { eligible: false, reason: 'Mã giới thiệu không phải chuỗi Nostr npub hợp lệ.' };
  }
  if (!refereeNpub || !isValidNpub(refereeNpub)) {
    return { eligible: false, reason: 'Danh tính tài khoản người dùng không hợp lệ.' };
  }
  if (referrerNpub === refereeNpub) {
    return { eligible: false, reason: 'Tài khoản không thể tự giới thiệu chính mình.' };
  }
  // Chặn farming: Chỉ áp dụng thưởng cho lượt Đặt Phòng Đầu Tiên của Referee
  const alreadyReferred = existingReferrals.some((ref) => ref.refereeNpub === refereeNpub);
  if (alreadyReferred) {
    return { eligible: false, reason: 'Chương trình Referral Sats chỉ áp dụng cho lần đặt phòng đầu tiên của thành viên mới.' };
  }
  return { eligible: true };
}

/**
 * Tạo mã giới thiệu mật mã dựa trên npub của người giới thiệu.
 */
export async function generateReferralCode(referrerNpub: string): Promise<string> {
  const hash = await sha256(`referral_${referrerNpub}`);
  return `ref_${hash.slice(0, 8)}`;
}

/**
 * Tính thưởng Sats khi một lượt giới thiệu hoàn tất đặt phòng thành công.
 */
export function calculateReferralBonus(bookingAmountSats: number): number {
  // Thưởng 0.5% số tiền đặt phòng cho người giới thiệu (tối thiểu 500 Sats, tối đa 10,000 Sats)
  return Math.max(500, Math.min(10000, Math.round(bookingAmountSats * 0.005)));
}

/**
 * Thực thi nhận thưởng Referral qua Lightning LNURL / Lightning Address
 */
export async function claimReferralReward(
  reward: ReferralReward,
  lnAddress: string
): Promise<{ success: boolean; txHash: string; message: string }> {
  if (reward.status === 'claimed') {
    return { success: false, txHash: reward.txHash || '', message: 'Phần thưởng này đã được nhận trước đó.' };
  }

  // Giả lập giao dịch thanh toán Lightning P2P tự động tới LN Address của người dùng
  const mockTxHash = `lntx_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        txHash: mockTxHash,
        message: `Đã chuyển thành công ${reward.rewardSats} Sats tới Lightning Address [${lnAddress}]`
      });
    }, 1000);
  });
}
