import React from 'react';
import { HelpCircle, Terminal, KeyRound, Landmark, Zap, RefreshCw, ShieldCheck, Award, Share2, Cpu, Coins, Sparkles, Network } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export default function Guide() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 font-mono">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
        <div className="p-3 bg-primary/10 rounded-2xl border border-primary/30 text-primary">
          <Network className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-wider">{t('guide.title')}</h2>
          <p className="text-xs text-text-secondary italic">{t('guide.subtitle')}</p>
        </div>
      </div>

      {/* Overview Banner */}
      <div className="p-5 bg-black/60 border border-primary/30 rounded-2xl space-y-2 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <span className="text-[10px] text-cyber-green font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyber-green/10 border border-cyber-green/30 inline-block">
          {t('guide.badge7Pillars')}
        </span>
        <h3 className="text-sm font-bold text-white">
          {t('guide.overviewTitle')}
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          {t('guide.overviewDesc')}
        </p>
      </div>

      {/* 7 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1 */}
        <div className="p-5 bg-surface border border-border hover:border-cyber-amber/40 rounded-2xl space-y-3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyber-amber/10 text-cyber-amber rounded-xl border border-cyber-amber/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-cyber-amber uppercase font-bold">PILLAR 01</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p1.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p1.desc')}
          </p>
          <div className="text-[10px] text-cyber-amber bg-cyber-amber/10 px-2.5 py-1 rounded-lg border border-cyber-amber/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p1.uiLoc')}
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="p-5 bg-surface border border-border hover:border-cyber-blue/40 rounded-2xl space-y-3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyber-blue/10 text-cyber-blue rounded-xl border border-cyber-blue/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-cyber-blue uppercase font-bold">PILLAR 02</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p2.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p2.desc')}
          </p>
          <div className="text-[10px] text-cyber-blue bg-cyber-blue/10 px-2.5 py-1 rounded-lg border border-cyber-blue/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p2.uiLoc')}
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="p-5 bg-surface border border-border hover:border-cyber-green/40 rounded-2xl space-y-3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyber-green/10 text-cyber-green rounded-xl border border-cyber-green/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-cyber-green uppercase font-bold">PILLAR 03</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p3.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p3.desc')}
          </p>
          <div className="text-[10px] text-cyber-green bg-cyber-green/10 px-2.5 py-1 rounded-lg border border-cyber-green/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p3.uiLoc')}
          </div>
        </div>

        {/* Pillar 4 */}
        <div className="p-5 bg-surface border border-border hover:border-primary/40 rounded-2xl space-y-3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-primary uppercase font-bold">PILLAR 04</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p4.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p4.desc')}
          </p>
          <div className="text-[10px] text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p4.uiLoc')}
          </div>
        </div>

        {/* Pillar 5 */}
        <div className="p-5 bg-surface border border-border hover:border-cyber-amber/40 rounded-2xl space-y-3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyber-amber/10 text-cyber-amber rounded-xl border border-cyber-amber/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-cyber-amber uppercase font-bold">PILLAR 05</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p5.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p5.desc')}
          </p>
          <div className="text-[10px] text-cyber-amber bg-cyber-amber/10 px-2.5 py-1 rounded-lg border border-cyber-amber/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p5.uiLoc')}
          </div>
        </div>

        {/* Pillar 6 */}
        <div className="p-5 bg-surface border border-border hover:border-purple-500/40 rounded-2xl space-y-3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-purple-400 uppercase font-bold">PILLAR 06</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p6.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p6.desc')}
          </p>
          <div className="text-[10px] text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p6.uiLoc')}
          </div>
        </div>

        {/* Pillar 7 */}
        <div className="p-5 bg-surface border border-border hover:border-cyber-green/40 rounded-2xl space-y-3 transition-all md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyber-green/10 text-cyber-green rounded-xl border border-cyber-green/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] text-cyber-green uppercase font-bold">PILLAR 07</span>
              <h4 className="text-xs font-bold text-white uppercase">{t('guide.pillars.p7.title')}</h4>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('guide.pillars.p7.desc')}
          </p>
          <div className="text-[10px] text-cyber-green bg-cyber-green/10 px-2.5 py-1 rounded-lg border border-cyber-green/20 font-bold">
            {t('guide.uiLocPrefix')}{t('guide.pillars.p7.uiLoc')}
          </div>
        </div>
      </div>

      {/* Protocol DNA Philosophy */}
      <div className="p-6 bg-surface-hover border border-border rounded-2xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
          <Zap className="w-4 h-4" />
          {t('guide.philosophyTitle')}
        </div>
        <p className="text-xs text-text-secondary leading-relaxed italic">
          {t('guide.philosophyQuote')}
        </p>
      </div>
    </div>
  );
}
