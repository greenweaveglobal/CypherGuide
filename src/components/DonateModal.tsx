import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Heart, Zap, Coins, Check, Copy, CookingPot, Edit2, Save, Banknote, Sparkles, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui/Button';
import { Card, CardHeader, CardContent } from './ui/Card';
import { generateBolt11, isWebLNAvailable, payViaWebLN } from '../utils/lightning';
import { generateCashuToken, redeemCashuToken } from '../utils/cashu';
import { payInvoiceViaNWC, getNWCConnectionString } from '../utils/nwc';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../store/useAppStore';

interface Props {
  onClose: () => void;
  onAddLog: (type: any, message: string, hash?: string) => void;
}

export default function DonateModal({ onClose, onAddLog }: Props) {
  const { t } = useTranslation();
  const { devLnAddress, setDevLnAddress, identity } = useAppStore();
  const MARKETING_NPUB = "npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh";

  const [amount, setAmount] = useState<number>(21000);
  const [invoice, setInvoice] = useState('');
  const [cashuToken, setCashuToken] = useState('');
  const [inputCashu, setInputCashu] = useState('');
  const [payMethod, setPayMethod] = useState<'lightning' | 'cashu'>('lightning');
  const [isPaying, setIsPaying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState(devLnAddress);

  const AMOUNTS = [1000, 21000, 100000, 1000000];

  const handleGenerateInvoice = () => {
    const inv = generateBolt11(amount, 'Donation to Developer V4V');
    const token = generateCashuToken(amount, 'https://mint.cashu.space', 'Quyengop V4V');
    setInvoice(inv);
    setCashuToken(token);
    onAddLog('lightning', t('donate.logCreateInvoice', { amount }));
  };

  const handlePayCashu = async (tokenToUse?: string) => {
    const target = tokenToUse || inputCashu || cashuToken;
    if (!target) return;
    setIsPaying(true);
    setErrorMsg('');
    
    onAddLog('lightning', t('donate.logSendingCashu'));
    const result = await redeemCashuToken(target);
    if (result.success) {
      setIsSuccess(true);
      onAddLog('relay', t('donate.logCashuSuccess', { sats: result.totalSats }), target.slice(0, 16));
    } else {
      setErrorMsg(result.error || t('donate.errInvalidToken'));
      setIsPaying(false);
    }
  };

  const handlePayNWC = async () => {
    const savedNwc = getNWCConnectionString();
    if (!savedNwc) {
      setErrorMsg(t('donate.errNoNwc'));
      return;
    }
    setIsPaying(true);
    setErrorMsg('');
    onAddLog('lightning', t('donate.logNwcZapSignal'));
    
    const result = await payInvoiceViaNWC(savedNwc, invoice);
    if (result.success) {
      setIsSuccess(true);
      onAddLog('relay', t('donate.logNwcSuccess', { amount }), result.preimage);
    } else {
      setErrorMsg(result.error || t('donate.errNwcFailed'));
      setIsPaying(false);
    }
  };

  const handlePay = async () => {
    setIsPaying(true);
    setErrorMsg('');
    
    if (isWebLNAvailable()) {
      onAddLog('lightning', t('donate.logWebLNActive'));
      const result = await payViaWebLN(invoice);
      
      if (result.success) {
        setIsSuccess(true);
        onAddLog('relay', t('donate.logWebLNSuccess', { amount }), result.preimage);
      } else {
        setErrorMsg(result.error || t('donate.errPaymentRejected'));
        setIsPaying(false);
      }
    } else {
      setErrorMsg(t('donate.errInstallWallet'));
      onAddLog('lightning', t('donate.logNoWebLNErr'));
      setIsPaying(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card variant="glass" className="border-primary/50 text-center py-12">
            <CardContent className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-warning/20 rounded-full flex items-center justify-center border border-warning">
                <CookingPot className="w-10 h-10 text-warning animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-mono text-white">{t('donate.thankYou')}</h2>
                <p className="text-sm text-text-secondary">
                  {t('donate.subtitle')} ({amount.toLocaleString()} Sats)
                </p>
              </div>
              <Button onClick={onClose} variant="primary" className="mt-4">
                {t('myTrips.cancelBtn')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card variant="glass" className="relative max-h-[90vh] overflow-y-auto">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-text-secondary hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <CardHeader>
            <div className="flex items-center gap-3">
              <CookingPot className="w-6 h-6 text-warning" />
              <div>
                <h2 className="text-lg font-bold font-mono text-warning">{t('donate.title')}</h2>
                <p className="text-xs text-text-secondary font-mono mt-1">{t('donate.subtitle')}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4 border-t border-border/50">
            {!invoice ? (
              <div className="space-y-6">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t('donate.subtitle')}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt)}
                      className={`p-3 rounded-lg border font-mono text-sm transition-all ${
                        amount === amt 
                          ? 'bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.2)]'
                          : 'bg-surface border-border text-text-secondary hover:border-primary/50 hover:text-white'
                      }`}
                    >
                      {amt.toLocaleString()} <span className="text-[10px]">Sats</span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-mono text-text-secondary uppercase mb-2 block">{t('donate.amountLabel')}</label>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min="1"
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-lg font-mono text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  />
                </div>

                <Button 
                  onClick={handleGenerateInvoice} 
                  variant="primary" 
                  fullWidth
                  className="py-4 text-sm uppercase tracking-widest bg-warning hover:bg-warning/80 text-black border-warning"
                >
                  <CookingPot className="w-4 h-4 mr-2" /> {t('donate.generateInvoice')}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Method selector tab */}
                <div className="flex bg-surface p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setPayMethod('lightning')}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      payMethod === 'lightning' ? 'bg-primary text-black font-bold' : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{t('donate.methodLightning')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('cashu')}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      payMethod === 'cashu' ? 'bg-cyber-blue text-black font-bold' : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>{t('donate.methodCashu')}</span>
                  </button>
                </div>

                {payMethod === 'lightning' ? (
                  <>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold text-white font-mono">{amount.toLocaleString()} Sats</h3>
                      <p className="text-xs text-text-secondary">{t('donate.invoiceReady')}</p>
                    </div>

                    <div className="flex justify-center bg-white p-4 rounded-xl">
                      <QRCodeSVG 
                        value={invoice} 
                        size={200}
                        level="L"
                        includeMargin={false}
                      />
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

                    <Button
                      type="button"
                      onClick={handlePayNWC}
                      disabled={isPaying}
                      className="w-full py-2.5 bg-cyber-amber text-black font-bold text-xs uppercase font-mono hover:bg-cyber-amber/80 flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-4 h-4 fill-black" />
                      <span>{t('donate.payNWC')}</span>
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center space-y-1">
                      <span className="text-[10px] font-mono bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Zero-Knowledge Ecash
                      </span>
                      <h3 className="text-xl font-bold text-white font-mono">{amount.toLocaleString()} Sats</h3>
                    </div>

                    <div className="p-3 bg-black/60 rounded-xl border border-cyber-blue/30 space-y-2">
                      <p className="text-[10px] text-gray-400 font-mono">Cashu Token {amount.toLocaleString()} Sats:</p>
                      <div className="p-2 bg-white/5 rounded text-[9px] text-cyber-blue font-mono break-all max-h-20 overflow-y-auto border border-white/10 select-all">
                        {cashuToken}
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePayCashu(cashuToken)}
                      disabled={isPaying}
                      variant="primary"
                      fullWidth
                      className="py-3 bg-cyber-blue text-black font-bold text-xs uppercase font-mono border-cyber-blue"
                    >
                      <Sparkles className="w-4 h-4 mr-2" /> {t('donate.payCashuBtn')}
                    </Button>

                    <div className="pt-2 border-t border-border space-y-2">
                      <label className="text-[10px] font-mono text-text-secondary block">{t('donate.cashuInputPlaceholder')}</label>
                      <input
                        type="text"
                        value={inputCashu}
                        onChange={(e) => setInputCashu(e.target.value)}
                        placeholder="cashuA..."
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-blue"
                      />
                      {inputCashu && (
                        <Button
                          onClick={() => handlePayCashu(inputCashu)}
                          disabled={isPaying}
                          variant="secondary"
                          fullWidth
                          className="py-2.5 text-xs font-mono"
                        >
                          {t('donate.payCashuBtn')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-center space-y-2">
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest font-mono">LN Address</p>
                  {isEditingAddress ? (
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="text"
                        value={tempAddress}
                        onChange={(e) => setTempAddress(e.target.value)}
                        className="bg-surface border border-border rounded px-2 py-1 text-xs text-white font-mono outline-none w-48 focus:border-primary/50"
                        placeholder="user@wallet.com"
                      />
                      <button 
                        onClick={() => {
                          setDevLnAddress(tempAddress);
                          setIsEditingAddress(false);
                          onAddLog('governance', `Updated donation LN address to: ${tempAddress}`);
                        }}
                        className="p-1.5 bg-primary/20 hover:bg-primary/40 text-primary rounded transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-xs font-mono text-primary">{devLnAddress}</p>
                      <button 
                        onClick={() => {
                          if (identity?.npub === MARKETING_NPUB || identity?.npub === "npub1developer...") {
                             setTempAddress(devLnAddress);
                             setIsEditingAddress(true);
                          } else {
                            setErrorMsg(t('donate.unauthorized'));
                          }
                        }}
                        className="text-text-secondary hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
                    {errorMsg}
                  </div>
                )}

                <div className="flex gap-2 sm:gap-3 items-center pt-2">
                  <Button 
                    variant="outline" 
                    className="px-4 py-2.5 text-xs font-mono font-bold uppercase shrink-0" 
                    onClick={() => setInvoice('')}
                  >
                    {t('donate.backBtn')}
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-mono font-bold uppercase flex items-center justify-center gap-1.5 min-w-0 overflow-hidden" 
                    onClick={handlePay}
                    disabled={isPaying}
                  >
                    {isPaying ? (
                      <span className="animate-pulse text-xs truncate">{t('donate.processing')}</span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5 text-xs sm:text-sm truncate">
                        <CookingPot className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t('donate.payWebLN')}</span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
