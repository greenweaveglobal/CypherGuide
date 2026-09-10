import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Terminal, AlertTriangle, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Listing, Booking, Proposal, Payout } from './types';

import NostrIdentityManager from './components/NostrIdentityManager';
import RelayLogs from './components/RelayLogs';
import LodgingListings from './components/LodgingListings';
import ListingDetail from './components/ListingDetail';
import GovernancePanel from './components/GovernancePanel';
import MyTrips from './components/MyTrips';
import DirectMessages from './components/DirectMessages';
import MeshNeighborhood from './components/MeshNeighborhood';
import AppLayout from './components/AppLayout';
import Guide from './components/Guide';
import SystemAudit from './components/SystemAudit';
import HostDashboard from './components/HostDashboard';
import { useAppStore } from './store/useAppStore';
import { isValidNpub } from './utils/referral';
import { useTranslation } from './hooks/useTranslation';

export default function App() {
  const { t } = useTranslation();
  const { 
    identity, setIdentity, 
    listings, setListings, addListing,
    bookings, setBookings, addBooking, updateBookingStatus,
    proposals, setProposals, addProposal,
    messages, addMessage,
    payouts, addPayout,
    documents, addDocument,
    logs, addLog, resetStore,
    checkIntegrity, fetchProtocolConfig
  } = useAppStore();

  const [selectedListingForBooking, setSelectedListingForBooking] = useState<Listing | null>(null);
  const [activeTab, setActiveTab] = useState<'lodgings' | 'governance' | 'identity' | 'trips' | 'messages' | 'mesh' | 'guide' | 'host'>('lodgings');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showProtocolLogs, setShowProtocolLogs] = useState(false);

  const hasHandledRefRef = React.useRef(false);
  const hasHandledListingRef = React.useRef(false);

  const handleTabChange = (tab: any) => {
    setSelectedListingForBooking(null);
    setActiveTab(tab);
  };

  React.useEffect(() => {
    // Cypher Travel: Tự động đối soát hạ tầng Cypher Protocol & đồng bộ cấu hình mạng lưới
    checkIntegrity();
    fetchProtocolConfig();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);

      // 1. Tự động ghi nhận mã giới thiệu từ URL (?ref=npub...)
      const refNpub = params.get('ref');
      if (refNpub && !hasHandledRefRef.current) {
        hasHandledRefRef.current = true;
        if (isValidNpub(refNpub)) {
          sessionStorage.setItem('cypher_referrer_npub', refNpub);
          addLog('relay', `Đã ghi nhận mã giới thiệu Referral hợp lệ: ${refNpub.slice(0, 16)}...`);
        } else {
          addLog('relay', `Bỏ qua mã giới thiệu URL do sai định dạng Nostr npub.`);
        }
      }

      // 2. Tự động mở chi tiết listing từ URL deep-link (?listing=<listingId>)
      const listingId = params.get('listing');
      if (listingId && !hasHandledListingRef.current) {
        // Cần đợi state listings sẵn sàng (data đã nạp)
        if (listings && listings.length > 0) {
          hasHandledListingRef.current = true;
          const targetId = listingId.trim();
          const foundListing = listings.find(
            (l) => l.id === targetId || l.id.toLowerCase() === targetId.toLowerCase()
          );

          if (foundListing) {
            setSelectedListingForBooking(foundListing);
            setActiveTab('lodgings');
            addLog('relay', `Đã mở chi tiết listing qua liên kết trực tiếp: ${foundListing.title} (${foundListing.id})`);
          } else {
            addLog('relay', `Không tìm thấy listing với mã ID: ${targetId} từ liên kết trực tiếp.`);
          }
        }
      }
    }
  }, [checkIntegrity, fetchProtocolConfig, addLog, listings]);

  const handleBookingSuccess = (newBooking: Booking) => {
    addBooking(newBooking);
    setListings(
      listings.map((l) => (l.id === newBooking.listingId ? { ...l, status: 'occupied' } : l))
    );
    setSelectedListingForBooking(null);
    setActiveTab('trips');
  };

  const handleCastVote = (proposalId: string, npub: string, vote: 'approve' | 'reject', signature: string) => {
    setProposals(
      proposals.map((p) => {
        if (p.id !== proposalId) return p;

        const updatedVotes = { ...p.votes, [npub]: vote };
        const listing = listings.find((l) => l.id === p.listingId);
        let status = p.status;

        if (listing && p.status === 'active') {
          let approveWeight = 0;
          let rejectWeight = 0;

          listing.coOwners.forEach((co) => {
            const v = updatedVotes[co.npub];
            if (v === 'approve') approveWeight += co.share;
            if (v === 'reject') rejectWeight += co.share;
          });

          if (approveWeight > 50) {
            status = 'passed';
            addLog('governance', `ĐỀ XUẤT ĐÃ ĐƯỢC PHÊ DUYỆT! Trọng số đồng ý (${approveWeight}%) vượt mức 50%.`, signature);
            
            if (p.category === 'finance' && p.value) {
              const matchedSats = p.value.match(/([0-9,]+)/);
              if (matchedSats) {
                const newPrice = parseInt(matchedSats[1].replace(/,/g, ''));
                setListings(
                  listings.map((l) =>
                    l.id === p.listingId ? { ...l, priceSats: newPrice } : l
                  )
                );
                addLog('governance', `Hợp đồng tự động điều chỉnh giá phòng của [${listing.title}] thành ${newPrice.toLocaleString()} Sats/đêm`);
              }
            }
          } else if (rejectWeight > 50) {
            status = 'rejected';
            addLog('governance', `ĐỀ XUẤT BỊ BÁC BỎ! Trọng số phản đối (${rejectWeight}%) vượt mức 50%.`, signature);
          }
        }

        return { ...p, votes: updatedVotes, status };
      })
    );
  };

  const handleAddReview = (listingId: string, review: any) => {
    setListings(listings.map(l => {
      if (l.id === listingId) {
        return { ...l, reviews: [review, ...l.reviews] };
      }
      return l;
    }));
  };

  const handleAddReply = (listingId: string, reviewId: string, reply: any) => {
    setListings(listings.map(l => {
      if (l.id === listingId) {
        return {
          ...l,
          reviews: l.reviews.map(r => r.id === reviewId ? { ...r, reply } : r)
        };
      }
      return l;
    }));
  };

  const handleSignPayout = (payoutId: string, signature: string) => {
    if (!identity) return;
    useAppStore.setState(state => ({
      payouts: state.payouts.map(p => {
        if (p.id === payoutId) {
          return { ...p, signatures: [...p.signatures, { npub: identity.npub, signature }] };
        }
        return p;
      })
    }));
  };

  const handleExecutePayout = (payoutId: string) => {
    useAppStore.setState(state => ({
      payouts: state.payouts.map(p => p.id === payoutId ? { ...p, status: 'executed' as const } : p)
    }));
  };

  const handleResetData = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    resetStore();
    window.location.reload();
  };

  return (
    <AppLayout
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      identity={identity}
      bookings={bookings}
      onAddLog={addLog}
    >
      <div className="w-full flex flex-col gap-4 sm:gap-6 p-1 sm:p-4 md:p-6 pb-12">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedListingForBooking ? 'listing_detail' : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full flex flex-col"
          >
            {selectedListingForBooking ? (
              <ListingDetail
                listing={selectedListingForBooking}
                identity={identity}
                    bookings={bookings}
                onBack={() => setSelectedListingForBooking(null)}
                onBookingSuccess={handleBookingSuccess}
                onAddReply={handleAddReply}
                onAddLog={addLog}
              />
            ) : (
              <>
                {activeTab === 'guide' && <Guide />}

                {activeTab === 'lodgings' && (
                  <LodgingListings
                    listings={listings}
                    onSelectListing={setSelectedListingForBooking}
                    identity={identity}
                    bookings={bookings}
                    onAddListing={addListing}
                    onAddLog={addLog}
                  />
                )}

                {activeTab === 'trips' && (
                  <MyTrips
                    listings={listings}
                    identity={identity}
                    bookings={bookings}
                    onUpdateBookingStatus={updateBookingStatus}
                    onAddReview={handleAddReview}
                    onAddLog={addLog}
                  />
                )}

                {activeTab === 'host' && (
                  <HostDashboard
                    listings={listings}
                    identity={identity}
                    bookings={bookings}
                    onAddListing={addListing}
                    onUpdateBookingStatus={updateBookingStatus}
                    onAddLog={addLog}
                  />
                )}

                {activeTab === 'governance' && (
                  <GovernancePanel
                    proposals={proposals}
                    listings={listings}
                    payouts={payouts}
                    documents={documents}
                    identity={identity}
                    bookings={bookings}
                    onCastVote={handleCastVote}
                    onAddProposal={addProposal}
                    onAddPayout={addPayout}
                    onSignPayout={handleSignPayout}
                    onExecutePayout={handleExecutePayout}
                    onAddDocument={addDocument}
                    onAddLog={addLog}
                  />
                )}

                {activeTab === 'messages' && (
                  <DirectMessages
                    identity={identity}
                    bookings={bookings}
                    listings={listings}
                    messages={messages}
                    onSendMessage={addMessage}
                    onAddLog={addLog}
                  />
                )}

                {activeTab === 'identity' && (
                  <div className="space-y-6 flex-1 flex flex-col">
                    <NostrIdentityManager
                      identity={identity}
                      bookings={bookings}
                      onIdentityChange={setIdentity}
                      onAddLog={addLog}
                    />
                    <SystemAudit />
                  </div>
                )}
                
                {activeTab === 'mesh' && (
                  <MeshNeighborhood
                    identity={identity}
                    bookings={bookings}
                    onAddLog={addLog}
                  />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

      </div>

      <div className="border-t border-border/70 bg-surface/90 backdrop-blur-md p-3 md:p-4 mt-8 font-mono">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setShowProtocolLogs(!showProtocolLogs)}
              className="flex items-center gap-2 text-[10px] md:text-xs font-mono uppercase text-text-secondary hover:text-white transition-colors text-left group"
              id="toggle-protocol-logs-btn"
            >
              <div className="p-1 rounded bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary/20 transition-all">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold tracking-wide">{t('logs.listenerTitle')}</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                8/8 Relays
              </span>
              <span className="text-[9px] md:text-[10px] text-text-disabled group-hover:text-primary flex items-center gap-1 ml-1 border border-border/60 px-2 py-0.5 rounded-lg bg-surface/60 transition-colors">
                {showProtocolLogs ? (
                  <>
                    <span>{t('logs.hideLogs')}</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>{t('logs.showLogs')}</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </span>
            </button>

            {showProtocolLogs && (
              <button
                onClick={handleResetData}
                className="text-[9px] font-mono text-text-disabled hover:text-danger border border-transparent hover:border-danger/20 px-2 py-0.5 rounded transition-all ml-auto"
                id="reset-local-data-btn"
              >
                {t('logs.clearLocalData')}
              </button>
            )}
          </div>

          <AnimatePresence>
            {showProtocolLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pt-4 mt-3 border-t border-border/40"
              >
                <RelayLogs logs={logs} identity={identity} bookings={bookings} onAddLog={addLog} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* In-App Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-rose-500/40 rounded-2xl p-6 shadow-2xl font-mono space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {t('logs.clearLocalData')}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowResetModal(false)}
                  className="text-text-secondary hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                <p>{t('logs.resetConfirm')}</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleConfirmReset}
                  className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 className="w-4 h-4 shrink-0" /> {t('logs.clearLocalData')}
                </button>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 bg-surface-active hover:bg-surface-active/80 text-text-secondary hover:text-white border border-border py-2.5 px-4 rounded-xl text-xs flex items-center justify-center transition-all"
                >
                  {t('identity.cancelBtn')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
