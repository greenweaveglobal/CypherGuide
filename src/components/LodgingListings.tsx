import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  MapPin, 
  Users, 
  Coins, 
  Star, 
  ShieldCheck, 
  Check, 
  Search, 
  SlidersHorizontal, 
  Home, 
  Sparkles, 
  Zap, 
  Bot, 
  Clock, 
  Maximize2, 
  Bed, 
  DollarSign, 
  Info,
  ArrowRight
} from 'lucide-react';
import { Listing, NostrIdentity, Booking } from '../types';
import { 
  getEffectivePrice, 
  getEffectivePriceRule, 
  migrateListingToRoomTypes, 
  REFUNDABLE_CHECKOUT_DEPOSIT_PERCENT 
} from '../utils/pricing';
import { calculateDynamicFee, createFeeStructureFromPcm, getPrimaryHostNpub, isEarlyHostEligible } from '../utils/dynamicFee';
import { fetchBtcFiatRates, formatSatsToEstimatedFiat, BtcFiatRates } from '../services/fiatRateService';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useTranslation } from '../hooks/useTranslation';

const HostRegistrationModal = React.lazy(() => import('./HostRegistrationModal'));

interface Props {
  listings: Listing[];
  identity: NostrIdentity | null;
  bookings: Booking[];
  onSelectListing: (listing: Listing) => void;
  onAddListing: (listing: Listing) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function LodgingListings({ listings, identity, onSelectListing, onAddListing, onAddLog }: Props) {
  const { t, locale } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPrice, setMaxPrice] = useState<number>(500000);
  const [showHostModal, setShowHostModal] = useState(false);
  const [fiatRates, setFiatRates] = useState<BtcFiatRates | null>(null);

  const showFiatEstimation = useAppStore(state => state.showFiatEstimation);
  const setShowFiatEstimation = useAppStore(state => state.setShowFiatEstimation);
  const fiatCurrency = useAppStore(state => state.fiatCurrency);
  const baseFeeRatePcm = useAppStore(state => state.baseFeeRatePcm);
  const earlyHostFeeRatePcm = useAppStore(state => state.earlyHostFeeRatePcm);
  const earlyHosts = useAppStore(state => state.earlyHosts);

  // Fetch fiat rates on-demand only when user opts in
  useEffect(() => {
    let isMounted = true;
    if (showFiatEstimation) {
      fetchBtcFiatRates()
        .then(rates => {
          if (isMounted && rates) {
            setFiatRates(rates);
          }
        })
        .catch(() => {
          if (isMounted) {
            setFiatRates(null);
          }
        });
    } else {
      setFiatRates(null);
    }
    return () => {
      isMounted = false;
    };
  }, [showFiatEstimation]);

  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      const matchSearch = 
        listing.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (listing.locationLabel && listing.locationLabel.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchPrice = listing.priceSats <= maxPrice;
      return matchSearch && matchPrice;
    });
  }, [listings, searchTerm, maxPrice]);

  const calcAverageRating = (listing: Listing) => {
    if (listing.reviews.length === 0) return 0;
    const sum = listing.reviews.reduce((acc, rev) => acc + rev.rating, 0);
    return (sum / listing.reviews.length).toFixed(1);
  };

  const getCancellationLabel = (policy?: string) => {
    switch (policy) {
      case 'flexible':
        return t('lodging.cancelFlexible');
      case 'moderate':
        return t('lodging.cancelModerate');
      case 'strict':
        return t('lodging.cancelStrict');
      case 'nonrefundable':
        return t('lodging.cancelNonrefundable');
      default:
        return null;
    }
  };

  const protocolFeeRatePercent = (baseFeeRatePcm / 100).toFixed(1);

  return (
    <div className="space-y-6 font-sans flex-1 flex flex-col min-h-0">
      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 mb-8">
        <Card variant="glass" className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-4 p-4 w-full">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input 
              type="text" 
              placeholder={t('lodging.searchPlaceholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-2.5">
            <SlidersHorizontal className="w-5 h-5 text-text-disabled" />
            <div className="flex flex-col flex-1 min-w-[140px]">
              <div className="flex justify-between text-xs font-mono text-text-secondary mb-1">
                <span>{t('lodging.maxPrice')}</span>
                <span className="text-warning font-bold">{maxPrice.toLocaleString()} Sats</span>
              </div>
              <input 
                type="range" 
                min="10000" 
                max="1000000" 
                step="10000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                className="w-full accent-warning cursor-pointer"
              />
            </div>
          </div>

          {/* Privacy-Preserving Fiat Estimation Toggle */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
            <button
              type="button"
              onClick={() => setShowFiatEstimation(!showFiatEstimation)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all border ${
                showFiatEstimation
                  ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                  : 'bg-surface text-text-secondary border-border/50 hover:text-white'
              }`}
              title={t('lodging.fiatEstimationPrivacyNote')}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{t('lodging.fiatEstimationToggle')}</span>
              <span className={`w-2 h-2 rounded-full ${showFiatEstimation ? 'bg-primary animate-pulse' : 'bg-text-disabled'}`} />
            </button>
          </div>
        </Card>
        
        <Button
          onClick={() => setShowHostModal(true)}
          variant="primary"
          className="w-full lg:w-auto h-auto py-3 px-6 text-sm font-bold"
        >
          <Home className="w-5 h-5 mr-2" />
          {t('lodging.becomeHost')}
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredListings.length === 0 ? (
          <div className="col-span-full text-center py-12 text-text-disabled font-mono text-sm border border-dashed border-border rounded-xl">
            {t('lodging.noListingsFound')}
          </div>
        ) : (
          filteredListings.map((listing) => {
            const migrated = migrateListingToRoomTypes(listing);
            const roomTypes = migrated.roomTypes;
            const cheapestRoom = roomTypes.length > 0
              ? roomTypes.reduce((min, rt) => rt.priceSats < min.priceSats ? rt : min, roomTypes[0])
              : undefined;
            const cheapestRoomId = cheapestRoom?.id;
            const effectivePriceToday = getEffectivePrice(listing, new Date(), cheapestRoomId);
            const activeRule = getEffectivePriceRule(listing, new Date(), cheapestRoomId);
            
            // Physical metrics
            const maxGuests = listing.maxGuests || cheapestRoom?.maxGuests;
            const bedType = listing.bedType || cheapestRoom?.bedType;
            const areaM2 = listing.areaM2 || cheapestRoom?.areaM2;
            const cancelLabel = getCancellationLabel(listing.cancellationPolicy);
            
            // Coarse Location (Strictly coarse per RFC-0018, never fallback to GPS / mesh coordinates)
            const coarseLocation = listing.locationLabel ? listing.locationLabel : t('lodging.unknownLocation');

            // Estimated fiat formatted string
            const estimatedFiat = showFiatEstimation && fiatRates
              ? formatSatsToEstimatedFiat(effectivePriceToday, fiatCurrency, fiatRates)
              : null;

            return (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                onClick={() => onSelectListing(listing)}
                className="cursor-pointer h-full"
              >
                <Card variant="glass" className="overflow-hidden flex flex-col justify-between group h-full p-0 border border-border/80 hover:border-primary/50 transition-all shadow-md">
                  {/* Image Section */}
                  <div className="relative h-52 sm:h-56 overflow-hidden bg-black">
                    <img 
                      src={listing.imageUrl} 
                      alt={listing.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/40 opacity-90"></div>
                    
                    {/* Top Left Badges: Dana & KYC */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 max-w-[70%]">
                      {listing.priceModel === 'dana' && (
                        <div className="flex items-center gap-1 bg-amber-950/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-amber-500/60 text-amber-300 shadow-md">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs font-bold font-sans">
                            {t('lodging.danaVoluntary')}
                          </span>
                        </div>
                      )}

                      {listing.priceModel !== 'dana' && listing.acceptedKycVerifiers && listing.acceptedKycVerifiers.length > 0 && (
                        <div className="flex items-center gap-1 bg-black/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-cyber-amber/60 text-cyber-amber shadow-md">
                          <span className="text-xs font-bold font-sans">
                            {t('lodging.kycRequired')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Top Right: Status Badge (Available / Occupied) */}
                    <div className="absolute top-3 right-3 z-10">
                      <div className={`flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1 rounded-md border shadow-md ${
                        listing.status === 'available'
                          ? 'bg-black/85 border-success/40 text-success'
                          : 'bg-black/85 border-danger/40 text-danger'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          listing.status === 'available' ? 'bg-success animate-pulse' : 'bg-danger'
                        }`} />
                        <span className="text-xs font-bold font-sans">
                          {listing.status === 'available' ? t('lodging.statusAvailable') : t('lodging.statusOccupied')}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Metadata Overlay: Rating & Coarse Location */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 z-10 text-white">
                      {/* Rating */}
                      <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 shadow">
                        <Star className="w-3.5 h-3.5 fill-warning text-warning shrink-0" />
                        <span className="text-xs font-bold text-white">
                          {listing.reviews.length > 0 ? (
                            <>
                              {calcAverageRating(listing)} <span className="text-xs font-normal text-text-secondary">({t('lodging.reviewsCount', { count: listing.reviews.length })})</span>
                            </>
                          ) : (
                            t('lodging.newListing')
                          )}
                        </span>
                      </div>

                      {/* Coarse Regional Location (RFC-0018) */}
                      <div className="flex items-center gap-1 bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 text-xs font-medium text-text-secondary truncate max-w-[55%] shadow" title={coarseLocation}>
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{coarseLocation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Info Section */}
                  <CardContent className="p-5 flex-1 flex flex-col justify-between bg-surface/30 space-y-4">
                    <div className="space-y-3">
                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-bold text-white leading-snug group-hover:text-primary transition-colors font-sans line-clamp-2">
                        {listing.title}
                      </h3>

                      {/* Key Attributes Row (Users, Bed, Area, Rooms) */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-secondary pt-1">
                        {maxGuests && (
                          <div className="flex items-center gap-1 text-white">
                            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{t('lodging.maxGuestsCount', { count: maxGuests })}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <Home className="w-3.5 h-3.5 text-cyber-blue shrink-0" />
                          <span>{roomTypes.length > 1 ? t('lodging.roomTypesCount', { count: roomTypes.length }) : t('lodging.singleRoomType')}</span>
                        </div>

                        {bedType && (
                          <div className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{bedType}</span>
                          </div>
                        )}

                        {areaM2 && areaM2 > 0 && (
                          <div className="flex items-center gap-1">
                            <Maximize2 className="w-3.5 h-3.5 text-success shrink-0" />
                            <span>{areaM2} m²</span>
                          </div>
                        )}
                      </div>

                      {/* Cancellation Policy Banner (RFC-0018) */}
                      {cancelLabel && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-cyber-green bg-cyber-green/10 border border-cyber-green/20 px-2.5 py-1.5 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-cyber-green shrink-0" />
                            <span className="font-medium truncate">{cancelLabel}</span>
                          </div>
                          <div className="text-xs text-gray-400 font-mono italic px-1">
                            {`(${t('lodging.cancelPolicyUnenforcedNote')})`}
                          </div>
                        </div>
                      )}

                      {/* Description (2 lines clamp, minimum 12px) */}
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed italic opacity-85">
                        {listing.description}
                      </p>

                      {/* Amenities Chips (Human-readable, natural casing, minimum 12px) */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {listing.securitySpecs.slice(0, 3).map((spec, i) => {
                          const isAgentReady = spec.toLowerCase().includes('agent-ready');
                          return (
                            <span 
                              key={i} 
                              className={`px-2.5 py-1 rounded text-xs border flex items-center gap-1 font-sans ${
                                isAgentReady 
                                  ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40 font-bold' 
                                  : 'bg-black/40 text-text-secondary border-border/40'
                              }`}
                            >
                              {isAgentReady ? <Bot className="w-3 h-3 text-cyan-400 shrink-0" /> : <ShieldCheck className="w-3 h-3 text-primary/70 shrink-0" />}
                              <span>{spec}</span>
                            </span>
                          );
                        })}
                        {listing.securitySpecs.length > 3 && (
                          <span className="px-2 py-1 rounded text-xs bg-black/30 text-text-disabled border border-border/30 font-mono">
                            +{listing.securitySpecs.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Booking Notice Section */}
                    {(() => {
                      const primaryHostNpub = getPrimaryHostNpub(listing);
                      const isEarlyHost = isEarlyHostEligible(primaryHostNpub, earlyHosts);
                      const effectiveFeePercent = isEarlyHost
                        ? ((earlyHostFeeRatePcm || 100) / 100).toFixed(1)
                        : protocolFeeRatePercent;

                      return (
                        <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                          <div className="flex items-baseline justify-between flex-wrap gap-2">
                            {listing.priceModel === 'dana' ? (
                              <div className="flex items-center gap-1.5 text-amber-400">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span className="text-lg font-bold font-mono">
                                  DANA / {t('lodging.danaVoluntary')}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                {roomTypes.length > 1 && (
                                  <span className="text-xs text-text-secondary">{t('lodging.fromPrice')}</span>
                                )}
                                <span className="text-lg sm:text-xl font-bold font-mono text-white tracking-tight flex items-center gap-1">
                                  <Zap className="w-4 h-4 text-warning shrink-0" />
                                  {effectivePriceToday.toLocaleString()}
                                  <span className="text-xs text-warning/80 font-normal">SATS</span>
                                </span>
                                <span className="text-xs text-text-secondary">{t('lodging.perNight')}</span>

                                {/* Dynamic Price Rule Badge */}
                                {activeRule && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-mono ml-1">
                                    {activeRule.label}
                                  </span>
                                )}

                                {/* Early Host Badge */}
                                {isEarlyHost && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono ml-1 font-semibold">
                                    {t('lodging.earlyHostBadge')}
                                  </span>
                                )}

                                {/* Optional Fiat Estimation Display */}
                                {estimatedFiat && (
                                  <span 
                                    className="text-xs font-mono text-text-secondary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded ml-1"
                                    title={t('lodging.fiatEstimationDisclaimer')}
                                  >
                                    {estimatedFiat}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                              <span>{t('lodging.viewDetails')}</span>
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </div>
                          </div>

                          {/* Sub-price Upfront Financial Transparency Notice */}
                          {listing.priceModel !== 'dana' && (
                            <div className="text-xs text-text-secondary leading-snug flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-text-disabled shrink-0" />
                              <span>
                                {isEarlyHost
                                  ? t('lodging.earlyHostSubPriceNotice', {
                                      feePercent: effectiveFeePercent,
                                      depositPercent: REFUNDABLE_CHECKOUT_DEPOSIT_PERCENT
                                    })
                                  : t('lodging.subPriceNotice', {
                                      feePercent: protocolFeeRatePercent,
                                      depositPercent: REFUNDABLE_CHECKOUT_DEPOSIT_PERCENT
                                    })}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {showHostModal && (
        <React.Suspense fallback={null}>
          <HostRegistrationModal 
            onClose={() => setShowHostModal(false)} 
            identity={identity} 
            onAddListing={onAddListing}
            onAddLog={onAddLog}
          />
        </React.Suspense>
      )}
    </div>
  );
}
