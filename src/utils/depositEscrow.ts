/**
 * Cypher Protocol - Deposit Escrow & NUT-11 Multisig Escrow Module
 * Quản lý tiền ký quỹ 2-of-3 Multisig & Timelock Escrow cho Chủ nhà & Khách sử dụng NUT-11 Ecash.
 */

import { generateP2PKLockedToken, redeemP2PKLockedToken } from './cashu';
import { sha256, npubToHex } from './crypto';

export interface DepositEscrowState {
  id: string;
  bookingId: string;
  listingId: string;
  guestNpub: string;
  hostNpub: string;
  arbitratorPubKeyHex: string;
  depositAmountSats: number;
  status: 'pending' | 'locked' | 'released' | 'refunded' | 'disputed';
  timelockExpiryTimestamp: number;
  paymentHash?: string;
  escrowToken?: string;
  multisigAddress?: string;
  createdAt: number;
}

/**
 * Tính toán số tiền đặt cọc cần thiết dựa trên giá phòng và thời gian ở.
 */
export function calculateRequiredDeposit(priceSats: number, nights: number = 1): number {
  return Math.max(5000, Math.round(priceSats * nights * 0.2));
}

/**
 * Tạo token NUT-11 P2PK 2-of-3 Multisig Escrow khóa tiền đặt cọc giữa Khách, Chủ nhà và Trọng tài.
 */
export async function generateEscrowMultisigAddress(
  guestNpub: string,
  hostNpub: string,
  arbitratorPubKeyHex: string,
  bookingId: string,
  amountSats: number = 10000,
  timelockExpirySeconds: number = 86400 * 7
): Promise<{ multisigAddress: string; escrowToken: string }> {
  const guestHex = npubToHex(guestNpub) || guestNpub;
  const hostHex = npubToHex(hostNpub) || hostNpub;
  const arbitratorHex = arbitratorPubKeyHex;

  // Cặp pubkeys 2-of-3 multisig: Khách + Chủ nhà + Trọng tài
  const pubkeys = [hostHex, guestHex, arbitratorHex];

  // Khóa Ecash token bằng NUT-11 2-of-3 Multisig P2PK Lock
  const escrowToken = generateP2PKLockedToken(
    amountSats,
    pubkeys,
    'https://mint.cashu.space',
    timelockExpirySeconds,
    2 // n_sigs = 2 (cần ít nhất 2 chữ ký để giải ngân)
  );

  const seed = `${guestHex}:${hostHex}:${arbitratorHex}:${bookingId}`;
  const hash = await sha256(seed);
  const multisigAddress = `lnescrow1nut11${hash.slice(0, 24)}`;

  return {
    multisigAddress,
    escrowToken
  };
}

/**
 * Thẩm định điều kiện giải ngân tiền ký quỹ an toàn.
 * BẮT BUỘC kiểm tra Bằng chứng lưu trú (Proof of Stay) hoặc chữ ký Trọng tài BFT!
 */
export function canReleaseDeposit(
  escrow: DepositEscrowState,
  hasProofOfStay: boolean = false,
  arbitratorSignaturesCount: number = 0
): { canRelease: boolean; reason: string } {
  if (escrow.status === 'released') {
    return { canRelease: false, reason: 'Tiền đặt cọc đã được giải ngân trước đó.' };
  }
  if (escrow.status === 'refunded') {
    return { canRelease: false, reason: 'Tiền đặt cọc đã được hoàn lại cho Khách.' };
  }

  // Nếu đang tranh chấp, yêu cầu Quorum Trọng tài BFT (≥ 2 chữ ký)
  if (escrow.status === 'disputed') {
    if (arbitratorSignaturesCount >= 2) {
      return { canRelease: true, reason: 'Đã đạt Quorum 2/3 chữ ký Trọng tài BFT giải quyết tranh chấp.' };
    }
    return { canRelease: false, reason: 'Hợp đồng đang tranh chấp. Cần ít nhất 2 chữ ký Trọng tài BFT.' };
  }

  // Kiểm tra thời hạn Timelock
  const isTimelockExpired = Date.now() >= escrow.timelockExpiryTimestamp;

  if (escrow.status === 'locked') {
    if (hasProofOfStay) {
      return { canRelease: true, reason: 'Đã xác minh Bằng chứng Lưu trú (Proof of Stay). Đủ điều kiện giải ngân cho Chủ nhà.' };
    }
    if (isTimelockExpired) {
      return { canRelease: true, reason: 'Thời hạn Timelock 2-of-3 Escrow đã hết. Tự động giải ngân theo hợp đồng.' };
    }
    return { canRelease: false, reason: 'Chưa có Bằng chứng lưu trú và thời hạn Timelock chưa hết.' };
  }

  return { canRelease: false, reason: 'Trạng thái ký quỹ không hợp lệ.' };
}

/**
 * Thực thi giải ngân token NUT-11 Ecash Escrow khi đủ điều kiện
 */
export async function executeDepositRelease(
  escrowToken: string,
  signatures: string[],
  userPubkeyHex?: string
): Promise<{ success: boolean; releasedSats: number; reason: string }> {
  const result = await redeemP2PKLockedToken(escrowToken, signatures, userPubkeyHex);
  if (result.success) {
    return {
      success: true,
      releasedSats: result.totalSats,
      reason: `Giải ngân thành công ${result.totalSats} Sats từ NUT-11 Escrow Mint.`
    };
  }
  return {
    success: false,
    releasedSats: 0,
    reason: result.error || 'Giải ngân Escrow thất bại.'
  };
}
