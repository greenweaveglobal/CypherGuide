import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Activity, RefreshCw, AlertCircle, CheckCircle2, Database, Key } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Card, CardHeader, CardContent } from './ui/Card';

export default function SystemAudit() {
  const { t } = useTranslation();
  const { integrityReport, checkIntegrity, listings, bookings, proposals } = useAppStore();
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = async () => {
    setIsChecking(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await checkIntegrity();
    setIsChecking(false);
  };

  return (
    <Card variant="glass" className="mt-8 border-border/40 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4 bg-black/20 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[10px] font-bold font-mono text-white/70 uppercase tracking-[0.2em]">
            {t('systemAudit.title')}
          </h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={runCheck} 
          disabled={isChecking}
          className="h-6 gap-2 text-[9px] font-mono border border-border/30 px-2 bg-black/40"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? t('systemAudit.scanning') : t('systemAudit.runBtn')}
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 divide-y divide-border/30">
          {integrityReport ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
                {[
                  { label: 'LISTINGS_HASH', hash: integrityReport.details.listings, icon: Database, color: 'text-primary' },
                  { label: 'BOOKINGS_HASH', hash: integrityReport.details.bookings, icon: CheckCircle2, color: 'text-success' },
                  { label: 'GOVERNANCE_HASH', hash: integrityReport.details.governance, icon: Key, color: 'text-warning' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-black/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-mono text-text-secondary/70 uppercase tracking-tighter">{item.label}</span>
                      <item.icon className={`w-2.5 h-2.5 ${item.color} opacity-70`} />
                    </div>
                    <div className="text-[10px] font-mono text-white/90 truncate font-light tracking-tight selection:bg-primary/50">
                      {item.hash}
                    </div>
                  </div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`py-2 px-4 flex items-center justify-between gap-4 ${integrityReport.isValid ? 'bg-success/5' : 'bg-danger/5'}`}
              >
                <div className="flex items-center gap-3">
                  {integrityReport.isValid ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-danger" />
                  )}
                  <div>
                    <div className={`text-[10px] font-bold font-mono ${integrityReport.isValid ? 'text-success' : 'text-danger'}`}>
                      {integrityReport.isValid ? t('systemAudit.stateValidated') : t('systemAudit.stateCompromised')}
                    </div>
                    <div className="text-[8px] font-mono text-primary/60 mt-0.5">
                      {t('systemAudit.selfHealing')}
                    </div>
                  </div>
                </div>
                <div className="text-[9px] font-mono text-text-secondary/60 italic">
                  {t('systemAudit.lastVerified', { time: new Date().toLocaleTimeString() })}
                </div>
              </motion.div>
            </>
          ) : (
            <div className="py-6 px-4 text-center bg-black/5">
              <p className="text-[10px] text-text-disabled font-mono italic tracking-tight">
                {t('systemAudit.waitingAudit')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
