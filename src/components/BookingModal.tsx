import React, { useState, useEffect } from 'react';
import { X, Calendar, Coins, Zap, Shield, KeyRound, ArrowRight, CheckCircle2, Terminal, Activity, Banknote, ShieldCheck, Copy, Sparkles, Radio, Cpu, Lock } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Listing, Booking, NostrIdentity } from '../types';
import { generateBolt11, isWebLNAvailable, payViaWebLN } from '../utils/lightning';
import { generateCashuToken, redeemCashuToken } from '../utils/cashu';
import { payInvoiceViaNWC, getNWCConnectionString, saveNWCConnectionString, parseNWCUrl } from '../utils/nwc';
import { sha256 } from '../utils/crypto';
import { calculateDynamicFee } from '../utils/dynamicFee';
import { generateEscrowMultisigAddress } from '../utils/depositEscrow';
import { useAppStore } from '../store/useAppStore';
import { calculateReferralBonus, checkReferralEligibility } from '../utils/referral';

interface Props {
  listing: Listing | null;
  onClose: () => void;
  onBookingSuccess: (booking: Booking) => void;
  identity: NostrIdentity | null;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function BookingModal({ listing, onClose, onBookingSuccess, identity, onAddLog }: Props) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nights, setNights] = useState(1);
  const [totalPriceSats, setTotalPriceSats] = useState(0);
  const [step, setStep] = useState<'details' | 'payment' | 'completed'>('details');
  const [paymentMethod, setPaymentMethod] = useState<'lightning' | 'cashu'>('lightning');
  
  const [networkCongestion, setNetworkCongestion] = useState<'low' | 'medium' | 'high'>('medium');
  const [routingFeeSats, setRoutingFeeSats] = useState(0);
  const [isFetchingFees, setIsFetchingFees] = useState(false);

  const [invoice, setInvoice] = useState('');
  const [cashuToken, setCashuToken] = useState('');
  const [customCashuInput, setCustomCashuInput] = useState('');
  const [paymentHash, setPaymentHash] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentLog, setPaymentLog] = useState<string[]>([]);
  const [webLNAvailable, setWebLNAvailable] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setWebLNAvailable(isWebLNAvailable());
  }, []);

  // Set default dates (today and tomorrow)
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  // Recalculate nights and total price
  useEffect(() => {
    if (!startDate || !endDate || !listing) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const effectiveNights = diffDays > 0 ? diffDays : 1;
    setNights(effectiveNights);
    setTotalPriceSats(effectiveNights * listing.priceSats);
  }, [startDate, endDate, listing]);

  // Fetch Mock Network Fees
  useEffect(() => {
    if (step === 'details' && totalPriceSats > 0) {
      setIsFetchingFees(true);
      const timer = setTimeout(() => {
        const levels = ['low', 'medium', 'high'] as const;
        const level = levels[Math.floor(Math.random() * levels.length)];
        setNetworkCongestion(level);
        
        const congestionScore = level === 'low' ? 0.8 : level === 'medium' ? 1.0 : 1.5;
        const feeResult = calculateDynamicFee(totalPriceSats, undefined, congestionScore, 'strict');
        setRoutingFeeSats(feeResult.totalFeeSats);
        setIsFetchingFees(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step, totalPriceSats]);

  if (!listing) return null;

  const handleGenerateInvoice = async () => {
    if (!identity) {
      setErrorMsg(t('booking.errActivateIdentity'));
      return;
    }
    setErrorMsg('');
    const totalWithFee = paymentMethod === 'cashu' ? totalPriceSats : (totalPriceSats + routingFeeSats);
    const hash = await sha256(listing.id + startDate + endDate + identity.npub + Date.now().toString());
    const bolt11 = generateBolt11(totalWithFee, `Thanh toan phong tai ${listing.title}`);
    const generatedCashu = generateCashuToken(totalWithFee, 'https://mint.cashu.space', `Thanh toan phong: ${listing.title}`);
    
    setInvoice(bolt11);
    setCashuToken(generatedCashu);
    setPaymentHash(hash);
    setStep('payment');
    
    if (paymentMethod === 'cashu') {
      setPaymentLog([
        t('booking.cashuLogInit', { sats: totalWithFee.toLocaleString() }),
        `[Cashu NIP-61] Mint server: https://mint.cashu.space (Chaumian Blind Signature)`,
        t('booking.cashuLogToken')
      ]);
      onAddLog('lightning', t('booking.cashuLogAdd', { title: listing.title, sats: totalWithFee }), hash);
    } else {
      setPaymentLog([
        t('booking.lnLogBolt11', { sats: totalWithFee.toLocaleString() }),
        t('booking.lnLogTxId', { hash: hash.slice(0, 32) }),
        t('booking.lnLogStatus', { status: networkCongestion.toUpperCase() }),
        t('booking.lnLogTracking')
      ]);
      onAddLog('lightning', t('booking.lnLogAdd', { title: listing.title, sats: totalWithFee }), hash);
    }
  };

  const executeProfitSplit = () => {
    onAddLog('lightning', t('booking.lnLogSmartSplit', { title: listing.title }));
    
    listing.coOwners.forEach((owner) => {
      const shareAmount = Math.round((totalPriceSats * owner.share) / 100);
      onAddLog('lightning', t('booking.lnLogSplitShare', { share: owner.share, sats: shareAmount.toLocaleString(), dest: owner.lightningAddress }));
    });
    
    onAddLog('lightning', t('booking.lnLogSplitComplete'));
  };

  const handlePayWebLN = async () => {
    setIsPaying(true);
    setPaymentLog(prev => [...prev, t('booking.weblnLogActive')]);
    
    const result = await payViaWebLN(invoice);
    if (result.success) {
      setPaymentLog(prev => [...prev, t('booking.weblnLogSuccess'), t('booking.weblnLogPreimage', { preimage: result.preimage?.slice(0, 32) })]);
      handlePaymentComplete();
    } else {
      setPaymentLog(prev => [...prev, t('booking.weblnLogError', { error: result.error || 'Giao dịch bị từ chối' })]);
      setIsPaying(false);
    }
  };

  const handlePayNWC = async (customUri?: string) => {
    const savedNwc = getNWCConnectionString();
    const uri = customUri || savedNwc;
    if (!uri) {
      setErrorMsg(t('booking.errNwcConnect'));
      return;
    }
    setErrorMsg('');
    setIsPaying(true);
    setPaymentLog(prev => [
      ...prev,
      t('booking.nwcLogSending'),
      t('booking.nwcLogWaiting')
    ]);

    const result = await payInvoiceViaNWC(uri, invoice);
    if (result.success) {
      setPaymentLog(prev => [
        ...prev,
        t('booking.nwcLogConfirmed'),
        `  └─ Preimage: ${result.preimage?.slice(0, 32)}...`
      ]);
      onAddLog('lightning', t('booking.nwcLogSuccess'), paymentHash);
      handlePaymentComplete();
    } else {
      setPaymentLog(prev => [...prev, t('booking.nwcLogError', { error: result.error })]);
      setErrorMsg(result.error || t('booking.errNwcFailed'));
      setIsPaying(false);
    }
  };

  const handlePayCashu = async (tokenToPay?: string) => {
    const targetToken = tokenToPay || customCashuInput || cashuToken;
    if (!targetToken) {
      setErrorMsg(t('booking.errValidCashuToken'));
      return;
    }
    setErrorMsg('');
    setIsPaying(true);
    setPaymentLog(prev => [
      ...prev,
      t('booking.cashuLogSending'),
      t('booking.cashuLogBlind')
    ]);

    const result = await redeemCashuToken(targetToken);
    if (result.success) {
      setPaymentLog(prev => [
        ...prev,
        t('booking.cashuLogConfirmed', { sats: result.totalSats }),
        t('booking.cashuLogAnonymity')
      ]);
      onAddLog('lightning', t('booking.cashuLogSuccess', { sats: result.totalSats }), paymentHash);
      handlePaymentComplete();
    } else {
      setPaymentLog(prev => [...prev, t('booking.cashuLogError', { error: result.error })]);
      setErrorMsg(result.error || t('booking.errInvalidToken'));
      setIsPaying(false);
    }
  };

  const handlePaymentComplete = async () => {
    setIsPaying(true);
    
    // Simulate payment resolution steps
    setTimeout(() => {
      setPaymentLog(prev => [...prev, t('booking.lnLogConfirmed')]);
      
      setTimeout(async () => {
        executeProfitSplit();
        
        // Trích thưởng 1% Referral Sats nếu đủ điều kiện (Chỉ áp dụng lượt Đặt Phòng Đầu Tiên)
        const referrerNpub = sessionStorage.getItem('cypher_referrer_npub');
        const existingReferrals = useAppStore.getState().referrals;
        const eligibility = checkReferralEligibility(referrerNpub, identity?.npub, existingReferrals);

        if (eligibility.eligible && referrerNpub) {
          const rewardSats = calculateReferralBonus(totalPriceSats);
          useAppStore.getState().addReferral({
            id: 'ref_' + Math.random().toString(36).substring(2, 9),
            referrerNpub,
            refereeNpub: identity?.npub || 'unknown',
            bookingId: 'bk_' + paymentHash.slice(0, 12),
            rewardSats,
            timestamp: Date.now(),
            status: 'unclaimed'
          });
          onAddLog('lightning', t('booking.referralBonusLog', { sats: rewardSats.toLocaleString(), npub: referrerNpub.slice(0, 16) }));
        }

        // Generate an offline local secret door access code
        const secretCode = 'sec_' + (await sha256(paymentHash + (identity?.nsec || ''))).slice(0, 16);
        
        const newBooking: Booking = {
          id: 'bk_' + paymentHash.slice(0, 12),
          listingId: listing.id,
          listingTitle: listing.title,
          guestNpub: identity?.npub || 'unknown',
          startDate,
          endDate,
          totalPriceSats,
          status: 'paid',
          invoiceBolt11: invoice,
          paymentHash,
          secretCode,
          paidAt: new Date().toISOString()
        };

        onAddLog('lock', t('booking.smartLockAuthLog', { npub: identity?.npub?.slice(0, 10), start: startDate, end: endDate }));
        
        setIsPaying(false);
        setStep('completed');
        onBookingSuccess(newBooking);
      }, 1000);
    }, 1200);
  };

  const copyInvoice = () => {
    navigator.clipboard.writeText(invoice);
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-cyber-dark border border-white/10 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl relative font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-black/40 px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyber-amber" />
            <h3 className="text-white font-mono font-bold uppercase tracking-wider text-sm">{t('booking.modalTitle')}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
            id="close-booking-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Content */}
        <div className="p-6">
          {errorMsg && (
            <div className="p-3 mb-4 bg-danger/20 border border-danger/30 rounded-lg text-xs font-mono text-danger flex justify-between items-center">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-white/10 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              {/* Hotel Overview */}
              <div className="flex gap-4 items-center p-3 bg-white/5 rounded-lg">
                <img 
                  src={listing.imageUrl} 
                  alt={listing.title} 
                  className="w-16 h-16 object-cover rounded-lg"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-white font-bold text-sm leading-snug">{listing.title}</h4>
                  <p className="text-xs text-cyber-green font-mono mt-1">{listing.meshCoordinates}</p>
                </div>
              </div>

              {/* Date selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-mono uppercase flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyber-green" />
                    {t('booking.checkInDate')}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyber-green/50"
                    id="booking-start-date"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-mono uppercase flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyber-green" />
                    {t('booking.checkOutDate')}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-cyber-gray border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyber-green/50"
                    id="booking-end-date"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-mono uppercase block">{t('booking.paymentMethodTitle')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('lightning')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between font-mono transition-all ${
                      paymentMethod === 'lightning'
                        ? 'bg-cyber-amber/10 border-cyber-amber text-white'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Zap className={`w-4 h-4 ${paymentMethod === 'lightning' ? 'text-cyber-amber fill-cyber-amber' : 'text-gray-400'}`} />
                      {paymentMethod === 'lightning' && <span className="text-[9px] bg-cyber-amber/20 text-cyber-amber px-1.5 rounded">{t('booking.defaultBadge')}</span>}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Lightning Network</div>
                      <div className="text-[9px] text-gray-400">BOLT11 / WebLN Instant</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cashu')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between font-mono transition-all ${
                      paymentMethod === 'cashu'
                        ? 'bg-cyber-blue/10 border-cyber-blue text-white'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Banknote className={`w-4 h-4 ${paymentMethod === 'cashu' ? 'text-cyber-blue' : 'text-gray-400'}`} />
                      <span className="text-[9px] bg-cyber-blue/20 text-cyber-blue px-1.5 rounded font-bold">NIP-60 ZK</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Cashu Chaumian Ecash</div>
                      <div className="text-[9px] text-gray-400">Blind Signatures / Offline</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Price & Tokenomics Breakdown */}
              <div className="bg-black/30 border border-white/5 p-4 rounded-lg space-y-2.5 relative">
                {isFetchingFees && paymentMethod === 'lightning' && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg z-10">
                    <span className="text-[10px] font-mono text-cyber-blue animate-pulse flex items-center gap-2">
                      <Activity className="w-3 h-3" /> {t('booking.optimizingFees')}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('booking.roomPrice', { nights })}:</span>
                  <span className="font-mono text-white">{totalPriceSats.toLocaleString()} Sats</span>
                </div>

                {/* 1. Reputation-Based Fee Reduction */}
                <div className="flex justify-between text-xs text-gray-400 items-center">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyber-green" />
                    <span>{t('booking.protocolFee')}:</span>
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyber-green/20 text-cyber-green font-bold">
                      {t('booking.cypherLegendBadge')}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="line-through text-gray-600 text-[10px] mr-1">
                      {Math.floor(totalPriceSats * 0.015).toLocaleString()} Sats
                    </span>
                    <span className="text-cyber-green font-bold">
                      {Math.floor(totalPriceSats * 0.002).toLocaleString()} Sats
                    </span>
                  </div>
                </div>

                {/* 2. 2-Way Refundable Escrow Deposit */}
                <div className="p-2.5 bg-black/50 border border-cyber-amber/20 rounded-lg space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-cyber-amber font-bold">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> {t('booking.escrow2Way')}
                    </span>
                    <span>+{Math.floor(totalPriceSats * 0.10).toLocaleString()} SATS ({t('booking.refund100')})</span>
                  </div>
                  <p className="text-[9px] text-gray-400 leading-tight">
                    • <strong>{t('booking.guestDeposit')}</strong><br/>
                    • <strong>{t('booking.hostDeposit')}</strong>
                  </p>
                </div>

                {/* 3. Referral Sats */}
                <div className="flex justify-between text-xs text-gray-400 items-center pt-1 border-t border-white/5">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Zap className="w-3 h-3 text-cyber-amber" /> {t('booking.referralBonus')}:
                  </span>
                  <span className="font-mono text-cyber-amber text-[11px]">
                    +{Math.floor(totalPriceSats * 0.01).toLocaleString()} Sats ({t('booking.referralAutoShare')})
                  </span>
                </div>

                {paymentMethod === 'lightning' && (
                  <div className="flex justify-between text-xs text-gray-400 items-center">
                    <span>{t('booking.lightningRoutingFee')}</span>
                    <span className="font-mono text-white">{routingFeeSats.toLocaleString()} Sats</span>
                  </div>
                )}

                <div className="border-t border-white/10 pt-2.5 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-white font-bold block">{t('booking.subtotalTitle')}</span>
                    <span className="text-[9px] text-cyber-green font-mono">
                      * {t('booking.refundOnCheckout', { sats: Math.floor(totalPriceSats * 0.10).toLocaleString() })}
                    </span>
                  </div>
                  <span className="font-mono text-cyber-amber font-bold text-lg flex items-center gap-1">
                    <Coins className="w-4 h-4" />
                    {(totalPriceSats + Math.floor(totalPriceSats * 0.10) + Math.floor(totalPriceSats * 0.002) + (paymentMethod === 'lightning' ? routingFeeSats : 0)).toLocaleString()} Sats
                  </span>
                </div>
              </div>

              {/* Guest Identification Info */}
              <div className="p-3 bg-cyber-green/5 border border-cyber-green/10 rounded-lg flex items-start gap-3">
                <Shield className="w-5 h-5 text-cyber-green shrink-0 mt-0.5" id="security-info-icon" />
                <div className="text-[11px] text-gray-300 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">{t('booking.nostrAuthTitle')}</span>
                  {t('booking.nostrAuthDescPrefix')}<span className="text-cyber-green font-mono">{identity?.npub?.slice(0, 16)}...</span>{t('booking.nostrAuthDescSuffix')}
                </div>
              </div>

              <button
                onClick={handleGenerateInvoice}
                className="w-full py-3 bg-cyber-green text-black font-bold text-xs uppercase rounded-lg hover:bg-cyber-green/80 transition-all font-mono flex items-center justify-center gap-2"
                id="generate-invoice-btn"
              >
                {paymentMethod === 'cashu' ? <Banknote className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                <span>{paymentMethod === 'cashu' ? t('booking.btnGenerateCashu') : t('booking.btnGenerateLN')}</span>
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Payment UI Block: Lightning or Cashu */}
              {paymentMethod === 'cashu' ? (
                <div className="flex flex-col items-center justify-between p-4 bg-black/40 rounded-xl border border-cyber-blue/30 space-y-4">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30 rounded-full text-[10px] font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" /> NIP-60 / NIP-61 Cashu Ecash
                    </div>
                    <h4 className="text-xs text-white font-bold font-mono">{t('booking.payEcashTitle')}</h4>
                  </div>

                  {/* Cashu QR or Token Box */}
                  <div className="w-full space-y-3">
                    <div className="p-2.5 bg-black rounded-lg border border-cyber-blue/30 text-center">
                      <p className="text-[10px] text-gray-400 font-mono mb-1">{t('booking.cashuTokenSample')}</p>
                      <div className="p-2 bg-white/5 rounded font-mono text-[9px] text-cyber-blue break-all max-h-20 overflow-y-auto border border-white/10 select-all">
                        {cashuToken}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePayCashu(cashuToken)}
                      disabled={isPaying}
                      className="w-full py-2.5 bg-cyber-blue text-black font-bold text-xs rounded-lg font-mono uppercase flex items-center justify-center gap-2 hover:bg-cyber-blue/80 disabled:opacity-50 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{t('booking.btnConfirmCashu')}</span>
                    </button>

                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-mono block">{t('booking.pasteCustomCashu')}</label>
                      <input
                        type="text"
                        value={customCashuInput}
                        onChange={(e) => setCustomCashuInput(e.target.value)}
                        placeholder="cashuA..."
                        className="w-full bg-black/80 border border-white/10 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-cyber-blue/50"
                      />
                      {customCashuInput && (
                        <button
                          type="button"
                          onClick={() => handlePayCashu(customCashuInput)}
                          disabled={isPaying}
                          className="w-full py-2 bg-cyber-green text-black font-bold text-xs rounded font-mono uppercase flex items-center justify-center gap-1 hover:bg-cyber-green/80"
                        >
                          {t('booking.btnPayPastedCashu')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 bg-black/30 rounded-lg border border-white/5 space-y-4">
                  <span className="text-[10px] text-gray-400 font-mono uppercase">{t('booking.scanQrLn')}</span>
                  
                  {/* Glowing Green QR Code */}
                  <div className="p-2.5 bg-cyber-black rounded-lg border border-cyber-green/30 glow-border-green">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(invoice)}&size=160x160&color=00ff66&bgcolor=0a0a0c`}
                      alt="Lightning Invoice QR"
                      referrerPolicy="no-referrer"
                      className="w-40 h-40 object-contain"
                    />
                  </div>

                  <div className="w-full space-y-2">
                    <button
                      onClick={copyInvoice}
                      className="w-full py-1.5 bg-cyber-gray hover:bg-white/5 border border-white/10 rounded text-[10px] text-gray-300 font-mono flex items-center justify-center gap-1"
                      id="copy-invoice-string-btn"
                    >
                      <span>{copiedInvoice ? t('booking.copiedInvoice') : t('booking.copyInvoice')}</span>
                    </button>
                    
                    {/* Nostr Wallet Connect (NWC) 1-Click Pay */}
                    <button
                      onClick={() => handlePayNWC()}
                      disabled={isPaying}
                      className="w-full py-2 bg-cyber-amber text-black font-bold text-xs rounded font-mono uppercase flex items-center justify-center gap-1.5 hover:bg-cyber-amber/80 disabled:opacity-50 transition-all shadow-lg shadow-cyber-amber/20"
                      id="pay-nwc-btn"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      <span>{t('booking.btnPayNwc')}</span>
                    </button>

                    {webLNAvailable && (
                      <button
                        onClick={handlePayWebLN}
                        disabled={isPaying}
                        className="w-full py-1.5 bg-white/10 text-white font-bold text-[10px] rounded font-mono uppercase flex items-center justify-center gap-1 hover:bg-white/20 disabled:opacity-50"
                        id="pay-webln-btn"
                      >
                        <span>{t('booking.btnPayWebLN')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Terminal Logs */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="glass-panel border border-white/10 rounded-lg p-3 font-mono text-[10px] flex-1 overflow-y-auto h-48 space-y-1 bg-black">
                  <div className="flex items-center gap-1.5 text-cyber-amber font-bold uppercase mb-2">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Lightning Node Console</span>
                  </div>
                  {paymentLog.map((log, lIdx) => (
                    <div key={lIdx} className="text-gray-300 leading-relaxed break-all">
                      {log}
                    </div>
                  ))}
                  {isPaying && (
                    <div className="text-cyber-green animate-pulse">
                      {t('booking.listeningReceipt')}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {step === 'completed' && (
            <div className="text-center py-8 space-y-6">
              <div className="flex justify-center">
                <div className="p-3 bg-cyber-green/10 text-cyber-green rounded-full border border-cyber-green/30">
                  <CheckCircle2 className="w-12 h-12" id="booking-success-checkmark" />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white uppercase font-mono tracking-wider">{t('booking.successTitle')}</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  {t('booking.successDesc')}
                </p>
              </div>

              {/* Smart lock token instruction */}
              <div className="max-w-md mx-auto bg-black/40 border border-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-cyber-green font-mono text-xs font-bold uppercase">
                  <KeyRound className="w-4 h-4" />
                  <span>{t('booking.offlineTokenTitle')}</span>
                </div>
                <p className="text-[11px] text-gray-300 text-left leading-relaxed">
                  {t('booking.offlineTokenDescPrefix')}<span className="text-cyber-green font-semibold">{t('booking.doorTabName')}</span>{t('booking.offlineTokenDescSuffix')}
                </p>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2 bg-cyber-gray hover:bg-white/10 text-white font-mono text-xs uppercase border border-white/10 rounded-lg transition-all"
                id="booking-modal-finish-btn"
              >
                {t('booking.btnBackToHome')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
