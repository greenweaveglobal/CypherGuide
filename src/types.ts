export interface CoOwner {
  npub: string;
  name: string;
  share: number; // percentage (e.g., 40 for 40%)
  lightningAddress: string;
}

export interface Review {
  id: string;
  guestNpub: string;
  rating: number;
  text: string;
  signature: string;
  createdAt: string;
  reply?: {
    ownerNpub: string;
    text: string;
    signature: string;
    createdAt: string;
  };
}

export interface Nip94Image {
  url: string;
  hash: string;
  signature: string;
  uploadedAt: number;
}

export type PriceRuleType = 'date_range' | 'day_of_week' | 'recurring_month';

export interface PriceRule {
  id: string;
  label: string; // ví dụ: "Tết 2026", "Cuối tuần"
  type: PriceRuleType;
  // date_range: { startDate, endDate } cụ thể YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  // day_of_week: mảng ['SA','SU'] áp dụng mọi tuần
  daysOfWeek?: string[]; // 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'
  // recurring_month: { startMonth, endMonth } lặp hàng năm (1-12)
  startMonth?: number;
  endMonth?: number;
  priceSats: number; // giá tuyệt đối cho rule này (không dùng % để tránh nhầm lẫn)
  priority: number; // rule trùng ngày thì priority cao hơn thắng
}

export interface EditHistoryEntry {
  timestamp: number;
  editedBy: string; // npub
  field: string;
  oldValue: string;
  newValue: string;
  signature: string;
}

export interface BookingSnapshot {
  title: string;
  roomTypeId?: string;
  roomTypeName?: string;
  pricePerNightSats: number; // giá đã tính theo effective price lúc đặt
  securitySpecs: string[];
}

export interface RoomType {
  id: string; // 'rt_' + random, duy nhất trong listing
  name: string; // "Bungalow Hướng Vườn", "Lều (Tent)"...
  maxGuests: number;
  priceSats: number; // giá gốc/đêm, giữ nguyên ý nghĩa như Listing.priceSats cũ
  securitySpecs: string[]; // tiện nghi riêng của loại phòng này (có thể khác amenities chung của listing)
  priceRules?: PriceRule[]; // TÁI SỬ DỤNG nguyên cấu trúc PriceRule đã có — mỗi room type có lịch giá riêng
  images?: string[]; // ảnh riêng cho loại phòng, tách khỏi ảnh chung listing
  status: 'available' | 'occupied' | 'inactive';
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  imagePrompt: string; // descriptive image prompt
  imageUrl: string;
  images?: Nip94Image[]; // NIP-94 Signed Images
  meshCoordinates: string; // e.g., "mesh:10.77:106.69"
  roomTypes: RoomType[]; // BẮT BUỘC, tối thiểu 1 phần tử
  priceSats: number; // = roomTypes[0].priceSats, tự động đồng bộ khi roomTypes[0] đổi
  priceModel?: 'fixed' | 'dana'; // RFC-0008: 'fixed' by default or 'dana' (voluntary offering / retreat)
  priceRules?: PriceRule[]; // = roomTypes[0].priceRules
  maxGuests?: number; // = roomTypes[0].maxGuests
  securitySpecs: string[]; // No-KYC, Starlink, Mesh backup, solar, etc. (tiện nghi chung)
  coOwners: CoOwner[];
  acceptedKycVerifiers?: string[]; // RFC-0006 array of verifier npubs specified by host
  kycThresholdSats?: number; // Optional amount threshold requiring KYC
  status: 'available' | 'occupied';
  reviews: Review[];
  editHistory?: EditHistoryEntry[]; // Audit trail of changes
}

export interface KycAttestationRecord {
  id: string;
  subjectNpub: string;
  verifierNpub: string;
  verifierStandard: string; // e.g. "FATF-TravelRule-2019"
  issuedAt: number; // timestamp in seconds
  expiresAt?: number; // timestamp in seconds
  revocationEndpoint?: string;
  signature: string;
  kind: number; // 30388
  proofType: 'kyc_attestation';
  version: string; // "1.0"
  rawNostrEventJson?: string;
}

export interface Booking {
  id: string;
  listingId: string;
  listingTitle: string;
  guestNpub: string;
  hostNpub?: string;
  startDate: string;
  endDate: string;
  nights?: number;
  totalPriceSats: number;
  bookingSnapshot?: BookingSnapshot; // Frozen snapshot at booking time
  status: 'pending' | 'paid' | 'checked_in' | 'checked_out' | 'expired';
  invoiceBolt11: string;
  paymentHash: string;
  secretCode?: string; // local access token
  paidAt?: string;
  proofOfStayHash?: string; // NFT hash minted on checkout
  // RFC-0008 Dana stay donations
  donationSats?: number;
  donationTxProof?: string;
  // 2-Way Refundable Escrow Deposit
  guestDepositSats?: number;
  hostDepositSats?: number;
  guestDepositStatus?: 'locked' | 'refunded' | 'forfeited';
  hostDepositStatus?: 'locked' | 'refunded' | 'forfeited';
  escrowToken?: string;
  multisigAddress?: string;
  // Referral Sats
  referralCode?: string;
  referrerNpub?: string;
  referralRewardSats?: number;
  // Reputation Discount
  reputationDiscountSats?: number;
  reputationTier?: 'Newbie (1.5%)' | 'Verified (0.8%)' | 'Cyber Legend (0.2%)';
}

export interface ReferralRecord {
  id: string;
  referrerNpub: string;
  refereeNpub: string;
  bookingId: string;
  rewardSats: number;
  timestamp: number;
  status: 'unclaimed' | 'claimed';
  txHash?: string;
}

export interface NodeIncentiveRecord {
  id: string;
  nodeNpub: string;
  nodeName: string;
  uptimeHours: number;
  packetsRouted: number;
  earnedSats: number;
  status: 'pending' | 'claimed';
  claimedAt?: number;
}

export interface Proposal {
  id: string;
  listingId: string;
  listingTitle: string;
  title: string;
  description: string;
  category: 'finance' | 'hardware' | 'policy';
  value?: string; // value associated (e.g., rent adjust, cash spend)
  creatorNpub: string;
  votes: { [npub: string]: 'approve' | 'reject' }; // npub -> vote
  status: 'active' | 'passed' | 'rejected';
  createdAt: string;
  reply?: {
    ownerNpub: string;
    text: string;
    signature: string;
    createdAt: string;
  };
}

export interface NostrIdentity {
  npub: string; // bech32 encoded pubkey
  nsec: string; // bech32 encoded privkey
  pubKeyHex: string; // hex public key
  privKeyHex: string; // hex private key
  name: string;
  picture?: string;
  about?: string;
  nip05?: string;
  cryptoKeys?: {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  };
}

export interface PropertyDocument {
  id: string;
  listingId: string;
  name: string;
  url: string; // NIP-96 file URL
  hash: string;
  type: 'rental_agreement' | 'floor_plan' | 'other';
  uploaderNpub: string;
  signature: string;
  uploadedAt: number;
}

export interface Payout {
  id: string;
  listingId: string;
  amountSats: number;
  destination: string;
  description: string;
  signatures: { npub: string; signature: string }[];
  status: 'pending' | 'executed' | 'rejected';
  requiredSignatures: number;
  createdAt: number;
}

export interface P2PLog {
  id: string;
  timestamp: string;
  type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message';
  message: string;
  hash?: string;
}

export interface GovernanceAct {
  action: 'vote' | 'propose' | 'execute';
  proposal_id: string;
  decision?: 'approve' | 'reject';
  payload?: any;
  reputation_proof: string; // Hash of reputation score or proof of stake
  timestamp: number;
  pubkey?: string; // Hex public key of voter/proposer
  signature?: string; // Nostr signed event JSON or Schnorr signature
  effect?: {
    type: 'security_level' | 'fee_structure';
    value: any;
  };
}

export interface DirectMessage {
  id: string;
  senderNpub: string;
  receiverNpub: string;
  content: string; // Encrypted payload in NIP-04
  decryptedContent?: string; // Decrypted content for UI
  timestamp: string;
  signature: string;
}
