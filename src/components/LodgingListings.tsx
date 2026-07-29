import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { MapPin, Users, Coins, Star, ShieldCheck, Check, ChevronDown, ChevronUp, Copy, Search, SlidersHorizontal, Home, Calendar as CalendarIcon, Download, Share2, Zap } from 'lucide-react';
import { Listing, NostrIdentity, Booking } from '../types';
import HostRegistrationModal from './HostRegistrationModal';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useTranslation } from '../hooks/useTranslation';

interface Props {
  listings: Listing[];
  identity: NostrIdentity | null;
  bookings: Booking[];
  onSelectListing: (listing: Listing) => void;
  onAddListing: (listing: Listing) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function LodgingListings({ listings, identity, onSelectListing, onAddListing, onAddLog }: Props) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPrice, setMaxPrice] = useState<number>(500000);
  const [copiedCoords, setCopiedCoords] = useState<string | null>(null);
  const [showHostModal, setShowHostModal] = useState(false);

  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      const matchSearch = listing.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          listing.meshCoordinates.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPrice = listing.priceSats <= maxPrice;
      return matchSearch && matchPrice;
    });
  }, [listings, searchTerm, maxPrice]);

  const handleCopyMeshCoords = (e: React.MouseEvent, coords: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(coords);
    setCopiedCoords(coords);
    setTimeout(() => setCopiedCoords(null), 2000);
    onAddLog('relay', t('lodging.copiedCoords', { coords }));
  };

  const calcAverageRating = (listing: Listing) => {
    if (listing.reviews.length === 0) return 0;
    const sum = listing.reviews.reduce((acc, rev) => acc + rev.rating, 0);
    return (sum / listing.reviews.length).toFixed(1);
  };

  return (
    <div className="space-y-6 font-sans flex-1 flex flex-col min-h-0">
      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-center gap-4 mb-8">
        <Card variant="glass" className="flex-1 flex flex-col md:flex-row gap-4 p-4 w-full">
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
            <div className="flex flex-col flex-1 min-w-[150px]">
              <div className="flex justify-between text-[10px] font-mono text-text-secondary mb-1">
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
                className="w-full accent-warning"
              />
            </div>
          </div>
        </Card>
        
        <Button
          onClick={() => setShowHostModal(true)}
          variant="primary"
          className="w-full lg:w-auto h-full px-6 py-4"
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
          filteredListings.map((listing) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              onClick={() => onSelectListing(listing)}
              className="cursor-pointer"
            >
              <Card variant="glass" className="overflow-hidden flex flex-col justify-between group h-full p-0">
                {/* Image Section */}
                <div className="relative h-48 overflow-hidden bg-black">
                  <img 
                    src={listing.imageUrl} 
                    alt={listing.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80"></div>
                  
                  {/* Mesh Tag */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded border border-border/50 shadow-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                      <span className="text-[10px] font-mono text-success font-bold tracking-tight">VERIFIED_NODE</span>
                    </div>
                    <div className="flex items-center gap-1 bg-black/75 backdrop-blur px-2 py-1 rounded border border-border text-[9px] font-mono text-primary/80">
                      <MapPin className="w-2.5 h-2.5" />
                      {listing.meshCoordinates}
                      <button 
                        onClick={(e) => handleCopyMeshCoords(e, listing.meshCoordinates)}
                        className="ml-1 text-text-disabled hover:text-primary transition-colors"
                      >
                        {copiedCoords === listing.meshCoordinates ? <Check className="w-2.5 h-2.5 text-success" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>

                  {/* 🔒 KYC Badge (RFC-0006) */}
                  {listing.acceptedKycVerifiers && listing.acceptedKycVerifiers.length > 0 && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/90 backdrop-blur-md px-2 py-1 rounded border border-cyber-amber/60 text-cyber-amber shadow-lg">
                      <span className="text-[10px] font-mono font-bold tracking-tight flex items-center gap-1">
                        🔒 KYC REQUIRED ({listing.acceptedKycVerifiers.length} Verifier{listing.acceptedKycVerifiers.length > 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                  
                  {/* Rating Tag */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-warning">
                      <Star className="w-3 h-3 fill-warning" />
                      {listing.reviews.length > 0 ? calcAverageRating(listing) : 'NEW_ID'}
                    </div>
                    <div className="w-[1px] h-3 bg-white/10"></div>
                    <div className="text-[9px] font-mono text-text-secondary/70">
                      REVS: {listing.reviews.length}
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                <CardContent className="p-5 flex-1 flex flex-col justify-between bg-black/10">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-mono text-text-secondary/50 tracking-widest uppercase">Registry ID: {listing.id.slice(0, 12)}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="w-1 h-1 bg-primary/20 rounded-full"></div>
                          ))}
                        </div>
                      </div>
                      <h3 className="text-md font-bold text-white leading-snug group-hover:text-primary transition-colors font-sans">
                        {listing.title}
                      </h3>
                      <p className="text-[11px] text-text-secondary mt-2 line-clamp-2 leading-relaxed italic opacity-80">
                        {listing.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {listing.securitySpecs.slice(0, 3).map((spec, i) => (
                        <span key={i} className="px-2 py-0.5 bg-black/40 rounded text-[9px] text-text-secondary font-mono border border-border/30 flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 opacity-60" /> {spec.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-text-disabled font-mono uppercase tracking-tighter opacity-50">Base_Rate / Cycle</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Zap className="w-3.5 h-3.5 text-warning opacity-80" />
                        <span className="text-sm font-bold font-mono text-white tracking-tighter">
                          {listing.priceSats.toLocaleString()} <span className="text-[10px] text-warning/70">SATS</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {listing.coOwners.slice(0, 3).map((owner, i) => (
                          <div key={i} className="w-7 h-7 rounded-full bg-black border border-border/50 flex items-center justify-center overflow-hidden ring-2 ring-black" title={owner.name}>
                            <Users className="w-3.5 h-3.5 text-text-disabled/50" />
                          </div>
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-mono text-text-secondary/50 leading-none">AUTH_SIGS</div>
                        <div className="text-[10px] font-mono text-white font-bold">{listing.coOwners.length}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {showHostModal && (
        <HostRegistrationModal 
          onClose={() => setShowHostModal(false)} 
          identity={identity} 
          onAddListing={onAddListing}
          onAddLog={onAddLog}
        />
      )}
    </div>
  );
}
