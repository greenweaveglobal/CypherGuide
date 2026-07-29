import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, KeyRound, Eye, EyeOff, Save, Trash2, Fingerprint, Download, CheckCircle2, Copy, AlertTriangle, ArrowLeft, LogIn, Sparkles, BrainCircuit, RefreshCw, X, Zap, Landmark, Coins, Info, ChevronDown, ChevronUp, ShieldCheck, FileCode, Share2, Award } from 'lucide-react';
import { NostrIdentity } from '../types';
import { Button } from './ui/Button';
import { Card, CardHeader, CardContent } from './ui/Card';
import { generateNostrIdentity, isNip07Available, loginWithNip07, sha256 } from '../utils/crypto';
import { claimReferralReward, generateReferralCode } from '../utils/referral';
import { nip19, getPublicKey, SimplePool } from 'nostr-tools';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/useAppStore';

interface Props {
  identity: NostrIdentity | null;
  bookings?: any[];
  onIdentityChange: (id: NostrIdentity | null) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function NostrIdentityManager({ identity, onIdentityChange, onAddLog }: Props) {
  const { t } = useTranslation();
  const referrals = useAppStore((state) => state.referrals);
  const claimReferral = useAppStore((state) => state.claimReferral);
  const bookings = useAppStore((state) => state.bookings);

  const [step, setStep] = useState<'connect' | 'generate' | 'backup' | 'verify' | 'ready'>(identity ? 'ready' : 'connect');
  
  // Generation states
  const [name, setName] = useState('');
  const [tempIdentity, setTempIdentity] = useState<NostrIdentity | null>(null);
  const [verifyNsec, setVerifyNsec] = useState('');
  const [showNsec, setShowNsec] = useState(false);
  const [importNsecStr, setImportNsecStr] = useState('');
  const [importMode, setImportMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedKeys, setCopiedKeys] = useState(false);

  const handleSyncProfile = async () => {
    if (!identity) return;
    setIsSyncing(true);
    onAddLog('relay', t('sysLogs.findingKind0', { pubkey: identity.pubKeyHex.slice(0, 8) }));
    
    try {
      const pool = new SimplePool();
      const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
      const event = await pool.get(relays, {
        kinds: [0],
        authors: [identity.pubKeyHex],
      });
      
      if (event) {
        const metadata = JSON.parse(event.content);
        const updatedIdentity = { ...identity };
        if (metadata.name || metadata.display_name) {
          updatedIdentity.name = metadata.display_name || metadata.name;
        }
        if (metadata.picture) updatedIdentity.picture = metadata.picture;
        if (metadata.about) updatedIdentity.about = metadata.about;
        if (metadata.nip05) updatedIdentity.nip05 = metadata.nip05;
        
        onIdentityChange(updatedIdentity);
        onAddLog('relay', t('sysLogs.syncProfileSuccess', { name: updatedIdentity.name }));
        setStatusMsg({ message: t('identity.syncSuccess', { name: updatedIdentity.name }), type: 'success' });
      } else {
        setStatusMsg({ message: t('identity.syncNotFound'), type: 'error' });
        onAddLog('relay', t('sysLogs.kind0NotFound'));
      }
      pool.close(relays);
    } catch (e) {
      console.error(e);
      setStatusMsg({ message: t('identity.syncError'), type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const generateKeys = async () => {
    if (!name.trim()) return;
    setStatusMsg(null);
    try {
      const newIdentity = await generateNostrIdentity(name.trim());
      setTempIdentity(newIdentity);
      setStep('backup');
    } catch (e) {
      console.error(e);
      setStatusMsg({ message: t('identity.genError'), type: 'error' });
    }
  };

  const handleVerify = () => {
    setStatusMsg(null);
    if (tempIdentity && verifyNsec === tempIdentity.nsec) {
      onIdentityChange(tempIdentity);
      onAddLog('relay', t('sysLogs.createdKeys', { name: tempIdentity.name }));
      setStep('ready');
    } else {
      setStatusMsg({ message: t('identity.keyMismatch'), type: 'error' });
    }
  };

  const handleImport = () => {
    setStatusMsg(null);
    try {
      const decoded = nip19.decode(importNsecStr) as any;
      if (decoded.type !== 'nsec') throw new Error("Not an nsec");
      
      const sk = decoded.data as Uint8Array;
      const pk = getPublicKey(sk);
      const npub = nip19.npubEncode(pk);
      
      const imported: NostrIdentity = {
        npub,
        nsec: importNsecStr,
        name: `Imported_${pk.slice(0, 8)}`, 
        pubKeyHex: pk, 
        privKeyHex: Array.from(sk).map(b => b.toString(16).padStart(2, '0')).join('')
      };
      onIdentityChange(imported);
      onAddLog('relay', t('sysLogs.importedSecretKey', { npub: npub.slice(0, 16) }));
      setStep('ready');
    } catch (e) {
      setStatusMsg({ message: t('identity.invalidNsec'), type: 'error' });
    }
  };

  const handleNip07Login = async () => {
    setStatusMsg(null);
    try {
      const nip07Id = await loginWithNip07();
      onIdentityChange(nip07Id);
      onAddLog('relay', t('sysLogs.connectedNip07', { npub: nip07Id.npub.slice(0, 16) }));
      setStep('ready');
    } catch (e: any) {
      setStatusMsg({ message: t('identity.nip07Error', { msg: e.message }), type: 'error' });
    }
  };

  const handleDisconnect = () => {
    if (window.confirm(t('identity.confirmLogout'))) {
      onAddLog('relay', t('sysLogs.loggedOut'));
      onIdentityChange(null);
      setStep('connect');
      setTempIdentity(null);
      setVerifyNsec('');
      setImportMode(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 w-full min-w-0">
      <Card variant="glass">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-primary/10 rounded-xl text-primary border border-primary/20 shrink-0">
            <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold font-mono text-white tracking-wider uppercase break-words">{t('identity.title')}</h2>
            <p className="text-[11px] text-text-secondary font-mono mt-1 leading-relaxed break-words">
              {t('identity.subtitle')}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {statusMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 mb-4 rounded-lg border font-mono text-xs flex justify-between items-center gap-2 overflow-hidden ${
                statusMsg.type === 'error' ? 'bg-danger/20 text-danger border-danger/30' : 'bg-primary/20 text-primary border-primary/30'
              }`}
            >
              <span className="break-all min-w-0 flex-1 leading-normal">{statusMsg.message}</span>
              <button onClick={() => setStatusMsg(null)} className="p-1 hover:bg-white/10 rounded shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 'connect' && (
                <div className="space-y-4">
                  {!importMode ? (
                    <>
                      <Button fullWidth variant="primary" size="lg" onClick={() => setStep('generate')} className="gap-2 text-xs sm:text-sm">
                        <PlusIcon className="w-5 h-5 shrink-0" /> {t('identity.createNew')}
                      </Button>
                      
                      <div className="flex items-center gap-4 py-2">
                        <div className="h-px bg-border flex-1" />
                        <span className="text-xs text-text-secondary font-mono">{t('identity.or')}</span>
                        <div className="h-px bg-border flex-1" />
                      </div>
                      
                      <Button fullWidth variant="outline" size="lg" onClick={() => setImportMode(true)} className="gap-2 text-xs sm:text-sm">
                        <Download className="w-5 h-5 shrink-0" /> {t('identity.importNsec')}
                      </Button>
                      
                      <Button 
                        fullWidth 
                        variant={isNip07Available() ? "primary" : "ghost"} 
                        size="lg" 
                        className={`gap-2 text-xs sm:text-sm ${!isNip07Available() ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={t('identity.nip07Tooltip')}
                        onClick={isNip07Available() ? handleNip07Login : undefined}
                      >
                        <LogIn className="w-5 h-5 shrink-0" /> {t('identity.connectExtension')}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <Button variant="ghost" onClick={() => setImportMode(false)} className="pl-0 gap-2 mb-2 text-text-secondary">
                        <ArrowLeft className="w-4 h-4" /> {t('identity.back')}
                      </Button>
                      <div className="space-y-2">
                        <label className="text-xs font-mono text-text-secondary uppercase">{t('identity.secretKeyLabel')}</label>
                        <input
                          type="password"
                          value={importNsecStr}
                          onChange={(e) => setImportNsecStr(e.target.value)}
                          placeholder="nsec1..."
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 font-mono text-sm"
                        />
                      </div>
                      <Button fullWidth variant="primary" onClick={handleImport}>{t('identity.importNsec')}</Button>
                    </div>
                  )}
                </div>
              )}

              {step === 'generate' && (
                <div className="space-y-6">
                  <Button variant="ghost" onClick={() => setStep('connect')} className="pl-0 gap-2 mb-2 text-text-secondary">
                    <ArrowLeft className="w-4 h-4" /> {t('identity.back')}
                  </Button>
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-text-secondary uppercase">{t('identity.aliasLabel')}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('identity.phAlias')}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 font-mono text-sm"
                    />
                  </div>
                  
                  <Button fullWidth variant="primary" onClick={generateKeys} disabled={!name.trim()}>
                    {t('identity.generateKeys')}
                  </Button>
                </div>
              )}

              {step === 'backup' && tempIdentity && (
                <div className="space-y-6">
                  <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3 text-warning">
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <p className="text-xs leading-relaxed">
                      {t('identity.backupWarning')}
                    </p>
                  </div>

                  <div className="space-y-4 bg-background p-4 rounded-lg border border-border">
                    <div>
                      <span className="text-[10px] font-mono text-text-secondary uppercase block mb-1">{t('identity.pubKeyLabel')}</span>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-surface-active p-2 rounded text-xs text-text-primary break-all border border-border">
                          {tempIdentity.npub}
                        </code>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-warning uppercase block mb-1">{t('identity.privKeyLabel')}</span>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-surface-active p-2 rounded text-xs text-warning break-all border border-warning/20 blur-sm hover:blur-none transition-all cursor-pointer">
                          {tempIdentity.nsec}
                        </code>
                      </div>
                    </div>
                  </div>

                  <Button 
                    fullWidth 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`npub: ${tempIdentity.npub}\nnsec: ${tempIdentity.nsec}`);
                      setStatusMsg({ message: t('identity.copySuccess'), type: "success" });
                    }}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" /> {t('identity.copyKeys')}
                  </Button>

                  <Button fullWidth variant="primary" onClick={() => setStep('verify')}>
                    {t('identity.keysSaved')}
                  </Button>
                </div>
              )}

              {step === 'verify' && tempIdentity && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-text-secondary uppercase">{t('identity.pasteNsecLabel')}</label>
                    <input
                      type="password"
                      value={verifyNsec}
                      onChange={(e) => setVerifyNsec(e.target.value)}
                      placeholder="nsec1..."
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 font-mono text-sm"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => setStep('backup')}>{t('identity.back')}</Button>
                    <Button fullWidth variant="primary" onClick={handleVerify} disabled={!verifyNsec}>
                      {t('identity.confirm')}
                    </Button>
                  </div>
                </div>
              )}

              {step === 'ready' && identity && (
                <div className="space-y-6">
                  <div className="bg-background border border-primary/20 rounded-xl p-3.5 sm:p-6 relative overflow-hidden">
                    <Shield className="absolute -right-4 -bottom-4 w-28 h-28 sm:w-32 sm:h-32 text-primary/5 pointer-events-none" />
                    
                    <div className="relative z-10 space-y-4">
                      <div>
                        <span className="text-[10px] font-mono text-primary block mb-1">{t('identity.activeAlias')}</span>
                        <div className="flex items-center gap-3 sm:gap-4 mb-3">
                          {identity.picture ? (
                            <img src={identity.picture} alt="Profile" className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 border-primary/20 object-cover shrink-0" />
                          ) : (
                            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-surface-active border-2 border-primary/20 flex items-center justify-center shrink-0">
                              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-text-secondary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="text-base sm:text-xl font-bold text-white font-sans flex items-center gap-1.5 truncate">
                              <span className="truncate">{identity.name}</span>
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                            </div>
                            {identity.nip05 && <div className="text-xs text-primary font-mono mt-0.5 truncate">{identity.nip05}</div>}
                            {identity.about && <div className="text-xs text-text-secondary mt-0.5 truncate">{identity.about}</div>}
                          </div>
                        </div>
                        
                        <Button
                          onClick={handleSyncProfile}
                          disabled={isSyncing}
                          variant="secondary"
                          className="w-full text-xs gap-2 py-2 border border-primary/20 hover:border-primary/50 whitespace-normal leading-tight text-center"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? t('identity.syncingProfile') : t('identity.syncProfile')}</span>
                        </Button>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <span className="text-[10px] font-mono text-text-secondary block uppercase">{t('identity.pubKeyLabel')}</span>
                        <div className="bg-surface p-2.5 sm:p-3 rounded border border-border text-[11px] sm:text-xs text-text-secondary font-mono break-all select-all overflow-x-auto max-w-full">
                          {identity.npub}
                        </div>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <span className="text-[10px] font-mono text-accent block uppercase">{t('identity.privKeyLabel')}</span>
                        <div className="relative min-w-0">
                          <div 
                            onClick={() => setShowNsec(!showNsec)}
                            className="bg-surface p-2.5 sm:p-3 rounded border border-accent/20 text-[11px] sm:text-xs text-accent font-mono break-all pr-10 select-all blur-sm hover:blur-none transition-all cursor-pointer max-w-full overflow-hidden"
                          >
                            {showNsec ? identity.nsec : 'nsec1' + '•'.repeat(32)}
                          </div>
                          <button 
                            type="button"
                            onClick={() => setShowNsec(!showNsec)}
                            onMouseEnter={() => setShowNsec(true)}
                            onMouseLeave={() => setShowNsec(false)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-accent p-1 cursor-pointer"
                          >
                            {showNsec ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(`npub: ${identity.npub}\nnsec: ${identity.nsec}`);
                        setCopiedKeys(true);
                        setTimeout(() => setCopiedKeys(false), 2500);
                        setStatusMsg({ message: t('identity.copySuccess'), type: "success" });
                      }}
                      variant={copiedKeys ? "primary" : "outline"}
                      className="flex-1 gap-2 text-xs py-2.5 transition-all"
                    >
                      {copiedKeys ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-cyber-green" />
                          <span>{t('identity.keysCopied')}</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 shrink-0" />
                          <span>{t('identity.backupKeys')}</span>
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleDisconnect}
                      variant="danger"
                      className="flex-1 gap-2 text-xs py-2.5"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" /> {t('identity.logout')}
                    </Button>
                  </div>

                  {/* Lightning Wallet Setup Guidance for Host */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 sm:p-5 bg-black/40 border border-cyber-amber/30 rounded-2xl space-y-3 overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-cyber-amber animate-pulse shrink-0" />
                        <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider break-words">
                          {t('identity.lightningTitle')}
                        </h3>
                      </div>
                      <span className="self-start sm:self-auto text-[9px] bg-cyber-amber/20 text-cyber-amber px-2 py-0.5 rounded font-mono shrink-0">
                        {t('identity.lightningBadge')}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary font-mono leading-relaxed break-words">
                      {t('identity.lightningDesc')}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
                      <div className="p-3 bg-surface rounded-xl border border-border flex flex-col justify-between space-y-2 min-w-0">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5 mb-1 text-xs">
                            <span className="w-2 h-2 rounded-full bg-cyber-green shrink-0"></span>
                            <span>{t('identity.lightningStep1Title')}</span>
                          </div>
                          <p className="text-[10px] text-text-secondary leading-snug">
                            {t('identity.lightningStep1Desc')}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-surface rounded-xl border border-border flex flex-col justify-between space-y-2 min-w-0">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5 mb-1 text-xs">
                            <Landmark className="w-3.5 h-3.5 text-cyber-blue shrink-0" />
                            <span>{t('identity.lightningStep2Title')}</span>
                          </div>
                          <p className="text-[10px] text-text-secondary leading-snug">
                            {t('identity.lightningStep2Desc')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Cypher AI Agent Audit */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3.5 sm:p-6 bg-primary/5 border border-primary/20 rounded-2xl relative overflow-hidden mt-6"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <BrainCircuit className="w-20 h-20 sm:w-24 sm:h-24 text-primary" />
                    </div>
                    
                    <div className="relative z-10 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="w-4 h-4 text-primary shrink-0" />
                          <h3 className="text-xs sm:text-sm font-bold font-mono text-white uppercase tracking-wider break-words">
                            {t('identity.aiAuditTitle')}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAuditDetails(!showAuditDetails)}
                          className="self-start sm:self-auto flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/30 transition-all shrink-0 cursor-pointer"
                        >
                          <Info className="w-3 h-3" />
                          <span>{showAuditDetails ? t('identity.hideLogic') : t('identity.viewLogic')}</span>
                          {showAuditDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-1">
                          <div className="text-[9px] text-text-secondary font-mono uppercase">{t('identity.repScore')}</div>
                          <div className="text-lg sm:text-xl font-bold text-white font-mono">98.2<span className="text-[10px] text-primary/70">/100</span></div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[9px] text-text-secondary font-mono uppercase">{t('identity.govTier')}</div>
                          <div className="text-xs text-primary font-mono font-bold uppercase tracking-wider truncate">Pioneer Council</div>
                        </div>
                      </div>

                      <div className="p-3 bg-black/40 rounded-xl border border-border/50">
                        <p className="text-[10px] text-text-secondary font-mono leading-relaxed italic break-words">
                          {t('identity.aiQuote')}
                        </p>
                      </div>

                      {/* Zero-Knowledge Proof (ZKP) Generator */}
                      <div className="pt-3 border-t border-primary/20 font-mono">
                        <div className="p-3 bg-black/60 rounded-xl border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-cyber-green shrink-0" />
                              <span className="break-words">{t('identity.zkTitle')}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 break-words">
                              {t('identity.zkDesc')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!identity) return;
                              const proofData = `zk_snark_proof_${identity.pubKeyHex}_${Date.now()}`;
                              const proofHash = await sha256(proofData);
                              onAddLog('lock', t('sysLogs.createdZkProof', { proof: proofHash.slice(0, 16) }), proofHash);
                              setStatusMsg({ message: t('identity.zkCreated', { hash: proofHash.slice(0, 12) }), type: 'success' });
                            }}
                            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-cyber-green/10 hover:bg-cyber-green/20 text-cyber-green border border-cyber-green/40 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{t('identity.zkBtn')}</span>
                          </button>
                        </div>
                      </div>

                      {/* RFC-0006 Optional KYC Attestation Layer (Kind 30388) */}
                      <div className="pt-3 border-t border-cyber-amber/20 font-mono">
                        <div className="p-3 bg-black/60 rounded-xl border border-cyber-amber/30 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyber-amber/20 pb-2">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-cyber-amber shrink-0" />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                RFC-0006 KYC Attestation Records (Kind 30388)
                              </span>
                            </div>
                            <span className="text-[9px] bg-cyber-amber/20 text-cyber-amber px-2 py-0.5 rounded border border-cyber-amber/40">
                              {useAppStore.getState().kycAttestations.filter(a => identity && a.subjectNpub === identity.npub).length} Records
                            </span>
                          </div>

                          <p className="text-[10px] text-gray-400 leading-snug">
                            Chứng nhận định danh (Attestation) ký bởi Verifier được ủy quyền. Được lưu trữ dưới dạng Nostr Event Kind 30388 kèm trường thu hồi và hết hạn.
                          </p>

                          {useAppStore.getState().kycAttestations.filter(a => identity && a.subjectNpub === identity.npub).length === 0 ? (
                            <div className="text-[10px] text-gray-500 italic p-2 bg-black/40 rounded text-center border border-white/5">
                              Chưa có KYC Attestation nào được liên kết với nPub này.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {useAppStore.getState().kycAttestations.filter(a => identity && a.subjectNpub === identity.npub).map((att) => (
                                <div key={att.id} className="p-2.5 bg-black/70 rounded-lg border border-white/10 space-y-1.5">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-cyber-amber font-bold flex items-center gap-1">
                                      📜 Kind {att.kind} ({att.verifierStandard})
                                    </span>
                                    <span className="text-success font-mono font-bold">
                                      {att.expiresAt ? `Hết hạn: ${new Date(att.expiresAt * 1000).toLocaleDateString()}` : 'Vĩnh viễn'}
                                    </span>
                                  </div>

                                  <div className="text-[9px] text-gray-400 truncate font-mono">
                                    <span className="text-gray-500">Verifier:</span> {att.verifierNpub}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px]">
                                    <span className="text-gray-500 truncate max-w-[180px]">SIG: {att.signature.slice(0, 16)}...</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (att.rawNostrEventJson) {
                                          navigator.clipboard.writeText(att.rawNostrEventJson);
                                          setStatusMsg({ message: 'Đã sao chép Raw Nostr Event Kind 30388 (JSON)!', type: 'success' });
                                        }
                                      }}
                                      className="text-cyber-blue hover:underline flex items-center gap-0.5"
                                    >
                                      <Copy className="w-2.5 h-2.5" /> Copy JSON
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expandable Explanation & Logic Formula */}
                      <AnimatePresence>
                        {showAuditDetails && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 pt-3 border-t border-primary/20 overflow-hidden font-mono"
                          >
                            <div className="flex items-center gap-2 text-xs font-bold text-white">
                              <ShieldCheck className="w-4 h-4 text-cyber-green shrink-0" />
                              <span>{t('identity.logicTitle')}</span>
                            </div>

                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              {t('identity.logicDesc')}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                              <div className="p-2.5 bg-black/50 rounded-lg border border-white/10 space-y-1 min-w-0">
                                <div className="text-cyber-blue font-bold flex items-center justify-between">
                                  <span>{t('identity.ind1Title')}</span>
                                  <span className="text-primary">30%</span>
                                </div>
                                <p className="text-gray-400 leading-snug">
                                  {t('identity.ind1Desc')}
                                </p>
                              </div>

                              <div className="p-2.5 bg-black/50 rounded-lg border border-white/10 space-y-1 min-w-0">
                                <div className="text-cyber-green font-bold flex items-center justify-between">
                                  <span>{t('identity.ind2Title')}</span>
                                  <span className="text-primary">30%</span>
                                </div>
                                <p className="text-gray-400 leading-snug">
                                  {t('identity.ind2Desc')}
                                </p>
                              </div>

                              <div className="p-2.5 bg-black/50 rounded-lg border border-white/10 space-y-1 min-w-0">
                                <div className="text-cyber-amber font-bold flex items-center justify-between">
                                  <span>{t('identity.ind3Title')}</span>
                                  <span className="text-primary">25%</span>
                                </div>
                                <p className="text-gray-400 leading-snug">
                                  {t('identity.ind3Desc')}
                                </p>
                              </div>

                              <div className="p-2.5 bg-black/50 rounded-lg border border-white/10 space-y-1 min-w-0">
                                <div className="text-purple-400 font-bold flex items-center justify-between">
                                  <span>{t('identity.ind4Title')}</span>
                                  <span className="text-primary">15%</span>
                                </div>
                                <p className="text-gray-400 leading-snug">
                                  {t('identity.ind4Desc')}
                                </p>
                              </div>
                            </div>

                            <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20 space-y-1 min-w-0">
                              <div className="text-[10px] text-white font-bold flex items-center gap-1.5">
                                <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>{t('identity.tiersTitle')}</span>
                              </div>
                              <ul className="text-[10px] text-text-secondary space-y-0.5 pl-4 list-disc">
                                <li>{t('identity.tierPioneer')}</li>
                                <li>{t('identity.tierGuardian')}</li>
                                <li>{t('identity.tierMember')}</li>
                                <li>{t('identity.tierNew')}</li>
                              </ul>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>

                  {/* 1. Referral Sats Real Earnings Dashboard */}
                  <div className="mt-6 p-3.5 sm:p-6 bg-cyber-amber/5 border border-cyber-amber/20 rounded-2xl space-y-4 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-cyber-amber/20 pb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Share2 className="w-5 h-5 text-cyber-amber shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold font-mono text-white uppercase tracking-wider break-words">
                            {t('identity.refTitle')}
                          </h3>
                          <p className="text-[10px] text-gray-400 font-mono break-words">{t('identity.refDesc')}</p>
                        </div>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40 rounded-full font-mono font-bold text-[10px] sm:text-xs shrink-0">
                        {t('identity.refBadge')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
                      <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                        <span className="text-[9px] text-gray-400 block uppercase">{t('identity.refTotalEarned')}</span>
                        <span className="text-base sm:text-lg font-bold text-cyber-amber">
                          {referrals
                            .filter(r => r.referrerNpub === identity?.npub)
                            .reduce((sum, r) => sum + r.rewardSats, 0)
                            .toLocaleString()} SATS
                        </span>
                      </div>

                      <div className="md:col-span-2 p-3 bg-black/50 border border-white/10 rounded-xl space-y-2 min-w-0">
                        <span className="text-[9px] text-gray-400 block uppercase">{t('identity.refLinkLabel')}</span>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                          {(() => {
                            const refUrl = identity?.npub 
                              ? `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname.replace(/\/$/, '') : 'https://cypherguide.org'}/?ref=${identity.npub}`
                              : '';
                            return (
                              <>
                                <input
                                  readOnly
                                  type="text"
                                  value={refUrl}
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                  className="flex-1 min-w-0 bg-black/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-cyber-amber font-mono truncate max-w-full cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (refUrl) {
                                      navigator.clipboard.writeText(refUrl);
                                      setCopiedRef(true);
                                      setTimeout(() => setCopiedRef(false), 3000);
                                      setStatusMsg({ message: t('identity.refCopyToast'), type: 'success' });
                                    }
                                  }}
                                  className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                                    copiedRef
                                      ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/40'
                                      : 'bg-cyber-amber/20 hover:bg-cyber-amber/40 text-cyber-amber'
                                  }`}
                                >
                                  {copiedRef ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyber-green" />
                                      <span>{t('identity.refCopied')}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 shrink-0" />
                                      <span>{t('identity.refCopy')}</span>
                                    </>
                                  )}
                                </button>
                              </>
                            );
                          })()}
                        </div>
                        {copiedRef && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-[11px] text-cyber-green font-mono flex items-center gap-1.5 pt-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyber-green" />
                            <span>{t('identity.refCopyToast')}</span>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Unclaimed referrals list */}
                    <div className="space-y-2 font-mono min-w-0">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">
                        {t('identity.refHistoryTitle', { count: referrals.filter(r => r.referrerNpub === identity?.npub).length })}
                      </span>
                      {referrals.filter(r => r.referrerNpub === identity?.npub).length === 0 ? (
                        <p className="text-[10px] text-gray-500 italic p-3 bg-black/30 rounded-lg border border-white/5 break-words">
                          {t('identity.refHistoryEmpty')}
                        </p>
                      ) : (
                        <div className="space-y-2 min-w-0">
                          {referrals
                            .filter(r => r.referrerNpub === identity?.npub)
                            .map((ref) => (
                              <div key={ref.id} className="p-3 bg-black/60 border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs min-w-0">
                                <div className="min-w-0">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-cyber-amber shrink-0" />
                                    +{ref.rewardSats.toLocaleString()} SATS
                                  </div>
                                  <div className="text-[9px] text-gray-500 truncate">
                                    {t('identity.bookingIdLabel', { id: ref.bookingId, date: new Date(ref.timestamp).toLocaleDateString() })}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  {ref.status === 'claimed' ? (
                                    <span className="text-[10px] text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-2 py-1 rounded font-bold">
                                      {t('identity.claimedBadge')}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const rewardObj = {
                                          id: ref.id,
                                          referrerNpub: ref.referrerNpub,
                                          refereeNpub: ref.refereeNpub,
                                          bookingId: ref.bookingId,
                                          rewardSats: ref.rewardSats,
                                          status: 'pending' as const,
                                          createdAt: ref.timestamp
                                        };
                                        const res = await claimReferralReward(rewardObj, `${identity?.name || 'cypher'}@getalby.com`);
                                        claimReferral(ref.id, res.txHash);
                                        onAddLog('lightning', t('sysLogs.withdrewReferral', { sats: ref.rewardSats.toLocaleString(), txHash: res.txHash }), res.txHash);
                                        setStatusMsg({ message: res.message, type: 'success' });
                                      }}
                                      className="px-3 py-1 bg-cyber-amber text-black hover:bg-cyber-amber/80 rounded font-bold text-[10px] transition-all cursor-pointer w-full sm:w-auto text-center"
                                    >
                                      {t('identity.claimBtn')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Proof-of-Stay Badge Showcase (NIP-58 / SBT) */}
                  <div className="mt-6 p-3.5 sm:p-6 bg-cyber-blue/5 border border-cyber-blue/20 rounded-2xl space-y-4 font-mono overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-cyber-blue/20 pb-3">
                      <Award className="w-5 h-5 text-cyber-blue shrink-0" />
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider break-words">
                          {t('identity.posTitle')}
                        </h3>
                        <p className="text-[10px] text-gray-400 break-words">{t('identity.posDesc')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bookings
                        .filter(b => b.guestNpub === identity?.npub && b.proofOfStayHash)
                        .length === 0 ? (
                          <p className="sm:col-span-2 text-[10px] text-gray-500 italic p-4 bg-black/30 rounded-xl border border-white/5 text-center break-words">
                            {t('identity.posEmpty')}
                          </p>
                        ) : (
                          bookings
                            .filter(b => b.guestNpub === identity?.npub && b.proofOfStayHash)
                            .map((b) => (
                              <div key={b.id} className="p-3 bg-black/60 border border-cyber-blue/30 rounded-xl space-y-2 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-white truncate max-w-[150px]">{b.listingTitle}</span>
                                  <span className="text-[9px] bg-cyber-blue/20 text-cyber-blue px-2 py-0.5 rounded font-bold border border-cyber-blue/30 shrink-0">
                                    NIP-58 SBT
                                  </span>
                                </div>
                                <div className="text-[9px] text-gray-400 space-y-0.5">
                                  <p>{t('identity.timeLabel', { start: b.startDate, end: b.endDate })}</p>
                                  <p className="text-cyber-green font-mono break-all">Hash: {b.proofOfStayHash}</p>
                                </div>
                              </div>
                            ))
                        )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
