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

export interface Listing {
  id: string;
  title: string;
  description: string;
  imagePrompt: string; // descriptive image prompt
  imageUrl: string;
  images?: Nip94Image[]; // NIP-94 Signed Images
  meshCoordinates: string; // e.g., "mesh:10.77:106.69"
  priceSats: number; // Sats per night
  maxGuests?: number;
  securitySpecs: string[]; // No-KYC, Starlink, Mesh backup, solar, etc.
  coOwners: CoOwner[];
  status: 'available' | 'occupied';
  reviews: Review[];
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
  status: 'pending' | 'paid' | 'checked_in' | 'checked_out' | 'expired';
  invoiceBolt11: string;
  paymentHash: string;
  secretCode?: string; // local access token
  paidAt?: string;
  proofOfStayHash?: string; // NFT hash minted on checkout
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
