import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Terminal } from 'lucide-react';
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
    checkIntegrity
  } = useAppStore();

  const [selectedListingForBooking, setSelectedListingForBooking] = useState<Listing | null>(null);
  const [activeTab, setActiveTab] = useState<'lodgings' | 'governance' | 'identity' | 'trips' | 'messages' | 'mesh' | 'guide' | 'host'>('guide');

  const handleTabChange = (tab: any) => {
    setSelectedListingForBooking(null);
    setActiveTab(tab);
  };

  React.useEffect(() => {
    // Cypher Travel: Tự động đối soát hạ tầng Cypher Protocol khi khởi động
    checkIntegrity();

    // Tự động ghi nhận mã giới thiệu từ URL (?ref=npub...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refNpub = params.get('ref');
      if (refNpub) {
        if (isValidNpub(refNpub)) {
          sessionStorage.setItem('cypher_referrer_npub', refNpub);
          addLog('relay', `Đã ghi nhận mã giới thiệu Referral hợp lệ: ${refNpub.slice(0, 16)}...`);
        } else {
          addLog('relay', `Bỏ qua mã giới thiệu URL do sai định dạng Nostr npub.`);
        }
      }
    }
  }, [checkIntegrity, addLog]);

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
    if (confirm(t('logs.resetConfirm'))) {
      localStorage.clear();
      resetStore();
      window.location.reload();
    }
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

      <div className="border-t border-border bg-background/80 backdrop-blur-md p-4 mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[10px] md:text-xs font-mono uppercase text-text-secondary">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="font-bold">{t('logs.listenerTitle')}</span>
            </div>
            <button
              onClick={handleResetData}
              className="text-[9px] font-mono text-text-disabled hover:text-danger border border-transparent hover:border-danger/20 px-2 py-0.5 rounded transition-all"
              id="reset-local-data-btn"
            >
              {t('logs.clearLocalData')}
            </button>
          </div>
          <RelayLogs logs={logs} identity={identity} bookings={bookings} onAddLog={addLog} />
        </div>
      </div>

      
    </AppLayout>
  );
}
