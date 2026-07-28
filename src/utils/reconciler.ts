import { sha256 } from './crypto';
import { GovernanceAct } from '../types';
import { validateGovernanceAct, verifyGovernanceAct } from './governanceSchema';

export interface IntegrityReport {
  timestamp: string;
  isValid: boolean;
  consensusScore: number;
  details: {
    listings: string;
    bookings: string;
    governance: string;
  };
  errors: string[];
}

/**
 * DataReconciler: Thực thể đối soát và tự chữa lành của Cypher Protocol
 * Không áp đặt ý chí, chỉ duy trì sự thật của giao thức.
 */
export const DataReconciler = {
  async generateFingerprint(data: any): Promise<string> {
    const serialized = JSON.stringify(data);
    return await sha256(serialized);
  },

  /**
   * Consensus Engine: Động cơ đồng thuận vô ngã
   * Phân tích các thông điệp Kind 1 đã xác thực chữ ký Nostr để xác định "ý chí" của mạng lưới.
   */
  async processConsensus(acts: GovernanceAct[]): Promise<number> {
    if (acts.length === 0) return 100; // Trạng thái tĩnh (Trống rỗng)
    
    let totalWeight = 0;
    let approvalWeight = 0;

    for (const act of acts) {
      // ĐOẠN BẢO MẬT BẮT BUỘC: Xác thực chữ ký cryptographic của từng act trước khi tính vào consensus
      const isSigValid = await verifyGovernanceAct(act);
      if (!isSigValid) {
        console.warn(`[Consensus Security Alert] Loại bỏ GovernanceAct [${act.proposal_id}] do thiếu chữ ký mật mã hoặc chữ ký không hợp lệ!`);
        continue;
      }

      // Trọng số chuẩn hóa: 1 vote / valid identity (Bỏ công thức giả định dựa trên độ dài chuỗi string length)
      const weight = 1; 
      totalWeight += weight;
      if (act.decision === 'approve') approvalWeight += weight;
    }

    return totalWeight > 0 ? (approvalWeight / totalWeight) * 100 : 100;
  },

  /**
   * Logic thực thi (The Executioner)
   * Chuyển hóa ý chí cộng đồng thành hành động kỹ thuật.
   */
  applyGovernanceEffect(acts: GovernanceAct[]): { logs: string[], changes: any } {
    const logs: string[] = [];
    const changes: any = {};

    // Tìm kiếm các effect được đề xuất trong các acts được tán thành
    acts.forEach(act => {
      if (act.decision === 'approve' && act.effect) {
        logs.push(`Thực thi ý chí: Cập nhật ${act.effect.type} thành ${act.effect.value}`);
        
        if (act.effect.type === 'security_level') {
          changes.securityLevel = Number(act.effect.value);
        } else if (act.effect.type === 'fee_structure') {
          changes.feeStructure = Number(act.effect.value);
        }
      }
    });

    return { logs, changes: Object.keys(changes).length > 0 ? changes : null };
  },

  /**
   * Lớp màng thẩm thấu: Lọc bỏ các dữ liệu không thuộc về giao thức
   */
  async heal(state: { 
    listings: any[], 
    bookings: any[], 
    proposals: any[],
    governanceActs?: GovernanceAct[]
  }): Promise<{ state: any, logs: string[] }> {
    const logs: string[] = [];
    const healedListings = state.listings.filter(l => {
      const isValid = l.id && l.coOwners && l.coOwners.length > 0;
      if (!isValid) logs.push(`Thanh lọc Listing lỗi: ${l.id || 'Unknown ID'}`);
      return isValid;
    });

    const healedBookings = state.bookings.map(b => {
      // BẢO MẬT: Booking bảo bố trạng thái 'paid' nhưng thiếu paymentHash -> Đánh dấu nghi vấn/cách ly
      // KHÔNG tự chế bằng chứng giả (repaired_<uuid>)!
      if (b.status === 'paid' && !b.paymentHash) {
        logs.push(`CẢNH BÁO THẨM THẤU: Booking ${b.id} ghi nhận 'paid' nhưng thiếu paymentHash. Chuyển sang trạng thái nghi vấn (Quarantined).`);
        return { ...b, status: 'pending', reconciliationStatus: 'quarantined' };
      }
      return b;
    });

    const healedGovernance = (state.governanceActs || []).filter(act => {
      const isValid = validateGovernanceAct(act);
      if (!isValid) {
        const invalidAct = act as any;
        logs.push(`Thanh lọc Governance Act không hợp lệ: ${invalidAct.action || 'Unknown'} [${invalidAct.proposal_id || 'N/A'}]`);
      }
      return isValid;
    });

    return {
      state: { 
        listings: healedListings, 
        bookings: healedBookings, 
        proposals: state.proposals,
        governanceActs: healedGovernance
      },
      logs
    };
  },

  async verifyIntegrity(state: { 
    listings: any[], 
    bookings: any[], 
    proposals: any[],
    governanceActs?: GovernanceAct[]
  }): Promise<IntegrityReport> {
    const errors: string[] = [];
    
    const listingsHash = await this.generateFingerprint(state.listings);
    const bookingsHash = await this.generateFingerprint(state.bookings);
    const proposalsHash = await this.generateFingerprint(state.proposals);
    const governanceHash = await this.generateFingerprint(state.governanceActs || []);
    const consensusScore = await this.processConsensus(state.governanceActs || []);

    // Kiểm tra tính nhất quán của sở hữu
    state.listings.forEach(l => {
      const totalShare = l.coOwners.reduce((sum: number, co: any) => sum + co.share, 0);
      if (Math.abs(totalShare - 100) > 0.01) {
        errors.push(`Mâu thuẫn cổ phần tại ${l.id}: Tổng ${totalShare}% (Yêu cầu 100%)`);
      }
    });

    return {
      timestamp: new Date().toISOString(),
      isValid: errors.length === 0,
      consensusScore,
      details: {
        listings: listingsHash.slice(0, 16),
        bookings: bookingsHash.slice(0, 16),
        governance: governanceHash.slice(0, 16)
      },
      errors
    };
  }
};
