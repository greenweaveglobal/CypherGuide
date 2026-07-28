import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Lock, User, Send, Clock, Shield, AlertTriangle, Paperclip, Image as ImageIcon, X, Flame, ShieldCheck, Cpu } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { DirectMessage, NostrIdentity, Booking, Listing } from '../types';
import { signMessage, sha256, encryptNostrMessage, decryptNostrMessage, nsecToHex } from '../utils/crypto';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';

interface Contact {
  npub: string;
  name: string;
  role: string;
  listingTitle: string;
}

interface Props {
  identity: NostrIdentity | null;
  listings: Listing[];
  bookings: Booking[];
  messages: DirectMessage[];
  onSendMessage: (msg: DirectMessage) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function DirectMessages({ identity, listings, bookings, messages, onSendMessage, onAddLog }: Props) {
  const { t } = useTranslation();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [encryptionStandard, setEncryptionStandard] = useState<'NIP-44' | 'NIP-04'>('NIP-44');
  const [ephemeralTTL, setEphemeralTTL] = useState<'none' | '1h' | '24h' | 'read'>('24h');
  const [showProtocolDetails, setShowProtocolDetails] = useState(false);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [sessionNsec, setSessionNsec] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [showNsecUnlockModal, setShowNsecUnlockModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Active identity with optional session-provided privKeyHex
  const activeIdentity: NostrIdentity | null = identity ? {
    ...identity,
    privKeyHex: identity.privKeyHex || (sessionNsec ? nsecToHex(sessionNsec) || '' : '')
  } : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedContact]);

  // Async E2EE Decryption for current conversation
  useEffect(() => {
    if (!activeIdentity || !selectedContact) return;
    let isMounted = true;

    const decryptAll = async () => {
      const newMap: Record<string, string> = {};
      for (const msg of conversationMessages) {
        if (msg.content) {
          let peerPubKey = msg.senderNpub === activeIdentity.npub ? msg.receiverNpub : msg.senderNpub;
          if (peerPubKey.startsWith('npub1')) {
            try {
              const { nip19 } = await import('nostr-tools');
              peerPubKey = (nip19.decode(peerPubKey).data as unknown) as string;
            } catch (e) {}
          }
          const text = await decryptNostrMessage(msg.content, peerPubKey, activeIdentity, encryptionStandard);
          newMap[msg.id] = text;
        }
      }
      if (isMounted) setDecryptedMap(newMap);
    };

    decryptAll();
    return () => { isMounted = false; };
  }, [messages, selectedContact?.npub, activeIdentity?.privKeyHex, sessionNsec, encryptionStandard]);

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert(t('directMessages.imgTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPendingImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUnlockSessionNsec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionNsec.startsWith('nsec1')) {
      alert(t('directMessages.invalidNsecFormat'));
      return;
    }
    setShowNsecUnlockModal(false);
    setSendError(null);
  };

  if (!identity) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-surface border border-border rounded-xl h-[400px]">
        <AlertTriangle className="w-12 h-12 text-text-disabled mb-4" />
        <h3 className="text-lg font-bold font-mono text-white mb-2">{t('directMessages.identityReq')}</h3>
        <p className="text-sm text-text-secondary max-w-md">{t('directMessages.identityReqDesc')}</p>
      </div>
    );
  }

  const contacts = new Map<string, Contact>();
  bookings.forEach(booking => {
    const listing = listings.find(l => l.id === booking.listingId);
    if (!listing) return;

    if (booking.guestNpub === identity.npub) {
      listing.coOwners.forEach(owner => {
        if (owner.npub !== identity.npub) {
          contacts.set(owner.npub, {
            npub: owner.npub,
            name: owner.name,
            role: t('directMessages.roleCoOwner'),
            listingTitle: listing.title
          });
        }
      });
    }

    const isOwner = listing.coOwners.some(co => co.npub === identity.npub);
    if (isOwner && booking.guestNpub !== identity.npub) {
      contacts.set(booking.guestNpub, {
        npub: booking.guestNpub,
        name: t('directMessages.guestName', { id: booking.guestNpub.slice(0, 8) }),
        role: t('directMessages.roleGuest'),
        listingTitle: listing.title
      });
    }
  });

  const contactList = Array.from(contacts.values());
  const conversationMessages = messages.filter(
    m => (m.senderNpub === identity.npub && m.receiverNpub === selectedContact?.npub) || 
         (m.senderNpub === selectedContact?.npub && m.receiverNpub === identity.npub)
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !pendingImage) || !selectedContact || !activeIdentity) return;

    try {
      setSendError(null);
      const messageContent = pendingImage 
        ? (inputText.trim() ? `${inputText.trim()}\n[IMAGE]:${pendingImage}` : `[IMAGE]:${pendingImage}`)
        : inputText.trim();

      // Get recipient hex pubkey
      let recipientPubKeyHex = selectedContact.npub;
      if (selectedContact.npub.startsWith('npub1')) {
        const { nip19 } = await import('nostr-tools');
        recipientPubKeyHex = (nip19.decode(selectedContact.npub).data as unknown) as string;
      }

      // Real Nostr E2EE Encryption (NIP-04 / NIP-44)
      const realCiphertext = await encryptNostrMessage(messageContent, recipientPubKeyHex, activeIdentity, encryptionStandard);

      const timestamp = new Date().toISOString();
      const rawPayload = `msg_${activeIdentity.npub}_${selectedContact.npub}_${timestamp}_${realCiphertext}`;
      const hash = await sha256(rawPayload);
      const signature = await signMessage(hash, activeIdentity);

      const newMessage: DirectMessage = {
        id: `msg_${Date.now()}`,
        senderNpub: activeIdentity.npub,
        receiverNpub: selectedContact.npub,
        content: realCiphertext,
        decryptedContent: messageContent,
        timestamp,
        signature
      };

      onSendMessage(newMessage);
      onAddLog('message', t('directMessages.sendLog', { standard: encryptionStandard, recipient: selectedContact.npub.slice(0, 8), ttl: ephemeralTTL }), signature);
      setInputText('');
      setPendingImage(null);
    } catch (err: any) {
      console.error(err);
      setSendError(err.message || t('directMessages.encryptionErr'));
    }
  };

  return (
    <Card variant="glass" className="flex-1 flex flex-col md:flex-row min-h-0 p-0 overflow-hidden font-sans border-border">
      {/* Contact List */}
      <div className="w-full md:w-1/3 border-r border-border flex flex-col bg-surface-active">
        <div className="p-4 border-b border-border bg-background flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">{t('directMessages.chatHeader')}</h2>
          </div>
          <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
            {encryptionStandard}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {contactList.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-secondary font-mono">
              {t('directMessages.noContactsDesc')}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {contactList.map(contact => (
                <li key={contact.npub}>
                  <button
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full text-left p-4 hover:bg-surface-active transition-colors flex items-start gap-3 ${
                      selectedContact?.npub === contact.npub ? 'bg-surface border-l-2 border-primary' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <div className="bg-background border border-border p-2 rounded-full mt-1 shrink-0">
                      <User className="w-4 h-4 text-text-disabled" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-white truncate">{contact.name}</h4>
                      <p className="text-[10px] text-primary font-mono mb-1">{contact.role} • {contact.listingTitle}</p>
                      <p className="text-[10px] text-text-disabled font-mono truncate">{contact.npub}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background/50">
        {selectedContact ? (
          <>
            {/* Header with Encryption & Ephemeral Options */}
            <div className="p-3 px-4 border-b border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{selectedContact.name}</h3>
                  <span className="text-[9px] font-mono bg-cyber-green/10 text-cyber-green border border-cyber-green/30 px-1.5 py-0.2 rounded flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Secp256k1 E2EE
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary font-mono flex items-center gap-1 mt-0.5">
                  <Lock className="w-3 h-3 text-warning" />
                  <span>{t('directMessages.encryptedChannel')}</span>
                  <span className="text-text-disabled">•</span>
                  <span className="text-primary font-bold">{encryptionStandard}</span>
                </p>
              </div>

              {/* Encryption & Ephemeral Controls */}
              <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-border self-start sm:self-auto">
                {/* Standard Selector */}
                <select
                  value={encryptionStandard}
                  onChange={(e) => setEncryptionStandard(e.target.value as 'NIP-44' | 'NIP-04')}
                  className="bg-background border border-border/60 text-white text-[10px] font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
                  title={t('directMessages.selectEncryption')}
                >
                  <option value="NIP-44">NIP-44 v2 (ChaCha20)</option>
                  <option value="NIP-04">NIP-04 (AES-CBC Legacy)</option>
                </select>

                {/* TTL Selector */}
                <div className="flex items-center gap-1 text-[10px] font-mono text-warning px-1">
                  <Flame className="w-3 h-3" />
                  <select
                    value={ephemeralTTL}
                    onChange={(e) => setEphemeralTTL(e.target.value as any)}
                    className="bg-background border border-border/60 text-warning text-[10px] font-mono rounded-lg px-1.5 py-1 focus:outline-none"
                    title={t('directMessages.ttlTitle')}
                  >
                    <option value="24h">{t('directMessages.ttl24h')}</option>
                    <option value="1h">{t('directMessages.ttl1h')}</option>
                    <option value="read">{t('directMessages.ttlRead')}</option>
                    <option value="none">{t('directMessages.ttlNone')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Encryption Warning & Session Unlock Bar */}
            {!activeIdentity?.privKeyHex && !(window as any).nostr && (
              <div className="bg-warning/10 border-b border-warning/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-warning">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-warning" />
                  <span>
                    {t('directMessages.cypherpunkNotice')}
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowNsecUnlockModal(true)}
                  className="text-[10px] py-1 h-7 border-warning/50 text-warning hover:bg-warning/20 font-bold"
                >
                  {t('directMessages.enterNsecBtn')}
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-disabled space-y-2">
                  <Shield className="w-8 h-8 opacity-20" />
                  <p className="text-xs font-mono">{t('directMessages.startSecureChat')}</p>
                </div>
              ) : (
                conversationMessages.map(msg => {
                  const isMine = msg.senderNpub === activeIdentity?.npub;
                  const decryptedText = decryptedMap[msg.id] || msg.decryptedContent;
                  const hasImage = decryptedText.includes('[IMAGE]:');
                  let textPart = decryptedText;
                  let imgPart = '';
                  if (hasImage) {
                    const parts = decryptedText.split('[IMAGE]:');
                    textPart = parts[0].trim();
                    imgPart = parts[1];
                  }

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl p-3 ${
                        isMine ? 'bg-primary/20 border border-primary/30 text-white rounded-tr-sm' 
                               : 'bg-surface border border-border text-text-primary rounded-tl-sm'
                      }`}>
                        {textPart && <p className="text-sm whitespace-pre-wrap">{textPart}</p>}
                        {imgPart && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-white/20 max-w-xs">
                            <img src={imgPart} alt="Attachment" className="w-full max-h-60 object-cover" />
                          </div>
                        )}
                        <div className="mt-2 pt-1.5 border-t border-white/10 text-[9px] font-mono text-gray-400 break-all select-all">
                          <span className="text-cyber-green font-bold mr-1">🔐 CIPHERTEXT ({encryptionStandard}):</span>
                          <span>{msg.content.slice(0, 48)}...</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <Clock className="w-3 h-3 text-text-disabled" />
                        <span className="text-[9px] text-text-secondary font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-background space-y-2">
              {sendError && (
                <div className="p-2.5 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setShowNsecUnlockModal(true)}
                    className="text-[10px] text-danger underline hover:bg-danger/20"
                  >
                    {t('directMessages.unlockNsecShort')}
                  </Button>
                </div>
              )}
              {pendingImage && (
                <div className="relative inline-block border border-primary/40 rounded-xl overflow-hidden bg-black/50 p-1">
                  <img src={pendingImage} alt="Attachment Preview" className="h-20 w-auto rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="absolute top-1 right-1 bg-black/80 text-white p-1 rounded-full hover:bg-danger transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <input
                  type="file"
                  ref={chatFileInputRef}
                  onChange={handleChatFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-2.5 bg-surface hover:bg-surface-active text-text-secondary hover:text-white border border-border rounded-lg transition-colors"
                  title={t('directMessages.attachImageTitle')}
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={t('directMessages.msgPlaceholder')}
                  className="flex-1 bg-surface border border-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
                <Button
                  type="submit"
                  disabled={!inputText.trim() && !pendingImage}
                  variant="primary"
                  className="px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-disabled space-y-4">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm font-mono">{t('directMessages.noContactSelected')}</p>
          </div>
        )}
      </div>

      {/* Session nsec Unlock Modal */}
      {showNsecUnlockModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface border border-primary/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary font-bold font-mono">
                <ShieldCheck className="w-5 h-5 text-cyber-green" />
                <span>{t('directMessages.unlockModalTitle')}</span>
              </div>
              <button 
                onClick={() => setShowNsecUnlockModal(false)}
                className="text-text-disabled hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              {t('directMessages.unlockModalDesc')}
            </p>

            <form onSubmit={handleUnlockSessionNsec} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">{t('directMessages.nsecSecretKeyLabel')}</label>
                <input
                  type="password"
                  value={sessionNsec}
                  onChange={e => setSessionNsec(e.target.value.trim())}
                  placeholder="nsec1..."
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowNsecUnlockModal(false)}
                >
                  {t('directMessages.cancelBtn')}
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={!sessionNsec.startsWith('nsec1')}
                >
                  {t('directMessages.activateE2EE')}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Card>
  );
}
