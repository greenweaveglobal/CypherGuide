import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Wifi, ShieldCheck, Zap, Radio, Send } from 'lucide-react';
import { P2PLog, NostrIdentity } from '../types';
import { signMessage, sha256 } from '../utils/crypto';
import { useTranslation } from '../hooks/useTranslation';

interface Props {
  logs: P2PLog[];
  identity: NostrIdentity | null;
  bookings?: any[];
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance', message: string, hash?: string) => void;
}

export default function RelayLogs({ logs, identity, onAddLog }: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'relay' | 'lightning' | 'lock' | 'governance'>('all');
  const [inputText, setInputText] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter((log) => filter === 'all' || log.type === filter);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !identity) return;

    try {
      const msg = inputText.trim();
      const timestampSec = Math.floor(Date.now() / 1000);
      
      // Structure standard Nostr Event Kind 1
      const nostrEvent = {
        pubkey: identity.pubKeyHex,
        created_at: timestampSec,
        kind: 1,
        tags: [['client', 'MeshHaven']],
        content: msg
      };

      const eventString = JSON.stringify(nostrEvent);
      const eventHash = await sha256(eventString);
      const signature = await signMessage(eventHash, identity);

      onAddLog('relay', t('relayLogs.broadcastMsg', { name: identity.name, msg }), eventHash);
      onAddLog('relay', t('relayLogs.sigLabel', { sig: signature.slice(0, 30) }), signature);
      onAddLog('relay', t('relayLogs.eventIdLabel', { id: eventHash.slice(0, 20) }));
      
      setInputText('');
    } catch (err) {
      console.error(err);
    }
  };

  const getLogTypeStyles = (type: string) => {
    switch (type) {
      case 'relay':
        return { color: 'text-cyber-green', label: 'MESH', icon: <Wifi className="w-3 h-3 inline mr-1" /> };
      case 'lightning':
        return { color: 'text-cyber-amber', label: 'LN⚡', icon: <Zap className="w-3 h-3 inline mr-1" /> };
      case 'lock':
        return { color: 'text-cyber-blue', label: 'LOCK🔑', icon: <ShieldCheck className="w-3 h-3 inline mr-1" /> };
      case 'governance':
        return { color: 'text-purple-400', label: 'CONTRACT📜', icon: <Radio className="w-3 h-3 inline mr-1" /> };
      default:
        return { color: 'text-gray-400', label: 'SYSTEM', icon: null };
    }
  };

  return (
    <div className="glass-panel rounded-xl p-4 md:p-5 border border-white/10 font-mono text-[10px] md:text-xs flex flex-col min-h-[150px] h-[350px] md:h-[550px]">
      {/* Console Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyber-green animate-pulse" id="terminal-pulse-icon" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">{t('relayLogs.title')}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'relay', 'lightning', 'lock', 'governance'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                filter === t 
                  ? 'bg-cyber-green text-black' 
                  : 'bg-cyber-gray text-gray-500 hover:text-white hover:bg-white/5'
              }`}
              id={`log-filter-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 select-text text-gray-300">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-600 text-center py-10 italic font-mono uppercase tracking-widest text-[9px]">
            {t('relayLogs.empty')}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const style = getLogTypeStyles(log.type);
            return (
              <div key={log.id} className="hover:bg-white/5 px-2 py-1 rounded leading-relaxed border-l-2 border-transparent hover:border-cyber-green/30">
                <span className="text-gray-500 text-[10px] mr-2">[{log.timestamp}]</span>
                <span className={`${style.color} font-bold mr-2 text-[10px]`}>
                  {style.icon}
                  {style.label}
                </span>
                <span className="text-gray-100">{log.message}</span>
                {log.hash && (
                  <span className="block text-[10px] text-gray-500 mt-0.5 ml-14 font-semibold overflow-x-hidden text-ellipsis">
                    hash: {log.hash}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Broadcast Panel */}
      {identity && (
        <form onSubmit={handleBroadcast} className="flex gap-2 border-t border-white/5 pt-3 mt-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('relayLogs.broadcastPlaceholder')}
            className="flex-1 bg-cyber-black text-cyber-green border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyber-green/50 placeholder-gray-600 font-mono"
            id="broadcast-input-field"
          />
          <button
            type="submit"
            className="p-2 bg-cyber-green/10 hover:bg-cyber-green text-cyber-green hover:text-black rounded-lg border border-cyber-green/20 transition-all"
            title={t('relayLogs.broadcastTitle')}
            id="broadcast-submit-btn"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
