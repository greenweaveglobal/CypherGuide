import { toBech32 } from './crypto';

// WebLN standard type definitions
export interface WebLNProvider {
  enable(): Promise<void>;
  sendPayment(invoice: string): Promise<{ preimage: string }>;
  makeInvoice(args: { amount?: number; defaultAmount?: number; minimumAmount?: number; maximumAmount?: number; defaultMemo?: string; memo?: string }): Promise<{ paymentRequest: string }>;
}

declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

// Convert satoshis to Lightning network multiplier notation
// e.g., 1000 Sats = 1000 * 100 = 100000 picoBTC => 100n (nano) or similar
export function satsToLightningMultiplier(sats: number): string {
  const pico = sats * 10; // 1 sat = 10 picoBTC
  if (pico >= 1000000) {
    return `${pico / 1000000}u`; // micro
  } else if (pico >= 1000) {
    return `${pico / 1000}n`; // nano
  } else {
    return `${pico}p`; // pico
  }
}

// Generate an authentic-looking BOLT11 invoice
export function generateBolt11(amountSats: number, memo: string): string {
  const prefix = 'lnbc' + satsToLightningMultiplier(amountSats);
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const memoHex = Array.from(new TextEncoder().encode(memo))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const paymentHashBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const paymentHashHex = Array.from(paymentHashBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Combine metadata to form an invoice payload
  const payloadHex = timestamp + paymentHashHex + memoHex;
  const invoice = toBech32(prefix, payloadHex);
  
  return `${invoice}_sim`;
}

export function isSimulatedInvoice(invoice: string): boolean {
  return invoice.endsWith('_sim') || invoice.includes('_sim') || !invoice.startsWith('lnbc');
}

// Parse a BOLT11 invoice to extract its details for the interactive UI
export interface ParsedInvoice {
  amountSats: number;
  memo: string;
  paymentHash: string;
  timestamp: number;
  expirySeconds: number;
}

export function parseBolt11(invoice: string): ParsedInvoice | null {
  try {
    const cleanInvoice = invoice.replace('_sim', '');
    if (!cleanInvoice.startsWith('lnbc')) return null;
    
    // Extract multiplier and amount
    const amountPart = cleanInvoice.match(/^lnbc([0-9.]+)([pnum])/);
    let amountSats = 0;
    if (amountPart) {
      const num = parseFloat(amountPart[1]);
      const multiplier = amountPart[2];
      if (multiplier === 'p') amountSats = num / 10;
      else if (multiplier === 'n') amountSats = num * 100;
      else if (multiplier === 'u') amountSats = num * 100000;
      else if (multiplier === 'm') amountSats = num * 100000000;
    } else {
      const simpleMatch = cleanInvoice.match(/^lnbc([0-9]+)/);
      if (simpleMatch) {
        amountSats = parseInt(simpleMatch[1]) / 10;
      }
    }

    let memo = "Room Booking at Cypherpunk Lodge";
    let paymentHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    
    if (cleanInvoice.length > 50) {
      paymentHash = cleanInvoice.slice(15, 79);
    }

    return {
      amountSats: Math.round(amountSats) || 5000,
      memo,
      paymentHash,
      timestamp: Math.floor(Date.now() / 1000),
      expirySeconds: 3600,
    };
  } catch (e) {
    return null;
  }
}

// Check for WebLN support
export function isWebLNAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.webln !== 'undefined';
}

// Pay via WebLN (safe handling: isolates simulated demo invoices from triggering real wallet errors)
export async function payViaWebLN(invoice: string): Promise<{ success: boolean; preimage?: string; error?: string }> {
  // If invoice is a generated simulated invoice, do NOT send to real wallet extension to prevent checksum errors
  if (isSimulatedInvoice(invoice)) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPreimage = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        resolve({
          success: true,
          preimage: `sim_preimage_${mockPreimage}`
        });
      }, 1000);
    });
  }

  if (!isWebLNAvailable()) {
    return { success: false, error: 'WebLN provider not detected' };
  }
  
  try {
    await window.webln!.enable();
    const result = await window.webln!.sendPayment(invoice);
    return { success: true, preimage: result.preimage };
  } catch (error: any) {
    console.error('WebLN Payment failed:', error);
    return { success: false, error: error.message || 'Payment rejected by wallet' };
  }
}
