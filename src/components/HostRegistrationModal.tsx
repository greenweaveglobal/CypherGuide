import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, MapPin, Coins, Users, ShieldCheck, Home, Zap, Upload, Image as ImageIcon, 
  Trash2, Plus, Check, User, Percent, Key, PieChart, CheckCircle2, AlertCircle, 
  Scale, Bot, Server, RefreshCw, AlertTriangle, Clock, Loader2 
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Listing, NostrIdentity, CoOwner } from '../types';
import { signMessage, sha256, npubToHex } from '../utils/crypto';
import { safeRandomUUID } from '../utils/uuid';
import { isValidNpub } from '../utils/kycAttestation';
import {
  selectBestMediaServer,
  uploadFileXHR,
  SelectedServerResult,
  setSimulatePrimaryOffline,
  getSimulatePrimaryOffline,
  PRIMARY_MEDIA_SERVER_URL
} from '../utils/mediaServer';

export interface BatchUploadItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  previewUrl: string;
  status: 'queued' | 'compressing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  uploadedUrl?: string;
}

const COMPRESSION_SETTINGS = {
  low: { maxWidth: 1200, quality: 0.7 },
  medium: { maxWidth: 800, quality: 0.6 },
  high: { maxWidth: 500, quality: 0.5 },
};

async function compressImage(file: File, level: 'low' | 'medium' | 'high'): Promise<Blob> {
  const { maxWidth, quality } = COMPRESSION_SETTINGS[level];
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      canvas.toBlob((blob) => {
        // Free memory aggressively
        canvas.width = 0;
        canvas.height = 0;
        img.src = '';
        
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob failed'));
      }, 'image/jpeg', quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

interface Props {
  identity: NostrIdentity | null;
  onClose: () => void;
  onAddListing: (listing: Listing) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function HostRegistrationModal({ identity, onClose, onAddListing, onAddLog }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceModel, setPriceModel] = useState<'fixed' | 'dana'>('fixed');
  const [priceSats, setPriceSats] = useState('150000');
  const [locationCoords, setLocationCoords] = useState('');
  const [maxGuests, setMaxGuests] = useState('2');
  const [securitySpecs, setSecuritySpecs] = useState(t('hostReg.defaultSecuritySpecs'));
  const [acceptedKycVerifiersInput, setAcceptedKycVerifiersInput] = useState('');
  const [kycThresholdSatsInput, setKycThresholdSatsInput] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [nip94Urls, setNip94Urls] = useState<string[]>([]);
  const [coOwners, setCoOwners] = useState<CoOwner[]>([
    {
      npub: identity?.npub || '',
      name: identity?.name || t('hostReg.defaultCoOwnerName'),
      share: 100,
      lightningAddress: ''
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'high'>('medium');

  // Media server resilience & individual upload progress state
  const [activeServerInfo, setActiveServerInfo] = useState<SelectedServerResult | null>(null);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [simulateOffline, setSimulateOffline] = useState(getSimulatePrimaryOffline());

  const [coverUploadState, setCoverUploadState] = useState<{
    status: 'idle' | 'compressing' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
  }>({ status: 'idle', progress: 0 });

  const [uploadQueue, setUploadQueue] = useState<BatchUploadItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const nip94FileInputRef = useRef<HTMLInputElement>(null);

  // Initial media server check on modal mount
  useEffect(() => {
    let isMounted = true;
    setIsTestingServer(true);
    selectBestMediaServer()
      .then((res) => {
        if (isMounted) {
          setActiveServerInfo(res);
          setIsTestingServer(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Initial media server probe error:', err);
          setIsTestingServer(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Handler for toggling simulated offline to test automatic fallback
  const handleToggleSimulateOffline = async () => {
    const nextVal = !simulateOffline;
    setSimulateOffline(nextVal);
    setSimulatePrimaryOffline(nextVal);
    setIsTestingServer(true);
    try {
      const res = await selectBestMediaServer();
      setActiveServerInfo(res);
    } catch (err: any) {
      console.warn('Media server probe after toggle failed:', err);
    } finally {
      setIsTestingServer(false);
    }
  };

  // Cover image upload handler with real-time XHR byte progress
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      const msg = t('hostReg.errImgOver10MB') || 'Dung lượng ảnh vượt quá 10MB! Vui lòng chọn ảnh nhỏ hơn.';
      setErrorMsg(msg);
      setCoverUploadState({ status: 'error', progress: 0, error: msg });
      return;
    }

    try {
      setCoverUploadState({ status: 'compressing', progress: 0 });
      setErrorMsg('');

      // Test/select server once for this upload
      let currentServer = activeServerInfo;
      if (!currentServer) {
        currentServer = await selectBestMediaServer();
        setActiveServerInfo(currentServer);
      }

      const compressedBlob = await compressImage(file, compressionLevel);
      setCoverUploadState({ status: 'uploading', progress: 0 });

      const res = await uploadFileXHR(
        currentServer.server.url,
        compressedBlob,
        file.name || 'cover.jpg',
        (info) => {
          setCoverUploadState(prev => ({ ...prev, progress: info.percent }));
        }
      );

      setImageUrl(res.url);
      setCoverUploadState({ status: 'done', progress: 100 });
      setTimeout(() => {
        setCoverUploadState({ status: 'idle', progress: 0 });
      }, 1500);
    } catch (err: any) {
      console.error('Image upload error:', err);
      const errMsg = err.message || 'Lỗi khi tải ảnh bìa lên máy chủ Nostr.';
      setCoverUploadState({ status: 'error', progress: 0, error: errMsg });
      setErrorMsg(errMsg);
    } finally {
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = '';
      }
    }
  };

  // Batch NIP-94 upload handler with item-level queue and real byte progress
  const handleNip94FilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 10) {
      setErrorMsg('Chỉ chọn tối đa 10 ảnh mỗi lần, vui lòng chọn ít hơn.');
      return;
    }

    const fileList = Array.from(files) as File[];

    // Build queued item entries with individual object URL thumbnails
    const newItems: BatchUploadItem[] = fileList.map((file) => {
      const isOverSize = file.size > 10 * 1024 * 1024;
      let previewUrl = '';
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {}
      return {
        id: safeRandomUUID(),
        file,
        fileName: file.name,
        fileSize: file.size,
        previewUrl,
        status: isOverSize ? 'error' : 'queued',
        progress: 0,
        error: isOverSize ? (t('hostReg.errImgOver10MB') || 'Kích thước vượt quá 10MB') : undefined
      };
    });

    setUploadQueue(prev => [...prev, ...newItems]);
    setIsBatchProcessing(true);
    setErrorMsg('');

    // Test/select server ONCE for this entire batch to avoid redundant delays
    let currentServer: SelectedServerResult;
    try {
      currentServer = await selectBestMediaServer();
      setActiveServerInfo(currentServer);
    } catch (serverErr: any) {
      setUploadQueue(prev => prev.map(item => {
        if (newItems.some(ni => ni.id === item.id) && item.status === 'queued') {
          return { ...item, status: 'error', error: serverErr.message || 'Không tìm thấy server media khả dụng' };
        }
        return item;
      }));
      setIsBatchProcessing(false);
      return;
    }

    // Sequentially process each queued item
    for (const item of newItems) {
      if (item.status === 'error') {
        // Individual file failed upfront validation (e.g. >10MB); keep error for this file and continue other files!
        continue;
      }

      // Step 1: Compressing
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'compressing' } : q));
      let compressedBlob: Blob;
      try {
        compressedBlob = await compressImage(item.file, compressionLevel);
      } catch (compErr: any) {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: 'Lỗi nén ảnh: ' + compErr.message } : q));
        continue;
      }

      // Step 2: Uploading via XMLHttpRequest with real-time percentage
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 0 } : q));
      try {
        const res = await uploadFileXHR(
          currentServer.server.url,
          compressedBlob,
          item.file.name || `image_${Date.now()}.jpg`,
          (info) => {
            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: info.percent } : q));
          }
        );

        // Upload success: mark done, immediately append to nip94Urls gallery
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', progress: 100, uploadedUrl: res.url } : q));
        setNip94Urls(prev => [...prev.filter(u => u.trim() !== ''), res.url]);

        // After visual confirmation (1.2s), remove completed item from pending queue so it only lives in uploaded list
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(q => q.id !== item.id));
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }, 1200);
      } catch (uploadErr: any) {
        console.error('Batch item upload error:', uploadErr);
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: uploadErr.message || 'Lỗi tải ảnh' } : q));
      }

      // Delay 300ms to allow mobile browser Garbage Collector to clean up canvas/img memory
      // This prevents the "Aw, Snap!" (OOM Crash) when picking 5-10 huge photos at once
      await new Promise(r => setTimeout(r, 300));
    }

    setIsBatchProcessing(false);
    if (nip94FileInputRef.current) {
      nip94FileInputRef.current.value = '';
    }
  };

  const removeQueueItem = (id: string) => {
    setUploadQueue(prev => {
      const target = prev.find(q => q.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(q => q.id !== id);
    });
  };

  const handleNip94UrlChange = (index: number, value: string) => {
    const newUrls = [...nip94Urls];
    newUrls[index] = value;
    setNip94Urls(newUrls);
  };

  const removeNip94Url = (index: number) => {
    setNip94Urls(prev => prev.filter((_, i) => i !== index));
  };

  const addNip94Url = () => setNip94Urls([...nip94Urls, '']);

  const handleCoOwnerChange = (index: number, field: keyof CoOwner, value: string | number) => {
    const newOwners = [...coOwners];
    newOwners[index] = { ...newOwners[index], [field]: value };
    setCoOwners(newOwners);
  };

  const addCoOwner = () => {
    setCoOwners([...coOwners, { npub: '', name: '', share: 0, lightningAddress: '' }]);
  };

  const removeCoOwner = (index: number) => {
    setCoOwners(coOwners.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!identity) {
      setErrorMsg(t('hostReg.errIdentityReq'));
      return;
    }
    
    // Check if total shares equal 100
    const totalShares = coOwners.reduce((sum, owner) => sum + (Number(owner.share) || 0), 0);
    if (totalShares !== 100) {
      setErrorMsg(t('hostReg.errShares100', { total: totalShares }));
      return;
    }

    if (!title || !description || !priceSats || !locationCoords) {
      setErrorMsg(t('hostReg.errRequiredFields'));
      return;
    }

    // Process RFC-0006 accepted KYC verifiers
    const rawVerifiers = acceptedKycVerifiersInput
      .split(/[\n,;\s]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);

    for (const verifier of rawVerifiers) {
      if (!isValidNpub(verifier)) {
        setErrorMsg(t('hostReg.errInvalidVerifierNpub', { verifier }));
        return;
      }
    }

    const kycThresholdSats = parseInt(kycThresholdSatsInput) || 0;

    setIsSubmitting(true);

    try {
      const listingId = 'list_' + safeRandomUUID().split('-')[0].toUpperCase();
      const payload = `register_${listingId}_${title}_${priceSats}_${identity.npub}`;
      const payloadHash = await sha256(payload);
      const signature = await signMessage(payloadHash, identity);

      // Sign images using NIP-94 mock
      const validUrls = nip94Urls.filter(url => url.trim() !== '');
      const signedImages = [];
      for (const url of validUrls) {
        // Optimize hash input for huge base64 strings to prevent memory spike (OOM)
        const hashTarget = url;
        const hash = await sha256(`nip94_mock_content_hash_${hashTarget}_${Date.now()}`);
        
        // Skip opening external signer 10 times for images. Just use a mock signature to prevent UX freezing.
        const sig = 'sig_mock_' + await sha256(hash + Date.now().toString());
        
        signedImages.push({
          url,
          hash,
          signature: sig,
          uploadedAt: Date.now()
        });
      }

      const basePrice = priceModel === 'dana' ? 0 : parseInt(priceSats) || 0;
      const parsedMaxGuests = parseInt(maxGuests) || 2;
      const specsList = securitySpecs.split(',').map(s => s.trim()).filter(Boolean);
      const mainImg = imageUrl || 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=600&q=80';

      const newListing: Listing = {
        id: listingId,
        title,
        description,
        roomTypes: [
          {
            id: `rt_${safeRandomUUID().slice(0, 8)}`,
            name: title,
            maxGuests: parsedMaxGuests,
            priceSats: basePrice,
            securitySpecs: specsList,
            priceRules: [],
            images: [mainImg],
            status: 'available'
          }
        ],
        priceSats: basePrice,
        priceModel: priceModel,
        maxGuests: parsedMaxGuests,
        meshCoordinates: locationCoords,
        imagePrompt: 'Cypherpunk bunker',
        securitySpecs: specsList,
        acceptedKycVerifiers: rawVerifiers,
        kycThresholdSats: kycThresholdSats,
        status: 'available',
        imageUrl: mainImg,
        images: signedImages,
        reviews: [],
        coOwners: coOwners.map(owner => ({
          ...owner,
          share: Number(owner.share)
        }))
      };

      onAddListing(newListing);
      onAddLog('relay', t('sysLogs.registeredListing', { title }), signature);
      onAddLog('governance', t('sysLogs.setupMultisig', { count: coOwners.length, title }));
      
      onClose();
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      setErrorMsg(`${t('hostReg.errSigning')} — Chi tiết: ${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!identity) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full border border-white/10 rounded-2xl p-6 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <ShieldCheck className="w-12 h-12 text-cyber-amber mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono mb-2">{t('hostReg.identityReqTitle')}</h2>
          <p className="text-sm text-gray-400 mb-6">{t('hostReg.identityReqDesc')}</p>
          <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-mono font-bold uppercase rounded-lg">{t('common.close')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full sm:max-w-2xl border-0 sm:border border-white/10 sm:rounded-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl relative font-sans overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="flex justify-between items-center bg-black/80 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Home className="w-5 h-5 text-cyber-green shrink-0" />
            <h2 className="text-white font-mono font-bold uppercase tracking-wider text-xs sm:text-sm truncate">
              {t('hostReg.title')}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5 pb-10">
          {errorMsg && (
            <div className="p-3 bg-danger/20 border border-danger/30 rounded-lg text-xs font-mono text-danger flex justify-between items-center">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-white/10 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 font-mono pb-4 border-b border-white/5">
            {t('hostReg.descHeader')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1">{t('hostReg.propertyName')}</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Vd: Cypherpunk Bunker #42"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyber-green/50"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1">{t('hostReg.shortDesc')}</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={t('hostReg.phDesc')}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyber-green/50"
                />
              </div>

              {/* Media Server Routing & Resilience Status */}
              <div className="p-3 rounded-xl border text-xs font-mono transition-all space-y-2 bg-black/50 border-white/10 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Server className="w-3.5 h-3.5 text-cyber-blue shrink-0" />
                    <span className="text-[10px] uppercase font-bold text-gray-400">Máy chủ Media (NIP-96):</span>
                    {isTestingServer ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyber-amber">
                        <Loader2 className="w-3 h-3 animate-spin" /> Đang kiểm tra kết nối...
                      </span>
                    ) : activeServerInfo ? (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        activeServerInfo.isFallback
                          ? 'bg-cyber-amber/15 text-cyber-amber border-cyber-amber/30'
                          : 'bg-cyber-green/15 text-cyber-green border-cyber-green/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${activeServerInfo.isFallback ? 'bg-cyber-amber animate-pulse' : 'bg-cyber-green'}`} />
                        {activeServerInfo.server.name} ({activeServerInfo.latency}ms)
                        {activeServerInfo.isFallback && ' [Dự phòng]'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">Chưa kiểm tra</span>
                    )}
                  </div>

                  {/* Dev / Acceptance test toggle: simulate primary offline */}
                  <button
                    type="button"
                    onClick={handleToggleSimulateOffline}
                    className={`text-[9px] px-2 py-0.5 rounded border transition-all flex items-center gap-1 font-mono ${
                      simulateOffline
                        ? 'bg-danger/20 border-danger/40 text-danger hover:bg-danger/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Mô phỏng máy chủ chính bị tắt để kiểm tra tính năng tự động chuyển sang máy chủ dự phòng"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isTestingServer ? 'animate-spin' : ''}`} />
                    <span>{simulateOffline ? '🧪 Server chính: ĐANG TẮT (Giả lập)' : '🧪 Giả lập tắt server chính'}</span>
                  </button>
                </div>

                {/* Clear prominent banner when using fallback */}
                {activeServerInfo?.isFallback && (
                  <div className="p-2 bg-cyber-amber/10 border border-cyber-amber/30 rounded-lg text-[10px] text-cyber-amber flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyber-amber" />
                    <div>
                      <span className="font-bold">Cảnh báo chuyển hướng:</span> {activeServerInfo.warning}
                    </div>
                  </div>
                )}
              </div>

              {/* Cover Image Upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-mono uppercase block">{t('hostReg.coverImg')}</label>
                
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/40 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${(coverUploadState.status === 'compressing' || coverUploadState.status === 'uploading' || isBatchProcessing) ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                      ref={coverFileInputRef}
                      type="file"
                      onChange={handleCoverFileUpload}
                      accept="image/*"
                      className="hidden"
                      disabled={coverUploadState.status === 'compressing' || coverUploadState.status === 'uploading' || isBatchProcessing}
                    />
                    {coverUploadState.status === 'compressing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Nén ảnh bìa...</span>
                      </>
                    ) : coverUploadState.status === 'uploading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Đang tải lên {coverUploadState.progress}%</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>{imageUrl ? 'Đổi ảnh bìa từ tệp' : t('hostReg.uploadFromFile')}</span>
                      </>
                    )}
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-3 py-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-lg text-xs font-mono font-bold transition-all"
                      title={t('hostReg.removeCoverImg')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Cover real-time progress bar */}
                {coverUploadState.status === 'uploading' && (
                  <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-primary/20">
                    <div
                      className="bg-primary h-full transition-all duration-150"
                      style={{ width: `${coverUploadState.progress}%` }}
                    />
                  </div>
                )}

                {coverUploadState.status === 'error' && coverUploadState.error && (
                  <div className="text-[10px] text-danger font-mono flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{coverUploadState.error}</span>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder={imageUrl.startsWith('data:') ? t('hostReg.uploadFromFile') : t('hostReg.phUrl')}
                    readOnly={imageUrl.startsWith('data:')}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-green/50 font-mono"
                  />
                </div>

                {imageUrl && (
                  <div className="relative mt-2 rounded-xl overflow-hidden border border-primary/30 h-32 bg-black/60 group">
                    <img src={imageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-primary border border-primary/40 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> {t('hostReg.previewCover')}
                    </div>
                  </div>
                )}
              </div>

              {/* NIP-94 Signed Images Upload */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-mono uppercase block">{t('hostReg.nip94Img')}</label>

                {/* Image Compression Settings */}
                <div className="flex gap-2 bg-black/40 p-1.5 rounded-lg border border-white/5">
                  <button
                    type="button"
                    onClick={() => setCompressionLevel('high')}
                    className={`flex-1 text-[10px] font-mono py-1 rounded transition-colors ${compressionLevel === 'high' ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Tiết kiệm dữ liệu
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompressionLevel('medium')}
                    className={`flex-1 text-[10px] font-mono py-1 rounded transition-colors ${compressionLevel === 'medium' ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Cân bằng
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompressionLevel('low')}
                    className={`flex-1 text-[10px] font-mono py-1 rounded transition-colors ${compressionLevel === 'low' ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Chất lượng cao
                  </button>
                </div>

                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/40 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${(isBatchProcessing || coverUploadState.status === 'uploading') ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                      ref={nip94FileInputRef}
                      type="file"
                      onChange={handleNip94FilesUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={isBatchProcessing || coverUploadState.status === 'uploading'}
                    />
                    {isBatchProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-cyber-blue" />
                        <span>Đang xử lý tải ảnh...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>{t('hostReg.uploadMultiple')}</span>
                      </>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={addNip94Url}
                    className="px-3 py-2 bg-surface hover:bg-white/10 text-white border border-white/20 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('hostReg.pasteUrl')}</span>
                  </button>
                </div>

                {/* Live Batch Upload Queue with individual progress and status */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-1.5 p-2.5 bg-black/60 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                      <span className="font-bold flex items-center gap-1 text-white">
                        <Clock className="w-3 h-3 text-cyber-blue" />
                        Tiến trình từng ảnh ({uploadQueue.filter(q => q.status === 'done').length}/{uploadQueue.length}):
                      </span>
                      {isBatchProcessing && (
                        <span className="text-cyber-blue text-[9px] animate-pulse">
                          Đang tải lên tuần tự...
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {uploadQueue.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2.5 p-1.5 rounded-lg border text-xs font-mono transition-all ${
                            item.status === 'error'
                              ? 'bg-danger/10 border-danger/30 text-danger'
                              : item.status === 'done'
                              ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green'
                              : item.status === 'uploading'
                              ? 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue'
                              : 'bg-black/40 border-white/5 text-gray-300'
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="w-10 h-10 rounded overflow-hidden bg-black/60 border border-white/10 shrink-0 relative">
                            {item.previewUrl ? (
                              <img src={item.previewUrl} alt={item.fileName} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-full h-full p-2 text-gray-500" />
                            )}
                            {item.status === 'uploading' && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyber-blue" />
                              </div>
                            )}
                          </div>

                          {/* Details & Live Progress */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[11px] font-medium text-white max-w-[130px] sm:max-w-[190px]" title={item.fileName}>
                                {item.fileName}
                              </span>
                              <span className="text-[9px] text-gray-400 shrink-0">
                                {(item.fileSize / 1024).toFixed(0)} KB
                              </span>
                            </div>

                            {/* Status indicator */}
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              {item.status === 'queued' && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Đang chờ...
                                </span>
                              )}
                              {item.status === 'compressing' && (
                                <span className="text-[10px] text-cyber-blue flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Nén ảnh...
                                </span>
                              )}
                              {item.status === 'uploading' && (
                                <span className="text-[10px] text-cyber-blue font-bold flex items-center gap-1">
                                  <span>Đang tải lên {item.progress}%</span>
                                </span>
                              )}
                              {item.status === 'done' && (
                                <span className="text-[10px] text-cyber-green flex items-center gap-1 font-bold">
                                  <CheckCircle2 className="w-3 h-3" /> Đã xong ✓
                                </span>
                              )}
                              {item.status === 'error' && (
                                <span className="text-[10px] text-danger flex items-center gap-1 truncate" title={item.error}>
                                  <AlertTriangle className="w-3 h-3 shrink-0" /> {item.error || 'Lỗi tải ảnh'}
                                </span>
                              )}
                            </div>

                            {/* Live byte-level progress bar */}
                            {item.status === 'uploading' && (
                              <div className="w-full bg-black/60 rounded-full h-1.5 mt-1 overflow-hidden border border-cyber-blue/20">
                                <div
                                  className="bg-cyber-blue h-full transition-all duration-150"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Action button if error */}
                          {item.status === 'error' && (
                            <button
                              type="button"
                              onClick={() => removeQueueItem(item.id)}
                              className="p-1 hover:bg-danger/20 text-danger rounded transition-colors shrink-0"
                              title="Xóa thông báo lỗi này"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thumbnails grid */}
                {nip94Urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto p-1 bg-black/30 rounded-xl border border-white/5">
                    {nip94Urls.map((url, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden border border-border aspect-video bg-black/50">
                        {url.trim() ? (
                          <img src={url} alt={`NIP-94 ${index}`} className="w-full h-full object-cover" />
                        ) : (
                          <input
                            type="url"
                            value={url}
                            onChange={(e) => handleNip94UrlChange(index, e.target.value)}
                            placeholder="https://..."
                            className="w-full h-full bg-black/80 p-1 text-[10px] text-white font-mono focus:outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeNip94Url(index)}
                          className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-danger text-white rounded-full transition-colors"
                          title={t('hostReg.removeThisImg')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[9px] text-gray-500 font-mono">
                  {t('hostReg.nip94Notice')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* RFC-0008 Pricing Model Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-mono uppercase block">
                  {t('hostReg.priceModelLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriceModel('fixed')}
                    className={`py-2 px-3 rounded-lg border text-xs font-mono text-left transition-all ${
                      priceModel === 'fixed'
                        ? 'bg-cyber-amber/20 border-cyber-amber text-cyber-amber font-bold'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{t('hostReg.priceModelFixed')}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriceModel('dana')}
                    className={`py-2 px-3 rounded-lg border text-xs font-mono text-left transition-all ${
                      priceModel === 'dana'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{t('hostReg.priceModelDana')}</span>
                    </div>
                  </button>
                </div>
              </div>

              {priceModel === 'fixed' ? (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1 flex items-center gap-1"><Coins className="w-3 h-3"/> {t('hostReg.pricePerNight')}</label>
                    <input
                      required={priceModel === 'fixed'}
                      type="number"
                      min="1"
                      value={priceSats}
                      onChange={(e) => setPriceSats(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-cyber-amber font-bold focus:outline-none focus:border-cyber-amber/50"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-400 space-y-1">
                  <div className="font-bold">{t('listingDetail.danaBadge')}</div>
                  <p className="text-[11px] text-gray-300">
                    {t('listingDetail.danaExplainer')}
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1 flex items-center gap-1"><Users className="w-3 h-3"/> {t('hostReg.maxGuests')}</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyber-green/50"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> {t('hostReg.gpsCoords')}</label>
                <input
                  required
                  type="text"
                  value={locationCoords}
                  onChange={(e) => setLocationCoords(e.target.value)}
                  placeholder={t('hostReg.phGps')}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyber-green/50"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> {t('hostReg.securitySpecs')}</label>
                <input
                  type="text"
                  value={securitySpecs}
                  onChange={(e) => setSecuritySpecs(e.target.value)}
                  placeholder={t('hostReg.phSecurity')}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyber-green/50"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const tag = 'Agent-Ready (Dedicated SBC, Relay, 50Mbps floor)';
                      if (!securitySpecs.toLowerCase().includes('agent-ready')) {
                        setSecuritySpecs(prev => prev.trim() ? `${prev.trim()}, ${tag}` : tag);
                      }
                    }}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/40 flex items-center gap-1 transition-colors"
                  >
                    <Bot className="w-2.5 h-2.5" /> + RFC-0013 AGENT-READY
                  </button>
                </div>
              </div>

              {/* RFC-0006: Optional KYC Verifiers Declaration */}
              <div className="p-3 bg-cyber-amber/5 border border-cyber-amber/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-cyber-amber font-mono uppercase font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyber-amber" />
                    {t('hostReg.kycVerifierListTitle')}
                  </label>
                </div>
                <p className="text-[9px] text-gray-400 font-mono leading-tight">
                  {t('hostReg.kycVerifierListDesc')}
                </p>
                <textarea
                  rows={2}
                  value={acceptedKycVerifiersInput}
                  onChange={(e) => setAcceptedKycVerifiersInput(e.target.value)}
                  placeholder={t('hostReg.phKycVerifiers')}
                  className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs font-mono text-cyber-amber focus:outline-none focus:border-cyber-amber/50 placeholder:text-gray-600"
                />

                <div>
                  <label className="text-[9px] text-gray-400 font-mono uppercase block mb-1">
                    {t('hostReg.kycThresholdLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={kycThresholdSatsInput}
                    onChange={(e) => setKycThresholdSatsInput(e.target.value)}
                    placeholder={t('hostReg.phKycThreshold')}
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-cyber-amber/50"
                  />
                  <span className="text-[8px] text-gray-500 font-mono block mt-0.5">
                    {t('hostReg.kycThresholdHint')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cổ đông Multisig (Co-Owners) */}
          {(() => {
            const totalShares = coOwners.reduce((sum, owner) => sum + (Number(owner.share) || 0), 0);
            const isTotalValid = totalShares === 100;
            const barColors = ['bg-cyber-blue', 'bg-cyber-amber', 'bg-cyber-green', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500'];

            return (
              <div className="pt-4 mt-6 border-t border-white/5 space-y-4">
                {/* Section Header Card */}
                <div className="p-3.5 sm:p-4 bg-gradient-to-r from-cyber-blue/10 via-black/40 to-black/60 border border-cyber-blue/30 rounded-xl space-y-3.5 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-cyber-blue font-mono uppercase font-bold flex items-center gap-1.5 tracking-wider">
                        <Zap className="w-4 h-4 text-cyber-blue shrink-0 animate-pulse" />
                        {t('hostReg.multisigConfig')}
                      </label>
                      <p className="text-[10px] text-gray-400 font-mono leading-relaxed max-w-xl">
                        {t('hostReg.multisigDesc')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border shadow-sm shrink-0 whitespace-nowrap ${
                        isTotalValid 
                          ? 'bg-cyber-green/15 text-cyber-green border-cyber-green/40' 
                          : 'bg-cyber-amber/15 text-cyber-amber border-cyber-amber/40'
                      }`}>
                        {isTotalValid ? (
                          <CheckCircle2 className="w-3 h-3 text-cyber-green shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-cyber-amber shrink-0" />
                        )}
                        {isTotalValid 
                          ? t('hostReg.totalShareValid') 
                          : t('hostReg.totalShareInvalid', { total: totalShares })}
                      </span>
                      <button
                        type="button"
                        onClick={addCoOwner}
                        className="inline-flex items-center gap-1.5 text-[10px] bg-cyber-blue/20 hover:bg-cyber-blue/30 text-cyber-blue px-3 py-1.5 rounded-lg border border-cyber-blue/40 font-mono font-bold transition-all shrink-0 whitespace-nowrap shadow-sm active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('hostReg.addCoOwner')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Allocation Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono text-gray-400">
                      <span>Allocation Breakdown:</span>
                      <span className={isTotalValid ? 'text-cyber-green font-bold' : 'text-cyber-amber font-bold'}>
                        {totalShares}% / 100%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-black/80 rounded-full overflow-hidden flex p-0.5 border border-white/10 gap-0.5">
                      {coOwners.map((owner, idx) => {
                        const shareVal = Number(owner.share) || 0;
                        if (shareVal <= 0) return null;
                        const colorClass = barColors[idx % barColors.length];
                        return (
                          <div
                            key={idx}
                            style={{ width: `${Math.min(shareVal, 100)}%` }}
                            className={`h-full ${colorClass} rounded-sm transition-all duration-300`}
                            title={`${owner.name || `Co-Owner #${idx + 1}`}: ${shareVal}%`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Co-Owners Cards List */}
                <div className="space-y-4">
                  {coOwners.map((owner, idx) => (
                    <div 
                      key={idx} 
                      className="p-3.5 sm:p-4 bg-black/70 border border-white/10 hover:border-cyber-blue/30 rounded-xl space-y-4 relative group transition-all shadow-md"
                    >
                      {/* Card Header Bar */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
                          <span className="text-[10px] font-mono font-bold text-cyber-blue bg-cyber-blue/10 border border-cyber-blue/30 px-2 py-0.5 rounded-md uppercase flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <Users className="w-3 h-3 text-cyber-blue shrink-0" />
                            <span>{t('hostReg.coOwnerTitle', { index: idx + 1 })}</span>
                          </span>
                          {idx === 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-cyber-green/10 text-cyber-green border border-cyber-green/30 rounded-md font-mono font-semibold shrink-0 whitespace-nowrap">
                              {t('hostReg.defaultCoOwnerName')}
                            </span>
                          )}
                          <span 
                            className="text-xs font-mono font-bold text-white truncate min-w-0 flex-1"
                            title={owner.name || t('hostReg.coOwnerUnassigned')}
                          >
                            {owner.name || t('hostReg.coOwnerUnassigned')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-cyber-amber bg-cyber-amber/10 border border-cyber-amber/30 px-2 sm:px-2.5 py-0.5 rounded-md whitespace-nowrap shadow-sm">
                            {owner.share || 0}%
                          </span>
                          {coOwners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCoOwner(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                              title="Delete Co-Owner"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Input Controls 2x2 Responsive Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. Name / Alias */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-300 font-mono uppercase font-semibold flex items-center gap-1.5">
                            <User className="w-3 h-3 text-cyber-blue shrink-0" />
                            {t('hostReg.coOwnerNameLabel')}
                          </label>
                          <input
                            required
                            type="text"
                            value={owner.name}
                            onChange={e => handleCoOwnerChange(idx, 'name', e.target.value)}
                            placeholder="CypherPunk"
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyber-blue/60 focus:ring-1 focus:ring-cyber-blue/30 placeholder:text-gray-600 transition-all"
                          />
                          <p className="text-[9px] text-gray-500 font-mono">
                            {t('hostReg.coOwnerNameHint')}
                          </p>
                        </div>

                        {/* 2. Share (%) */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-300 font-mono uppercase font-semibold flex items-center gap-1.5">
                            <PieChart className="w-3 h-3 text-cyber-amber shrink-0" />
                            {t('hostReg.coOwnerShareLabel')}
                          </label>
                          <div className="relative">
                            <input
                              required
                              type="number"
                              min="1"
                              max="100"
                              value={owner.share}
                              onChange={e => handleCoOwnerChange(idx, 'share', Number(e.target.value))}
                              className="w-full bg-black/60 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-xs text-cyber-amber font-mono font-bold focus:outline-none focus:border-cyber-amber/60 focus:ring-1 focus:ring-cyber-amber/30 transition-all"
                            />
                            <span className="absolute right-3 top-2 text-xs text-cyber-amber font-mono font-bold select-none pointer-events-none">
                              %
                            </span>
                          </div>
                          <p className="text-[9px] text-gray-500 font-mono">
                            {t('hostReg.coOwnerShareHint')}
                          </p>
                        </div>

                        {/* 3. Lightning Address */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-300 font-mono uppercase font-semibold flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-cyber-blue shrink-0" />
                            {t('hostReg.coOwnerLnLabel')}
                          </label>
                          <input
                            required
                            type="text"
                            value={owner.lightningAddress}
                            onChange={e => handleCoOwnerChange(idx, 'lightningAddress', e.target.value)}
                            placeholder="user@getalby.com"
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-cyber-blue font-mono focus:outline-none focus:border-cyber-blue/60 focus:ring-1 focus:ring-cyber-blue/30 placeholder:text-gray-600 transition-all"
                          />
                          <p className="text-[9px] text-gray-500 font-mono">
                            {t('hostReg.coOwnerLnHint')}
                          </p>
                        </div>

                        {/* 4. Nostr Public Key (npub) */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-300 font-mono uppercase font-semibold flex items-center gap-1.5">
                            <Key className="w-3 h-3 text-gray-400 shrink-0" />
                            {t('hostReg.coOwnerNpubLabel')}
                          </label>
                          <input
                            required
                            type="text"
                            value={owner.npub}
                            onChange={e => handleCoOwnerChange(idx, 'npub', e.target.value)}
                            placeholder="npub1..."
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-cyber-blue/60 focus:ring-1 focus:ring-cyber-blue/30 placeholder:text-gray-600 transition-all"
                          />
                          <p className="text-[9px] text-gray-500 font-mono">
                            {t('hostReg.coOwnerNpubHint')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* RFC-0012: Sovereignty Boundary & Legal Notice */}
          <div className="p-3.5 bg-black/70 border border-cyber-amber/30 rounded-xl space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-cyber-amber">
              <Scale className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wide">
                {t('hostReg.sovereigntyNoticeTitle')}
              </span>
            </div>
            <p className="text-[10px] text-gray-300 font-mono leading-relaxed">
              {t('hostReg.sovereigntyNoticeDesc')}
            </p>
            <div className="pt-1">
              <span className="text-[9px] text-gray-400 font-mono italic">
                📖 {t('hostReg.sovereigntyNoticeDocLink')}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-mono font-bold text-gray-400 hover:text-white uppercase transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isBatchProcessing || coverUploadState.status === 'uploading' || coverUploadState.status === 'compressing'}
              className="px-6 py-2.5 bg-cyber-green hover:bg-cyber-green/80 text-black rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? t('hostReg.signingBtn') : (isBatchProcessing || coverUploadState.status === 'uploading') ? 'Đang tải ảnh...' : t('hostReg.signAndBroadcast')}
            </button>
          </div>
        </form>
        </div>
      </motion.div>
    </div>
  );
}
