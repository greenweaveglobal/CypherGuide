import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Listing, Booking, Proposal, NostrIdentity, P2PLog, Payout, PropertyDocument, GovernanceAct, ReferralRecord, NodeIncentiveRecord, KycAttestationRecord } from '../types';
import { INITIAL_LISTINGS, INITIAL_PROPOSALS } from '../data';
import { DataReconciler, IntegrityReport } from '../utils/reconciler';
import { DEMO_VERIFIER_NPUB_1 } from '../utils/kycAttestation';

interface AppState {
  identity: NostrIdentity | null;
  setIdentity: (identity: NostrIdentity | null) => void;
  
  listings: Listing[];
  setListings: (listings: Listing[]) => void;
  addListing: (listing: Listing) => void;

  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;
  addBooking: (booking: Booking) => void;
  updateBookingStatus: (id: string, status: 'checked_in' | 'checked_out' | 'expired', proofOfStayHash?: string) => void;
  updateDepositStatus: (bookingId: string, guestStatus?: 'locked' | 'refunded' | 'forfeited', hostStatus?: 'locked' | 'refunded' | 'forfeited') => void;

  // KYC Attestations (RFC-0006)
  kycAttestations: KycAttestationRecord[];
  addKycAttestation: (attestation: KycAttestationRecord) => void;
  removeKycAttestation: (id: string) => void;

  // Referral Sats
  referrals: ReferralRecord[];
  addReferral: (ref: ReferralRecord) => void;
  claimReferral: (id: string, txHash: string) => void;

  // Infrastructure Node Incentives
  nodeIncentives: NodeIncentiveRecord[];
  claimNodeIncentive: (id: string) => void;

  proposals: Proposal[];
  setProposals: (proposals: Proposal[]) => void;
  addProposal: (proposal: Proposal) => void;

  governanceActs: GovernanceAct[];
  addGovernanceAct: (act: GovernanceAct) => void;
  setGovernanceActs: (acts: GovernanceAct[]) => void;

  evolutionLog: string[];
  addEvolutionLog: (entry: string) => void;

  protocolSettings: {
    securityLevel: number;
    feeStructure: number;
    consensusThreshold: number;
  };
  updateProtocolSettings: (settings: Partial<AppState['protocolSettings']>) => void;

  messages: any[];
  addMessage: (msg: any) => void;

  payouts: Payout[];
  addPayout: (payout: Payout) => void;

  documents: PropertyDocument[];
  addDocument: (doc: PropertyDocument) => void;

  logs: P2PLog[];
  addLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;

  integrityReport: IntegrityReport | null;
  checkIntegrity: () => Promise<void>;

  devLnAddress: string;
  setDevLnAddress: (address: string) => void;

  resetStore: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      devLnAddress: 'dev@cypherlodge.io',
      setDevLnAddress: (address) => set({ devLnAddress: address }),

      identity: null,
      setIdentity: (identity) => set({ identity }),

      listings: INITIAL_LISTINGS,
      setListings: (listings) => set({ listings }),
      addListing: (listing) => set((state) => ({ listings: [listing, ...state.listings] })),

      bookings: [],
      setBookings: (bookings) => set({ bookings }),
      addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
      updateBookingStatus: (id, status, proofOfStayHash) => set((state) => {
        const updatedBookings = state.bookings.map((b) => {
          if (b.id !== id) return b;
          let newGuestDepositStatus = b.guestDepositStatus;
          let newHostDepositStatus = b.hostDepositStatus;

          // Auto release deposits on check_in / check_out
          if (status === 'checked_in') {
            newHostDepositStatus = 'refunded'; // Host deposit unlocked on successful guest check-in
          } else if (status === 'checked_out') {
            newGuestDepositStatus = 'refunded'; // Guest deposit returned on clean check-out
          }

          return { 
            ...b, 
            status, 
            ...(proofOfStayHash && { proofOfStayHash }),
            guestDepositStatus: newGuestDepositStatus,
            hostDepositStatus: newHostDepositStatus
          };
        });
        
        let updatedListings = state.listings;
        if (status === 'checked_out' || status === 'expired') {
          const target = state.bookings.find(b => b.id === id);
          if (target) {
            updatedListings = state.listings.map(l => 
              l.id === target.listingId ? { ...l, status: 'available' } : l
            );
          }
        }
        
        return { bookings: updatedBookings, listings: updatedListings };
      }),

      updateDepositStatus: (bookingId, guestStatus, hostStatus) => set((state) => ({
        bookings: state.bookings.map((b) => b.id === bookingId ? {
          ...b,
          ...(guestStatus && { guestDepositStatus: guestStatus }),
          ...(hostStatus && { hostDepositStatus: hostStatus })
        } : b)
      })),

      // RFC-0006 KYC Attestations
      kycAttestations: [],
      addKycAttestation: (attestation) => set((state) => ({
        kycAttestations: [attestation, ...state.kycAttestations.filter(a => a.id !== attestation.id)]
      })),
      removeKycAttestation: (id) => set((state) => ({
        kycAttestations: state.kycAttestations.filter((a) => a.id !== id)
      })),

      referrals: [
        {
          id: 'ref_sample_01',
          referrerNpub: 'npub1cypher_creator_001',
          refereeNpub: 'npub1guest_saigon_001',
          bookingId: 'book_mesh_772',
          rewardSats: 2500,
          timestamp: Date.now() - 86400000 * 2,
          status: 'unclaimed'
        }
      ],
      addReferral: (ref) => set((state) => ({ referrals: [ref, ...state.referrals] })),
      claimReferral: (id, txHash) => set((state) => ({
        referrals: state.referrals.map((r) => r.id === id ? { ...r, status: 'claimed', txHash } : r)
      })),

      nodeIncentives: [
        {
          id: 'node_inc_001',
          nodeNpub: 'npub1cypher_node_sg_01',
          nodeName: 'Saigon CyberMesh Relay Node #1',
          uptimeHours: 340,
          packetsRouted: 14280,
          earnedSats: 5000,
          status: 'pending'
        },
        {
          id: 'node_inc_002',
          nodeNpub: 'npub1cypher_node_hn_02',
          nodeName: 'Hanoi LoRa Mesh Gateway Node #2',
          uptimeHours: 520,
          packetsRouted: 28900,
          earnedSats: 12500,
          status: 'pending'
        }
      ],
      claimNodeIncentive: (id) => set((state) => ({
        nodeIncentives: state.nodeIncentives.map((n) => n.id === id ? { ...n, status: 'claimed', claimedAt: Date.now() } : n)
      })),

      proposals: INITIAL_PROPOSALS,
      setProposals: (proposals) => set({ proposals }),
      addProposal: (proposal) => set((state) => ({ proposals: [proposal, ...state.proposals] })),

      governanceActs: [],
      addGovernanceAct: (act) => set((state) => ({ governanceActs: [...state.governanceActs, act] })),
      setGovernanceActs: (acts) => set({ governanceActs: acts }),

      evolutionLog: [],
      addEvolutionLog: (entry) => set((state) => ({ evolutionLog: [entry, ...state.evolutionLog] })),

      protocolSettings: {
        securityLevel: 1,
        feeStructure: 0.05,
        consensusThreshold: 90,
      },
      updateProtocolSettings: (settings) => set((state) => ({ 
        protocolSettings: { ...state.protocolSettings, ...settings } 
      })),

      messages: [],
      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

      payouts: [],
      addPayout: (payout) => set((state) => ({ payouts: [payout, ...state.payouts] })),

      documents: [],
      addDocument: (doc) => set((state) => ({ documents: [doc, ...state.documents] })),

      logs: [
        { id: 'log-0', timestamp: new Date().toLocaleTimeString(), type: 'relay', message: 'Mạng lưới P2P Meshnet địa phương đã sẵn sàng.' },
        { id: 'log-1', timestamp: new Date().toLocaleTimeString(), type: 'relay', message: 'Kết nối thành công tới trạm Nostr Relay Cypherpunk: nostr://relay.mesh.local' },
        { id: 'log-2', timestamp: new Date().toLocaleTimeString(), type: 'governance', message: 'Khởi động Smart Contract phân tách lợi nhuận đa bên v1.0.0' }
      ],
      addLog: (type, message, hash) => set((state) => ({
        logs: [
          ...state.logs,
          {
            id: `log-${Date.now()}-${crypto.randomUUID()}`,
            timestamp: new Date().toLocaleTimeString(),
            type,
            message,
            hash
          }
        ]
      })),

      integrityReport: null,
      checkIntegrity: async () => {
        const { listings, bookings, proposals, governanceActs } = get();
        
        // Bước 1: Thẩm thấu và tự chữa lành
        const { state: healedState, logs: healingLogs } = await DataReconciler.heal({ 
          listings, 
          bookings, 
          proposals,
          governanceActs 
        });
        
        if (healingLogs.length > 0) {
          set({ 
            listings: healedState.listings, 
            bookings: healedState.bookings,
            governanceActs: healedState.governanceActs
          });
          healingLogs.forEach(log => get().addLog('governance', `Self-Healing: ${log}`));
        }

        // Bước 2: Đối soát tính toàn vẹn
        const report = await DataReconciler.verifyIntegrity(healedState);
        set({ integrityReport: report });
        
        // Bước 3: Thực thi ý chí (The Act of Will)
        if (report.consensusScore >= get().protocolSettings.consensusThreshold) {
          const { logs: execLogs, changes } = DataReconciler.applyGovernanceEffect(healedState.governanceActs || []);
          if (changes) {
            get().updateProtocolSettings(changes);
            execLogs.forEach(log => {
              const entry = `[${new Date().toISOString()}] Protocol Update: ${log}`;
              get().addLog('governance', log);
              get().addEvolutionLog(entry);
            });
          }
        }

        if (!report.isValid) {
          get().addLog('governance', `CẢNH BÁO: Phát hiện ${report.errors.length} mâu thuẫn dữ liệu trong Protocol Core.`, report.details.listings);
        } else {
          get().addLog('relay', `Đối soát Cypher Guide hoàn tất. Trạng thái: Toàn vẹn (Immutable).`, report.details.listings);
        }
      },

      resetStore: () => {
        set({
          identity: null,
          listings: INITIAL_LISTINGS,
          bookings: [],
          proposals: INITIAL_PROPOSALS,
          governanceActs: [],
          evolutionLog: [],
          protocolSettings: {
            securityLevel: 1,
            feeStructure: 0.05,
            consensusThreshold: 90,
          },
          messages: [],
          payouts: [],
          documents: [],
          logs: [],
          integrityReport: null
        });
      }
    }),
    {
      name: '__mesh_store',
      partialize: (state) => {
        // Safe persistence: Keep npub and public keys, but never store private keys in localStorage
        const safeIdentity = state.identity ? {
          ...state.identity,
          nsec: '',
          privKeyHex: ''
        } : null;
        
        return {
          ...state,
          identity: safeIdentity
        };
      },
    }
  )
);
