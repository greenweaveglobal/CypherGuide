import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Coins, Users, ShieldCheck, Home, Zap, Upload, Image as ImageIcon, Trash2, Plus, Check, User, Percent, Key, PieChart, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Listing, NostrIdentity, CoOwner } from '../types';
import { signMessage, sha256, npubToHex } from '../utils/crypto';
import { isValidNpub } from '../utils/kycAttestation';

interface Props {
  identity: NostrIdentity | null;
  onClose: () => void;
  onAddListing: (listing: Listing) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance', message: string, hash?: string) => void;
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

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const nip94FileInputRef = useRef<HTMLInputElement>(null);

  // File upload handlers
  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(t('hostReg.errImgOver10MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNip94FilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(t('hostReg.errSomeImgOver10MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const dataUrl = event.target.result as string;
          setNip94Urls((prev) => [...prev.filter(u => u.trim() !== ''), dataUrl]);
        }
      };
      reader.readAsDataURL(file);
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
      const listingId = 'list_' + crypto.randomUUID().split('-')[0].toUpperCase();
      const payload = `register_${listingId}_${title}_${priceSats}_${identity.npub}`;
      const payloadHash = await sha256(payload);
      const signature = await signMessage(payloadHash, identity);

      // Sign images using NIP-94 mock
      const validUrls = nip94Urls.filter(url => url.trim() !== '');
      const signedImages = await Promise.all(validUrls.map(async (url) => {
        const hash = await sha256(`nip94_mock_content_hash_${url}_${Date.now()}`);
        const sig = await signMessage(hash, identity);
        return {
          url,
          hash,
          signature: sig,
          uploadedAt: Date.now()
        };
      }));

      const newListing: Listing = {
        id: listingId,
        title,
        description,
        priceSats: priceModel === 'dana' ? 0 : parseInt(priceSats) || 0,
        priceModel: priceModel,
        maxGuests: parseInt(maxGuests),
        meshCoordinates: locationCoords,
        imagePrompt: 'Cypherpunk bunker',
        securitySpecs: securitySpecs.split(',').map(s => s.trim()),
        acceptedKycVerifiers: rawVerifiers,
        kycThresholdSats: kycThresholdSats,
        status: 'available',
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=600&q=80',
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
      setErrorMsg(t('hostReg.errSigning'));
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel max-w-2xl w-full border border-white/10 rounded-2xl p-6 relative my-8"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <Home className="w-6 h-6 text-cyber-green" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider font-mono">{t('hostReg.title')}</h2>
        </div>

        {errorMsg && (
          <div className="p-3 mb-6 bg-danger/20 border border-danger/30 rounded-lg text-xs font-mono text-danger flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-white/10 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 font-mono mb-6 pb-4 border-b border-white/5">
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

              {/* Cover Image Upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-mono uppercase block">{t('hostReg.coverImg')}</label>
                <input
                  type="file"
                  ref={coverFileInputRef}
                  onChange={handleCoverFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/40 rounded-lg text-xs font-mono font-bold transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('hostReg.uploadFromFile')}</span>
                  </button>
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

                <div className="relative">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder={t('hostReg.phUrl')}
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
                
                <input
                  type="file"
                  ref={nip94FileInputRef}
                  onChange={handleNip94FilesUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => nip94FileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/40 rounded-lg text-xs font-mono font-bold transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('hostReg.uploadMultiple')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={addNip94Url}
                    className="px-3 py-2 bg-surface hover:bg-white/10 text-white border border-white/20 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('hostReg.pasteUrl')}</span>
                  </button>
                </div>

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
                <div className="p-4 bg-gradient-to-r from-cyber-blue/10 via-black/40 to-black/60 border border-cyber-blue/30 rounded-xl space-y-3.5 shadow-lg">
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
                    <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border shadow-sm ${
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
                        <Plus className="w-3.5 h-3.5" />
                        {t('hostReg.addCoOwner')}
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
                      className="p-4 bg-black/70 border border-white/10 hover:border-cyber-blue/30 rounded-xl space-y-4 relative group transition-all shadow-md"
                    >
                      {/* Card Header Bar */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-cyber-blue bg-cyber-blue/10 border border-cyber-blue/30 px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                            <Users className="w-3 h-3 text-cyber-blue" />
                            {t('hostReg.coOwnerTitle', { index: idx + 1 })}
                          </span>
                          {idx === 0 && (
                            <span className="text-[9px] px-2 py-0.5 bg-cyber-green/10 text-cyber-green border border-cyber-green/30 rounded-md font-mono font-semibold">
                              {t('hostReg.defaultCoOwnerName')}
                            </span>
                          )}
                          <span className="text-xs font-mono font-bold text-white ml-1 truncate max-w-[150px] sm:max-w-xs">
                            {owner.name || t('hostReg.coOwnerUnassigned')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-cyber-amber bg-cyber-amber/10 border border-cyber-amber/30 px-2.5 py-0.5 rounded-md">
                            {owner.share || 0}%
                          </span>
                          {coOwners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCoOwner(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-cyber-green hover:bg-cyber-green/80 text-black rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? t('hostReg.signingBtn') : t('hostReg.signAndBroadcast')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
