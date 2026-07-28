import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Plus, Check, X, ShieldAlert, Vote, Cpu, Coins, Sparkles, FileSpreadsheet, Clock, TrendingUp, Wallet, CheckCircle2, ShieldCheck, Zap, Network, Share2, History, Pencil } from 'lucide-react';
import { Proposal, Listing, NostrIdentity, Booking, Payout, PropertyDocument, GovernanceAct } from '../types';
import { signMessage, sha256 } from '../utils/crypto';
import { useAppStore } from '../store/useAppStore';
import { parseGovernanceContent } from '../utils/governanceSchema';
import { useTranslation } from '../hooks/useTranslation';
import { createProtocolSnapshot } from '../utils/nostrBootstrap';
import { processConsensusAndApplyAct, INITIAL_PROTOCOL_GOVERNANCE } from '../utils/protocolGovernance';
import {
  verifyQuorumAndTally,
  reverifyEscrowAuthorization,
  createSignedArbitratorVote,
  DEFAULT_ARBITRATOR_POOL,
  DisputeCase,
  EscrowReleaseAuthorization,
  ArbitratorVote
} from '../utils/insuranceFund';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

interface Props {
  proposals: Proposal[];
  listings: Listing[];
  bookings: Booking[];
  payouts: Payout[];
  documents: PropertyDocument[];
  identity: NostrIdentity | null;
  onCastVote: (proposalId: string, npub: string, vote: 'approve' | 'reject', signature: string) => void;
  onAddProposal: (proposal: Proposal) => void;
  onAddPayout: (payout: Payout) => void;
  onSignPayout: (payoutId: string, signature: string) => void;
  onExecutePayout: (payoutId: string) => void;
  onAddDocument: (doc: PropertyDocument) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function GovernancePanel({ proposals, listings, bookings, payouts, documents, identity, onCastVote, onAddProposal, onAddPayout, onSignPayout, onExecutePayout, onAddDocument, onAddLog }: Props) {
  const { t } = useTranslation();
  const { integrityReport, checkIntegrity, addGovernanceAct, protocolSettings, evolutionLog, setListings } = useAppStore();
  const [selectedListingId, setSelectedListingId] = useState<string>(listings[0]?.id || '');
  const [viewMode, setViewMode] = useState<'proposals' | 'analytics' | 'wallet' | 'documents' | 'evolution' | 'insurance'>('proposals');
  const [showAddForm, setShowAddForm] = useState(false);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [editingLnOwnerIndex, setEditingLnOwnerIndex] = useState<number | null>(null);
  const [editingLnValue, setEditingLnValue] = useState<string>('');

  // Quỹ Bảo Hiểm & Trọng Tài BFT State
  const [disputeCases, setDisputeCases] = useState<DisputeCase[]>([
    {
      id: 'disp_001_mesh_hcm',
      bookingId: 'book_mesh_772',
      listingTitle: 'Phòng Trọ An Toàn Meshnet Saigon',
      guestNpub: 'npub1guest_saigon_001',
      hostNpub: 'npub1host_mesh_001',
      amountSats: 150000,
      reason: 'Sự cố mất điện bất ngờ trong thời gian ở do sự cố cáp chính, khách yêu cầu hoàn lại 50% tiền phòng.',
      status: 'open',
      createdAt: Date.now() - 3600000 * 5,
      votes: []
    }
  ]);

  const [activeAuthorization, setActiveAuthorization] = useState<EscrowReleaseAuthorization | null>(null);
  const [verifyingCaseId, setVerifyingCaseId] = useState<string | null>(null);

  // Ký chữ ký Schnorr thật cho các Trọng tài BFT seed khi khởi tạo
  useEffect(() => {
    async function signInitialSeedVotes() {
      try {
        const caseId = 'disp_001_mesh_hcm';
        const arb1 = DEFAULT_ARBITRATOR_POOL[0];
        const arb3 = DEFAULT_ARBITRATOR_POOL[2];
        const ts1 = Date.now() - 3600000 * 3;
        const ts3 = Date.now() - 3600000 * 2;

        const vote1 = await createSignedArbitratorVote(caseId, arb1, 'partial_refund', 50, ts1);
        const vote3 = await createSignedArbitratorVote(caseId, arb3, 'partial_refund', 50, ts3);

        setDisputeCases([
          {
            id: caseId,
            bookingId: 'book_mesh_772',
            listingTitle: 'Phòng Trọ An Toàn Meshnet Saigon',
            guestNpub: 'npub1guest_saigon_001',
            hostNpub: 'npub1host_mesh_001',
            amountSats: 150000,
            reason: 'Sự cố mất điện bất ngờ trong thời gian ở do sự cố cáp chính, khách yêu cầu hoàn lại 50% tiền phòng.',
            status: 'open',
            createdAt: Date.now() - 3600000 * 5,
            votes: [vote1, vote3]
          }
        ]);
      } catch (e) {
        console.error('Lỗi ký phiếu bầu trọng tài khởi tạo:', e);
      }
    }

    signInitialSeedVotes();
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  
  // Form fields
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'finance' | 'hardware' | 'policy'>('hardware');
  const [newValue, setNewValue] = useState('');

  // Document form fields
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocType, setNewDocType] = useState<'rental_agreement' | 'floor_plan' | 'other'>('rental_agreement');
  const [showDocForm, setShowDocForm] = useState(false);

  const currentListing = listings.find((l) => l.id === selectedListingId);
  const activeProposals = proposals.filter((p) => p.listingId === selectedListingId);

  // Check if current active Nostr identity is a co-owner of the selected lodging
  const userCoOwner = currentListing?.coOwners.find((co) => co.npub === identity?.npub);

  const handleVote = async (proposal: Proposal, voteType: 'approve' | 'reject') => {
    if (!identity) {
      setNotice({ message: t('governance.voteNeedKeys'), type: "error" });
      return;
    }
    if (!userCoOwner) {
      setNotice({ message: t('governance.voteNotCoOwner'), type: "error" });
      return;
    }

    try {
      const votePayload = `vote_${proposal.id}_${identity.npub}_${voteType}`;
      const voteHash = await sha256(votePayload);
      const signature = await signMessage(voteHash, identity);

      onCastVote(proposal.id, identity.npub, voteType, signature);
      onAddLog('governance', t('sysLogs.coOwnerVoted', { name: identity.name, vote: voteType === 'approve' ? t('governance.btnApprove') : t('governance.btnReject'), title: proposal.title }), signature);
      setNotice({ message: t('governance.voteRecorded', { type: voteType === 'approve' ? t('governance.btnApprove') : t('governance.btnReject') }), type: "success" });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOwnerLnAddress = (index: number) => {
    if (!currentListing) return;
    const val = editingLnValue.trim();
    if (!val) {
      setNotice({ message: t('governance.lnAddressEmpty'), type: "error" });
      return;
    }

    const updatedCoOwners = currentListing.coOwners.map((owner, idx) => 
      idx === index ? { ...owner, lightningAddress: val } : owner
    );

    const updatedListing = { ...currentListing, coOwners: updatedCoOwners };
    setListings(listings.map(l => l.id === updatedListing.id ? updatedListing : l));
    setEditingLnOwnerIndex(null);
    setNotice({ message: t('governance.lnAddressUpdated', { val }), type: "success" });
    onAddLog('lightning', t('sysLogs.updatedLnAddr', { name: updatedCoOwners[index].name, val }));
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity || !currentListing) return;
    if (!newTitle.trim() || !newDesc.trim()) return;

    if (!userCoOwner) {
      setNotice({ message: t('governance.createProposalNotCoOwner'), type: "error" });
      return;
    }

    try {
      const propId = 'prop_' + crypto.randomUUID().split('-')[0].toUpperCase();
      const proposalPayload = `${propId}_${currentListing.id}_${newTitle}_${newCategory}_${newValue}`;
      const payloadHash = await sha256(proposalPayload);
      const signature = await signMessage(payloadHash, identity);

      // Autovote 'approve' for creator
      const initialVotes = { [identity.npub]: 'approve' as const };

      const newProp: Proposal = {
        id: propId,
        listingId: currentListing.id,
        listingTitle: currentListing.title,
        title: newTitle.trim(),
        description: newDesc.trim(),
        category: newCategory,
        value: newValue.trim() || undefined,
        creatorNpub: identity.npub,
        votes: initialVotes,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      onAddProposal(newProp);
      onAddLog('governance', t('sysLogs.initGovVoting', { name: identity.name, title: newTitle }), payloadHash);
      onAddLog('governance', t('sysLogs.initGovVotingCategory', { category: newCategory.toUpperCase(), value: newValue || 'N/A' }));
      onAddLog('governance', t('sysLogs.initGovVotingSig', { sig: signature.slice(0, 32) }));
      
      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewCategory('hardware');
      setNewValue('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const calculateVotesWeight = (proposal: Proposal) => {
    if (!currentListing) return { approvePercent: 0, rejectPercent: 0, noVotePercent: 100 };

    let approveShares = 0;
    let rejectShares = 0;

    currentListing.coOwners.forEach((owner) => {
      const vote = proposal.votes[owner.npub];
      if (vote === 'approve') {
        approveShares += owner.share;
      } else if (vote === 'reject') {
        rejectShares += owner.share;
      }
    });

    return {
      approvePercent: approveShares,
      rejectPercent: rejectShares,
      noVotePercent: 100 - approveShares - rejectShares
    };
  };

  // Analytics Data Preparation
  const currentListingBookings = bookings.filter(b => b.listingId === selectedListingId && b.status !== 'expired');
  
  // Last 7 days trend
  const trendData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    
    // Find bookings overlapping with this date
    const dailyOccupancy = currentListingBookings.reduce((acc, b) => {
      const checkIn = new Date(b.startDate).toISOString().split('T')[0];
      const checkOut = new Date(b.endDate).toISOString().split('T')[0];
      if (dateStr >= checkIn && dateStr < checkOut) {
        return acc + 1;
      }
      return acc;
    }, 0);

    const revenue = currentListingBookings.reduce((acc, b) => {
      const checkIn = new Date(b.startDate).toISOString().split('T')[0];
      if (dateStr === checkIn) {
        return acc + b.totalPriceSats;
      }
      return acc;
    }, 0);

    return {
      date: dateStr.slice(5), // MM-DD
      occupancy: dailyOccupancy,
      revenue: revenue
    };
  });

  // Co-owner Revenue Share
  const totalRevenue = currentListingBookings.reduce((acc, b) => acc + b.totalPriceSats, 0);
  const revenueShareData = currentListing?.coOwners.map(owner => ({
    name: owner.name.substring(0, 10),
    share: owner.share,
    earnings: Math.floor(totalRevenue * (owner.share / 100))
  })) || [];

  return (
    <div className="space-y-6 font-sans flex-1 flex flex-col min-h-0">
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-4 py-3 rounded-lg border flex items-center justify-between font-mono text-xs shadow-lg ${
            notice.type === 'error' ? 'bg-danger/20 text-danger border-danger/40' :
            notice.type === 'success' ? 'bg-primary/20 text-primary border-primary/40' :
            'bg-info/20 text-info border-info/40'
          }`}
        >
          <span className="font-semibold">{notice.message}</span>
          <button onClick={() => setNotice(null)} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {integrityReport && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-4 py-2 rounded-lg border flex items-center justify-between gap-3 ${integrityReport.isValid ? 'bg-success/5 border-success/20 text-success' : 'bg-danger/5 border-danger/20 text-danger'}`}
        >
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase">
            <ShieldCheck className="w-3 h-3" />
            <span>{t('governance.protocolStateTitle', { status: integrityReport.isValid ? t('governance.protocolImmutable') : t('governance.protocolWarning') })}</span>
          </div>
          <div className="text-[9px] font-mono opacity-60">
            Hash: {integrityReport.details.listings}
          </div>
        </motion.div>
      )}
      
      {/* Property selector and owner shares card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 glass-panel rounded-xl p-5 border border-white/10 flex flex-col justify-between">
          <div className="space-y-4">
            <label className="text-xs text-gray-500 font-mono uppercase block">{t('governance.selectLodging')}</label>
            <select
              value={selectedListingId}
              onChange={(e) => {
                setSelectedListingId(e.target.value);
                setShowAddForm(false);
              }}
              className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyber-green/50"
              id="gov-property-selector"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>

          <div className="mt-6 pt-5 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono uppercase block">{t('governance.lnDistAddress')}</span>
              <span className="text-[9px] text-cyber-blue font-mono">{t('governance.directRouting')}</span>
            </div>
            {currentListing?.coOwners.map((owner, idx) => {
              const isEditing = editingLnOwnerIndex === idx;
              const isMe = identity?.npub === owner.npub;
              return (
                <div key={idx} className="bg-black/20 p-2.5 rounded-lg border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="text-white font-bold flex items-center gap-1.5 truncate pr-2">
                      <span className="truncate">{owner.name}</span>
                      {isMe && <span className="text-[9px] bg-cyber-green/20 text-cyber-green px-1.5 py-0.5 rounded font-mono shrink-0">{t('governance.youHost')}</span>}
                    </div>
                    <div className="text-cyber-green font-bold text-right shrink-0">{t('governance.shareCount', { share: owner.share })}</div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={editingLnValue}
                        onChange={(e) => setEditingLnValue(e.target.value)}
                        placeholder={t('governance.phLnAddress')}
                        className="w-full bg-black/60 border border-cyber-blue/50 rounded px-2 py-1 text-[11px] text-cyber-blue font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOwnerLnAddress(idx)}
                        className="px-2 py-1 bg-cyber-green text-black font-bold text-[10px] rounded font-mono hover:bg-cyber-green/80 shrink-0"
                      >
                        {t('governance.saveBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLnOwnerIndex(null)}
                        className="px-1.5 py-1 text-gray-400 hover:text-white text-[10px] font-mono shrink-0"
                      >
                        {t('governance.cancelBtn')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
                      <span className="text-cyber-blue truncate font-semibold pr-1" title={owner.lightningAddress}>
                        ⚡ {owner.lightningAddress || t('governance.noLnSet')}
                      </span>
                      {(userCoOwner || isMe) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLnOwnerIndex(idx);
                            setEditingLnValue(owner.lightningAddress || '');
                          }}
                          className="text-[9px] text-gray-400 hover:text-cyber-green underline ml-2 shrink-0 flex items-center gap-1"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          {t('governance.editBtn')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Co-ownership dashboard banner */}
        <div className="md:col-span-2 glass-panel rounded-xl p-6 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono">{t('governance.title')}</h2>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {t('governance.desc')}
            </p>

            {/* Tiered Governance Structure */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 font-mono text-[10px]">
              <div className="p-2.5 bg-black/50 border border-cyber-blue/30 rounded-lg space-y-1">
                <div className="text-cyber-blue font-bold">{t('governance.tier1Title')}</div>
                <p className="text-gray-400">{t('governance.tier1Desc')}</p>
              </div>
              <div className="p-2.5 bg-black/50 border border-cyber-green/30 rounded-lg space-y-1">
                <div className="text-cyber-green font-bold">{t('governance.tier2Title')}</div>
                <p className="text-gray-400">{t('governance.tier2Desc')}</p>
              </div>
              <div className="p-2.5 bg-black/50 border border-purple-500/30 rounded-lg space-y-1">
                <div className="text-purple-400 font-bold">{t('governance.tier3Title')}</div>
                <p className="text-gray-400">{t('governance.tier3Desc')}</p>
              </div>
            </div>

            {userCoOwner ? (
              <div className="mt-4 p-3 bg-cyber-green/5 border border-cyber-green/15 rounded-lg flex items-center gap-2 text-xs text-cyber-green font-mono">
                <Check className="w-4 h-4 shrink-0" />
                <span>{t('governance.coOwnerIdentified', { name: userCoOwner.name, share: userCoOwner.share })}</span>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-lg flex items-center gap-2 text-xs text-gray-400 font-mono">
                <ShieldAlert className="w-4 h-4 shrink-0 text-cyber-amber" id="shield-alert-icon" />
                <span>{t('governance.guestViewNotice')}</span>
              </div>
            )}
          </div>

          {userCoOwner && !showAddForm && (
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center justify-center gap-2 flex-1 py-2 bg-cyber-green hover:bg-cyber-green/80 text-black text-xs font-bold font-mono uppercase rounded-lg transition-all"
                id="open-new-proposal-form-btn"
              >
                <Plus className="w-4 h-4" />
                {t('governance.createProposalBtn')}
              </button>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-2 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-3 h-3 ${integrityReport?.isValid ? 'text-cyber-green' : 'text-danger'}`} />
                  <span className="text-[9px] font-mono text-gray-400 uppercase">Protocol: Cypher v1.1 {integrityReport?.isValid ? '(Stable)' : '(Compromised)'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono text-cyber-green uppercase">Self-Healing: ON</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Selector */}
      {userCoOwner && (
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setViewMode('proposals')}
            className={`px-4 py-2 text-xs font-bold font-mono uppercase rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
              viewMode === 'proposals' ? 'bg-white/10 text-white border-b-2 border-cyber-green' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t('governance.tabProposals')}
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 text-xs font-bold font-mono uppercase rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
              viewMode === 'analytics' ? 'bg-white/10 text-white border-b-2 border-cyber-green' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t('governance.tabAnalytics')}
          </button>
          <button
            onClick={() => setViewMode('wallet')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
              viewMode === 'wallet' ? 'bg-white/10 text-white border-b-2 border-cyber-amber' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {t('governance.tabWallet')}
          </button>
          <button
            onClick={() => setViewMode('documents')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
              viewMode === 'documents' ? 'bg-white/10 text-white border-b-2 border-cyber-blue' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            {t('governance.tabDocuments')}
          </button>
          <button
            onClick={() => setViewMode('insurance')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
              viewMode === 'insurance' ? 'bg-white/10 text-white border-b-2 border-cyber-green' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-cyber-green" />
            {t('governance.tabInsurance')}
          </button>
          <button
            onClick={() => setViewMode('evolution')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase rounded-t-lg transition-colors shrink-0 whitespace-nowrap ${
              viewMode === 'evolution' ? 'bg-white/10 text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            {t('governance.tabEvolution')}
          </button>
        </div>
      )}

      {/* Proposals View */}
      {viewMode === 'proposals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* New proposal form */}
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="glass-panel rounded-xl p-6 border border-white/10"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                  <h3 className="text-sm font-bold font-mono text-white uppercase">{t('governance.newProposalTitle')}</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-white">
                    <X className="w-5 h-5" id="close-proposal-form-btn" />
                  </button>
                </div>

                <form onSubmit={handleCreateProposal} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 block mb-1">{t('governance.labelProposalTitle')}</label>
                      <input
                        required
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder={t('governance.phProposalTitle')}
                        className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-green/50"
                        id="new-proposal-title-input"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 block mb-1">{t('governance.labelProposalDesc')}</label>
                      <textarea
                        required
                        rows={3}
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder={t('governance.phProposalDesc')}
                        className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-green/50 font-sans"
                        id="new-proposal-desc-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-400 block mb-1">{t('governance.labelCategory')}</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as any)}
                          className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-green/50"
                          id="new-proposal-category-select"
                        >
                          <option value="hardware">{t('governance.catHardware')}</option>
                          <option value="finance">{t('governance.catFinance')}</option>
                          <option value="policy">{t('governance.catPolicy')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">{t('governance.labelValue')}</label>
                        <input
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          placeholder={t('governance.phValue')}
                          className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-green/50"
                          id="new-proposal-value-input"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-cyber-green text-black font-bold uppercase rounded-lg hover:bg-cyber-green/80 transition-all text-xs"
                      id="submit-new-proposal-btn"
                    >
                      {t('governance.submitProposalBtn')}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Proposals list */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" id="proposal-list-icon" />
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">{t('governance.activeProposalsTitle', { count: activeProposals.length })}</h3>
              </div>

              {activeProposals.length === 0 ? (
                <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl text-gray-500 italic text-xs">
                  {t('governance.noProposals')}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {activeProposals.map((prop) => {
                    const weights = calculateVotesWeight(prop);
                    const hasVoted = identity ? prop.votes[identity.npub] !== undefined : false;

                    return (
                      <div key={prop.id} className="glass-panel border border-white/10 rounded-xl p-5 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-cyber-blue uppercase">
                                {prop.category === 'hardware' ? t('governance.catHardwareTag') : prop.category === 'finance' ? t('governance.catFinanceTag') : t('governance.catPolicyTag')}
                              </span>
                              {prop.value && (
                                <span className="text-[9px] font-mono font-bold bg-cyber-amber/10 text-cyber-amber px-2 py-0.5 rounded">
                                  {prop.value}
                                </span>
                              )}
                              <span className="text-[9px] font-mono text-gray-500">ID: {prop.id}</span>
                            </div>
                            <h4 className="text-sm font-bold text-white mt-1.5">{prop.title}</h4>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${
                              prop.status === 'passed' 
                                ? 'bg-cyber-green/10 text-cyber-green' 
                                : prop.status === 'rejected' 
                                ? 'bg-red-500/10 text-red-400' 
                                : 'bg-cyber-amber/10 text-cyber-amber animate-pulse'
                            }`}>
                              {prop.status === 'passed' ? t('governance.statusPassed') : prop.status === 'rejected' ? t('governance.statusRejected') : t('governance.statusVoting')}
                            </span>
                            {(() => {
                              let score = 50;
                              if (prop.category === 'finance') score += 20;
                              if (prop.category === 'hardware') score -= 10;
                              if (prop.value) {
                                const valueNum = parseInt(prop.value.replace(/[^0-9]/g, ''));
                                if (!isNaN(valueNum) && valueNum > 1000000) score += 15;
                              }
                              const creator = currentListing?.coOwners.find(co => co.npub === prop.creatorNpub);
                              if (creator) {
                                if (creator.share >= 50) score -= 15;
                                else score += 10;
                              }
                              score = Math.max(0, Math.min(100, score));
                              const isLow = score < 30;
                              const isMed = score >= 30 && score < 70;

                              // Expiry logic (48 hours from creation)
                              const createdAt = new Date(prop.createdAt).getTime();
                              const expiresAt = createdAt + 48 * 60 * 60 * 1000;
                              const now = Date.now();
                              const timeLeft = expiresAt - now;
                              const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                              const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));

                              return (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1 bg-black/40 border border-white/5 px-2 py-1 rounded text-[9px] font-mono">
                                    <span className="text-gray-400">{t('governance.riskScore')}</span>
                                    <span className={isLow ? 'text-cyber-green' : isMed ? 'text-cyber-amber' : 'text-red-400'}>
                                      {score}/100 ({isLow ? t('governance.riskLow') : isMed ? t('governance.riskMed') : t('governance.riskHigh')})
                                    </span>
                                  </div>
                                  {prop.status === 'active' && (
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono ${timeLeft <= 0 ? 'bg-red-500/10 text-red-400' : 'bg-black/40 border border-white/5 text-cyber-blue'}`}>
                                      <Clock className="w-3 h-3" />
                                      {timeLeft <= 0 ? t('governance.expired') : t('governance.timeLeft', { h: hoursLeft, m: minutesLeft })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed font-sans">{prop.description}</p>

                        {/* Vote slider bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-mono text-gray-400">
                            <span className="text-cyber-green font-bold">{t('governance.voteApprove', { percent: weights.approvePercent })}</span>
                            <span className="text-red-400 font-bold">{t('governance.voteReject', { percent: weights.rejectPercent })}</span>
                          </div>
                          <div className="w-full bg-cyber-gray h-2.5 rounded-full overflow-hidden flex">
                            <div className="bg-cyber-green h-full" style={{ width: `${weights.approvePercent}%` }}></div>
                            <div className="bg-red-500 h-full" style={{ width: `${weights.rejectPercent}%` }}></div>
                            <div className="bg-white/10 h-full flex-1" style={{ width: `${weights.noVotePercent}%` }}></div>
                          </div>
                        </div>

                        {/* Cast vote actions */}
                        {prop.status === 'active' && userCoOwner && (
                          <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                            <button
                              onClick={() => handleVote(prop, 'approve')}
                              disabled={hasVoted}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
                                hasVoted && prop.votes[identity!.npub] === 'approve'
                                  ? 'bg-cyber-green text-black'
                                  : 'bg-cyber-green/10 hover:bg-cyber-green text-cyber-green hover:text-black border border-cyber-green/20'
                              }`}
                              id={`vote-approve-btn-${prop.id}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {hasVoted && prop.votes[identity!.npub] === 'approve' ? t('governance.btnApproved') : t('governance.btnApprove')}
                            </button>
                            <button
                              onClick={() => handleVote(prop, 'reject')}
                              disabled={hasVoted}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
                                hasVoted && prop.votes[identity!.npub] === 'reject'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20'
                              }`}
                              id={`vote-reject-btn-${prop.id}`}
                            >
                              <X className="w-3.5 h-3.5" />
                              {hasVoted && prop.votes[identity!.npub] === 'reject' ? t('governance.btnRejected') : t('governance.btnReject')}
                            </button>
                          </div>
                        )}

                        {/* Already Voted feedback for non-owners */}
                        {prop.status === 'active' && !userCoOwner && (
                          <div className="text-[10px] text-gray-500 text-right italic font-mono pt-1">
                            {t('governance.coOwnersOnlyVote')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Protocol Parameters Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel border border-white/10 rounded-xl p-5 bg-primary/5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">{t('governance.protocolParams')}</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500">
                    <span>Voting Threshold</span>
                    <span className="text-white">51% Simple Majority</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[51%]" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500">
                    <span>Security Protocol</span>
                    <span className="text-white">Level {protocolSettings.securityLevel}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyber-blue h-full" style={{ width: `${(protocolSettings.securityLevel / 3) * 100}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500">
                    <span>Fee Structure</span>
                    <span className="text-white">{(protocolSettings.feeStructure * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyber-pink h-full" style={{ width: `${(protocolSettings.feeStructure / 0.2) * 100}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500">
                    <span>Consensus Stability</span>
                    <span className={`${integrityReport?.consensusScore && integrityReport.consensusScore > 80 ? 'text-cyber-green' : 'text-cyber-amber'}`}>
                      {integrityReport?.consensusScore !== undefined ? `${integrityReport.consensusScore.toFixed(1)}%` : '100%'}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${integrityReport?.consensusScore && integrityReport.consensusScore > 80 ? 'bg-cyber-green' : 'bg-cyber-amber'}`}
                      style={{ width: `${integrityReport?.consensusScore ?? 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500">
                    <span>Governance Delay</span>
                    <span className="text-white">6 Blocks (Kind 1)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500">
                    <span>Identity Layer</span>
                    <span className="text-white">Nostr Bech32 (NIP-01)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3 h-3 text-cyber-amber" />
                      <span className="text-[9px] font-mono text-gray-400 uppercase">Lightning Streamer</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed italic">
                      {t('governance.bolt11StreamDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-4 h-4 text-cyber-blue" />
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">{t('governance.relayNetwork')}</h3>
              </div>
              <div className="space-y-2">
                {['relay.meshaven.io', 'relay.cyphertravel.com', 'nos.lol', 'relay.damus.io'].map((r, i) => (
                  <div key={r} className="flex items-center justify-between p-2 bg-black/20 rounded border border-white/5">
                    <span className="text-[10px] font-mono text-gray-400">{r}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${i < 2 ? 'bg-cyber-green shadow-[0_0_5px_rgba(0,255,163,0.5)]' : 'bg-cyber-blue'}`} />
                      <span className="text-[9px] font-mono text-gray-500 uppercase">{i < 2 ? 'Active' : 'Sync'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evolution Log View */}
      {viewMode === 'evolution' && (
        <div className="glass-panel border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <History className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">{t('governance.evolutionTitle')}</h3>
              <p className="text-[10px] text-gray-500 font-mono italic">{t('governance.evolutionSub')}</p>
            </div>
          </div>

          <div className="space-y-4">
            {evolutionLog.length === 0 ? (
              <div className="text-center py-12 bg-black/20 rounded-xl border border-white/5">
                <div className="inline-flex p-3 bg-white/5 rounded-full mb-3">
                  <Sparkles className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-xs text-gray-500 font-mono">{t('governance.evolutionEmpty')}</p>
              </div>
            ) : (
              <div className="relative pl-6 border-l border-purple-500/30 space-y-6 py-2">
                {evolutionLog.map((log, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="relative"
                  >
                    <div className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] border-2 border-black" />
                    <div className="bg-black/40 border border-white/5 p-3 rounded-lg hover:border-purple-500/30 transition-colors">
                      <p className="text-xs font-mono text-purple-300">{log}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multisig Wallet View */}
      {viewMode === 'wallet' && userCoOwner && (
        <div className="space-y-6">
          <div className="glass-panel border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Wallet className="w-6 h-6 text-cyber-amber" />
                <div>
                  <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">{t('governance.walletTitle')}</h3>
                  <p className="text-[10px] text-gray-500 font-mono">{t('governance.walletSub')}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const amountSats = parseInt(prompt(t('governance.promptPayoutAmount')) || "0");
                  if (!amountSats) return;
                  const description = prompt(t('governance.promptPayoutDesc')) || "";
                  if (!description) return;
                  const destination = prompt(t('governance.promptPayoutDest')) || "";
                  if (!destination) return;
                  
                  const requiredSignatures = Math.ceil(currentListing.coOwners.length * 0.6); // 60% threshold
                  const newPayout: Payout = {
                    id: `pay_${Date.now()}`,
                    listingId: selectedListingId,
                    amountSats,
                    destination,
                    description,
                    signatures: [],
                    status: 'pending',
                    requiredSignatures,
                    createdAt: Date.now()
                  };
                  onAddPayout(newPayout);
                  onAddLog('lightning', t('sysLogs.createdPayoutTx', { sats: amountSats.toLocaleString(), dest: destination.slice(0,10) }));
                }}
                className="flex items-center gap-2 bg-cyber-amber/20 hover:bg-cyber-amber/40 text-cyber-amber px-4 py-2 rounded-lg font-bold font-mono text-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('governance.createPayoutBtn')}
              </button>
            </div>

            <div className="space-y-4">
              {payouts.filter(p => p.listingId === selectedListingId).length === 0 ? (
                <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl text-gray-500 italic text-xs">
                  {t('governance.noPayouts')}
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.filter(p => p.listingId === selectedListingId).map(payout => {
                    const hasSigned = identity ? payout.signatures.some(s => s.npub === identity.npub) : false;
                    const signProgress = (payout.signatures.length / payout.requiredSignatures) * 100;
                    
                    return (
                      <div key={payout.id} className="bg-black/40 border border-white/5 p-4 rounded-xl">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-bold text-white font-sans">{payout.description}</h4>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-cyber-amber flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {payout.amountSats.toLocaleString()} SATS
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">{t('governance.toLabel', { dest: payout.destination })}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            {payout.status === 'executed' ? (
                              <span className="text-xs font-mono font-bold text-cyber-green bg-cyber-green/10 px-2 py-1 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> {t('governance.statusExecuted')}
                              </span>
                            ) : (
                              <span className="text-xs font-mono font-bold text-cyber-blue bg-cyber-blue/10 px-2 py-1 rounded">
                                {t('governance.statusPendingSign', { signed: payout.signatures.length, required: payout.requiredSignatures })}
                              </span>
                            )}
                          </div>
                        </div>

                        {payout.status === 'pending' && (
                          <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                            <div className="w-full bg-black h-2 rounded-full overflow-hidden border border-white/5">
                              <div className="bg-cyber-amber h-full transition-all duration-500" style={{ width: `${Math.min(100, signProgress)}%` }} />
                            </div>

                            <div className="flex justify-between items-center">
                              <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                {payout.signatures.map(s => s.npub.slice(0, 8)).join(', ')}
                              </div>
                              
                              <div className="flex gap-2">
                                {!hasSigned && (
                                  <button
                                    onClick={async () => {
                                      const hash = await sha256(`payout_${payout.id}_${payout.amountSats}`);
                                      const sig = await signMessage(hash, identity!);
                                      onSignPayout(payout.id, sig);
                                      onAddLog('lightning', t('sysLogs.signedPayoutConfirm', { sats: payout.amountSats.toLocaleString(), name: identity?.name }));
                                    }}
                                    className="bg-cyber-blue/20 hover:bg-cyber-blue/40 text-cyber-blue border border-cyber-blue/30 px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all"
                                  >
                                    {t('governance.signBtn')}
                                  </button>
                                )}
                                
                                {payout.signatures.length >= payout.requiredSignatures && (
                                  <button
                                    onClick={() => {
                                      onExecutePayout(payout.id);
                                      onAddLog('lightning', t('sysLogs.executedLargePayout', { sats: payout.amountSats.toLocaleString() }));
                                    }}
                                    className="bg-cyber-green text-black px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all hover:shadow-[0_0_15px_rgba(0,255,163,0.3)]"
                                  >
                                    {t('governance.executePayoutBtn')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documents View */}
      {viewMode === 'documents' && userCoOwner && (
        <div className="space-y-6">
          <div className="glass-panel border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-cyber-blue" />
                <div>
                  <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">{t('governance.docsTitle')}</h3>
                  <p className="text-[10px] text-gray-500 font-mono">{t('governance.docsSub')}</p>
                </div>
              </div>
              {!showDocForm && (
                <button
                  onClick={() => setShowDocForm(true)}
                  className="flex items-center gap-2 bg-cyber-blue/20 hover:bg-cyber-blue/40 text-cyber-blue px-4 py-2 rounded-lg font-bold font-mono text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('governance.uploadDocBtn')}
                </button>
              )}
            </div>

            {showDocForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-black/30 p-4 rounded-xl border border-cyber-blue/30 mb-6"
              >
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!identity) return;
                    
                    const hash = await sha256(`nip96_${newDocName}_${newDocUrl}_${Date.now()}`);
                    const signature = await signMessage(hash, identity);

                    onAddDocument({
                      id: `doc_${Date.now()}`,
                      listingId: selectedListingId,
                      name: newDocName,
                      url: newDocUrl,
                      type: newDocType,
                      hash,
                      signature,
                      uploaderNpub: identity.npub,
                      uploadedAt: Date.now()
                    });

                    onAddLog('governance', t('sysLogs.uploadedNip96Doc', { name: newDocName }), hash);

                    setNewDocName('');
                    setNewDocUrl('');
                    setShowDocForm(false);
                  }}
                  className="space-y-4 font-mono text-xs"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 block mb-1">{t('governance.labelDocName')}</label>
                      <input
                        required
                        type="text"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder={t('governance.phDocName')}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-blue/50"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-1">{t('governance.labelDocType')}</label>
                      <select
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value as any)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-blue/50"
                      >
                        <option value="rental_agreement">{t('governance.docRentalAgreement')}</option>
                        <option value="floor_plan">{t('governance.docFloorPlan')}</option>
                        <option value="other">{t('governance.docOther')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">NIP-96 Blob URL</label>
                    <input
                      required
                      type="url"
                      value={newDocUrl}
                      onChange={(e) => setNewDocUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyber-blue/50"
                    />
                  </div>
                  
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDocForm(false)}
                      className="px-4 py-2 border border-white/10 text-gray-400 rounded-lg hover:text-white"
                    >
                      {t('governance.cancelBtn')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-cyber-blue text-black font-bold rounded-lg hover:bg-cyber-blue/80"
                    >
                      {t('governance.signAndStoreBtn')}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.filter(d => d.listingId === selectedListingId).length === 0 ? (
                <div className="md:col-span-2 text-center p-8 bg-black/20 border border-white/5 rounded-xl text-gray-500 italic text-xs">
                  {t('governance.noDocs')}
                </div>
              ) : (
                documents.filter(d => d.listingId === selectedListingId).map(doc => {
                  const uploader = currentListing?.coOwners.find(co => co.npub === doc.uploaderNpub);
                  return (
                    <div key={doc.id} className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-start gap-4 group hover:border-white/20 transition-all">
                      <div className="p-3 rounded-lg bg-cyber-blue/10 text-cyber-blue shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-gray-300 uppercase border border-white/5">
                            {doc.type === 'rental_agreement' ? t('governance.docTagRental') : doc.type === 'floor_plan' ? t('governance.docTagPlan') : t('governance.docTagOther')}
                          </span>
                          <span className="text-[8px] font-mono text-cyber-green flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> {t('governance.docVerified')}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white font-sans truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] text-gray-500 font-mono truncate">
                            {t('governance.docUploader', { name: uploader ? uploader.name : doc.uploaderNpub.slice(0, 10) + '...' })}
                          </p>
                          <p className="text-[9px] text-gray-600 font-mono truncate" title={doc.signature}>
                            {t('governance.docSig', { sig: doc.signature.slice(0, 16) })}
                          </p>
                        </div>
                        
                        <a 
                          href={doc.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyber-blue hover:text-white transition-colors"
                        >
                          {t('governance.docDownload')}
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Insurance Fund & BFT Arbitrator Panel View */}
      {viewMode === 'insurance' && (
        <div className="space-y-6 font-sans">
          {/* Header Banner */}
          <div className="glass-panel border border-white/10 rounded-xl p-6 bg-cyber-green/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-5 h-5 text-cyber-green" />
                  <h3 className="text-base font-bold font-mono text-white uppercase tracking-wider">
                    {t('governance.insuranceTitle')}
                  </h3>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed font-sans max-w-3xl">
                  {t('governance.insuranceDesc')}
                </p>
              </div>
              <div className="bg-black/50 border border-cyber-green/30 p-3 rounded-lg text-right shrink-0">
                <span className="text-[10px] text-gray-400 font-mono block uppercase">{t('governance.totalInsuranceFund')}</span>
                <span className="text-sm font-bold font-mono text-cyber-green">500,000 SATS</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Arbitrator Pool Cards */}
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-panel border border-white/10 rounded-xl p-4">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyber-blue" />
                  {t('governance.arbitratorCouncilTitle', { count: DEFAULT_ARBITRATOR_POOL.length })}
                </h4>
                <div className="space-y-2.5">
                  {DEFAULT_ARBITRATOR_POOL.map((arb) => (
                    <div key={arb.npub} className="p-3 bg-black/40 rounded-lg border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-white font-bold">{arb.name}</span>
                        <span className="text-cyber-green font-bold">{arb.reputationScore} Rep</span>
                      </div>
                      <p className="text-[9px] text-gray-500 font-mono truncate">
                        Pubkey: {arb.pubKeyHex.slice(0, 16)}...
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-gray-400 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>{t('governance.totalPoolWeight')}</span>
                    <span className="text-white font-bold">270 Rep</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('governance.requiredBftQuorum')}</span>
                    <span className="text-cyber-green font-bold">179 Rep</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute Cases & Verification */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                <Vote className="w-4 h-4 text-cyber-amber" />
                {t('governance.disputeCasesTitle', { count: disputeCases.length })}
              </h4>

              {disputeCases.map((c) => {
                const isValidatingThis = verifyingCaseId === c.id;

                return (
                  <div key={c.id} className="glass-panel border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[9px] font-mono text-cyber-amber bg-cyber-amber/10 px-2 py-0.5 rounded font-bold">
                          CASE ID: {c.id}
                        </span>
                        <h5 className="text-sm font-bold text-white mt-1">{c.listingTitle}</h5>
                        <p className="text-xs text-gray-400 mt-1">{c.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-cyber-green block">
                          ⚡ {c.amountSats.toLocaleString()} SATS
                        </span>
                        <span className="text-[9px] font-mono text-gray-500">
                          {c.status === 'open' ? t('governance.caseStatusVoting') : t('governance.caseStatusResolved')}
                        </span>
                      </div>
                    </div>

                    {/* Arbitrators votes cast */}
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                      <span className="text-[10px] font-mono text-gray-400 uppercase block">
                        {t('governance.existingSigs', { count: c.votes.length })}
                      </span>
                      {c.votes.length === 0 ? (
                        <p className="text-[10px] text-gray-500 italic">{t('governance.noSigs')}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {c.votes.map((v, idx) => {
                            const arb = DEFAULT_ARBITRATOR_POOL.find(a => a.npub === v.arbitratorNpub);
                            return (
                              <div key={idx} className="flex justify-between items-center text-[10px] font-mono p-1.5 bg-black/40 rounded">
                                <span className="text-white font-semibold">
                                  {arb ? arb.name : v.arbitratorNpub.slice(0, 10)}
                                </span>
                                <span className="text-cyber-blue font-bold">
                                  {t('governance.decisionLabel', { decision: v.decision, percent: v.refundPercent })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Trigger Verification Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="text-[10px] text-gray-400 font-mono">
                        {t('governance.verifySchnorrNote')}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setVerifyingCaseId(c.id);
                          const result = await verifyQuorumAndTally(c, DEFAULT_ARBITRATOR_POOL);
                          setVerifyingCaseId(null);

                          if (result.hasQuorum && result.authorization) {
                            setActiveAuthorization(result.authorization);
                            setNotice({
                              message: t('governance.bftSuccess'),
                              type: 'success'
                            });
                            onAddLog('governance', t('sysLogs.bftQuorumVerified', { id: c.id, percent: result.authorization.approvedRefundPercent }), result.authorization.authorizationHash);
                          } else {
                            setNotice({
                              message: result.reason || t('governance.bftFailed'),
                              type: 'error'
                            });
                            onAddLog('governance', t('sysLogs.bftQuorumFailed', { id: c.id, reason: result.reason || '' }));
                          }
                        }}
                        disabled={isValidatingThis}
                        className="bg-cyber-green hover:bg-cyber-green/80 text-black font-bold font-mono text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {isValidatingThis ? t('governance.verifyingBft') : t('governance.verifyBftBtn')}
                      </button>
                    </div>

                    {/* Escrow Authorization Result Box */}
                    {activeAuthorization && activeAuthorization.caseId === c.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 bg-cyber-green/10 border border-cyber-green/40 rounded-xl space-y-3 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-cyber-green/30 pb-2">
                          <span className="text-cyber-green font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            {t('governance.escrowAuthTitle')}
                          </span>
                          <span className="text-[9px] text-gray-400">BFT Quorum Verified</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-gray-400 block">{t('governance.collectiveDecision')}</span>
                            <span className="text-white font-bold uppercase">{activeAuthorization.decision}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">{t('governance.guestRefundRate')}</span>
                            <span className="text-cyber-green font-bold">{activeAuthorization.approvedRefundPercent}%</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">{t('governance.guestPayout')}</span>
                            <span className="text-cyber-green font-bold">{activeAuthorization.payoutSatsToGuest.toLocaleString()} Sats</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">{t('governance.hostPayout')}</span>
                            <span className="text-cyber-blue font-bold">{activeAuthorization.payoutSatsToHost.toLocaleString()} Sats</span>
                          </div>
                        </div>

                        <div className="p-2 bg-black/60 rounded border border-white/10 space-y-1 text-[10px]">
                          <div className="text-gray-400">{t('governance.authProofHash')}</div>
                          <div className="text-cyber-green font-mono break-all font-bold">
                            {activeAuthorization.authorizationHash}
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const isValid = await reverifyEscrowAuthorization(activeAuthorization, DEFAULT_ARBITRATOR_POOL);
                              if (isValid) {
                                setNotice({ message: t('governance.reverifySuccess'), type: 'success' });
                              } else {
                                setNotice({ message: t('governance.reverifyFailed'), type: 'error' });
                              }
                            }}
                            className="text-[10px] text-cyber-blue hover:underline flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" /> Re-check Authorization Proof
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
