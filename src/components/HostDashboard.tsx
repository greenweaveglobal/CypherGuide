import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Home, Plus, ShieldCheck, Coins, Key, Users, CheckCircle, Clock, AlertTriangle, FileText, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Listing, Booking, NostrIdentity } from '../types';
import HostRegistrationModal from './HostRegistrationModal';
import { calculateRequiredDeposit, canReleaseDeposit } from '../utils/depositEscrow';
import { calculateDynamicFee } from '../utils/dynamicFee';

interface Props {
  listings: Listing[];
  identity: NostrIdentity | null;
  bookings: Booking[];
  onAddListing: (listing: Listing) => void;
  onUpdateBookingStatus: (id: string, status: 'checked_in' | 'checked_out' | 'expired', proofOfStayHash?: string) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance', message: string, hash?: string) => void;
}

export default function HostDashboard({
  listings,
  identity,
  bookings,
  onAddListing,
  onUpdateBookingStatus,
  onAddLog
}: Props) {
  const { t } = useTranslation();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'my_listings' | 'escrow_management' | 'earnings'>('my_listings');

  const [simAmountSats, setSimAmountSats] = useState<number>(100000);
  const [simCongestion, setSimCongestion] = useState<number>(1.0);
  const [simSecurity, setSimSecurity] = useState<'relaxed' | 'strict' | 'paranoid'>('strict');

  const simResult = calculateDynamicFee(simAmountSats, undefined, simCongestion, simSecurity);

  // Filter listings owned or co-owned by current host identity
  const hostListings = listings.filter(l => 
    !identity ? true : l.coOwners?.some(co => co.npub === identity.npub)
  );

  const hostBookings = bookings.filter(b => 
    hostListings.some(l => l.id === b.listingId)
  );

  const totalEarningsSats = hostBookings
    .filter(b => b.status === 'paid' || b.status === 'checked_in' || b.status === 'checked_out')
    .reduce((sum, b) => sum + b.totalPriceSats, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-surface via-surface to-primary/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase font-bold mb-1">
            <Home className="w-4 h-4" />
            <span>{t('hostDashboard.titleBanner')}</span>
          </div>
          <h2 className="text-xl font-bold font-mono text-white">{t('hostDashboard.mainTitle')}</h2>
          <p className="text-xs text-text-secondary mt-1">
            {t('hostDashboard.subTitle')}
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-black font-mono font-bold text-xs uppercase rounded-xl flex items-center gap-2 transition-all shadow-md shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t('hostDashboard.registerBtn')}</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-border bg-surface">
          <div className="flex justify-between items-center text-text-secondary text-xs font-mono mb-1">
            <span>{t('hostDashboard.statListings')}</span>
            <Home className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{hostListings.length}</div>
          <p className="text-[10px] text-text-secondary mt-1 font-mono">{t('hostDashboard.statListingsSub')}</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border bg-surface">
          <div className="flex justify-between items-center text-text-secondary text-xs font-mono mb-1">
            <span>{t('hostDashboard.statActiveBookings')}</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold font-mono text-warning">
            {hostBookings.filter(b => b.status === 'paid' || b.status === 'checked_in').length}
          </div>
          <p className="text-[10px] text-text-secondary mt-1 font-mono">{t('hostDashboard.statActiveBookingsSub')}</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border bg-surface">
          <div className="flex justify-between items-center text-text-secondary text-xs font-mono mb-1">
            <span>{t('hostDashboard.statTotalRevenue')}</span>
            <Coins className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold font-mono text-success">
            {totalEarningsSats.toLocaleString()} Sats
          </div>
          <p className="text-[10px] text-text-secondary mt-1 font-mono">{t('hostDashboard.statTotalRevenueSub')}</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveSubTab('my_listings')}
          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
            activeSubTab === 'my_listings'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-text-secondary hover:text-white'
          }`}
        >
          {t('hostDashboard.tabMyListings', { count: hostListings.length })}
        </button>
        <button
          onClick={() => setActiveSubTab('escrow_management')}
          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
            activeSubTab === 'escrow_management'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-text-secondary hover:text-white'
          }`}
        >
          {t('hostDashboard.tabEscrow', { count: hostBookings.length })}
        </button>
        <button
          onClick={() => setActiveSubTab('earnings')}
          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
            activeSubTab === 'earnings'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-text-secondary hover:text-white'
          }`}
        >
          {t('hostDashboard.tabEarnings')}
        </button>
      </div>

      {/* Sub Tab Contents */}
      {activeSubTab === 'my_listings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hostListings.map(listing => (
            <div key={listing.id} className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-3">
              <div className="flex gap-3">
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-20 h-20 rounded-lg object-cover border border-border shrink-0"
                />
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded font-mono font-bold">
                      {listing.id}
                    </span>
                    <span className="text-[10px] text-text-secondary font-mono truncate">{listing.meshCoordinates}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate">{listing.title}</h3>
                  <p className="text-xs text-text-secondary line-clamp-2">{listing.description}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 flex justify-between items-center text-xs font-mono">
                <div>
                  <span className="text-text-secondary">Price: </span>
                  <span className="text-warning font-bold">{t('hostDashboard.priceSatsPerNight', { sats: listing.priceSats.toLocaleString() })}</span>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('hostDashboard.coOwnersCount', { count: listing.coOwners?.length || 1 })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'escrow_management' && (
        <div className="space-y-3">
          {hostBookings.length === 0 ? (
            <div className="glass-panel p-8 text-center text-text-secondary font-mono text-xs rounded-xl border border-border">
              {t('hostDashboard.noEscrowBookings')}
            </div>
          ) : (
            hostBookings.map(b => {
              const matchedListing = listings.find(l => l.id === b.listingId);
              const nights = b.nights || 1;
              const depositSats = calculateRequiredDeposit(b.totalPriceSats / Math.max(1, nights), nights);
              
              return (
                <div key={b.id} className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">{b.id}</span>
                      <span className="text-[10px] bg-surface-hover text-text-secondary px-2 py-0.5 rounded font-mono uppercase">
                        {b.status}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">{matchedListing?.title || b.listingId}</div>
                    <div className="text-xs text-text-secondary font-mono">
                      Guest: {b.guestNpub.slice(0, 16)}... | Room Rate: <span className="text-warning">{b.totalPriceSats.toLocaleString()} Sats</span>
                    </div>
                    {b.proofOfStayHash && (
                      <div className="text-[10px] text-success font-mono flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Proof-of-Stay Verified: {b.proofOfStayHash.slice(0, 16)}...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono">
                      <div className="text-[10px] text-text-secondary">{t('hostDashboard.escrowLabel')}</div>
                      <div className="text-sm font-bold text-primary">{depositSats.toLocaleString()} Sats</div>
                    </div>
                    {b.status === 'paid' && (
                      <button
                        onClick={() => {
                          onUpdateBookingStatus(b.id, 'checked_in');
                          onAddLog('lock', t('hostDashboard.logCheckedIn', { id: b.id }));
                        }}
                        className="px-3 py-1.5 bg-success hover:bg-success/80 text-black font-mono font-bold text-xs rounded-lg uppercase"
                      >
                        {t('hostDashboard.checkInBtn')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeSubTab === 'earnings' && (
        <div className="glass-panel p-6 rounded-xl border border-border bg-surface space-y-6 font-mono">
          <div>
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              {t('hostDashboard.earningsTitle')}
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              {t('hostDashboard.earningsDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-background rounded-lg border border-border space-y-2">
              <div className="text-xs text-primary font-bold">{t('hostDashboard.dynamicFeeTitle')}</div>
              <div className="text-lg font-bold text-white">{t('hostDashboard.dynamicFeeVal')}</div>
              <div className="text-[11px] text-text-secondary">{t('hostDashboard.dynamicFeeDesc')}</div>
            </div>

            <div className="p-4 bg-background rounded-lg border border-border space-y-2">
              <div className="text-xs text-warning font-bold">{t('hostDashboard.routingFeeTitle')}</div>
              <div className="text-lg font-bold text-white">{t('hostDashboard.routingFeeVal')}</div>
              <div className="text-[11px] text-text-secondary">{t('hostDashboard.routingFeeDesc')}</div>
            </div>
          </div>

          {/* Interactive Fee Simulator */}
          <div className="p-5 bg-black/60 rounded-xl border border-primary/30 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <span className="text-xs font-bold text-primary uppercase flex items-center gap-2">
                <Coins className="w-4 h-4 text-warning" /> Interactive Dynamic Fee Simulator
              </span>
              <span className="text-[10px] text-text-disabled">calculateDynamicFee()</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Input Amount */}
              <div className="space-y-1">
                <label className="text-[10px] text-text-secondary uppercase">Booking Amount (Sats):</label>
                <input
                  type="number"
                  min="1000"
                  step="5000"
                  value={simAmountSats}
                  onChange={(e) => setSimAmountSats(Math.max(1000, Number(e.target.value)))}
                  className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>

              {/* Input Congestion */}
              <div className="space-y-1">
                <label className="text-[10px] text-text-secondary uppercase">Congestion Score ({simCongestion.toFixed(1)}x):</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={simCongestion}
                  onChange={(e) => setSimCongestion(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer mt-2"
                />
              </div>

              {/* Security Tier */}
              <div className="space-y-1">
                <label className="text-[10px] text-text-secondary uppercase">Security Tier:</label>
                <select
                  value={simSecurity}
                  onChange={(e) => setSimSecurity(e.target.value as any)}
                  className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                >
                  <option value="relaxed">Relaxed (0.8x)</option>
                  <option value="strict">Strict (1.0x)</option>
                  <option value="paranoid">Paranoid (1.5x)</option>
                </select>
              </div>
            </div>

            {/* Live Calculation Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface/80 p-3 rounded-lg border border-border/60 text-xs">
              <div>
                <div className="text-[10px] text-text-disabled">Protocol Fee</div>
                <div className="font-bold text-primary">{simResult.protocolFeeSats.toLocaleString()} Sats</div>
              </div>
              <div>
                <div className="text-[10px] text-text-disabled">LN Routing Fee</div>
                <div className="font-bold text-warning">{simResult.routingFeeSats.toLocaleString()} Sats</div>
              </div>
              <div>
                <div className="text-[10px] text-text-disabled">Effective Rate</div>
                <div className="font-bold text-white">{simResult.effectiveRatePercent}%</div>
              </div>
              <div>
                <div className="text-[10px] text-text-disabled">Net Host Share</div>
                <div className="font-bold text-success">{(simAmountSats - simResult.protocolFeeSats).toLocaleString()} Sats</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Host Registration Modal */}
      {showRegisterModal && (
        <HostRegistrationModal
          identity={identity}
          onClose={() => setShowRegisterModal(false)}
          onAddListing={onAddListing}
          onAddLog={onAddLog}
        />
      )}
    </div>
  );
}
