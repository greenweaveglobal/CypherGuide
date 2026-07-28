import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, BookOpen, Compass, Terminal, Landmark, Network, HelpCircle, 
  ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2, Lightbulb, Cpu
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export interface TourStep {
  id: string;
  tabId?: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  description: string;
  keyFeatures: string[];
  userRoleHint: string;
}

export function useTourSteps(): TourStep[] {
  const { t } = useTranslation();
  return [
    {
      id: 'welcome',
      title: t('tour.steps.welcome.title'),
      subtitle: t('tour.steps.welcome.subtitle'),
      icon: Shield,
      badge: t('tour.steps.welcome.badge'),
      badgeColor: 'bg-primary/20 text-primary border-primary/30',
      description: t('tour.steps.welcome.description'),
      keyFeatures: [
        t('tour.steps.welcome.feat1'),
        t('tour.steps.welcome.feat2'),
        t('tour.steps.welcome.feat3')
      ],
      userRoleHint: t('tour.steps.welcome.userRoleHint')
    },
    {
      id: 'lodgings',
      tabId: 'lodgings',
      title: t('tour.steps.lodgings.title'),
      subtitle: t('tour.steps.lodgings.subtitle'),
      icon: BookOpen,
      badge: t('tour.steps.lodgings.badge'),
      badgeColor: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
      description: t('tour.steps.lodgings.description'),
      keyFeatures: [
        t('tour.steps.lodgings.feat1'),
        t('tour.steps.lodgings.feat2'),
        t('tour.steps.lodgings.feat3')
      ],
      userRoleHint: t('tour.steps.lodgings.userRoleHint')
    },
    {
      id: 'trips',
      tabId: 'trips',
      title: t('tour.steps.trips.title'),
      subtitle: t('tour.steps.trips.subtitle'),
      icon: Compass,
      badge: t('tour.steps.trips.badge'),
      badgeColor: 'bg-cyber-green/20 text-cyber-green border-cyber-green/30',
      description: t('tour.steps.trips.description'),
      keyFeatures: [
        t('tour.steps.trips.feat1'),
        t('tour.steps.trips.feat2'),
        t('tour.steps.trips.feat3')
      ],
      userRoleHint: t('tour.steps.trips.userRoleHint')
    },
    {
      id: 'messages',
      tabId: 'messages',
      title: t('tour.steps.messages.title'),
      subtitle: t('tour.steps.messages.subtitle'),
      icon: Terminal,
      badge: t('tour.steps.messages.badge'),
      badgeColor: 'bg-cyber-amber/20 text-cyber-amber border-cyber-amber/30',
      description: t('tour.steps.messages.description'),
      keyFeatures: [
        t('tour.steps.messages.feat1'),
        t('tour.steps.messages.feat2'),
        t('tour.steps.messages.feat3')
      ],
      userRoleHint: t('tour.steps.messages.userRoleHint')
    },
    {
      id: 'governance',
      tabId: 'governance',
      title: t('tour.steps.governance.title'),
      subtitle: t('tour.steps.governance.subtitle'),
      icon: Landmark,
      badge: t('tour.steps.governance.badge'),
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      description: t('tour.steps.governance.description'),
      keyFeatures: [
        t('tour.steps.governance.feat1'),
        t('tour.steps.governance.feat2'),
        t('tour.steps.governance.feat3')
      ],
      userRoleHint: t('tour.steps.governance.userRoleHint')
    },
    {
      id: 'identity',
      tabId: 'identity',
      title: t('tour.steps.identity.title'),
      subtitle: t('tour.steps.identity.subtitle'),
      icon: Shield,
      badge: t('tour.steps.identity.badge'),
      badgeColor: 'bg-primary/20 text-primary border-primary/30',
      description: t('tour.steps.identity.description'),
      keyFeatures: [
        t('tour.steps.identity.feat1'),
        t('tour.steps.identity.feat2'),
        t('tour.steps.identity.feat3')
      ],
      userRoleHint: t('tour.steps.identity.userRoleHint')
    },
    {
      id: 'mesh',
      tabId: 'mesh',
      title: t('tour.steps.mesh.title'),
      subtitle: t('tour.steps.mesh.subtitle'),
      icon: Network,
      badge: t('tour.steps.mesh.badge'),
      badgeColor: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
      description: t('tour.steps.mesh.description'),
      keyFeatures: [
        t('tour.steps.mesh.feat1'),
        t('tour.steps.mesh.feat2'),
        t('tour.steps.mesh.feat3')
      ],
      userRoleHint: t('tour.steps.mesh.userRoleHint')
    },
    {
      id: 'guide',
      tabId: 'guide',
      title: t('tour.steps.guide.title'),
      subtitle: t('tour.steps.guide.subtitle'),
      icon: HelpCircle,
      badge: t('tour.steps.guide.badge'),
      badgeColor: 'bg-cyber-green/20 text-cyber-green border-cyber-green/30',
      description: t('tour.steps.guide.description'),
      keyFeatures: [
        t('tour.steps.guide.feat1'),
        t('tour.steps.guide.feat2'),
        t('tour.steps.guide.feat3')
      ],
      userRoleHint: t('tour.steps.guide.userRoleHint')
    }
  ];
}

export default function OnboardingTourModal({ isOpen, onClose, activeTab, setActiveTab }: OnboardingTourModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { t } = useTranslation();
  const tourSteps = useTourSteps();

  if (!isOpen) return null;

  const currentStep = tourSteps[currentStepIndex];
  const Icon = currentStep.icon;
  const isLastStep = currentStepIndex === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      if (tourSteps[nextIdx].tabId) {
        setActiveTab(tourSteps[nextIdx].tabId!);
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      if (tourSteps[prevIdx].tabId) {
        setActiveTab(tourSteps[prevIdx].tabId!);
      }
    }
  };

  const handleJumpToStep = (idx: number) => {
    setCurrentStepIndex(idx);
    if (tourSteps[idx].tabId) {
      setActiveTab(tourSteps[idx].tabId!);
    }
  };

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem('cypher_tour_completed', 'true');
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col bg-surface border border-primary/40 rounded-2xl shadow-[0_0_50px_rgba(var(--primary),0.2)] overflow-hidden font-sans"
        >
          {/* Header Bar */}
          <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-black/60">
            <div className="flex items-center gap-2 font-mono text-xs truncate pr-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
              <span className="text-white font-bold uppercase tracking-wider truncate text-[11px] sm:text-xs">
                {t('tour.headerTitle')}
              </span>
              <span className="text-text-secondary text-[10px] shrink-0 font-bold">
                ({t('tour.stepIndicator', { current: currentStepIndex + 1, total: tourSteps.length })})
              </span>
            </div>
            <button
              onClick={handleComplete}
              className="p-1.5 text-text-secondary hover:text-white rounded-lg bg-surface-hover hover:bg-white/10 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="shrink-0 w-full bg-black/80 h-1.5 flex">
            {tourSteps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => handleJumpToStep(idx)}
                className={`h-full flex-1 transition-all border-r border-black/40 ${
                  idx === currentStepIndex
                    ? 'bg-primary'
                    : idx < currentStepIndex
                    ? 'bg-primary/50'
                    : 'bg-white/10'
                }`}
                title={step.title}
              />
            ))}
          </div>

          {/* Body Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-primary/10 border border-primary/30 text-primary rounded-xl shrink-0 shadow-inner">
                  <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${currentStep.badgeColor}`}>
                      {currentStep.badge}
                    </span>
                    {currentStep.tabId && (
                      <span className="text-[10px] font-mono text-text-secondary bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        Tab ID: {currentStep.tabId}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-bold font-mono text-white tracking-wide">
                    {currentStep.title}
                  </h2>
                  <p className="text-[11px] sm:text-xs font-mono text-primary/80">
                    {currentStep.subtitle}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm font-mono text-text-secondary leading-relaxed bg-black/30 p-3.5 sm:p-4 rounded-xl border border-white/5">
              {currentStep.description}
            </p>

            {/* Key Features List */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-warning" />
                <span>{t('tour.highlightsTitle')}</span>
              </div>
              <div className="space-y-1.5">
                {currentStep.keyFeatures.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs font-mono text-text-primary">
                    <CheckCircle2 className="w-4 h-4 text-cyber-green shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* User Role Hint */}
            <div className="p-3 bg-surface-active rounded-xl border border-border flex items-center gap-2.5 font-mono text-xs text-text-secondary">
              <Cpu className="w-4 h-4 text-cyber-blue shrink-0" />
              <span>{currentStep.userRoleHint}</span>
            </div>
          </div>

          {/* Footer Controls - Fixed at Bottom */}
          <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-black/60 backdrop-blur-sm">
            <label className="flex items-center gap-2 text-xs font-mono text-text-secondary cursor-pointer hover:text-white transition-colors w-full sm:w-auto">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-border bg-surface text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-[11px] sm:text-xs">{t('tour.dontShowAgain')}</span>
            </label>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 bg-surface-hover hover:bg-white/10 text-text-secondary hover:text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 border border-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t('tour.backBtn')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 bg-primary text-black hover:bg-primary/90 font-mono font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] flex items-center justify-center gap-1.5"
              >
                <span>{isLastStep ? t('tour.exploreBtn') : t('tour.nextBtn')}</span>
                {isLastStep ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
