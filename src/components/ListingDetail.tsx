import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Users, Coins, Star, ShieldCheck, Check, Copy, Calendar as CalendarIcon, ArrowLeft, Zap, ExternalLink, ArrowRight, MessageSquare, QrCode, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Listing, NostrIdentity, Booking } from '../types';
import { Button } from './ui/Button';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { sha256, signMessage } from '../utils/crypto';
import { generateBolt11, isWebLNAvailable, payViaWebLN } from '../utils/lightning';
import { calculateDynamicFee } from '../utils/dynamicFee';
import { generateEscrowMultisigAddress, calculateRequiredDeposit } from '../utils/depositEscrow';
import { DEFAULT_ARBITRATOR_POOL } from '../utils/insuranceFund';
import QrScannerModal from './QrScannerModal';
import { useAppStore } from '../store/useAppStore';
import { calculateReferralBonus, checkReferralEligibility } from '../utils/referral';
import { useTranslation } from '../hooks/useTranslation';

interface Props {
  listing: Listing;
  identity: NostrIdentity | null;
  bookings?: any[];
  onBack: () => void;
  onBookingSuccess: (booking: Booking) => void;
  onAddReply?: (listingId: string, reviewId: string, reply: any) => void;
  onAddLog: (type: any, msg: string, hash?: string) => void;
}

export default function ListingDetail({ listing, identity, onBack, onBookingSuccess, onAddReply, onAddLog }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'detail' | 'availability' | 'payment' | 'completed'>('detail');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  
  const [securityLevel, setSecurityLevel] = useState<'relaxed' | 'strict' | 'paranoid'>('strict');
  const [invoice, setInvoice] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentLog, setPaymentLog] = useState<string[]>([]);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const handleScanSuccess = async (scannedInvoice: string) => {
    setShowQrScanner(false);
    setInvoice(scannedInvoice);
    addPaymentLog(t('listingDetail.scannedQRLog', { code: scannedInvoice.slice(0, 16) }));
    onAddLog('lightning', t('listingDetail.scannedQRSystemLog', { invoice: scannedInvoice.slice(0, 20) }));
    
    setIsPaying(true);
    addPaymentLog(t('listingDetail.verifyingInvoiceLog'));
    setTimeout(async () => {
      await finalizeBooking();
    }, 1200);
  };
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const isOwner = identity && listing.coOwners.some(o => o.npub === identity.npub);

  const handleReplySubmit = async (reviewId: string) => {
    if (!identity || !onAddReply || !replyText.trim()) return;
    
    const payload = `Reply|${reviewId}|${identity.npub}|${replyText.trim()}|${Date.now()}`;
    const hash = await sha256(payload);
    const signature = await signMessage(hash, identity);
    
    const reply = {
      ownerNpub: identity.npub,
      text: replyText.trim(),
      signature,
      createdAt: new Date().toISOString(),
    };
    
    onAddReply(listing.id, reviewId, reply);
    onAddLog('relay', t('listingDetail.logReplySent'), signature);
    setReplyingTo(null);
    setReplyText('');
  };

  const diffTime = checkIn && checkOut ? new Date(checkOut).getTime() - new Date(checkIn).getTime() : 0;
  const nights = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const effectiveNights = nights > 0 ? nights : 1;
  
  const totalPriceSats = listing.priceSats * effectiveNights;
  const dynamicFeeInfo = calculateDynamicFee(totalPriceSats, undefined, 1.0, securityLevel);
  const totalFeeSats = dynamicFeeInfo.totalFeeSats; 
  const isDateValid = checkIn && checkOut && new Date(checkOut) > new Date(checkIn);

  const addPaymentLog = (msg: string) => {
    setPaymentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleProceedToPayment = async () => {
    if (!isDateValid) return;
    setStep('payment');
    
    addPaymentLog('Requesting Lightning Invoice from mesh routing node...');
    onAddLog('relay', t('listingDetail.requestingLNLog', { title: listing.title }));
    
    setTimeout(() => {
      const generatedInvoice = generateBolt11(totalPriceSats + totalFeeSats, `Thanh toan phong tai ${listing.title}`);
      setInvoice(generatedInvoice);
      addPaymentLog(`Received invoice: ${generatedInvoice.slice(0, 15)}...`);
      onAddLog('lightning', t('listingDetail.invoiceReceivedLog', { invoice: generatedInvoice.slice(0, 20) }));
    }, 1500);
  };

  const executeProfitSplit = () => {
    onAddLog('lightning', t('listingDetail.profitSplitLog', { title: listing.title }));
    
    listing.coOwners.forEach((owner) => {
      const shareAmount = Math.round((totalPriceSats * owner.share) / 100);
      onAddLog('lightning', `  ├─ LN Split [${owner.share}%]: ${shareAmount.toLocaleString()} Sats -> LN Address: ${owner.lightningAddress}`);
      addPaymentLog(`Split [${owner.share}%]: ${shareAmount.toLocaleString()} Sats routed to ${owner.lightningAddress}`);
    });
    
    onAddLog('lightning', t('listingDetail.profitSplitCompleteLog'));
  };

  const handlePayInvoice = async () => {
    if (!identity) return;
    setIsPaying(true);

    if (isWebLNAvailable()) {
      addPaymentLog('WebLN/NWC detected. Activating Alby / Amethyst Wallet...');
      onAddLog('lightning', t('listingDetail.webLNActivatedLog'));
      
      const result = await payViaWebLN(invoice);
      if (result.success) {
        addPaymentLog(`WebLN payment successful! Preimage: ${result.preimage?.slice(0, 16)}...`);
        onAddLog('lightning', t('listingDetail.webLNSuccessLog', { sats: (totalPriceSats + totalFeeSats).toLocaleString() }));
        await finalizeBooking();
      } else {
        addPaymentLog(`WebLN Error: ${result.error || 'Payment rejected'}`);
        setIsPaying(false);
      }
    } else {
      addPaymentLog('No WebLN provider found. Please install a Lightning wallet like Alby.');
      onAddLog('lightning', t('listingDetail.webLNErrorLog'));
      setIsPaying(false);
    }
  };

  const finalizeBooking = async () => {
    addPaymentLog('Settlement confirmed. Generating cryptographic proof of booking...');
    
    try {
      const bookingPayload = JSON.stringify({
        listingId: listing.id,
        guest: identity?.npub,
        dates: { checkIn, checkOut },
        amount: totalPriceSats
      });
      
      const signature = await signMessage(bookingPayload, identity!);
      const hash = await sha256(bookingPayload + signature);
      
      addPaymentLog(`Booking proof generated: ${hash.slice(0, 12)}...`);
      onAddLog('lock', t('listingDetail.bookingProofLog'));

      const hostNpub = listing.coOwners[0]?.npub || identity?.npub || '';
      const primaryArbitrator = DEFAULT_ARBITRATOR_POOL.find(a => a.isActive) || DEFAULT_ARBITRATOR_POOL[0];
      const arbitratorPubKeyHex = primaryArbitrator.pubKeyHex;
      const depositAmountSats = calculateRequiredDeposit(listing.priceSats, effectiveNights);

      const escrow = await generateEscrowMultisigAddress(
        identity!.npub,
        hostNpub,
        arbitratorPubKeyHex,
        `bk_${Date.now()}`,
        depositAmountSats
      );

      addPaymentLog(`NUT-11 Escrow created: ${escrow.multisigAddress}`);
      onAddLog('lightning', t('listingDetail.escrowCreatedLog', { sats: depositAmountSats.toLocaleString(), address: escrow.multisigAddress }), hash);
      
      const newBooking: Booking = {
        id: `bk_${Date.now()}`,
        listingId: listing.id,
        listingTitle: listing.title,
        guestNpub: identity!.npub,
        hostNpub: hostNpub,
        startDate: checkIn,
        endDate: checkOut,
        nights: effectiveNights,
        totalPriceSats: totalPriceSats,
        guestDepositSats: depositAmountSats,
        guestDepositStatus: 'locked',
        escrowToken: escrow.escrowToken,
        multisigAddress: escrow.multisigAddress,
        status: 'paid',
        invoiceBolt11: invoice,
        paymentHash: hash,
        paidAt: new Date().toISOString()
      };
      
      executeProfitSplit();

      // Kiểm tra & Xử lý thưởng 1% Referral Sats (Gọi hàm audit checkReferralEligibility)
      const referrerNpub = sessionStorage.getItem('cypher_referrer_npub');
      const existingReferrals = useAppStore.getState().referrals;
      const eligibility = checkReferralEligibility(referrerNpub, identity?.npub, existingReferrals);

      if (eligibility.eligible && referrerNpub) {
        const rewardSats = calculateReferralBonus(totalPriceSats);
        useAppStore.getState().addReferral({
          id: 'ref_' + Math.random().toString(36).substring(2, 9),
          referrerNpub: referrerNpub,
          refereeNpub: identity?.npub || 'unknown',
          bookingId: newBooking.id,
          rewardSats,
          timestamp: Date.now(),
          status: 'unclaimed'
        });
        onAddLog('lightning', t('listingDetail.referralBonusLog', { sats: rewardSats.toLocaleString(), referrer: referrerNpub.slice(0, 16) }));
      } else if (referrerNpub && !eligibility.eligible) {
        onAddLog('relay', t('listingDetail.referralSkippedLog', { reason: eligibility.reason }));
      }

      setTimeout(() => {
        setStep('completed');
        onBookingSuccess(newBooking);
        onAddLog('governance', t('listingDetail.smartContractCompleteLog', { sats: totalPriceSats.toLocaleString() }));
      }, 1000);
        
    } catch(err) {
      addPaymentLog('Error generating proof.');
      setIsPaying(false);
    }
  };

  const calcAverageRating = (l: Listing) => {
    if (l.reviews.length === 0) return 0;
    const sum = l.reviews.reduce((acc, rev) => acc + rev.rating, 0);
    return (sum / l.reviews.length).toFixed(1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('listingDetail.back')}
        </Button>
      </div>
      
      <Card variant="glass" className="overflow-hidden p-0 border-border">
        {/* Banner Image */}
        <div className="relative h-64 md:h-80 bg-black">
          <img src={listing.imageUrl} alt={listing.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
          
          <div className="absolute top-4 right-4">
            <Badge variant="primary" className="bg-black/80 backdrop-blur">
              <MapPin className="w-3 h-3 mr-1" />
              {listing.meshCoordinates}
            </Badge>
          </div>
        </div>

        <CardContent className="p-6 md:p-8 -mt-16 relative z-10">
          <div className="bg-surface/90 backdrop-blur border border-border rounded-2xl p-6 shadow-xl mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="warning" className="px-3 py-1 text-sm font-bold">
                  <Star className="w-4 h-4 mr-1 fill-warning" />
                  {listing.reviews.length > 0 ? calcAverageRating(listing) : t('listingDetail.newBadge')}
                </Badge>
                <span className="text-sm font-mono text-text-secondary">{t('listingDetail.reviewsCount', { count: listing.reviews.length })}</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">{listing.title}</h1>
            </div>
            <div className="flex flex-col md:items-end">
              <span className="text-sm font-mono text-text-secondary uppercase mb-1">{t('listingDetail.pricePerNight')}</span>
              <div className="flex items-center gap-2 text-warning">
                <Coins className="w-6 h-6" />
                <span className="text-3xl font-bold font-mono">{listing.priceSats.toLocaleString()}</span>
                <span className="text-sm font-bold mt-1">Sats</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> {t('listingDetail.meshStandards')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {listing.securitySpecs.map((spec, i) => (
                    <Badge key={i} variant="default" className="bg-surface">
                      <Check className="w-3 h-3 mr-1 text-success" />
                      {spec}
                    </Badge>
                  ))}
                </div>
                <p className="text-text-secondary leading-relaxed mt-4 text-sm">
                  {listing.description}
                </p>
              </section>

              <section className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> {t('listingDetail.coOwnersTitle')}
                </h3>
                <p className="text-xs text-text-secondary font-mono">
                  {t('listingDetail.coOwnersSub')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.coOwners.map((owner, i) => (
                    <div key={i} className="bg-surface/50 border border-border hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -z-10 group-hover:bg-primary/10 transition-colors"></div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary shadow-[0_0_10px_rgba(var(--primary),0.2)]">
                          {owner.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{owner.name}</div>
                          <div className="text-[10px] text-text-disabled font-mono truncate">{owner.npub.slice(0, 12)}...{owner.npub.slice(-4)}</div>
                        </div>
                        <div className="flex flex-col items-end">
                          <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 px-2 py-1 text-xs">
                            {t('listingDetail.shareBadge', { share: owner.share })}
                          </Badge>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded border border-border/50 p-2.5 flex items-center gap-2 mt-1">
                        <Zap className="w-3.5 h-3.5 text-warning shrink-0" />
                        <div className="text-[10px] text-warning font-mono truncate" title={owner.lightningAddress}>
                          {owner.lightningAddress || t('listingDetail.noLnAddress')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> {t('listingDetail.communityReviews')}
                </h3>
                <p className="text-xs text-text-secondary font-mono mb-4">
                  {t('listingDetail.communityReviewsSub')}
                </p>
                {listing.reviews.length === 0 ? (
                  <div className="text-sm text-text-secondary italic">{t('listingDetail.noReviews')}</div>
                ) : (
                  <div className="space-y-4">
                    {listing.reviews.map((review) => (
                      <div key={review.id} className="bg-surface/30 border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                              {review.guestNpub.slice(5, 7).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{review.guestNpub.slice(0, 12)}...</div>
                              <div className="text-[10px] text-text-disabled">{new Date(review.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <Badge variant="warning" className="px-2 py-0.5 text-xs font-bold">
                            <Star className="w-3 h-3 mr-1 fill-warning" /> {review.rating}/5
                          </Badge>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">{review.text}</p>
                        
                        {/* Owner Reply Section */}
                        {review.reply ? (
                          <div className="mt-4 pl-4 border-l-2 border-primary/50 space-y-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-primary" />
                              <span className="text-xs font-bold text-primary">{t('listingDetail.hostReply')}</span>
                              <span className="text-[10px] text-text-disabled">{new Date(review.reply.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-text-secondary italic">{review.reply.text}</p>
                          </div>
                        ) : isOwner ? (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            {replyingTo === review.id ? (
                              <div className="space-y-3">
                                <textarea
                                  className="w-full bg-background border border-border rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary resize-none h-24"
                                  placeholder={t('listingDetail.replyPlaceholder')}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                ></textarea>
                                <div className="flex gap-2 justify-end">
                                  <Button variant="ghost" className="text-xs py-1" onClick={() => { setReplyingTo(null); setReplyText(''); }}>{t('listingDetail.cancelReply')}</Button>
                                  <Button variant="primary" className="text-xs py-1" onClick={() => handleReplySubmit(review.id)}>
                                    {t('listingDetail.sendReply')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button variant="outline" className="text-xs py-1" onClick={() => setReplyingTo(review.id)}>
                                {t('listingDetail.replyBtn')}
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Sidebar Booking Widget */}
            <div className="md:col-span-1">
              <Card variant="glass" className="sticky top-24 border-border">
                <CardHeader className="pb-4 border-b border-border">
                  <h3 className="text-lg font-bold font-mono text-white">{t('listingDetail.bookingConfirmation')}</h3>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {step === 'detail' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-mono text-text-secondary uppercase mb-2 block">{t('listingDetail.checkIn')}</label>
                        <input 
                          type="date" 
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-text-secondary uppercase mb-2 block">{t('listingDetail.checkOut')}</label>
                        <input 
                          type="date" 
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                      </div>
                      
                      {!identity ? (
                        <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-xs text-danger text-center">
                          {t('listingDetail.connectIdentityWarning')}
                        </div>
                      ) : (
                        <Button 
                          variant="primary" 
                          className="w-full" 
                          disabled={!isDateValid}
                          onClick={handleProceedToPayment}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {t('listingDetail.continuePayment')}
                        </Button>
                      )}
                    </div>
                  )}

                  {step === 'payment' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {/* Security Level Selector */}
                      <div className="bg-black/40 border border-border p-2.5 rounded-lg space-y-1.5">
                        <div className="flex justify-between items-center text-[11px] font-mono">
                          <span className="text-text-secondary">{t('listingDetail.securityLevel')}:</span>
                          <span className="text-primary font-bold uppercase">{t(`listingDetail.secTier.${securityLevel}`)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                          {(['relaxed', 'strict', 'paranoid'] as const).map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => setSecurityLevel(lvl)}
                              className={`py-1 px-2 rounded border text-center transition-colors ${
                                securityLevel === lvl
                                  ? 'bg-primary/20 border-primary text-primary font-bold'
                                  : 'bg-surface border-border text-text-disabled hover:text-white'
                              }`}
                            >
                              {lvl === 'relaxed' ? '0.8x' : lvl === 'strict' ? '1.0x' : '1.5x'} {t(`listingDetail.secTier.${lvl}`)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">{t('listingDetail.stayCost', { nights: effectiveNights })}</span>
                        <span className="font-mono text-white">{totalPriceSats.toLocaleString()} Sats</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary">BFT Protocol Fee ({dynamicFeeInfo.effectiveRatePercent}%):</span>
                        <span className="font-mono text-primary font-bold">+{dynamicFeeInfo.protocolFeeSats.toLocaleString()} Sats</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary">LN Routing Fee (LNURL/NWC):</span>
                        <span className="font-mono text-warning font-bold">+{dynamicFeeInfo.routingFeeSats.toLocaleString()} Sats</span>
                      </div>
                      <div className="h-px w-full bg-border"></div>
                      <div className="flex justify-between items-center font-bold text-lg text-warning">
                        <span>{t('listingDetail.totalCost')}</span>
                        <span className="font-mono">{(totalPriceSats + dynamicFeeInfo.totalFeeSats).toLocaleString()} Sats</span>
                      </div>
                      
                      {/* Alby / NWC Routing Visualization */}
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2 mt-4">
                        <div className="flex items-center gap-2 text-primary mb-2 border-b border-primary/10 pb-2">
                          <Zap className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase font-mono tracking-wider">WebLN / NWC Routing Split</span>
                        </div>
                        {listing.coOwners.map((owner, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-text-secondary truncate pr-2 max-w-[150px]">{owner.name} ({owner.share}%)</span>
                            <span className="font-mono text-white whitespace-nowrap">+{Math.round((totalPriceSats * owner.share) / 100).toLocaleString()} Sats</span>
                          </div>
                        ))}
                      </div>

                      {invoice ? (
                        <div className="space-y-4 pt-2">
                           {/* High-Resolution QR Code display for external Lightning Wallet Scanning */}
                           <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center border-2 border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.15)] mx-auto max-w-[210px] text-center">
                              <QRCodeSVG value={`lightning:${invoice}`} size={160} level="M" includeMargin={true} />
                              <span className="text-[10px] text-black font-mono font-bold mt-2 uppercase tracking-wider">{t('listingDetail.scanWithWallet')}</span>
                           </div>

                           <div className="bg-black border border-border rounded-lg p-3 relative group">
                              <p className="text-[10px] font-mono text-primary break-all pr-8">
                                {invoice}
                              </p>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(invoice);
                                  setCopiedInvoice(true);
                                  setTimeout(() => setCopiedInvoice(false), 2000);
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-surface rounded hover:bg-surface-hover text-text-secondary"
                              >
                                {copiedInvoice ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                              </button>
                           </div>

                           <div className="flex gap-2">
                             <Button 
                               variant="primary" 
                               className="flex-1"
                               onClick={handlePayInvoice}
                               disabled={isPaying}
                             >
                               {isPaying ? (
                                 <span className="animate-pulse">{t('listingDetail.paying')}</span>
                               ) : (
                                 <>
                                   <Coins className="w-4 h-4 mr-2" />
                                   {t('listingDetail.payWebLN')}
                                 </>
                               )}
                             </Button>

                             <Button
                               variant="secondary"
                               className="px-3 border-primary/30 text-primary hover:bg-primary/10 gap-1.5 text-xs font-mono shrink-0"
                               onClick={() => setShowQrScanner(true)}
                               title={t('listingDetail.scanQRTitle')}
                             >
                               <Camera className="w-4 h-4" />
                               <span className="hidden sm:inline">{t('listingDetail.scanQR')}</span>
                             </Button>
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 space-y-3">
                           <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                           <p className="text-xs font-mono text-text-secondary">{t('listingDetail.generatingInvoice')}</p>
                        </div>
                      )}

                      {/* Modal QR Scanner */}
                      {showQrScanner && (
                        <QrScannerModal
                          onClose={() => setShowQrScanner(false)}
                          onScanSuccess={handleScanSuccess}
                          expectedAmountSats={totalPriceSats + dynamicFeeInfo.totalFeeSats}
                        />
                      )}

                      {/* Payment Terminal */}
                      <div className="bg-black border border-border rounded-lg p-3 h-32 flex flex-col mt-4 font-mono text-[10px]">
                        <div className="text-success mb-2 font-bold uppercase flex items-center gap-1">
                           <Zap className="w-3 h-3" /> LN Terminal
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1">
                          {paymentLog.map((log, idx) => (
                            <div key={idx} className="text-text-disabled">{log}</div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'completed' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                       <div className="w-16 h-16 bg-success/20 border border-success/30 rounded-full flex items-center justify-center mx-auto">
                         <Check className="w-8 h-8 text-success" />
                       </div>
                       <h3 className="text-lg font-bold text-success font-mono">{t('listingDetail.paymentCompleted')}</h3>
                       <p className="text-xs text-text-secondary">{t('listingDetail.paymentCompletedDesc')}</p>
                       
                       <Button variant="outline" className="w-full mt-4" onClick={() => onBack()}>
                         {t('listingDetail.backToList')}
                       </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
