import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Upload, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui/Button';

interface QrScannerModalProps {
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  expectedAmountSats?: number;
}

export default function QrScannerModal({ onClose, onScanSuccess, expectedAmountSats }: QrScannerModalProps) {
  const { t } = useTranslation();
  const [scanMethod, setScanMethod] = useState<'camera' | 'file'>('camera');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = "lightning-qr-reader";

  useEffect(() => {
    if (scanMethod === 'camera') {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
  }, [scanMethod]);

  const startCameraScanner = async () => {
    setError(null);
    setIsScanning(true);
    try {
      if (scannerRef.current) {
        await stopCameraScanner();
      }

      const html5Qrcode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleSuccess(decodedText);
        },
        () => {
          // Ignore scanning frame errors
        }
      );
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setIsScanning(false);
      setError(t('qrScanner.cameraPermErr'));
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5Qrcode = new Html5Qrcode("qr-file-dummy");
      const result = await html5Qrcode.scanFile(file, true);
      handleSuccess(result);
    } catch (err) {
      setError(t('qrScanner.fileInvalidErr'));
    }
  };

  const handleSuccess = (text: string) => {
    // Clean lightning prefix if present
    const cleaned = text.replace(/^lightning:/i, '').trim();
    setScannedResult(cleaned);
    stopCameraScanner();
    
    setTimeout(() => {
      onScanSuccess(cleaned);
    }, 600);
  };

  const handleSimulateScan = () => {
    const demoInvoice = `lnbc${expectedAmountSats || 21000}0n1p3demo${Math.random().toString(36).substring(2, 10)}...mock_scanned_lightning_invoice`;
    handleSuccess(demoInvoice);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/50">
          <div className="flex items-center gap-2 text-warning font-mono font-bold text-sm">
            <Zap className="w-5 h-5" />
            <span>{t('qrScanner.title')}</span>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border bg-black/40 text-xs font-mono">
          <button
            onClick={() => setScanMethod('camera')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
              scanMethod === 'camera'
                ? 'border-primary text-primary font-bold bg-primary/10'
                : 'border-transparent text-text-secondary hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" /> {t('qrScanner.tabCamera')}
          </button>
          <button
            onClick={() => setScanMethod('file')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
              scanMethod === 'file'
                ? 'border-primary text-primary font-bold bg-primary/10'
                : 'border-transparent text-text-secondary hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" /> {t('qrScanner.tabFile')}
          </button>
        </div>

        {/* Scanner Container */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-4">
          {scannedResult ? (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 rounded-full bg-success/20 border border-success/30 flex items-center justify-center mx-auto text-success">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-success font-mono">{t('qrScanner.scannedSuccess')}</h4>
                <p className="text-xs text-text-secondary font-mono mt-2 break-all max-w-xs mx-auto bg-black p-3 rounded border border-border">
                  {scannedResult}
                </p>
              </div>
            </div>
          ) : scanMethod === 'camera' ? (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.2)] bg-black flex items-center justify-center">
                <div id={qrRegionId} className="w-full h-full"></div>
                {!isScanning && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-xs font-mono text-text-secondary gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    Connecting...
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger flex items-center gap-2 max-w-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-4 text-center">
              <div id="qr-file-dummy" className="hidden"></div>
              <label className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-black/40 hover:bg-black/60 transition-all">
                <Upload className="w-10 h-10 text-primary animate-pulse" />
                <span className="text-xs font-mono text-text-secondary">{t('qrScanner.uploadPrompt')}</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
              {error && (
                <p className="text-xs text-danger font-mono bg-danger/10 p-2 rounded border border-danger/20">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Simulation Helper */}
        <div className="p-4 border-t border-border bg-black/60 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs font-mono">
          <span className="text-text-secondary text-[11px]">
            {expectedAmountSats ? `Payment amount: ${expectedAmountSats.toLocaleString()} Sats` : 'Supports Bolt11 / LNURL'}
          </span>
          <Button variant="secondary" size="sm" onClick={handleSimulateScan} className="w-full sm:w-auto text-xs py-1.5 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
            <Zap className="w-3.5 h-3.5 fill-primary" /> Simulate Scan (Demo)
          </Button>
        </div>

      </div>
    </div>
  );
}
