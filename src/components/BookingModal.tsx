import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Coins, Zap, Shield, KeyRound, ArrowRight, CheckCircle2, Terminal, Activity, Banknote, ShieldCheck, Copy, Sparkles, Radio, Cpu, Lock, Users, ChevronRight, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Listing, Booking, NostrIdentity } from '../types';
import { 
  generateBolt11, 
  isWebLNAvailable, 
  payViaWebLN, 
  resolveLightningAddressToInvoice, 
  parseBolt11,
  verifyLightningPreimage 
} from '../utils/lightning';
import { generateCashuToken, redeemCashuToken } from '../utils/cashu';
import { payInvoiceViaNWC, getNWCConnectionString, saveNWCConnectionString, parseNWCUrl } from '../utils/nwc';
import { sha256 } from '../utils/crypto';
import { calculateDynamicFee, createFeeStructureFromPcm, DEFAULT_FEE_STRUCTURE } from '../utils/dynamicFee';
import { generateEscrowMultisigAddress } from '../utils/depositEscrow';
import { useAppStore } from '../store/useAppStore';
import { calculateReferralBonus, checkReferralEligibility } from '../utils/referral';
import { calculateStayPrice, getRoomType, migrateListingToRoomTypes } from '../utils/pricing';
import { safeRandomUUID } from '../utils/uuid';

interface Props {
  listing: Listing | null;
  preselectedRoomTypeId?: string;
  onClose: () => void;
  onBookingSuccess: (booking: Booking) => void;
  identity: NostrIdentity | null;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function BookingModal({ listing, preselectedRoomTypeId, onClose, onBookingSuccess, identity, onAddLog }: Props) {
  const { t } = useTranslation();
  const effectiveListing = listing ? migrateListingToRoomTypes(listing) : null;
  const roomTypes = effectiveListing?.roomTypes || [];
  const infraIncentiveTreasuryLightningAddress = useAppStore((state) => state.infraIncentiveTreasuryLightningAddress);
  const baseFeeRatePcm = useAppStore((state) => state.baseFeeRatePcm);
  const fetchProtocolConfig = useAppStore((state) => state.fetchProtocolConfig);

  useEffect(() => {
    fetchProtocolConfig();
  }, [fetchProtocolConfig]);

  const activeFeeStructure = useMemo(() => {
    return createFeeStructureFromPcm(typeof baseFeeRatePcm === 'number' ? baseFeeRatePcm : DEFAULT_FEE_STRUCTURE.baseFeeRatePcm);
  }, [baseFeeRatePcm]);

  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | undefined>(() => {
    if (preselectedRoomTypeId && roomTypes.some(rt => rt.id === preselectedRoomTypeId)) {
      return preselectedRoomTypeId;
    }
    if (roomTypes.length === 1) {
      return roomTypes[0].id;
    }
    return undefined;
  });

  const [step, setStep] = useState<'select_room' | 'details' | 'payment' | 'completed'>(() => {
    if (preselectedRoomTypeId && roomTypes.some(rt => rt.id === preselectedRoomTypeId)) {
      return 'details';
    }
    if (roomTypes.length <= 1) {
      return 'details';
    }
    return 'select_room';
  });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nights, setNights] = useState(1);
  const [totalPriceSats, setTotalPriceSats] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'lightning' | 'cashu'>('lightning');
  
  const [networkCongestion, setNetworkCongestion] = useState<'low' | 'medium' | 'high'>('medium');
  const [protocolFeeSats, setProtocolFeeSats] = useState(0);
  const [lnRoutingFeeSats, setLnRoutingFeeSats] = useState(0);
  const [isFetchingFees, setIsFetchingFees] = useState(false);

  // Dual-Invoice State for Host & Treasury Split (RFC-0016)
  const [hostInvoice, setHostInvoice] = useState('');
  const [hostPaymentHash, setHostPaymentHash] = useState('');
  const [hostPaid, setHostPaid] = useState(false);
  const [hostPreimage, setHostPreimage] = useState('');
  const [copiedHostInvoice, setCopiedHostInvoice] = useState(false);

  const [treasuryInvoice, setTreasuryInvoice] = useState('');
  const [treasuryPaymentHash, setTreasuryPaymentHash] = useState('');
  const [treasuryPaid, setTreasuryPaid] = useState(false);
  const [treasuryPreimage, setTreasuryPreimage] = useState('');
  const [copiedTreasuryInvoice, setCopiedTreasuryInvoice] = useState(false);

  const [isTreasuryMerged, setIsTreasuryMerged] = useState(false);
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<'host' | 'treasury'>('host');
  const [showPartialExitConfirm, setShowPartialExitConfirm] = useState(false);

  const [cashuToken, setCashuToken] = useState('');
  const [customCashuInput, setCustomCashuInput] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentLog, setPaymentLog] = useState<string[]>([]);
  const [webLNAvailable, setWebLNAvailable] = useState(false);
  const [externalPreimage, setExternalPreimage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync when listing or preselectedRoomTypeId changes
  useEffect(() => {
    if (!effectiveListing) return;
    const rts = effectiveListing.roomTypes;
    if (preselectedRoomTypeId && rts.some(rt => rt.id === preselectedRoomTypeId)) {
      setSelectedRoomTypeId(preselectedRoomTypeId);
      setStep('details');
    } else if (rts.length === 1) {
      setSelectedRoomTypeId(rts[0].id);
      setStep('details');
    } else if (!selectedRoomTypeId || !rts.some(rt => rt.id === selectedRoomTypeId)) {
      setStep('select_room');
    }
  }, [listing?.id, preselectedRoomTypeId]);

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

  // Recalculate nights and total price based on selectedRoomTypeId
  useEffect(() => {
    if (!startDate || !endDate || !effectiveListing) return;
    const calc = calculateStayPrice(effectiveListing, startDate, endDate, selectedRoomTypeId);
    setNights(calc.nights);
    setTotalPriceSats(calc.totalSats);
    if (calc.totalSats > 0) {
      const initialFee = calculateDynamicFee(calc.totalSats, activeFeeStructure, 1.0, 'strict');
      setProtocolFeeSats(initialFee.protocolFeeSats);
      setLnRoutingFeeSats(initialFee.routingFeeSats);
    }
  }, [startDate, endDate, effectiveListing, selectedRoomTypeId, activeFeeStructure]);

  // Fetch Network Congestion & Dynamic Fees
  useEffect(() => {
    if (step === 'details' && totalPriceSats > 0) {
      setIsFetchingFees(true);
      const timer = setTimeout(() => {
        const levels = ['low', 'medium', 'high'] as const;
        const level = levels[Math.floor(Math.random() * levels.length)];
        setNetworkCongestion(level);
        
        const congestionScore = level === 'low' ? 0.8 : level === 'medium' ? 1.0 : 1.5;
        const feeResult = calculateDynamicFee(totalPriceSats, activeFeeStructure, congestionScore, 'strict');
        setProtocolFeeSats(feeResult.protocolFeeSats);
        setLnRoutingFeeSats(feeResult.routingFeeSats);
        setIsFetchingFees(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step, totalPriceSats, activeFeeStructure]);

  if (!listing) return null;

  const handleGenerateInvoice = async () => {
    if (!identity) {
      setErrorMsg(t('booking.errActivateIdentity'));
      return;
    }
    setErrorMsg('');

    const targetLightningAddress = listing.coOwners?.[0]?.lightningAddress;
    if (!targetLightningAddress) {
      setErrorMsg('Listing này chưa có Lightning Address hợp lệ của Host để nhận thanh toán.');
      return;
    }

    const treasuryAddress = (infraIncentiveTreasuryLightningAddress || 'peevishtender468@walletofsatoshi.com').trim();
    const hash = await sha256(listing.id + startDate + endDate + identity.npub + Date.now().toString());
    const room = effectiveListing ? getRoomType(effectiveListing, selectedRoomTypeId) : null;
    const roomSuffix = room ? ` - ${room.name}` : '';

    // Check if protocol fee is too small (< 1 Sat) to split separately
    let shouldMerge = protocolFeeSats < 1;
    let finalHostSats = totalPriceSats;
    let finalTreasurySats = protocolFeeSats;

    if (shouldMerge) {
      finalHostSats = totalPriceSats + protocolFeeSats;
      finalTreasurySats = 0;
    }

    // Resolve Host invoice for room price
    const hostResolved = await resolveLightningAddressToInvoice(targetLightningAddress, finalHostSats);
    if (!hostResolved.invoice || !hostResolved.isReal) {
      setErrorMsg(hostResolved.error || `Không thể tạo invoice từ máy chủ Lightning của Host (${targetLightningAddress}).`);
      return;
    }

    let treasuryResolvedInvoice = '';
    let treasuryResolvedHash = '';

    if (!shouldMerge) {
      const treasuryResolved = await resolveLightningAddressToInvoice(treasuryAddress, finalTreasurySats);
      if (!treasuryResolved.invoice || !treasuryResolved.isReal) {
        // Fallback: If treasury server rejects (e.g. minSendable restriction or offline), merge into Host invoice
        console.warn('[Treasury LNURL] Cannot resolve separate invoice for Treasury, merging into Host invoice:', treasuryResolved.error);
        shouldMerge = true;
        finalHostSats = totalPriceSats + protocolFeeSats;
        finalTreasurySats = 0;

        const reResolvedHost = await resolveLightningAddressToInvoice(targetLightningAddress, finalHostSats);
        if (reResolvedHost.invoice && reResolvedHost.isReal) {
          hostResolved.invoice = reResolvedHost.invoice;
        }
      } else {
        treasuryResolvedInvoice = treasuryResolved.invoice;
        const parsedT = parseBolt11(treasuryResolvedInvoice);
        treasuryResolvedHash = parsedT?.paymentHash || '';
      }
    }

    const parsedH = parseBolt11(hostResolved.invoice);
    const parsedHHash = parsedH?.paymentHash || hash;

    // Verify invoice amounts
    if (parsedH && parsedH.amountSats > 0 && parsedH.amountSats !== finalHostSats) {
      setErrorMsg(`Số tiền invoice Host (${parsedH.amountSats} Sats) không khớp với tiền phòng (${finalHostSats} Sats)!`);
      return;
    }
    if (!shouldMerge && treasuryResolvedInvoice) {
      const parsedT = parseBolt11(treasuryResolvedInvoice);
      if (parsedT && parsedT.amountSats > 0 && parsedT.amountSats !== finalTreasurySats) {
        setErrorMsg(`Số tiền invoice Treasury (${parsedT.amountSats} Sats) không khớp với phí protocol (${finalTreasurySats} Sats)!`);
        return;
      }
    }

    setHostInvoice(hostResolved.invoice);
    setHostPaymentHash(parsedHHash);
    setHostPaid(false);
    setHostPreimage('');

    setIsTreasuryMerged(shouldMerge);
    if (shouldMerge) {
      setTreasuryInvoice('');
      setTreasuryPaymentHash('');
      setTreasuryPaid(true); // Treated as not requiring separate payment
      setTreasuryPreimage('');
    } else {
      setTreasuryInvoice(treasuryResolvedInvoice);
      setTreasuryPaymentHash(treasuryResolvedHash);
      setTreasuryPaid(false);
      setTreasuryPreimage('');
    }

    setActiveInvoiceTab('host');
    setExternalPreimage('');

    const totalWithFee = totalPriceSats + protocolFeeSats;
    const generatedCashu = generateCashuToken(totalWithFee, 'https://mint.cashu.space', `Thanh toan phong: ${listing.title}${roomSuffix}`);
    setCashuToken(generatedCashu);
    setStep('payment');

    if (paymentMethod === 'cashu') {
      setPaymentLog([
        t('booking.cashuLogInit', { sats: totalWithFee.toLocaleString() }),
        `[Cashu NIP-61] Mint server: https://mint.cashu.space (Chaumian Blind Signature)`,
        t('booking.cashuLogToken')
      ]);
      onAddLog('lightning', t('booking.cashuLogAdd', { title: listing.title, sats: totalWithFee }), hash);
    } else if (shouldMerge) {
      setPaymentLog([
        t('booking.lnLogBolt11', { sats: finalHostSats.toLocaleString() }),
        `ℹ️ [RFC-0016] Phí protocol (${protocolFeeSats} Sats) được gộp vào hóa đơn Host (${targetLightningAddress}) do quá nhỏ để tách riêng (< 1 Sat) hoặc yêu cầu minSendable từ treasury.`,
        `Hóa đơn Host: ${hostResolved.invoice.slice(0, 32)}...`,
        t('booking.lnLogTracking')
      ]);
      onAddLog('lightning', `Hóa đơn thanh toán Host: ${finalHostSats} Sats (đã gộp phí protocol)`, parsedHHash);
    } else {
      setPaymentLog([
        `⚡ [RFC-0016 Lightning Payout Flow] Khởi tạo 2 hóa đơn Lightning phân tách độc lập:`,
        `  ├─ Hóa đơn 1 (Host): ${finalHostSats.toLocaleString()} Sats -> ${targetLightningAddress}`,
        `  └─ Hóa đơn 2 (Treasury Quỹ Thưởng): ${finalTreasurySats.toLocaleString()} Sats -> ${treasuryAddress}`,
        `⚠️ TIÊU CHUẨN MẬT MÃ: Cả hai hóa đơn đều phải được xác nhận bằng Preimage SHA-256 mới kích hoạt booking.`,
        `Trạng thái: 0/2 Hoàn tất. Đang chờ thanh toán Khoản 1...`
      ]);
      onAddLog('lightning', `Khởi tạo thanh toán 2 invoice: Host (${finalHostSats} Sats) + Treasury (${finalTreasurySats} Sats)`, parsedHHash);
    }
  };

  const executeProfitSplit = () => {
    onAddLog('lightning', t('booking.lnLogSmartSplit', { title: listing.title }));
    
    listing.coOwners.forEach((owner) => {
      const shareAmount = Math.round((totalPriceSats * owner.share) / 100);
      onAddLog('lightning', t('booking.lnLogSplitShare', { share: owner.share, sats: shareAmount.toLocaleString(), dest: owner.lightningAddress }));
    });
    
    onAddLog('lightning', t('booking.lnLogSplitComplete'));

    if (!isTreasuryMerged && protocolFeeSats > 0) {
      const treasuryAddress = (infraIncentiveTreasuryLightningAddress || 'peevishtender468@walletofsatoshi.com').trim();
      onAddLog('lightning', `  ├─ RFC-0016 Treasury: ${protocolFeeSats.toLocaleString()} Sats -> Ví Quỹ Thưởng Hạ Tầng: ${treasuryAddress}`);
    }
  };

  const handlePayWebLN = async (targetTab?: 'host' | 'treasury') => {
    const tab = targetTab || activeInvoiceTab;
    const invToPay = tab === 'host' ? hostInvoice : treasuryInvoice;
    const targetHash = tab === 'host' ? hostPaymentHash : treasuryPaymentHash;
    const label = tab === 'host' ? `Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats)` : `Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats)`;

    if (!invToPay) return;
    setIsPaying(true);
    setPaymentLog(prev => [...prev, `[WebLN] Đang gửi yêu cầu thanh toán cho ${label}...`]);

    const result = await payViaWebLN(invToPay);
    if (result.success && result.preimage) {
      const isValid = await verifyLightningPreimage(result.preimage, targetHash);
      if (!isValid) {
        setIsPaying(false);
        setPaymentLog(prev => [...prev, `❌ [WebLN] Chữ ký preimage không khớp payment_hash của ${label}!`]);
        setErrorMsg(`Chữ ký preimage từ ví không khớp payment_hash của ${label}!`);
        return;
      }

      setPaymentLog(prev => [
        ...prev,
        `✓ [WebLN] ${label} đã thanh toán & xác minh thành công!`,
        `  └─ Preimage: ${result.preimage?.slice(0, 32)}...`
      ]);

      if (tab === 'host') {
        setHostPaid(true);
        setHostPreimage(result.preimage);
        if (isTreasuryMerged || treasuryPaid) {
          handlePaymentComplete(result.preimage, treasuryPreimage);
        } else {
          setIsPaying(false);
          setActiveInvoiceTab('treasury');
          setPaymentLog(prev => [
            ...prev,
            `⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats) để hoàn tất!`
          ]);
        }
      } else {
        setTreasuryPaid(true);
        setTreasuryPreimage(result.preimage);
        if (hostPaid) {
          handlePaymentComplete(hostPreimage, result.preimage);
        } else {
          setIsPaying(false);
          setActiveInvoiceTab('host');
          setPaymentLog(prev => [
            ...prev,
            `⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats) để hoàn tất!`
          ]);
        }
      }
    } else {
      setIsPaying(false);
      setPaymentLog(prev => [...prev, `❌ [WebLN] Lỗi thanh toán ${label}: ${result.error || 'Giao dịch bị từ chối'}`]);
      setErrorMsg(result.error || `Thanh toán ${label} bị từ chối`);
    }
  };

  const handlePayNWC = async (targetTab?: 'host' | 'treasury', customUri?: string) => {
    const savedNwc = getNWCConnectionString();
    const uri = customUri || savedNwc;
    if (!uri) {
      setErrorMsg(t('booking.errNwcConnect'));
      return;
    }
    setErrorMsg('');

    const tab = targetTab || activeInvoiceTab;
    const invToPay = tab === 'host' ? hostInvoice : treasuryInvoice;
    const targetHash = tab === 'host' ? hostPaymentHash : treasuryPaymentHash;
    const label = tab === 'host' ? `Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats)` : `Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats)`;

    if (!invToPay) return;
    setIsPaying(true);
    setPaymentLog(prev => [
      ...prev,
      `⚡ [NWC NIP-47] Đang gửi yêu cầu thanh toán ${label}...`,
      t('booking.nwcLogWaiting')
    ]);

    const result = await payInvoiceViaNWC(uri, invToPay);
    if (result.success && result.preimage) {
      const isValid = await verifyLightningPreimage(result.preimage, targetHash);
      if (!isValid) {
        setIsPaying(false);
        setPaymentLog(prev => [...prev, `❌ [NWC] Preimage không khớp payment_hash của ${label}!`]);
        setErrorMsg(`Chữ ký preimage từ NWC không khớp payment_hash của ${label}!`);
        return;
      }

      setPaymentLog(prev => [
        ...prev,
        `✓ [NWC] ${label} đã xác nhận thanh toán!`,
        `  └─ Preimage: ${result.preimage?.slice(0, 32)}...`
      ]);

      if (tab === 'host') {
        setHostPaid(true);
        setHostPreimage(result.preimage);
        if (isTreasuryMerged || treasuryPaid) {
          handlePaymentComplete(result.preimage, treasuryPreimage);
        } else {
          setIsPaying(false);
          setActiveInvoiceTab('treasury');
          setPaymentLog(prev => [
            ...prev,
            `⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats) để hoàn tất!`
          ]);
        }
      } else {
        setTreasuryPaid(true);
        setTreasuryPreimage(result.preimage);
        if (hostPaid) {
          handlePaymentComplete(hostPreimage, result.preimage);
        } else {
          setIsPaying(false);
          setActiveInvoiceTab('host');
          setPaymentLog(prev => [
            ...prev,
            `⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Đã thanh toán Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats) để hoàn tất!`
          ]);
        }
      }
    } else {
      setIsPaying(false);
      setPaymentLog(prev => [...prev, `❌ [NWC] Lỗi thanh toán ${label}: ${result.error}`]);
      setErrorMsg(result.error || `Thanh toán ${label} qua NWC thất bại`);
    }
  };

  const handlePayBothNWC = async (customUri?: string) => {
    const savedNwc = getNWCConnectionString();
    const uri = customUri || savedNwc;
    if (!uri) {
      setErrorMsg(t('booking.errNwcConnect'));
      return;
    }
    setErrorMsg('');
    setIsPaying(true);

    let currentHostPre = hostPreimage;
    let currentTreasuryPre = treasuryPreimage;

    // 1. Pay Host if not yet paid
    if (!hostPaid) {
      setPaymentLog(prev => [
        ...prev,
        `⚡ [NWC NIP-47] Đang thanh toán Khoản 1: Tiền phòng Host (${totalPriceSats.toLocaleString()} Sats)...`
      ]);
      const resH = await payInvoiceViaNWC(uri, hostInvoice);
      if (!resH.success || !resH.preimage) {
        setIsPaying(false);
        setPaymentLog(prev => [...prev, `❌ [NWC] Lỗi thanh toán Khoản 1 (Host): ${resH.error}`]);
        setErrorMsg(`Thanh toán Khoản 1 thất bại: ${resH.error}`);
        return;
      }
      const validH = await verifyLightningPreimage(resH.preimage, hostPaymentHash);
      if (!validH) {
        setIsPaying(false);
        setPaymentLog(prev => [...prev, `❌ [NWC] Preimage Khoản 1 không khớp payment_hash!`]);
        setErrorMsg('Preimage Khoản 1 không khớp payment_hash!');
        return;
      }
      currentHostPre = resH.preimage;
      setHostPaid(true);
      setHostPreimage(resH.preimage);
      setPaymentLog(prev => [
        ...prev,
        `✓ [NWC] Khoản 1 (Host) đã thanh toán & xác minh thành công! (Preimage: ${resH.preimage?.slice(0, 24)}...)`
      ]);
    }

    // 2. Pay Treasury if not merged and not yet paid
    if (!isTreasuryMerged && !treasuryPaid) {
      setPaymentLog(prev => [
        ...prev,
        `⚡ [NWC NIP-47] Đang thanh toán Khoản 2: Phí Treasury (${protocolFeeSats.toLocaleString()} Sats)...`
      ]);
      const resT = await payInvoiceViaNWC(uri, treasuryInvoice);
      if (!resT.success || !resT.preimage) {
        setIsPaying(false);
        setActiveInvoiceTab('treasury');
        setPaymentLog(prev => [
          ...prev,
          `❌ [NWC] Lỗi thanh toán Khoản 2 (Treasury): ${resT.error}`,
          `⚠️ TRẠNG THÁI MỘT PHẦN (1/2): Tiền phòng Host đã trả, nhưng phí Treasury thất bại! Vui lòng hoàn tất thanh toán Khoản 2.`
        ]);
        setErrorMsg(`Thanh toán Khoản 2 (Treasury) thất bại: ${resT.error}. Trạng thái giữ một phần!`);
        return;
      }
      const validT = await verifyLightningPreimage(resT.preimage, treasuryPaymentHash);
      if (!validT) {
        setIsPaying(false);
        setActiveInvoiceTab('treasury');
        setPaymentLog(prev => [...prev, `❌ [NWC] Preimage Khoản 2 không khớp payment_hash!`]);
        setErrorMsg('Preimage Khoản 2 không khớp payment_hash! Trạng thái giữ một phần!');
        return;
      }
      currentTreasuryPre = resT.preimage;
      setTreasuryPaid(true);
      setTreasuryPreimage(resT.preimage);
      setPaymentLog(prev => [
        ...prev,
        `✓ [NWC] Khoản 2 (Treasury) đã thanh toán & xác minh thành công! (Preimage: ${resT.preimage?.slice(0, 24)}...)`
      ]);
    }

    handlePaymentComplete(currentHostPre, currentTreasuryPre);
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
      onAddLog('lightning', t('booking.cashuLogSuccess', { sats: result.totalSats }), hostPaymentHash);
      handlePaymentComplete();
    } else {
      setPaymentLog(prev => [...prev, t('booking.cashuLogError', { error: result.error })]);
      setErrorMsg(result.error || t('booking.errInvalidToken'));
      setIsPaying(false);
    }
  };

  const handleVerifyExternalPreimage = async (targetTab?: 'host' | 'treasury') => {
    const tab = targetTab || activeInvoiceTab;
    const cleanPreimage = externalPreimage.trim();
    if (!cleanPreimage) {
      setErrorMsg('Vui lòng dán mã Preimage (32 bytes hex) từ ví Lightning sau khi thanh toán.');
      return;
    }
    setErrorMsg('');
    setIsPaying(true);

    const targetHash = tab === 'host' ? hostPaymentHash : treasuryPaymentHash;
    const label = tab === 'host' ? `Khoản 1 (Tiền phòng: ${totalPriceSats.toLocaleString()} Sats)` : `Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats)`;

    setPaymentLog(prev => [
      ...prev,
      `Kiểm tra Proof-of-Payment: Đang xác minh Preimage cho ${label}...`,
      `Preimage input: ${cleanPreimage.slice(0, 32)}...`
    ]);

    const isValid = await verifyLightningPreimage(cleanPreimage, targetHash);
    if (!isValid) {
      setIsPaying(false);
      setPaymentLog(prev => [
        ...prev,
        `❌ XÁC MINH THẤT BẠI: Preimage không khớp với payment_hash của ${label}!`,
        `  └─ SHA-256(preimage) !== ${targetHash.slice(0, 32)}...`
      ]);
      setErrorMsg(`Xác minh mật mã thất bại: Preimage không khớp với payment_hash của ${label}!`);
      return;
    }

    setPaymentLog(prev => [
      ...prev,
      `✓ XÁC MINH MẬT MÃ THÀNH CÔNG: SHA-256(preimage) === payment_hash (${label})`,
      `  └─ Proof-of-Payment hợp lệ (Preimage: ${cleanPreimage.slice(0, 32)}...)`
    ]);
    onAddLog('lightning', `Xác nhận thanh toán ${label} thành công qua Preimage: ${cleanPreimage.slice(0, 16)}...`, targetHash);
    setExternalPreimage('');

    if (tab === 'host') {
      setHostPaid(true);
      setHostPreimage(cleanPreimage);
      if (isTreasuryMerged || treasuryPaid) {
        handlePaymentComplete(cleanPreimage, treasuryPreimage);
      } else {
        setIsPaying(false);
        setActiveInvoiceTab('treasury');
        setPaymentLog(prev => [
          ...prev,
          `⚠️ TRẠNG THÁI MỘT PHẦN (1/2 HOÀN TẤT): Đã xác minh tiền phòng Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Treasury: ${protocolFeeSats.toLocaleString()} Sats) để hoàn tất đặt phòng.`
        ]);
      }
    } else {
      setTreasuryPaid(true);
      setTreasuryPreimage(cleanPreimage);
      if (hostPaid) {
        handlePaymentComplete(hostPreimage, cleanPreimage);
      } else {
        setIsPaying(false);
        setActiveInvoiceTab('host');
        setPaymentLog(prev => [
          ...prev,
          `⚠️ TRẠNG THÁI MỘT PHẦN (1/2 HOÀN TẤT): Đã xác minh phí Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats) để hoàn tất đặt phòng.`
        ]);
      }
    }
  };

  const handlePaymentComplete = async (confirmedHostPreimage?: string, confirmedTreasuryPreimage?: string) => {
    setIsPaying(true);
    const finalHostPreimage = confirmedHostPreimage || hostPreimage;
    const finalTreasuryPreimage = confirmedTreasuryPreimage || treasuryPreimage;
    
    // Payment resolution steps
    setTimeout(() => {
      setPaymentLog(prev => [
        ...prev, 
        t('booking.lnLogConfirmed'),
        `🎉 TẤT CẢ KHOẢN THANH TOÁN ĐÃ ĐƯỢC XÁC THỰC MẬT MÃ:`,
        `  ├─ Tiền phòng Host: ${totalPriceSats.toLocaleString()} Sats (Preimage: ${finalHostPreimage.slice(0, 24)}...)`,
        isTreasuryMerged 
          ? `  └─ Phí Protocol: Đã gộp vào hóa đơn Host`
          : `  └─ Phí Protocol Treasury: ${protocolFeeSats.toLocaleString()} Sats (Preimage: ${finalTreasuryPreimage.slice(0, 24)}...)`
      ]);
      
      setTimeout(async () => {
        executeProfitSplit();
        
        // Trích thưởng 1% Referral Sats nếu đủ điều kiện (Chỉ áp dụng lượt Đặt Phòng Đầu Tiên)
        const referrerNpub = sessionStorage.getItem('cypher_referrer_npub');
        const existingReferrals = useAppStore.getState().referrals;
        const eligibility = checkReferralEligibility(referrerNpub, identity?.npub, existingReferrals);

        if (eligibility.eligible && referrerNpub) {
          const rewardSats = calculateReferralBonus(totalPriceSats);
          useAppStore.getState().addReferral({
            id: 'ref_' + safeRandomUUID().slice(0, 8),
            referrerNpub,
            refereeNpub: identity?.npub || 'unknown',
            bookingId: 'bk_' + hostPaymentHash.slice(0, 12),
            rewardSats,
            timestamp: Date.now(),
            status: 'unclaimed'
          });
          onAddLog('lightning', t('booking.referralBonusLog', { sats: rewardSats.toLocaleString(), npub: referrerNpub.slice(0, 16) }));
        }

        // Generate an offline local secret door access code
        const secretCode = 'sec_' + (await sha256(hostPaymentHash + (identity?.nsec || ''))).slice(0, 16);
        
        const stayCalc = calculateStayPrice(effectiveListing || listing, startDate, endDate, selectedRoomTypeId);
        const room = effectiveListing ? getRoomType(effectiveListing, selectedRoomTypeId) : null;

        const newBooking: Booking = {
          id: 'bk_' + hostPaymentHash.slice(0, 12),
          listingId: listing.id,
          listingTitle: listing.title,
          roomTypeId: room?.id,
          roomTypeName: room?.name,
          guestNpub: identity?.npub || 'unknown',
          startDate,
          endDate,
          totalPriceSats,
          bookingSnapshot: {
            title: listing.title,
            roomTypeId: room?.id,
            roomTypeName: room?.name,
            pricePerNightSats: stayCalc.averageNightlySats,
            securitySpecs: (room?.securitySpecs && room.securitySpecs.length > 0) ? room.securitySpecs : (listing.securitySpecs || [])
          },
          status: 'paid',
          invoiceBolt11: hostInvoice,
          paymentHash: hostPaymentHash,
          treasuryInvoiceBolt11: treasuryInvoice || undefined,
          treasuryPaymentHash: treasuryPaymentHash || undefined,
          protocolFeeSats: protocolFeeSats,
          secretCode,
          paidAt: new Date().toISOString()
        };

        onAddLog('lock', t('booking.smartLockAuthLog', { npub: identity?.npub?.slice(0, 10), start: startDate, end: endDate }));
        
        setIsPaying(false);
        setStep('completed');
        onBookingSuccess(newBooking);
      }, 1000);
    }, 1000);
  };

  const copyInvoice = (inv: string, type: 'host' | 'treasury') => {
    navigator.clipboard.writeText(inv);
    if (type === 'host') {
      setCopiedHostInvoice(true);
      setTimeout(() => setCopiedHostInvoice(false), 2000);
    } else {
      setCopiedTreasuryInvoice(true);
      setTimeout(() => setCopiedTreasuryInvoice(false), 2000);
    }
  };

  const handleAttemptClose = () => {
    if (step === 'payment' && !isTreasuryMerged && ((hostPaid && !treasuryPaid) || (!hostPaid && treasuryPaid))) {
      setShowPartialExitConfirm(true);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-cyber-dark border border-white/10 rounded-2xl w-full max-w-2xl my-auto flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] shadow-2xl relative font-sans overflow-hidden">
        
        {/* Sticky Header */}
        <div className="flex justify-between items-center bg-black/60 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-5 h-5 text-cyber-amber shrink-0" />
            <h3 className="text-white font-mono font-bold uppercase tracking-wider text-xs sm:text-sm truncate">
              {t('booking.modalTitle')}
            </h3>
          </div>
          <button 
            onClick={handleAttemptClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
            id="close-booking-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Steps Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3 mb-4 bg-danger/20 border border-danger/30 rounded-lg text-xs font-mono text-danger flex justify-between items-center">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-white/10 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {step === 'select_room' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyber-amber" />
                    Chọn Loại Phòng Lưu Trú
                  </h4>
                  <p className="text-xs text-text-secondary mt-0.5 font-mono">
                    {listing.title} • {roomTypes.length} loại phòng sẵn có
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {roomTypes.map((rt) => {
                  const roomImage = (rt.images && rt.images.length > 0) ? rt.images[0] : listing.imageUrl;
                  const isAvailable = rt.status !== 'occupied';
                  return (
                    <div
                      key={rt.id}
                      onClick={() => {
                        if (!isAvailable) return;
                        setSelectedRoomTypeId(rt.id);
                        setStep('details');
                      }}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isAvailable
                          ? 'bg-surface/60 border-border hover:border-primary/60 hover:bg-surface-hover cursor-pointer'
                          : 'bg-black/30 border-border/40 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={roomImage}
                          alt={rt.name}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shrink-0 border border-white/10 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="text-sm font-bold text-white truncate">{rt.name}</h5>
                            {rt.status === 'occupied' ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 font-mono">
                                Đã có khách
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30 font-mono">
                                Sẵn sàng
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-secondary font-mono">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-primary" />
                              Tối đa {rt.maxGuests} khách
                            </span>
                          </div>
                          {rt.securitySpecs && rt.securitySpecs.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {rt.securitySpecs.slice(0, 3).map((spec, i) => (
                                <span key={i} className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-text-disabled border border-border/40 font-mono">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-bold font-mono text-warning">
                            {rt.priceSats.toLocaleString()} Sats
                          </div>
                          <span className="text-[10px] text-text-disabled font-mono block">/ đêm</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAvailable}
                          className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-mono font-bold flex items-center gap-1 transition-colors"
                        >
                          <span>Chọn phòng</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              {/* Hotel & Selected Room Overview */}
              {(() => {
                const currentRoom = effectiveListing ? getRoomType(effectiveListing, selectedRoomTypeId) : null;
                const roomImg = (currentRoom?.images && currentRoom.images.length > 0) ? currentRoom.images[0] : listing.imageUrl;
                return (
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <div className="flex gap-3.5 items-center">
                      <img 
                        src={roomImg} 
                        alt={currentRoom?.name || listing.title} 
                        className="w-16 h-16 object-cover rounded-lg border border-white/10 shrink-0 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-white font-bold text-sm truncate leading-snug">
                            {currentRoom?.name || listing.title}
                          </h4>
                          {roomTypes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setStep('select_room')}
                              className="text-[11px] font-mono text-primary hover:underline shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/25"
                            >
                              Đổi loại phòng
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary truncate mt-0.5">{listing.title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-cyber-green mt-1">
                          <span>{listing.meshCoordinates}</span>
                          {currentRoom && (
                            <span className="text-text-secondary font-mono">
                              • Tối đa {currentRoom.maxGuests} khách • <strong className="text-warning font-semibold">{currentRoom.priceSats.toLocaleString()} Sats/đêm</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Date selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-mono uppercase flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyber-green shrink-0" />
                    <span>{t('booking.checkInDate')}</span>
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
                  <label className="text-xs text-gray-400 font-mono uppercase flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyber-green shrink-0" />
                    <span>{t('booking.checkOutDate')}</span>
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
                <label className="text-[11px] text-gray-400 font-mono uppercase block">{t('booking.paymentMethodTitle')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('lightning')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between font-mono transition-all ${
                      paymentMethod === 'lightning'
                        ? 'bg-cyber-amber/10 border-cyber-amber text-white ring-1 ring-cyber-amber/40'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Zap className={`w-4 h-4 ${paymentMethod === 'lightning' ? 'text-cyber-amber fill-cyber-amber' : 'text-gray-400'}`} />
                      {paymentMethod === 'lightning' && <span className="text-[9px] bg-cyber-amber/20 text-cyber-amber px-1.5 py-0.5 rounded font-bold">{t('booking.defaultBadge')}</span>}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Lightning Network</div>
                      <div className="text-[10px] text-gray-400">BOLT11 / WebLN Instant</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cashu')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between font-mono transition-all ${
                      paymentMethod === 'cashu'
                        ? 'bg-cyber-blue/10 border-cyber-blue text-white ring-1 ring-cyber-blue/40'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Banknote className={`w-4 h-4 ${paymentMethod === 'cashu' ? 'text-cyber-blue' : 'text-gray-400'}`} />
                      <span className="text-[9px] bg-cyber-blue/20 text-cyber-blue px-1.5 rounded font-bold">NIP-60 ZK</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Cashu Chaumian Ecash</div>
                      <div className="text-[10px] text-gray-400">Blind Signatures / Offline</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Price & Tokenomics Breakdown */}
              <div className="bg-black/40 border border-white/10 p-3.5 sm:p-4 rounded-xl space-y-3 relative">
                {isFetchingFees && paymentMethod === 'lightning' && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10">
                    <span className="text-xs font-mono text-cyber-blue animate-pulse flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" /> {t('booking.optimizingFees')}
                    </span>
                  </div>
                )}
                
                {/* Room Price */}
                <div className="flex justify-between items-center text-xs text-gray-300 font-mono">
                  <span>{t('booking.roomPrice', { nights })}</span>
                  <span className="font-bold text-white text-sm">{totalPriceSats.toLocaleString()} Sats</span>
                </div>

                {/* 1. Reputation-Based Fee Reduction */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-gray-300 font-mono">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Sparkles className="w-3.5 h-3.5 text-cyber-green shrink-0" />
                    <span>{t('booking.protocolFee')}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyber-green/20 text-cyber-green font-bold shrink-0">
                      {t('booking.cypherLegendBadge')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:text-right shrink-0">
                    <span className="line-through text-gray-500 text-[11px]">
                      {Math.floor(totalPriceSats * 0.015).toLocaleString()} Sats
                    </span>
                    <span className="text-cyber-green font-bold text-xs">
                      {Math.floor(totalPriceSats * 0.002).toLocaleString()} Sats
                    </span>
                  </div>
                </div>

                {/* 2. 2-Way Refundable Escrow Deposit */}
                <div className="p-3 bg-black/60 border border-cyber-amber/30 rounded-xl space-y-1.5 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-cyber-amber font-bold">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-cyber-amber" />
                      <span>{t('booking.escrow2Way')}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyber-amber/20 text-cyber-amber font-semibold shrink-0">
                        {t('booking.refund100')}
                      </span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-cyber-amber shrink-0">
                      +{Math.floor(totalPriceSats * 0.10).toLocaleString()} Sats
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 space-y-1 leading-relaxed pt-1 border-t border-white/5">
                    <div>{t('booking.guestDeposit')}</div>
                    <div>{t('booking.hostDeposit')}</div>
                  </div>
                </div>

                {/* 3. Referral Sats */}
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-gray-300 font-mono pt-1 border-t border-white/5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyber-amber shrink-0" />
                    <span>{t('booking.referralBonus')}</span>
                    <span className="text-[10px] text-gray-400 font-normal">({t('booking.referralAutoShare')})</span>
                  </span>
                  <span className="font-bold text-cyber-amber text-xs shrink-0">
                    +{Math.floor(totalPriceSats * 0.01).toLocaleString()} Sats
                  </span>
                </div>

                {paymentMethod === 'lightning' && (
                  <div className="flex justify-between items-center text-xs text-gray-300 font-mono">
                    <span title="Phí định tuyến Lightning ước tính (không thu vào CypherGuide)">{t('booking.lightningRoutingFee')}</span>
                    <span className="font-bold text-white text-xs shrink-0">{lnRoutingFeeSats.toLocaleString()} Sats</span>
                  </div>
                )}

                {/* Subtotal with deposit */}
                <div className="border-t border-white/10 pt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm text-white font-bold block">{t('booking.subtotalTitle')}</span>
                    <span className="text-[10px] text-cyber-green font-mono block mt-0.5">
                      * {t('booking.refundOnCheckout', { sats: Math.floor(totalPriceSats * 0.10).toLocaleString() })}
                    </span>
                  </div>
                  <div className="font-mono text-cyber-amber font-bold text-base sm:text-lg flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>
                      {(totalPriceSats + Math.floor(totalPriceSats * 0.10) + protocolFeeSats).toLocaleString()} Sats
                    </span>
                  </div>
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
                <div className="flex flex-col p-4 bg-black/40 rounded-xl border border-white/10 space-y-3.5">
                  {/* Partial / Status Banner */}
                  {isTreasuryMerged ? (
                    <div className="p-2.5 bg-cyber-blue/10 border border-cyber-blue/30 rounded-lg text-[11px] font-mono text-cyber-blue flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-cyber-blue" />
                      <div>
                        <span className="font-bold block">HÓA ĐƠN GỘP (RFC-0016)</span>
                        Phí Protocol ({protocolFeeSats} Sats) được gộp vào hóa đơn Host ({listing.coOwners?.[0]?.lightningAddress}) do phí nhỏ hơn 1 Sat hoặc yêu cầu minSendable từ ví.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Dual Payment Progress Status */}
                      {hostPaid && !treasuryPaid && (
                        <div className="p-2.5 bg-cyber-amber/15 border border-cyber-amber/40 rounded-lg text-xs font-mono text-cyber-amber flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-cyber-amber animate-pulse" />
                          <div>
                            <span className="font-bold block">⚠️ TRẠNG THÁI MỘT PHẦN (1/2 HOÀN TẤT)</span>
                            Đã thanh toán tiền phòng Host. Vui lòng thanh toán tiếp Khoản 2 (Phí Protocol: {protocolFeeSats.toLocaleString()} Sats) để hoàn tất đặt phòng!
                          </div>
                        </div>
                      )}
                      {!hostPaid && treasuryPaid && (
                        <div className="p-2.5 bg-cyber-amber/15 border border-cyber-amber/40 rounded-lg text-xs font-mono text-cyber-amber flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-cyber-amber animate-pulse" />
                          <div>
                            <span className="font-bold block">⚠️ TRẠNG THÁI MỘT PHẦN (1/2 HOÀN TẤT)</span>
                            Đã thanh toán phí Treasury. Vui lòng thanh toán tiếp Khoản 1 (Tiền phòng: {totalPriceSats.toLocaleString()} Sats) để hoàn tất đặt phòng!
                          </div>
                        </div>
                      )}
                      {!hostPaid && !treasuryPaid && (
                        <div className="p-2 bg-black/60 border border-white/10 rounded-lg text-[11px] font-mono text-gray-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-cyber-amber">
                            <Zap className="w-3.5 h-3.5 fill-cyber-amber" />
                            Tiến độ thanh toán song song:
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">
                            0/2 Khoản đã xác nhận
                          </span>
                        </div>
                      )}

                      {/* Dual Invoice Tabs */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveInvoiceTab('host')}
                          className={`p-2.5 rounded-lg border text-left transition-all font-mono ${
                            activeInvoiceTab === 'host'
                              ? 'bg-cyber-green/10 border-cyber-green text-white ring-1 ring-cyber-green/30'
                              : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-bold uppercase tracking-wider">Khoản 1: Tiền phòng Host</span>
                            {hostPaid ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyber-green/20 text-cyber-green font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Đã trả
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-gray-400">Chờ trả</span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-cyber-green">{totalPriceSats.toLocaleString()} Sats</div>
                          <div className="text-[9px] text-gray-400 truncate mt-0.5">{listing.coOwners?.[0]?.lightningAddress}</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveInvoiceTab('treasury')}
                          className={`p-2.5 rounded-lg border text-left transition-all font-mono ${
                            activeInvoiceTab === 'treasury'
                              ? 'bg-cyber-amber/10 border-cyber-amber text-white ring-1 ring-cyber-amber/30'
                              : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-bold uppercase tracking-wider">Khoản 2: Phí Treasury</span>
                            {treasuryPaid ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyber-green/20 text-cyber-green font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Đã trả
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-gray-400">Chờ trả</span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-cyber-amber">{protocolFeeSats.toLocaleString()} Sats</div>
                          <div className="text-[9px] text-gray-400 truncate mt-0.5">{infraIncentiveTreasuryLightningAddress || 'peevishtender468@walletofsatoshi.com'}</div>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Active Invoice Content */}
                  {(() => {
                    const currentTab = isTreasuryMerged ? 'host' : activeInvoiceTab;
                    const currentInv = currentTab === 'host' ? hostInvoice : treasuryInvoice;
                    const currentPaid = currentTab === 'host' ? hostPaid : treasuryPaid;
                    const currentPreimage = currentTab === 'host' ? hostPreimage : treasuryPreimage;
                    const currentHash = currentTab === 'host' ? hostPaymentHash : treasuryPaymentHash;
                    const currentAmount = currentTab === 'host' ? (isTreasuryMerged ? totalPriceSats + protocolFeeSats : totalPriceSats) : protocolFeeSats;
                    const currentRecipient = currentTab === 'host' 
                      ? listing.coOwners?.[0]?.lightningAddress 
                      : (infraIncentiveTreasuryLightningAddress || 'peevishtender468@walletofsatoshi.com');
                    const isCopied = currentTab === 'host' ? copiedHostInvoice : copiedTreasuryInvoice;

                    if (currentPaid) {
                      return (
                        <div className="p-4 bg-cyber-green/10 border border-cyber-green/30 rounded-xl text-center space-y-3 font-mono">
                          <CheckCircle2 className="w-8 h-8 text-cyber-green mx-auto" />
                          <div>
                            <h5 className="text-xs font-bold text-white uppercase">
                              {currentTab === 'host' ? 'Khoản 1: Tiền phòng Host đã xác nhận' : 'Khoản 2: Phí Treasury đã xác nhận'}
                            </h5>
                            <p className="text-[11px] text-cyber-green mt-1">
                              {currentAmount.toLocaleString()} Sats → {currentRecipient}
                            </p>
                          </div>
                          <div className="p-2 bg-black/60 rounded text-[10px] text-gray-400 text-left space-y-1">
                            <div><span className="text-gray-500">Hash:</span> {currentHash.slice(0, 24)}...</div>
                            <div><span className="text-gray-500">Preimage:</span> {currentPreimage.slice(0, 24)}...</div>
                          </div>
                          {!isTreasuryMerged && (!hostPaid || !treasuryPaid) && (
                            <button
                              type="button"
                              onClick={() => setActiveInvoiceTab(currentTab === 'host' ? 'treasury' : 'host')}
                              className="w-full py-2 bg-cyber-amber text-black font-bold text-xs rounded uppercase hover:bg-cyber-amber/80 transition-all flex items-center justify-center gap-1.5"
                            >
                              <span>Chuyển sang thanh toán Khoản {currentTab === 'host' ? '2 (Phí Treasury)' : '1 (Tiền phòng)'}</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="text-center font-mono space-y-0.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                            Quét mã QR thanh toán {currentTab === 'host' ? 'Tiền phòng Host' : 'Phí Protocol Treasury'}
                          </span>
                          <span className="text-xs text-white font-bold block">
                            {currentAmount.toLocaleString()} Sats → <span className="text-cyber-green">{currentRecipient}</span>
                          </span>
                        </div>

                        {/* Glowing QR Code */}
                        <div className="p-2 bg-cyber-black rounded-lg border border-cyber-green/30 glow-border-green">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(currentInv)}&size=160x160&color=00ff66&bgcolor=0a0a0c`}
                            alt="Lightning Invoice QR"
                            referrerPolicy="no-referrer"
                            className="w-36 h-36 object-contain"
                          />
                        </div>

                        <div className="w-full space-y-2">
                          <button
                            type="button"
                            onClick={() => copyInvoice(currentInv, currentTab)}
                            className="w-full py-1.5 bg-cyber-gray hover:bg-white/5 border border-white/10 rounded text-[10px] text-gray-300 font-mono flex items-center justify-center gap-1"
                            id="copy-invoice-string-btn"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{isCopied ? t('booking.copiedInvoice') : t('booking.copyInvoice')}</span>
                          </button>

                          {/* 1-Click Pay Both via NWC (if neither paid) */}
                          {!isTreasuryMerged && !hostPaid && !treasuryPaid && (
                            <button
                              type="button"
                              onClick={() => handlePayBothNWC()}
                              disabled={isPaying}
                              className="w-full py-2 bg-cyber-amber text-black font-bold text-xs rounded font-mono uppercase flex items-center justify-center gap-1.5 hover:bg-cyber-amber/80 disabled:opacity-50 transition-all shadow-md shadow-cyber-amber/20"
                            >
                              <Zap className="w-3.5 h-3.5 fill-black" />
                              <span>Thanh toán cả 2 khoản qua NWC ({(totalPriceSats + protocolFeeSats).toLocaleString()} Sats)</span>
                            </button>
                          )}

                          {/* Pay active tab via NWC */}
                          <button
                            type="button"
                            onClick={() => handlePayNWC(currentTab)}
                            disabled={isPaying}
                            className="w-full py-2 bg-cyber-amber text-black font-bold text-xs rounded font-mono uppercase flex items-center justify-center gap-1.5 hover:bg-cyber-amber/80 disabled:opacity-50 transition-all shadow-md shadow-cyber-amber/20"
                            id="pay-nwc-btn"
                          >
                            <Zap className="w-3.5 h-3.5 fill-black" />
                            <span>{t('booking.btnPayNwc')} ({currentAmount.toLocaleString()} Sats)</span>
                          </button>

                          {/* Pay active tab via WebLN */}
                          {webLNAvailable && (
                            <button
                              type="button"
                              onClick={() => handlePayWebLN(currentTab)}
                              disabled={isPaying}
                              className="w-full py-1.5 bg-white/10 text-white font-bold text-[10px] rounded font-mono uppercase flex items-center justify-center gap-1 hover:bg-white/20 disabled:opacity-50"
                              id="pay-webln-btn"
                            >
                              <span>{t('booking.btnPayWebLN')} ({currentAmount.toLocaleString()} Sats)</span>
                            </button>
                          )}

                          {/* External Preimage Verification */}
                          <div className="pt-2 border-t border-white/10 space-y-1.5 text-left">
                            <label className="text-[10px] text-gray-400 font-mono block">
                              Đã quét thanh toán từ ví ngoài (Zeus / Phoenix / Alby)?
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={externalPreimage}
                                onChange={(e) => setExternalPreimage(e.target.value)}
                                placeholder="Dán Preimage hex (64 ký tự)..."
                                className="flex-1 bg-black/80 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-cyber-green/50 placeholder:text-gray-600"
                              />
                              <button
                                type="button"
                                onClick={() => handleVerifyExternalPreimage(currentTab)}
                                disabled={isPaying || !externalPreimage.trim()}
                                className="px-2.5 py-1.5 bg-cyber-green text-black font-bold text-[10px] rounded font-mono uppercase hover:bg-cyber-green/80 disabled:opacity-50 transition-all shrink-0"
                                id="verify-external-preimage-btn"
                              >
                                Xác minh
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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

        {/* Partial Payment Exit Warning Dialog */}
        {showPartialExitConfirm && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center">
            <div className="bg-cyber-gray border border-cyber-amber/40 p-5 rounded-xl max-w-md space-y-4 shadow-2xl">
              <AlertTriangle className="w-10 h-10 text-cyber-amber mx-auto animate-pulse" />
              <h4 className="text-white font-bold font-mono text-sm uppercase">Cảnh Báo: Thanh Toán Một Phần!</h4>
              <p className="text-xs text-gray-300 font-mono leading-relaxed">
                Bạn đã thanh toán 1 trong 2 khoản ({hostPaid ? 'đã thanh toán tiền phòng Host' : 'đã thanh toán phí Treasury'}).
                Nếu thoát ngay bây giờ, đặt phòng sẽ <strong>chưa được xác nhận hoàn tất</strong> cho tới khi cả hai khoản đều được thanh toán và xác minh.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPartialExitConfirm(false)}
                  className="flex-1 py-2 bg-cyber-green text-black font-bold font-mono text-xs rounded uppercase hover:bg-cyber-green/80 transition-colors"
                >
                  Tiếp tục thanh toán
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPartialExitConfirm(false);
                    onClose();
                  }}
                  className="px-3 py-2 bg-white/10 text-gray-300 font-mono text-xs rounded hover:bg-white/20 transition-colors"
                >
                  Vẫn thoát
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
