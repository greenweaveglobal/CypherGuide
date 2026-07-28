import React, { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans text-text-primary">
      <Card variant="glass" className="max-w-md w-full border-danger/30">
        <CardHeader className="flex flex-col items-center gap-4 pt-8">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-bold text-white font-mono uppercase tracking-wider text-center">
            System Fault
          </h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-black/40 border border-border rounded-lg overflow-auto">
            <p className="text-xs font-mono text-danger mb-2">CRITICAL_EXCEPTION_DETECTED:</p>
            <code className="text-xs text-text-secondary whitespace-pre-wrap">
              {error.message}
            </code>
          </div>
          <Button 
            variant="primary" 
            fullWidth 
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> REBOOT CORE PROTOCOL
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
