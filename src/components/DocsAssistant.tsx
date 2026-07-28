import React, { useState } from 'react';
import { Bot, Search, AlertTriangle, X, Sparkles, Send, Loader2, BookOpen, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { clientDocsLookup } from '../services/docsSearchService';

interface DocsAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsAssistant: React.FC<DocsAssistantProps> = ({ isOpen, onClose }) => {
  const { t, locale } = useTranslation();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sampleQuestions = [
    t('docsAssistant.sample1'),
    t('docsAssistant.sample2'),
    t('docsAssistant.sample3'),
    t('docsAssistant.sample4')
  ];

  const handleSearch = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q) return;

    if (queryText) {
      setQuestion(queryText);
    }

    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      let isSuccess = false;
      try {
        const res = await fetch('/api/docs-assistant/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ question: q, locale })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.answer) {
            setResponse(data.answer);
            isSuccess = true;
          } else if (data.error) {
            setError(data.error);
            isSuccess = true;
          }
        }
      } catch (networkErr) {
        console.warn('Backend API request failed, switching to client fallback:', networkErr);
      }

      if (!isSuccess) {
        // Fallback to client-side RFC search
        const fallbackResult = await clientDocsLookup(q, locale);
        if (fallbackResult.answer) {
          setResponse(fallbackResult.answer);
        } else {
          setResponse(t('docsAssistant.noDocResponse'));
        }
      }
    } catch (err: any) {
      console.error('Error querying docs assistant:', err);
      setError(err.message || 'Error executing documentation lookup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-zinc-900 border border-primary/30 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-mono font-bold text-base sm:text-lg text-white truncate">
                  {t('docsAssistant.title')}
                </h3>
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3" />
                  Experimental
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-mono text-zinc-400 truncate">
                {t('docsAssistant.subtitle')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mandatory Non-Hideable Disclaimer Label */}
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-amber-950/40 border-b border-amber-500/30 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] sm:text-xs font-mono text-amber-200/90 leading-relaxed font-medium">
            {t('docsAssistant.disclaimer')}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Input Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('docsAssistant.placeholder')}
                disabled={loading}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-primary text-black font-mono font-bold text-xs sm:text-sm uppercase rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{loading ? t('docsAssistant.thinking') : t('docsAssistant.send')}</span>
            </button>
          </form>

          {/* Sample Query Chips */}
          <div>
            <p className="text-xs font-mono text-zinc-400 mb-2 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {t('docsAssistant.sampleQuestionsTitle')}
            </p>
            <div className="flex flex-col gap-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(q)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-primary/40 rounded-lg text-xs font-mono text-zinc-300 hover:text-primary transition-all text-left disabled:opacity-50 break-words [overflow-wrap:anywhere]"
                >
                  ⚡ {q}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 sm:p-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-3 max-w-full">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-red-200 space-y-1 break-words [overflow-wrap:anywhere] min-w-0 flex-1">
                <p className="font-bold">{t('docsAssistant.errorTitle')}</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Answer Output */}
          {response && (
            <div className="p-3.5 sm:p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 animate-in fade-in duration-300 max-w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-2 gap-1">
                <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('docsAssistant.resultTitle')}</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">
                  {t('docsAssistant.modelBadge')}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] selection:bg-primary selection:text-black min-w-0 max-w-full overflow-x-auto">
                {response}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-950 border-t border-zinc-800 text-[10px] sm:text-[11px] font-mono text-zinc-500 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1">
          <span>{t('docsAssistant.referenceIndex')}</span>
          <span>{t('docsAssistant.scopeLabel')}</span>
        </div>
      </div>
    </div>
  );
};
