import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { motion, AnimatePresence } from 'motion/react';
import { X, Volume2, VolumeX, Sparkles, Flame, Eye, EyeOff, RotateCcw, Info, Heart } from 'lucide-react';
import { Button } from './ui/Button';

interface StillnessRitualProps {
  isOpen: boolean;
  onClose: () => void;
  listingTitle?: string;
}

// Japanese Keisu / Inkin bronze bell synthesis using Web Audio API
// Rich non-harmonic inharmonic metallic overtones with natural exponential decay.
//
// Fundamental frequency chosen arbitrarily (622 Hz) for acoustic timbre only —
// deliberately NOT 432/528/639/... (Solfeggio) or any frequency
// associated with unverified "healing" claims. See RFC-0010.
function playKeisuBell(strikeCount: number = 1) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Inharmonic overtone spectrum for cast bronze bowl/bell:
    // Base 622Hz with non-integer ratios (1.0, ~1.43, ~2.08, ~2.76, ~3.42, ~4.89)
    const frequencies = [622.0, 889.6, 1293.8, 1716.8, 2127.3, 3039.3];
    const relativeGains = [0.8, 0.55, 0.4, 0.25, 0.15, 0.08];
    const decayTimes = [5.0, 4.2, 3.4, 2.6, 1.8, 1.2];

    const playSingleStrike = (startTime: number) => {
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Fundamental tone is pure sine, upper overtones contain slight triangle harmonics
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.997, startTime + decayTimes[idx]);

        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.linearRampToValueAtTime(relativeGains[idx] * 0.22, startTime + 0.012); // strike attack
        gainNode.gain.exponentialRampToValueAtTime(0.00001, startTime + decayTimes[idx]);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + decayTimes[idx]);
      });
    };

    for (let i = 0; i < strikeCount; i++) {
      playSingleStrike(ctx.currentTime + i * 2.4);
    }
  } catch (err) {
    console.warn('Audio playback not supported or blocked by browser policy:', err);
  }
}

const LOCAL_STORAGE_KEY = 'stillness_ritual_personal_sessions';
const TOTAL_DURATION_SECONDS = 369;

export default function StillnessRitual({ isOpen, onClose, listingTitle }: StillnessRitualProps) {
  const { t } = useTranslation();

  // Ritual State: 'idle' (unlit) -> 'lighting' -> 'active' (369s stillness) -> 'ended'
  const [ritualState, setRitualState] = useState<'idle' | 'lighting' | 'active' | 'ended'>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(TOTAL_DURATION_SECONDS);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showTimerNumbers, setShowTimerNumbers] = useState<boolean>(false);
  const [optInLocalCounter, setOptInLocalCounter] = useState<boolean>(() => {
    return localStorage.getItem('stillness_opt_in_local_storage') === 'true';
  });
  const [personalSessionCount, setPersonalSessionCount] = useState<number>(() => {
    const val = localStorage.getItem(LOCAL_STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  });
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  // Handle opt-in toggle
  const handleToggleLocalCounter = (checked: boolean) => {
    setOptInLocalCounter(checked);
    localStorage.setItem('stillness_opt_in_local_storage', checked ? 'true' : 'false');
    if (!checked) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setPersonalSessionCount(0);
    }
  };

  // Light incense and start ritual
  const handleLightIncense = () => {
    if (ritualState !== 'idle') return;
    setRitualState('lighting');

    // Ring opening Keisu / Inkin single strike bell
    if (soundEnabled) {
      playKeisuBell(1);
    }

    // Transition into active stillness after flame / incense catch
    setTimeout(() => {
      setRitualState('active');
      setSecondsRemaining(TOTAL_DURATION_SECONDS);
    }, 1800);
  };

  // Timer loop for 369 seconds
  useEffect(() => {
    if (ritualState === 'active') {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleRitualCompletion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ritualState]);

  const handleRitualCompletion = useCallback(() => {
    setRitualState('ended');

    // Ring closing bell (2 strikes spaced apart per RFC-0010)
    if (soundEnabled) {
      playKeisuBell(2);
    }

    // Option C: if user opted in, increment purely local counter
    if (optInLocalCounter) {
      const newCount = personalSessionCount + 1;
      setPersonalSessionCount(newCount);
      localStorage.setItem(LOCAL_STORAGE_KEY, newCount.toString());
    }
  }, [soundEnabled, optInLocalCounter, personalSessionCount]);

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRitualState('idle');
    setSecondsRemaining(TOTAL_DURATION_SECONDS);
  };

  const handleCloseModal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  if (!isOpen) return null;

  const progressRatio = (TOTAL_DURATION_SECONDS - secondsRemaining) / TOTAL_DURATION_SECONDS;
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-neutral-950 border border-amber-500/20 rounded-3xl p-6 sm:p-10 shadow-[0_0_80px_rgba(245,158,11,0.08)] overflow-hidden flex flex-col items-center text-center"
        >
          {/* Subtle Ambient Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar Controls */}
          <div className="w-full flex items-center justify-between z-10 mb-4 pb-4 border-b border-white/5 text-xs font-mono">
            <div className="flex items-center gap-2 text-amber-400/80">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="uppercase tracking-widest text-[11px] font-bold">
                {t('stillness.protocolTitle', 'RFC-0010: Zen Stillness')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title={soundEnabled ? t('stillness.soundOn', 'Sound: On') : t('stillness.soundOff', 'Sound: Muted')}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
              </button>

              <button
                type="button"
                onClick={() => setShowExplanation(!showExplanation)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-400 transition-colors"
                title={t('stillness.aboutPhilosophy', 'RFC-0010 Philosophy')}
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RFC-0010 Philosophical Info Drawer */}
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full bg-black/60 border border-amber-500/20 rounded-2xl p-4 mb-6 text-left text-xs font-mono text-gray-300 space-y-2 z-10"
            >
              <div className="text-amber-400 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('stillness.ensoConceptTitle', 'Ensō (0) & Incense (1) — 369s Silence')}
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400">
                {t(
                  'stillness.ensoConceptBody',
                  'Ensō represents emptiness (0). Lighting the single incense represents intention (1). 369 seconds of non-attachment without gamification, ranking, or proof generation.'
                )}
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
                <span>{t('stillness.keisuBellNote', 'Bell: Keisu/Inkin bronze resonance')}</span>
                <span className="text-amber-400/80">{t('stillness.zeroDataNote', 'Option A: Pure client-side')}</span>
              </div>
            </motion.div>
          )}

          {/* Context / Subheading */}
          {listingTitle && (
            <div className="text-[11px] font-mono text-amber-500/70 mb-2 truncate max-w-md">
              {listingTitle}
            </div>
          )}

          {/* Main Visual Centerpiece: Ensō + Incense Stick */}
          <div className="relative my-6 flex flex-col items-center justify-center">
            {/* Ensō (Zen Circle) SVG */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-45">
                {/* Background faint guide stroke */}
                <path
                  d="M 100, 20
                     A 80,80 0 1,1 25, 115
                     A 80,80 0 0,1 92, 21"
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.08)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                
                {/* Active Dynamic Ensō Stroke with Brush Flavour & Imperfection */}
                <motion.path
                  d="M 100, 20
                     A 80,80 0 1,1 25, 115
                     A 80,80 0 0,1 92, 21"
                  fill="none"
                  stroke="url(#ensoGradient)"
                  strokeWidth={ritualState === 'active' ? '9' : '7'}
                  strokeLinecap="round"
                  strokeDasharray="500"
                  initial={{ strokeDashoffset: 500 }}
                  animate={{
                    strokeDashoffset: ritualState === 'idle' ? 0 : ritualState === 'active' ? 500 * (1 - progressRatio) : 0,
                    opacity: ritualState === 'active' ? [0.65, 0.95, 0.65] : 0.85
                  }}
                  transition={
                    ritualState === 'active'
                      ? {
                          opacity: { repeat: Infinity, duration: 6, ease: 'easeInOut' },
                          strokeDashoffset: { duration: 1, ease: 'linear' }
                        }
                      : { duration: 1.5, ease: 'easeOut' }
                  }
                />
                
                <defs>
                  <linearGradient id="ensoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#d97706" stopOpacity="0.75" />
                    <stop offset="95%" stopColor="#b45309" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Incense Stick Positioned in the Center of Ensō */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="relative flex flex-col items-center justify-center">
                  
                  {/* Subtle Smoke Effect when lit / active */}
                  {(ritualState === 'lighting' || ritualState === 'active') && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: [0.15, 0.5, 0.1],
                        y: [-2, -28, -50],
                        x: [0, 4, -4, 2],
                        scale: [0.6, 1.2, 1.8]
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 4.5,
                        ease: 'easeInOut'
                      }}
                      className="absolute -top-12 w-3 h-8 bg-gradient-to-t from-amber-200/40 via-amber-400/10 to-transparent rounded-full blur-sm"
                    />
                  )}

                  {/* Incense Ember / Flame Tip */}
                  <motion.div
                    animate={
                      ritualState === 'lighting' || ritualState === 'active'
                        ? {
                            scale: [1, 1.3, 1],
                            boxShadow: [
                              '0 0 8px rgba(245,158,11,0.6)',
                              '0 0 16px rgba(239,68,68,0.9)',
                              '0 0 8px rgba(245,158,11,0.6)'
                            ]
                          }
                        : { scale: 1, boxShadow: 'none' }
                    }
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                    className={`w-2.5 h-2.5 rounded-full ${
                      ritualState === 'idle'
                        ? 'bg-amber-900/60 border border-amber-800/40'
                        : 'bg-amber-400 border border-amber-200'
                    }`}
                  />

                  {/* Incense Stick Shaft (100px slender wood stem) */}
                  <div className="w-1 h-20 bg-gradient-to-b from-amber-700 via-amber-900 to-amber-950 rounded-b-full shadow-inner" />

                  {/* Incense Base / Lotus Stand */}
                  <div className="w-6 h-1.5 bg-neutral-800 border border-amber-500/30 rounded-full mt-0.5" />
                </div>
              </div>
            </div>

            {/* Subtle Breath Glow Prompt or Timer Display */}
            <div className="mt-4 flex flex-col items-center space-y-2">
              {ritualState === 'idle' && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-300 font-sans tracking-wide">
                    {t('stillness.tapToLight', 'Chạm vào nén nhang để bắt đầu 369 giây tĩnh lặng')}
                  </p>
                  <p className="text-[11px] font-mono text-gray-500">
                    {t('stillness.symbolicSubtext', 'Ensō (0) — Vô thường · Nhang (1) — Một ý niệm')}
                  </p>
                </div>
              )}

              {ritualState === 'lighting' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-mono text-amber-400 animate-pulse"
                >
                  {t('stillness.bellRinging', '🔔 Tiếng chuông Keisu ngân... Bắt đầu khoảng lặng')}
                </motion.div>
              )}

              {ritualState === 'active' && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="text-xs font-mono text-gray-400 italic">
                    {t('stillness.breatheAndLetGo', 'Thở nhẹ và buông bỏ mọi suy nghĩ...')}
                  </div>

                  {/* Toggleable minimal countdown display */}
                  {showTimerNumbers ? (
                    <div className="text-xl font-mono font-bold text-amber-400/90 tracking-widest">
                      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-gray-600 flex items-center gap-1.5">
                      <span>{t('stillness.silentCountdown', '369 giây')}</span>
                      <span className="text-amber-500/50">•</span>
                      <span>{Math.round(progressRatio * 100)}%</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowTimerNumbers(!showTimerNumbers)}
                    className="text-[10px] font-mono text-gray-500 hover:text-gray-400 flex items-center gap-1 mt-1 transition-colors"
                  >
                    {showTimerNumbers ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showTimerNumbers ? t('stillness.hideTimer', 'Ẩn đồng hồ') : t('stillness.showTimer', 'Hiện số giây')}</span>
                  </button>
                </div>
              )}

              {ritualState === 'ended' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="text-amber-400 font-sans text-base font-medium">
                    {t('stillness.sessionEndedPeace', 'Khoảng lặng đã hoàn tất.')}
                  </div>
                  <p className="text-xs font-mono text-gray-400 max-w-sm mx-auto leading-relaxed">
                    {t('stillness.noAttachmentNote', 'Nhang đã tàn. Không có huy hiệu hay điểm số nào được tạo ra, đúng tinh thần buông bỏ.')}
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
            {/* Option C: Purely Local Opt-in Counter Toggle */}
            <div className="flex items-center gap-2 text-left">
              <input
                type="checkbox"
                id="optInLocal"
                checked={optInLocalCounter}
                onChange={(e) => handleToggleLocalCounter(e.target.checked)}
                className="rounded border-gray-700 bg-neutral-900 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
              />
              <label htmlFor="optInLocal" className="text-[10px] font-mono text-gray-400 select-none cursor-pointer">
                {t('stillness.optInLocalLabel', 'Tự đếm cá nhân (Chỉ lưu trên máy, không tạo proof)')}
                {optInLocalCounter && personalSessionCount > 0 && (
                  <span className="ml-1.5 text-amber-400 font-bold">[{personalSessionCount}]</span>
                )}
              </label>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {ritualState === 'idle' && (
                <Button
                  variant="primary"
                  onClick={handleLightIncense}
                  className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs py-2 px-5 rounded-xl flex items-center gap-2"
                >
                  <Flame className="w-4 h-4 text-neutral-950 fill-neutral-950" />
                  {t('stillness.lightIncenseBtn', 'Thắp Nhang (Start)')}
                </Button>
              )}

              {ritualState === 'active' && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-white/10 text-gray-400 hover:text-white text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('stillness.stopOrReset', 'Dừng')}
                </Button>
              )}

              {ritualState === 'ended' && (
                <Button
                  variant="primary"
                  onClick={handleCloseModal}
                  className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs py-2 px-5 rounded-xl"
                >
                  {t('stillness.returnQuietly', 'Quay lại')}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
