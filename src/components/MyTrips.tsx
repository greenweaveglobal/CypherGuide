import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Calendar, History, Shield, PenTool, CheckCircle2, Star, AlertCircle, X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Booking, Listing, NostrIdentity, Review } from '../types';
import { signMessage, sha256 } from '../utils/crypto';
import { createProofOfStay } from '../utils/proofOfStay';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface Props {
  bookings: Booking[];
  listings: Listing[];
  identity: NostrIdentity | null;
  onUpdateBookingStatus: (bookingId: string, status: 'checked_in' | 'checked_out' | 'expired', proofOfStayHash?: string) => void;
  onAddReview: (listingId: string, review: Review) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function MyTrips({ bookings, listings, identity, onUpdateBookingStatus, onAddReview, onAddLog }: Props) {
  const { t } = useTranslation();
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);

  if (!identity) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-surface border border-border rounded-xl">
        <Compass className="w-12 h-12 text-text-disabled mb-4" />
        <h3 className="text-lg font-bold font-mono text-white mb-2">{t('myTrips.unactivatedIdentity')}</h3>
        <p className="text-sm text-text-secondary max-w-md">{t('myTrips.connectIdentityDesc')}</p>
      </div>
    );
  }

  const myBookings = bookings.filter(b => b.guestNpub === identity.npub);
  const activeTrips = myBookings.filter(b => b.status === 'paid' || b.status === 'checked_in');
  const pastTrips = myBookings.filter(b => b.status === 'checked_out' || b.status === 'expired');

  const executeCheckOut = async (booking: Booking) => {
    const posRecord = await createProofOfStay(
      booking.id,
      identity,
      booking.hostNpub || identity.npub,
      Date.parse(booking.startDate) || Date.now() - 86400000,
      Date.now()
    );
    
    const proofHash = `${posRecord.proofHash.slice(0, 8)}...${posRecord.proofHash.slice(-8)}`;
    
    onUpdateBookingStatus(booking.id, 'checked_out', proofHash);
    onAddLog('lock', t('myTrips.logCheckOut', { title: booking.listingTitle }));
    onAddLog('lightning', t('myTrips.logRefund', { sats: (Math.floor(booking.totalPriceSats * 0.10)).toLocaleString() }));
    onAddLog('relay', t('myTrips.logProof', { hash: proofHash }), posRecord.proofHash);
    setCheckOutBooking(null);
  };

  const handleSubmitReview = async (e: React.FormEvent, booking: Booking) => {
    e.preventDefault();
    if (!reviewText.trim()) return;

    const payload = `Review|${booking.listingId}|${identity.npub}|${rating}|${reviewText.trim()}|${Date.now()}`;
    const hash = await sha256(payload);
    const signature = await signMessage(hash, identity);

    const newReview: Review = {
      id: crypto.randomUUID().slice(0, 8),
      guestNpub: identity.npub,
      rating,
      text: reviewText.trim(),
      signature,
      createdAt: new Date().toISOString()
    };

    onAddReview(booking.listingId, newReview);
    onAddLog('relay', t('myTrips.logReview', { title: booking.listingTitle }), hash);
    setReviewingBookingId(null);
    setReviewText('');
    setRating(5);
  };

  const getListing = (id: string) => listings.find(l => l.id === id);

  return (
    <div className="max-w-4xl mx-auto space-y-8 flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 border-b border-border pb-6">
        <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-mono text-white tracking-wider uppercase">{t('myTrips.title')}</h2>
          <p className="text-[11px] text-text-secondary font-mono mt-1">{t('myTrips.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-text-secondary font-mono flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {t('myTrips.activeTripsTitle')}
        </h3>
        
        {activeTrips.length === 0 ? (
          <div className="p-6 bg-surface border border-border rounded-xl text-center text-xs text-text-secondary font-mono">
            {t('myTrips.noActiveTrips')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTrips.map(trip => (
              <Card key={trip.id} variant="glass" className="border-primary/20">
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">
                        {trip.bookingSnapshot?.title || trip.listingTitle}
                      </h4>
                      <div className="text-[10px] text-text-secondary font-mono space-y-1">
                        <p>{t('myTrips.checkInLabel')} <span className="text-white font-bold">{trip.startDate}</span></p>
                        <p>{t('myTrips.checkOutLabel')} <span className="text-white font-bold">{trip.endDate}</span> ({trip.nights} đêm)</p>
                        <p>
                          Giá đã đóng băng: <span className="text-warning font-bold">
                            {trip.bookingSnapshot?.pricePerNightSats !== undefined
                              ? `${trip.bookingSnapshot.pricePerNightSats.toLocaleString()} Sats/đêm`
                              : `${Math.round(trip.totalPriceSats / Math.max(1, trip.nights)).toLocaleString()} Sats/đêm`}
                          </span> · Tổng: <span className="text-white font-bold">{trip.totalPriceSats.toLocaleString()} Sats</span>
                        </p>
                        {trip.bookingSnapshot?.securitySpecs && trip.bookingSnapshot.securitySpecs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {trip.bookingSnapshot.securitySpecs.map((spec, si) => (
                              <span key={si} className="text-[8px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-secondary">
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={trip.status === 'checked_in' ? 'info' : 'success'}>
                      {trip.status === 'checked_in' ? t('myTrips.checkedInBadge') : t('myTrips.paidBadge')}
                    </Badge>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <Button
                      fullWidth
                      variant="danger"
                      onClick={() => setCheckOutBooking(trip)}
                    >
                      {t('myTrips.checkOutBtn')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 mt-8">
        <h3 className="text-sm font-bold text-text-secondary font-mono flex items-center gap-2">
          <History className="w-4 h-4" />
          {t('myTrips.pastTripsTitle')}
        </h3>
        
        {pastTrips.length === 0 ? (
          <div className="p-6 bg-surface border border-border rounded-xl text-center text-xs text-text-secondary font-mono">
            {t('myTrips.noPastTrips')}
          </div>
        ) : (
          <div className="space-y-4">
            {pastTrips.map(trip => {
              const listing = getListing(trip.listingId);
              const hasReviewed = listing?.reviews.some(r => r.guestNpub === identity.npub);
              return (
                <Card key={trip.id} variant="glass">
                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-text-primary mb-1">
                          {trip.bookingSnapshot?.title || trip.listingTitle}
                        </h4>
                        <div className="text-[10px] text-text-secondary font-mono space-y-1">
                          <p>{trip.startDate} — {trip.endDate} ({trip.nights} đêm)</p>
                          <p>
                            Giá đóng băng: <span className="text-warning font-bold">
                              {trip.bookingSnapshot?.pricePerNightSats !== undefined
                                ? `${trip.bookingSnapshot.pricePerNightSats.toLocaleString()} Sats/đêm`
                                : `${Math.round(trip.totalPriceSats / Math.max(1, trip.nights)).toLocaleString()} Sats/đêm`}
                            </span> · Tổng: <span className="text-white font-bold">{trip.totalPriceSats.toLocaleString()} Sats</span>
                          </p>
                          <p>Booking ID: {trip.id}</p>
                          {trip.bookingSnapshot?.securitySpecs && trip.bookingSnapshot.securitySpecs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {trip.bookingSnapshot.securitySpecs.map((spec, si) => (
                                <span key={si} className="text-[8px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-secondary">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}
                          {trip.proofOfStayHash && (
                            <div className="flex items-center gap-1.5 mt-2 bg-info/10 text-info px-2 py-1 rounded inline-flex border border-info/20">
                              <Shield className="w-3 h-3" />
                              <span>{t('myTrips.proofBadge', { hash: trip.proofOfStayHash })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge variant={trip.status === 'checked_out' ? 'default' : 'danger'}>
                          {trip.status === 'checked_out' ? t('myTrips.completedBadge') : t('myTrips.expiredBadge')}
                        </Badge>
                        
                        {trip.status === 'checked_out' && !hasReviewed && reviewingBookingId !== trip.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-accent border-accent/20 hover:border-accent/50"
                            onClick={() => setReviewingBookingId(trip.id)}
                          >
                            <PenTool className="w-3 h-3 mr-1" /> {t('myTrips.writeReviewBtn')}
                          </Button>
                        )}
                        {trip.status === 'checked_out' && hasReviewed && (
                          <span className="text-[10px] font-mono text-accent flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t('myTrips.reviewedBadge')}
                          </span>
                        )}
                      </div>
                    </div>

                    {reviewingBookingId === trip.id && (
                      <motion.form 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-border space-y-4"
                        onSubmit={(e) => handleSubmitReview(e, trip)}
                      >
                        <div>
                          <label className="text-[10px] text-text-secondary font-mono uppercase block mb-2">{t('myTrips.rateExperience')}</label>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className={`p-1 ${rating >= star ? 'text-accent' : 'text-surface-active'}`}
                              >
                                <Star className="w-6 h-6 fill-current" />
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-[10px] text-text-secondary font-mono uppercase block mb-2">{t('myTrips.shareReview')}</label>
                          <textarea
                            required
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            rows={3}
                            placeholder={t('myTrips.reviewPlaceholder')}
                            className="w-full bg-background border border-border rounded-lg p-3 text-sm text-white focus:outline-none focus:border-accent/50"
                          />
                        </div>
                        
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setReviewingBookingId(null)}
                          >
                            {t('myTrips.cancelBtn')}
                          </Button>
                          <Button
                            type="submit"
                            variant="outline"
                            className="bg-accent/10 border-accent/20 text-accent hover:border-accent/50 hover:bg-accent/20"
                          >
                            <PenTool className="w-3 h-3 mr-1" /> {t('myTrips.signAndPostBtn')}
                          </Button>
                        </div>
                      </motion.form>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* In-App Check Out Confirmation Modal */}
      <AnimatePresence>
        {checkOutBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-rose-500/40 rounded-2xl p-6 shadow-2xl font-mono space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {t('myTrips.checkOutBtn')}
                  </h3>
                </div>
                <button 
                  onClick={() => setCheckOutBooking(null)}
                  className="text-text-secondary hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                <p>{t('myTrips.confirmCheckOut', { title: checkOutBooking.listingTitle })}</p>
                <div className="p-3 bg-black/40 border border-border/30 rounded-xl space-y-1 text-text-primary text-[11px]">
                  <p className="text-cyber-green font-semibold">⚡ {t('myTrips.logRefund', { sats: (Math.floor(checkOutBooking.totalPriceSats * 0.10)).toLocaleString() })}</p>
                  <p className="text-cyber-blue">📜 {t('myTrips.proofOfStayBadge')}</p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <Button 
                  fullWidth 
                  variant="danger" 
                  onClick={() => executeCheckOut(checkOutBooking)}
                  className="gap-2 text-xs py-2.5 font-bold justify-center"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {t('myTrips.checkOutBtn')}
                </Button>
                <Button 
                  fullWidth 
                  variant="outline" 
                  onClick={() => setCheckOutBooking(null)}
                  className="text-xs text-text-secondary hover:text-white py-2.5 justify-center"
                >
                  {t('myTrips.cancelBtn')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
