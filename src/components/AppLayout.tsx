import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, KeyRound, Terminal, BookOpen, Compass, Landmark, Network, Menu, X, Zap, HelpCircle, Heart, CookingPot, Sparkles, Navigation, Home, Globe } from 'lucide-react';
import { NostrIdentity } from '../types';
import DonateModal from './DonateModal';
import OnboardingTourModal from './OnboardingTourModal';
import { DocsAssistant } from './DocsAssistant';
import cypherLogo from '../assets/images/cypher_brand_identity_1784773030963.jpg';
import { useTranslation } from '../hooks/useTranslation';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  identity: NostrIdentity | null;
  bookings: any[];
  onAddLog: (type: any, msg: string, hash?: string) => void;
}

const TABS = [
  { id: 'lodgings', label: 'Lưu Trú', icon: BookOpen },
  { id: 'trips', label: 'Chuyến Đi', icon: Compass },
  { id: 'host', label: 'Chủ Nhà', icon: Home },
  { id: 'messages', label: 'Tin Nhắn', icon: Terminal },
  { id: 'governance', label: 'Quản Trị', icon: Landmark },
  { id: 'identity', label: 'Mật Mã', icon: Shield },
  { id: 'mesh', label: 'Mạng Lưới', icon: Network },
  { id: 'guide', label: 'Sổ Tay', icon: HelpCircle },
];

export default function AppLayout({ children, activeTab, setActiveTab, identity, bookings, onAddLog }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showDocsAssistant, setShowDocsAssistant] = useState(false);
  const { t, locale, setLocale } = useTranslation();

  useEffect(() => {
    // Automatically open tour for first-time visitors if not completed yet
    const completed = localStorage.getItem('cypher_tour_completed');
    if (!completed) {
      setShowTour(true);
    }
  }, []);

  const toggleLanguage = () => {
    setLocale(locale === 'vi' ? 'en' : 'vi');
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex font-sans selection:bg-primary/30 selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface h-screen sticky top-0 shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-primary/30 shadow-lg shrink-0">
              <img 
                src={cypherLogo} 
                alt="Cypher Guide Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = '/logo.jpg'; }}
              />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wider font-mono text-white flex items-center gap-2">
                CYPHER GUIDE
              </h1>
              <p className="text-[10px] text-primary/80 font-mono tracking-tight uppercase">v1.1 Core (Cypher Protocol)</p>
            </div>
          </div>
        </div>

        <div className="px-4 mb-2">
          <button
            onClick={() => setShowTour(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-mono font-bold transition-all group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-spin-slow" />
              <span>{t('layout.tourBtn')}</span>
            </div>
            <span className="text-[9px] bg-primary/20 px-1.5 py-0.5 rounded uppercase">{t('layout.start')}</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            let hasNotification = false;
            if (tab.id === 'trips' && bookings.some(b => b.status === 'checked_in')) hasNotification = true;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono font-medium transition-all relative ${
                  isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-text-secondary hover:text-white hover:bg-surface-hover border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />
                {t(`nav.${tab.id}`)}
                {hasNotification && (
                  <span className="absolute right-4 w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          {/* Cypher Protocol Heartbeat */}
          <div className="mb-4 px-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-text-secondary uppercase tracking-widest">{t('layout.protocolHeartbeat')}</span>
              <div className="flex gap-1 h-3 items-end">
                <motion.div 
                  animate={{ height: ['20%', '80%', '20%'] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1 bg-primary rounded-full"
                />
                <motion.div 
                  animate={{ height: ['40%', '60%', '40%'] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-1 bg-primary rounded-full"
                />
                <motion.div 
                  animate={{ height: ['60%', '30%', '60%'] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="w-1 bg-primary rounded-full"
                />
              </div>
            </div>
          </div>

          {identity ? (
            <div className="flex flex-col gap-1 p-3 bg-surface-active rounded-xl border border-border">
              <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                {t('layout.networkStatus')}
              </div>
              <div className="text-sm font-bold truncate">{identity.name}</div>
              <div className="text-[10px] font-mono text-primary/70 truncate">
                {identity.npub.slice(0, 12)}...
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 text-xs font-mono mb-3">
              <span className="w-2 h-2 rounded-full bg-danger"></span>
              <span>{t('layout.noIdConnected')}</span>
            </div>
          )}

          <button 
            onClick={() => setShowDonate(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 text-white border border-primary/50 rounded-xl text-sm font-mono font-bold uppercase transition-all shadow-[0_0_15px_rgba(var(--primary),0.2)] hover:shadow-[0_0_25px_rgba(var(--primary),0.4)]"
          >
            <CookingPot className="w-5 h-5 text-warning" />
            {t('layout.supportDev')}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-surface/90 backdrop-blur-md z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/30 shadow-md shrink-0">
            <img 
              src={cypherLogo} 
              alt="Cypher Guide Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.src = '/logo.jpg'; }}
            />
          </div>
          <h1 className="font-bold font-mono tracking-wider text-xs sm:text-sm truncate">CYPHER GUIDE</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-hover hover:bg-primary/20 text-text-primary border border-border/60 rounded-xl text-xs font-mono font-bold transition-all"
            title={t('layout.language')}
          >
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="uppercase">{locale}</span>
          </button>

          <button
            onClick={() => setShowDonate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/40 rounded-xl text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.25)] active:scale-95"
          >
            <CookingPot className="w-4 h-4 text-warning animate-pulse" />
            <span>{t('layout.donateShort')}</span>
          </button>

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-text-secondary hover:text-white"
            aria-label={t('layout.toggleMenu')}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-background/95 backdrop-blur-lg z-40 p-4 border-b border-border overflow-y-auto">
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowTour(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-primary/10 text-primary border border-primary/30 rounded-xl text-sm font-mono font-bold"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>{t('layout.tourFullTitle')}</span>
              </div>
              <span className="text-xs bg-primary/20 px-2 py-0.5 rounded">{t('layout.start')}</span>
            </button>

            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono font-medium transition-all ${
                    isActive 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-text-secondary'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {t(`nav.${tab.id}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 border-b border-border items-center justify-between px-8 shrink-0 bg-background/80 backdrop-blur-md z-10">
          <div className="text-sm font-mono text-text-secondary flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span>{t('layout.protocolActive')}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            {/* Language Switcher Button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover hover:bg-primary/20 text-text-primary border border-primary/30 rounded-xl font-bold transition-all shadow-sm hover:border-primary/60"
              title={t('layout.language')}
            >
              <Globe className="w-4 h-4 text-primary" />
              <span className="uppercase text-xs font-mono tracking-wider">{locale === 'vi' ? 'VI (Tiếng Việt)' : 'EN (English)'}</span>
            </button>

            <button
              onClick={() => setShowDonate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-warning/15 hover:bg-warning/25 text-warning border border-warning/50 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95"
            >
              <CookingPot className="w-5 h-5 text-warning animate-pulse" />
              <span>{t('layout.supportDev')}</span>
            </button>

            <button
              onClick={() => setShowTour(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl font-bold transition-all shadow-sm hover:shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            >
              <Navigation className="w-4 h-4 text-primary" />
              <span>{t('layout.tourExplore')}</span>
            </button>
            <span className="text-text-secondary pl-2 border-l border-border/40">P2P:</span>
            <span className="text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20 font-bold">{t('layout.operational')}</span>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto pt-16 md:pt-0 w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-6">
          <div className="w-full main-view-wrapper min-w-0">
            {children}
          </div>
        </div>

        {/* System Status Bar */}
        <footer className="h-8 border-t border-border/40 bg-surface/80 backdrop-blur-sm flex items-center justify-between px-3 text-[9px] sm:text-[10px] font-mono tracking-wider shrink-0 z-20 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1 text-text-secondary/80">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0"></span>
              <span>{t('layout.sync')}</span>
            </div>
            <div className="flex items-center gap-1 text-text-secondary/80">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0"></span>
              <span>{t('layout.relays')}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-text-secondary/70 border-l border-border/30 pl-3">
              {t('layout.block')}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-text-secondary/60 shrink-0">
            <span className="hidden xs:inline">{t('layout.uptime')}</span>
            <span className="hidden md:inline text-primary/40">{t('layout.cypherProtocol')}</span>
            <button
              onClick={() => setShowDocsAssistant(true)}
              className="flex items-center gap-1 hover:text-primary transition-colors font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 active:scale-95"
              title={t('docsAssistant.title')}
            >
              <Sparkles className="w-3 h-3 text-primary shrink-0" />
              <span>{t('docsAssistant.navButton')}</span>
            </button>
            <button onClick={() => setShowDonate(true)} className="flex items-center gap-1 hover:text-warning transition-colors font-bold text-white px-1 py-0.5 rounded bg-warning/10 border border-warning/30 sm:bg-transparent sm:border-0">
              <CookingPot className="w-3 h-3 text-warning shrink-0" />
              <span>{t('layout.donateShort')}</span>
            </button>
          </div>
        </footer>
      </main>

      {showDonate && (
        <DonateModal onClose={() => setShowDonate(false)} onAddLog={onAddLog} />
      )}

      <OnboardingTourModal
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <DocsAssistant
        isOpen={showDocsAssistant}
        onClose={() => setShowDocsAssistant(false)}
      />
    </div>
  );
}
