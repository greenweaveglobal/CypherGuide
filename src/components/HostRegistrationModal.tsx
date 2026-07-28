import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Coins, Users, ShieldCheck, Home, Zap, Upload, Image as ImageIcon, Trash2, Plus, Check } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Listing, NostrIdentity, CoOwner } from '../types';
import { signMessage, sha256 } from '../utils/crypto';

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
  const [priceSats, setPriceSats] = useState('150000');
  const [locationCoords, setLocationCoords] = useState('');
  const [maxGuests, setMaxGuests] = useState('2');
  const [securitySpecs, setSecuritySpecs] = useState('Kết nối Cypherpunk, Thanh toán Bitcoin Lightning');
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
        priceSats: parseInt(priceSats),
        maxGuests: parseInt(maxGuests),
        meshCoordinates: locationCoords,
        imagePrompt: 'Cypherpunk bunker',
        securitySpecs: securitySpecs.split(',').map(s => s.trim()),
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
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1 flex items-center gap-1"><Coins className="w-3 h-3"/> {t('hostReg.pricePerNight')}</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={priceSats}
                    onChange={(e) => setPriceSats(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-cyber-amber font-bold focus:outline-none focus:border-cyber-amber/50"
                  />
                </div>
              </div>

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
            </div>
          </div>

          {/* Cổ đông Multisig (Co-Owners) */}
          <div className="pt-4 mt-6 border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1 flex items-center gap-1 text-cyber-blue"><Zap className="w-3 h-3"/> {t('hostReg.multisigConfig')}</label>
                <p className="text-[9px] text-gray-500 font-mono">{t('hostReg.multisigDesc')}</p>
              </div>
              <button type="button" onClick={addCoOwner} className="text-[10px] bg-cyber-blue/10 text-cyber-blue hover:bg-cyber-blue/20 px-3 py-1.5 rounded border border-cyber-blue/30 font-mono transition-colors">
                {t('hostReg.addCoOwner')}
              </button>
            </div>
            
            <div className="space-y-3">
              {coOwners.map((owner, idx) => (
                <div key={idx} className="p-3 bg-black/40 border border-white/10 rounded-lg relative group">
                  {coOwners.length > 1 && (
                    <button type="button" onClick={() => removeCoOwner(idx)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="text-[9px] text-gray-500 font-mono uppercase block mb-1">{t('hostReg.nameOrAlias')}</label>
                      <input required type="text" value={owner.name} onChange={e => handleCoOwnerChange(idx, 'name', e.target.value)} placeholder="CypherPunk" className="w-full bg-transparent border-b border-white/10 p-1 text-xs text-white focus:outline-none focus:border-cyber-blue/50" />
                    </div>
                    <div className="col-span-12 sm:col-span-8">
                      <label className="text-[9px] text-gray-500 font-mono uppercase block mb-1">Npub (Nostr ID)</label>
                      <input required type="text" value={owner.npub} onChange={e => handleCoOwnerChange(idx, 'npub', e.target.value)} placeholder="npub1..." className="w-full bg-transparent border-b border-white/10 p-1 text-xs text-gray-400 font-mono focus:outline-none focus:border-cyber-blue/50" />
                    </div>
                    <div className="col-span-12 sm:col-span-9">
                      <label className="text-[9px] text-gray-500 font-mono uppercase block mb-1">{t('hostReg.lnAddress')}</label>
                      <input required type="text" value={owner.lightningAddress} onChange={e => handleCoOwnerChange(idx, 'lightningAddress', e.target.value)} placeholder="user@getalby.com" className="w-full bg-transparent border-b border-white/10 p-1 text-xs text-cyber-blue font-mono focus:outline-none focus:border-cyber-blue/50" />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-[9px] text-gray-500 font-mono uppercase block mb-1">{t('hostReg.sharePercent')}</label>
                      <input required type="number" min="1" max="100" value={owner.share} onChange={e => handleCoOwnerChange(idx, 'share', Number(e.target.value))} className="w-full bg-transparent border-b border-white/10 p-1 text-xs text-cyber-amber font-mono font-bold focus:outline-none focus:border-cyber-amber/50" />
                    </div>
                  </div>
                </div>
              ))}
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
