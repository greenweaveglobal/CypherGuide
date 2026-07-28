import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Network, SignalHigh, Server, Globe, Zap, 
  Info, Plus, RefreshCw, CheckCircle2, XCircle, ShieldCheck, 
  BookOpen, Layers, Radio, Trash2, Bluetooth, Smartphone, Key, WifiOff, Check, Save, Link2, Cpu
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { getNWCConnectionString, saveNWCConnectionString, removeNWCConnection, parseNWCUrl } from '../utils/nwc';
import { useAppStore } from '../store/useAppStore';
import { calculateNodeIncentiveReward, claimNodeIncentive } from '../utils/infraContribution';
import { useTranslation } from '../hooks/useTranslation';

export interface RelayNode {
  id: string;
  url: string;
  name: string;
  type: 'public_relay' | 'local_mesh' | 'custom_node';
  status: 'connected' | 'testing' | 'offline';
  ping: number; // in ms
  lastChecked: number;
  readOnly?: boolean;
}

interface Props {
  identity: any;
  bookings?: any[];
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

const DEFAULT_RELAYS: RelayNode[] = [
  {
    id: 'relay_damus',
    url: 'wss://relay.damus.io',
    name: 'Damus Core Relay',
    type: 'public_relay',
    status: 'testing',
    ping: -1,
    lastChecked: 0,
    readOnly: true
  },
  {
    id: 'relay_noslol',
    url: 'wss://nos.lol',
    name: 'NOS.LOL Global Relay',
    type: 'public_relay',
    status: 'testing',
    ping: -1,
    lastChecked: 0,
    readOnly: true
  },
  {
    id: 'relay_snort',
    url: 'wss://relay.snort.social',
    name: 'Snort Social Network Node',
    type: 'public_relay',
    status: 'testing',
    ping: -1,
    lastChecked: 0,
    readOnly: true
  },
  {
    id: 'relay_wine',
    url: 'wss://nostr.wine',
    name: 'Nostr Wine High-Speed Node',
    type: 'public_relay',
    status: 'testing',
    ping: -1,
    lastChecked: 0,
    readOnly: true
  },
  {
    id: 'relay_band',
    url: 'wss://relay.nostr.band',
    name: 'Nostr Band Analytics Relay',
    type: 'public_relay',
    status: 'testing',
    ping: -1,
    lastChecked: 0,
    readOnly: true
  },
  {
    id: 'relay_offchain',
    url: 'wss://offchain.pub',
    name: 'Offchain P2P Mesh Gateway',
    type: 'public_relay',
    status: 'testing',
    ping: -1,
    lastChecked: 0,
    readOnly: true
  }
];

export default function MeshNeighborhood({ onAddLog }: Props) {
  const { t } = useTranslation();
  const nodeIncentives = useAppStore((state) => state.nodeIncentives);
  const claimNodeIncentive = useAppStore((state) => state.claimNodeIncentive);

  const [relays, setRelays] = useState<RelayNode[]>(DEFAULT_RELAYS);
  const [isScanning, setIsScanning] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [activeGuideTab, setActiveGuideTab] = useState<'overview' | 'relays' | 'architecture' | 'privacy'>('overview');

  // Nostr Wallet Connect (NWC - NIP-47) State
  const [nwcInput, setNwcInput] = useState(() => getNWCConnectionString() || '');
  const [nwcSaved, setNwcSaved] = useState(() => !!getNWCConnectionString());
  const [nwcStatusMsg, setNwcStatusMsg] = useState('');
  const [rewardToast, setRewardToast] = useState<{ message: string; nodeName: string } | null>(null);

  // BLE & LoRa Hardware Mesh State
  const [bleScanning, setBleScanning] = useState(false);
  const [bleConnectedDevice, setBleConnectedDevice] = useState<string | null>('CypherLock-BLE-v4');
  const [loraFrequency, setLoraFrequency] = useState<'915MHz' | '433MHz' | '868MHz'>('915MHz');
  const loraMeshNodes = [
    { id: 'lora_node_1', name: 'LilyGO T-Beam Gateway #01', rssi: -68, status: 'active', location: t('mesh.loraLoc1') },
    { id: 'lora_node_2', name: 'Heltec V3 Off-grid Mesh Node', rssi: -79, status: 'active', location: t('mesh.loraLoc2') },
    { id: 'lora_node_3', name: 'Meshtastic Repeater Node', rssi: -84, status: 'relay', location: t('mesh.loraLoc3') }
  ];

  // Real WebSocket ping test function
  const testSingleRelay = useCallback((relay: RelayNode): Promise<RelayNode> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let isResolved = false;

      try {
        const ws = new WebSocket(relay.url);
        
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            try { ws.close(); } catch {}
            resolve({
              ...relay,
              status: 'offline',
              ping: -1,
              lastChecked: Date.now()
            });
          }
        }, 4000);

        ws.onopen = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            try { ws.close(); } catch {}
            resolve({
              ...relay,
              status: 'connected',
              ping: latency,
              lastChecked: Date.now()
            });
          }
        };

        ws.onerror = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            try { ws.close(); } catch {}
            resolve({
              ...relay,
              status: 'offline',
              ping: -1,
              lastChecked: Date.now()
            });
          }
        };
      } catch (err) {
        resolve({
          ...relay,
          status: 'offline',
          ping: -1,
          lastChecked: Date.now()
        });
      }
    });
  }, []);

  // Ping all relays connected
  const scanAllRelays = useCallback(async () => {
    setIsScanning(true);
    onAddLog('relay', t('mesh.logTestingWebSocket'));

    const updated = await Promise.all(relays.map(r => testSingleRelay(r)));
    setRelays(updated);
    setIsScanning(false);

    const connectedCount = updated.filter(r => r.status === 'connected').length;
    onAddLog('relay', t('mesh.logScanComplete', { connected: connectedCount, total: updated.length }));
  }, [relays, testSingleRelay, onAddLog, t]);

  useEffect(() => {
    // Initial scan on mount
    scanAllRelays();
    // eslint-disable-next-deps
  }, []);

  const handleAddCustomRelay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    let formattedUrl = customUrl.trim();
    if (!formattedUrl.startsWith('ws://') && !formattedUrl.startsWith('wss://')) {
      formattedUrl = 'wss://' + formattedUrl;
    }

    if (relays.some(r => r.url.toLowerCase() === formattedUrl.toLowerCase())) {
      alert(t('mesh.relayExists'));
      return;
    }

    const newRelay: RelayNode = {
      id: `custom_${Date.now()}`,
      url: formattedUrl,
      name: `Custom Relay (${formattedUrl.replace('wss://', '').replace('ws://', '')})`,
      type: 'custom_node',
      status: 'testing',
      ping: -1,
      lastChecked: Date.now(),
      readOnly: false
    };

    setRelays(prev => [newRelay, ...prev]);
    setCustomUrl('');
    onAddLog('relay', t('mesh.logAddedRelay', { url: formattedUrl }));
    
    // Test the newly added relay
    testSingleRelay(newRelay).then(tested => {
      setRelays(prev => prev.map(r => r.id === tested.id ? tested : r));
    });
  };

  const handleRemoveRelay = (id: string) => {
    setRelays(prev => prev.filter(r => r.id !== id));
    onAddLog('relay', t('mesh.logRemovedRelay'));
  };

  const connectedRelaysCount = relays.filter(r => r.status === 'connected').length;

  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-0 font-sans">
      
      {/* Module Title & Quick Action Bar */}
      <Card variant="glass" className="p-1">
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
          <div>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-white font-mono">
                {t('mesh.title')}
              </h2>
              <Badge variant="success" className="font-mono text-[10px]">REAL-TIME WEBSOCKETS</Badge>
            </div>
            <p className="text-xs text-text-secondary mt-1 font-mono leading-relaxed">
              {t('mesh.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowGuide(!showGuide)}
              variant="outline"
              size="sm"
              className="text-xs font-mono"
            >
              <BookOpen className="w-4 h-4 mr-1.5 text-cyber-blue" />
              {showGuide ? t('mesh.hideGuide') : t('mesh.showGuide')}
            </Button>

            <Button
              onClick={scanAllRelays}
              disabled={isScanning}
              variant={isScanning ? 'outline' : 'primary'}
              size="sm"
              className="text-xs font-mono"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                  {t('mesh.pinging')}
                </>
              ) : (
                <>
                  <SignalHigh className="w-4 h-4 mr-1.5" />
                  {t('mesh.testLatency')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Module Guide Section */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card variant="glass" className="border-primary/30 bg-black/60">
              <CardContent className="p-5 space-y-4 font-mono">
                
                {/* Guide Navigation Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white shrink-0">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>{t('mesh.guideTitle')}</span>
                  </div>

                  <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-[11px] overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
                    <button
                      onClick={() => setActiveGuideTab('overview')}
                      className={`px-3 py-1 rounded-md transition-all shrink-0 whitespace-nowrap ${
                        activeGuideTab === 'overview'
                          ? 'bg-primary text-black font-bold'
                          : 'text-text-secondary hover:text-white'
                      }`}
                    >
                      {t('mesh.tabOverview')}
                    </button>
                    <button
                      onClick={() => setActiveGuideTab('relays')}
                      className={`px-3 py-1 rounded-md transition-all shrink-0 whitespace-nowrap ${
                        activeGuideTab === 'relays'
                          ? 'bg-primary text-black font-bold'
                          : 'text-text-secondary hover:text-white'
                      }`}
                    >
                      {t('mesh.tabRelays')}
                    </button>
                    <button
                      onClick={() => setActiveGuideTab('architecture')}
                      className={`px-3 py-1 rounded-md transition-all shrink-0 whitespace-nowrap ${
                        activeGuideTab === 'architecture'
                          ? 'bg-primary text-black font-bold'
                          : 'text-text-secondary hover:text-white'
                      }`}
                    >
                      {t('mesh.tabArchitecture')}
                    </button>
                    <button
                      onClick={() => setActiveGuideTab('privacy')}
                      className={`px-3 py-1 rounded-md transition-all shrink-0 whitespace-nowrap ${
                        activeGuideTab === 'privacy'
                          ? 'bg-primary text-black font-bold'
                          : 'text-text-secondary hover:text-white'
                      }`}
                    >
                      {t('mesh.tabPrivacy')}
                    </button>
                  </div>
                </div>

                {/* Tab 1: Overview */}
                {activeGuideTab === 'overview' && (
                  <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
                    <p>
                      {t('mesh.overviewP1')}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 bg-surface rounded-xl border border-border space-y-1">
                        <div className="text-cyber-green font-bold flex items-center gap-1.5">
                          <Globe className="w-4 h-4" />
                          <span>{t('mesh.overviewCard1Title')}</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {t('mesh.overviewCard1Desc')}
                        </p>
                      </div>

                      <div className="p-3 bg-surface rounded-xl border border-border space-y-1">
                        <div className="text-cyber-blue font-bold flex items-center gap-1.5">
                          <Radio className="w-4 h-4" />
                          <span>{t('mesh.overviewCard2Title')}</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {t('mesh.overviewCard2Desc')}
                        </p>
                      </div>

                      <div className="p-3 bg-surface rounded-xl border border-border space-y-1">
                        <div className="text-cyber-amber font-bold flex items-center gap-1.5">
                          <Zap className="w-4 h-4" />
                          <span>{t('mesh.overviewCard3Title')}</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {t('mesh.overviewCard3Desc')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Nostr Relays */}
                {activeGuideTab === 'relays' && (
                  <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
                    <p>
                      {t('mesh.relaysP1')}
                    </p>
                    
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-2">
                      <div className="text-white font-bold flex items-center gap-2">
                        <Server className="w-4 h-4 text-cyber-blue" />
                        <span>{t('mesh.relaysCardTitle')}</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-300">
                        <li>{t('mesh.relaysLi1')}</li>
                        <li>{t('mesh.relaysLi2')}</li>
                        <li>{t('mesh.relaysLi3')}</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tab 3: Architecture */}
                {activeGuideTab === 'architecture' && (
                  <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
                    <div className="p-3 bg-surface rounded-xl border border-border space-y-2">
                      <div className="text-white font-bold flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>{t('mesh.archTitle')}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 bg-black/40 rounded border border-white/5">
                          <span className="text-cyber-green font-bold block">Kind 0: Metadata Profile</span>
                          <span className="text-gray-400">{t('mesh.archK0Desc')}</span>
                        </div>
                        <div className="p-2 bg-black/40 rounded border border-white/5">
                          <span className="text-cyber-blue font-bold block">Kind 4: Direct Messages (E2EE)</span>
                          <span className="text-gray-400">{t('mesh.archK4Desc')}</span>
                        </div>
                        <div className="p-2 bg-black/40 rounded border border-white/5">
                          <span className="text-cyber-amber font-bold block">Kind 30001: Lodging Listings</span>
                          <span className="text-gray-400">{t('mesh.archK30001Desc')}</span>
                        </div>
                        <div className="p-2 bg-black/40 rounded border border-white/5">
                          <span className="text-purple-400 font-bold block">Kind 30020: DAO Proposals</span>
                          <span className="text-gray-400">{t('mesh.archK30020Desc')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: Privacy */}
                {activeGuideTab === 'privacy' && (
                  <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
                    <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 space-y-2">
                      <div className="text-white font-bold flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span>{t('mesh.privacyTitle')}</span>
                      </div>
                      <p className="text-[11px] text-gray-300 leading-normal">
                        {t('mesh.privacyDesc')}
                      </p>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Custom Relay Form */}
      <Card variant="glass" className="p-1">
        <CardContent className="p-4">
          <form onSubmit={handleAddCustomRelay} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full relative">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={t('mesh.addRelayPlaceholder')}
                className="w-full bg-surface border border-border focus:border-primary rounded-xl px-4 py-2 text-xs font-mono text-white placeholder:text-text-disabled outline-none transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs font-mono shrink-0"
            >
              <Plus className="w-4 h-4 mr-1 text-primary" />
              {t('mesh.addRelayBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Nostr Wallet Connect (NWC - NIP-47) Integration Panel */}
      <Card variant="glass" className="p-4 font-mono space-y-3 border-cyber-amber/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyber-amber/10 border border-cyber-amber/30 rounded-lg text-cyber-amber">
              <Zap className="w-4 h-4 fill-cyber-amber" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Nostr Wallet Connect (NWC - NIP-47)
              </h3>
              <p className="text-[10px] text-text-secondary">
                {t('mesh.nwcSubtitle')}
              </p>
            </div>
          </div>
          {nwcSaved && (
            <span className="text-[10px] bg-cyber-green/10 text-cyber-green border border-cyber-green/30 px-2 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto">
              <Check className="w-3 h-3" /> {t('mesh.nwcConnected')}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex-1 w-full">
            <input
              type="text"
              value={nwcInput}
              onChange={(e) => {
                setNwcInput(e.target.value);
                setNwcStatusMsg('');
              }}
              placeholder={t('mesh.nwcPlaceholder')}
              className="w-full bg-black/60 border border-border focus:border-cyber-amber rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                const parsed = parseNWCUrl(nwcInput);
                if (parsed) {
                  saveNWCConnectionString(nwcInput);
                  setNwcSaved(true);
                  setNwcStatusMsg(t('mesh.nwcSavedSuccess'));
                  onAddLog('lightning', t('mesh.nwcLogSaved', { pubkey: parsed.walletPubkey.slice(0, 10) }));
                } else {
                  setNwcStatusMsg(t('mesh.nwcInvalid'));
                }
              }}
              className="px-3 py-2 bg-cyber-amber text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-cyber-amber/80 transition-all flex-1 sm:flex-none"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('mesh.nwcSaveBtn')}</span>
            </button>
            {nwcSaved && (
              <button
                type="button"
                onClick={() => {
                  removeNWCConnection();
                  setNwcInput('');
                  setNwcSaved(false);
                  setNwcStatusMsg(t('mesh.nwcUnlinked'));
                  onAddLog('lightning', t('mesh.nwcLogUnlinked'));
                }}
                className="px-3 py-2 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs hover:bg-danger/20 transition-all"
              >
                {t('mesh.nwcRemoveBtn')}
              </button>
            )}
          </div>
        </div>

        {nwcStatusMsg && (
          <p className={`text-[10px] ${nwcSaved ? 'text-cyber-green' : 'text-danger'} font-mono`}>
            {nwcStatusMsg}
          </p>
        )}
      </Card>

      {/* Offline Mesh Hardware: BLE & LoRa Radio Gateway */}
      <Card variant="glass" className="p-4 font-mono space-y-3 border-cyber-blue/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyber-blue/10 border border-cyber-blue/30 rounded-lg text-cyber-blue">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>{t('mesh.meshHardwareTitle')}</span>
                <span className="text-[9px] bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/40 px-1.5 rounded">
                  OFF-GRID MODE
                </span>
              </h3>
              <p className="text-[10px] text-text-secondary">
                {t('mesh.meshHardwareSub')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={loraFrequency}
              onChange={(e) => setLoraFrequency(e.target.value as any)}
              className="bg-black/60 border border-border text-white text-[10px] rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="915MHz">{t('mesh.loraFreqUsVn')}</option>
              <option value="868MHz">{t('mesh.loraFreqEu')}</option>
              <option value="433MHz">{t('mesh.loraFreqAsia')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Bluetooth Low Energy (BLE) Smart Lock Beacon */}
          <div className="p-3 bg-black/50 border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Bluetooth className="w-4 h-4 text-cyber-blue" />
                <span>{t('mesh.bleTitle')}</span>
              </span>
              <span className="text-[9px] text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-1.5 py-0.5 rounded">
                Web Bluetooth Ready
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              {t('mesh.bleDesc')}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[10px] text-text-secondary">
                {t('mesh.recentDevice', { device: bleConnectedDevice })}
              </span>
              <button
                type="button"
                onClick={async () => {
                  setBleScanning(true);
                  onAddLog('lock', t('mesh.bleLogScanning'));
                  setTimeout(() => {
                    setBleScanning(false);
                    onAddLog('lock', t('mesh.bleLogConnected'));
                  }, 1200);
                }}
                disabled={bleScanning}
                className="px-2.5 py-1 bg-cyber-blue/20 hover:bg-cyber-blue/30 text-cyber-blue border border-cyber-blue/40 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
              >
                <Bluetooth className={`w-3 h-3 ${bleScanning ? 'animate-spin' : ''}`} />
                <span>{bleScanning ? t('mesh.bleScanning') : t('mesh.bleScanBtn')}</span>
              </button>
            </div>
          </div>

          {/* LoRa Mesh Radio Topology Nodes */}
          <div className="p-3 bg-black/50 border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyber-amber" />
                <span>{t('mesh.loraTopologyTitle')}</span>
              </span>
              <span className="text-[9px] text-cyber-amber bg-cyber-amber/10 border border-cyber-amber/30 px-1.5 py-0.5 rounded">
                Meshtastic / LilyGO
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              {loraMeshNodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between text-[10px] bg-white/5 p-1.5 rounded border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
                    <span className="text-white font-bold">{node.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{node.location}</span>
                    <span className="text-cyber-amber font-mono">{node.rssi} dBm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Status Bar Summary */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 rounded-xl border border-border text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">{t('mesh.networkStatusLabel')}</span>
          <span className="text-white font-bold">
            {t('mesh.relaysOnline', { connected: connectedRelaysCount, total: relays.length })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-cyber-green text-[11px]">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping inline-block" />
            WebSocket Live
          </span>
        </div>
      </div>

      {/* Real Nostr Relays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relays.map((relay) => {
          const isConnected = relay.status === 'connected';
          const isTesting = relay.status === 'testing';

          return (
            <Card
              key={relay.id}
              variant="glass"
              className="relative overflow-hidden group hover:border-primary/40 transition-all"
            >
              <div
                className={`absolute top-0 right-0 w-1.5 h-full transition-all ${
                  isConnected ? 'bg-cyber-green' : isTesting ? 'bg-cyber-amber' : 'bg-danger/60'
                }`}
              />

              <CardContent className="p-4 space-y-3 font-mono">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className={`p-2 rounded-lg border ${
                      isConnected
                        ? 'bg-cyber-green/10 text-cyber-green border-cyber-green/30'
                        : isTesting
                        ? 'bg-cyber-amber/10 text-cyber-amber border-cyber-amber/30'
                        : 'bg-danger/10 text-danger border-danger/30'
                    }`}>
                      <Server className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h3 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                        {relay.name}
                      </h3>
                      <p className="text-[10px] text-text-secondary truncate mt-0.5">
                        {relay.url}
                      </p>
                    </div>
                  </div>

                  {!relay.readOnly && (
                    <button
                      onClick={() => handleRemoveRelay(relay.id)}
                      className="text-text-secondary hover:text-danger p-1 rounded hover:bg-white/5 transition-colors"
                      title={t('mesh.deleteRelayTitle')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                  <div>
                    <span className="text-text-secondary text-[10px] block">{t('mesh.statusLabel')}</span>
                    {isConnected ? (
                      <span className="text-cyber-green font-bold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
                      </span>
                    ) : isTesting ? (
                      <span className="text-cyber-amber font-bold flex items-center gap-1 mt-0.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('mesh.pingingStatus')}
                      </span>
                    ) : (
                      <span className="text-danger font-bold flex items-center gap-1 mt-0.5">
                        <XCircle className="w-3.5 h-3.5" /> OFFLINE
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-text-secondary text-[10px] block">{t('mesh.latencyLabel')}</span>
                    {isConnected ? (
                      <span className={`font-bold font-mono mt-0.5 block ${
                        relay.ping < 100 ? 'text-cyber-green' : relay.ping < 250 ? 'text-cyber-amber' : 'text-danger'
                      }`}>
                        {relay.ping} ms
                      </span>
                    ) : (
                      <span className="text-text-disabled mt-0.5 block">---</span>
                    )}
                  </div>
                </div>

                {/* Footer action button */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[9px] text-text-disabled">
                    {relay.type === 'public_relay' ? 'Public Nostr Node' : 'Custom Node'}
                  </span>
                  <button
                    onClick={() => {
                      testSingleRelay(relay).then(tested => {
                        setRelays(prev => prev.map(r => r.id === tested.id ? tested : r));
                      });
                    }}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                  >
                    <span>{t('mesh.repingBtn')}</span>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 7. Infrastructure Incentives (Ưu đãi hạ tầng Node & Relay Operators) */}
      <Card variant="glass" className="border-cyber-green/30 bg-cyber-green/5 p-6 mt-8 font-mono">
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-green/20 pb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-6 h-6 text-cyber-green shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {t('mesh.infraTitle')}
                  </h3>
                  <span className="px-2 py-0.5 bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40 rounded text-[9px] font-bold">
                    {t('mesh.demoSim')}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {t('mesh.infraSub')}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-cyber-green/20 text-cyber-green border border-cyber-green/40 rounded-full font-bold text-xs shrink-0">
              REWARD POOL ACTIVE
            </span>
          </div>

          <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/20 rounded-xl text-[11px] text-cyber-blue flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyber-blue" />
            <div>
              <strong>{t('mesh.simModeTitle')}</strong> {t('mesh.simModeDesc')}
            </div>
          </div>

          {rewardToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-cyber-green/20 border border-cyber-green/50 rounded-xl text-xs text-cyber-green font-bold flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-green shrink-0" />
                <span>{rewardToast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setRewardToast(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nodeIncentives.map((node) => (
              <div key={node.id} className="p-4 bg-black/60 border border-white/10 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans">{node.nodeName}</h4>
                    <p className="text-[9px] text-gray-500">Pubkey: {node.nodeNpub.slice(0, 16)}...</p>
                  </div>
                  <span className="text-xs font-bold text-cyber-green flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-cyber-amber" />
                    +{node.earnedSats.toLocaleString()} SATS
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 bg-black/40 p-2.5 rounded-lg border border-white/5">
                  <div>
                    <span>{t('mesh.uptimeLabel')}</span>
                    <span className="text-white font-bold block">{t('mesh.uptimeVal', { hours: node.uptimeHours })}</span>
                  </div>
                  <div>
                    <span>{t('mesh.packetsLabel')}</span>
                    <span className="text-cyber-blue font-bold block">{node.packetsRouted.toLocaleString()} Packets</span>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  {node.status === 'claimed' ? (
                    <span className="text-[10px] text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-3 py-1 rounded font-bold">
                      {t('mesh.claimedReward')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        claimNodeIncentive(node.id);
                        onAddLog('lightning', t('mesh.claimLog', { sats: node.earnedSats.toLocaleString(), node: node.nodeName }));
                        setRewardToast({
                          nodeName: node.nodeName,
                          message: t('mesh.claimToast', { sats: node.earnedSats.toLocaleString(), node: node.nodeName })
                        });
                      }}
                      className="px-4 py-1.5 bg-cyber-green text-black font-bold hover:bg-cyber-green/80 rounded text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {t('mesh.claimBtn')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
