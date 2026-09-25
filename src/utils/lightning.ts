import { toBech32, verifyLightningPreimage } from './crypto';
import bolt11 from 'light-bolt11-decoder';

export { verifyLightningPreimage };

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

// Generate an authentic-looking BOLT11 invoice for testing
export function generateBolt11(_amountSats: number, _memo: string): string {
  throw new Error('Cảnh báo bảo mật: Không được phép tạo hóa đơn giả lập. Mọi hóa đơn phải được tạo từ Lightning Node hoặc LNURL thực tế của Host.');
}

/**
 * Kiểm tra xem invoice có phải là invoice giả lập (simulated) hay không.
 * Trong môi trường production thật, không bao giờ coi bất kỳ invoice nào là simulated.
 */
export function isSimulatedInvoice(_invoice: string): boolean {
  return false;
}

// Parse a BOLT11 invoice to extract its details for the interactive UI
export interface ParsedInvoice {
  amountSats: number;
  memo: string;
  paymentHash: string;
  timestamp: number;
  expirySeconds: number;
}

/**
 * Decode BOLT11 invoice sử dụng thư viện chuẩn light-bolt11-decoder
 * Hỗ trợ cả chữ thường (lnbc...) và chữ hoa (LNBC...), testnet (lntb...), v.v.
 */
export function parseBolt11(invoice: string): ParsedInvoice | null {
  if (!invoice) return null;
  const cleanInvoice = invoice.trim();

  try {
    const rawInv = cleanInvoice.toLowerCase();
    const decoded: any = bolt11.decode(rawInv);
    const sections: any[] = decoded?.sections || [];

    const paymentHashObj = sections.find((s: any) => s.name === 'payment_hash');
    const amountObj = sections.find((s: any) => s.name === 'amount');
    const descObj = sections.find((s: any) => s.name === 'description');
    const timestampObj = sections.find((s: any) => s.name === 'timestamp');
    const expiryObj = sections.find((s: any) => s.name === 'expiry');

    // amount trong bolt11 là millisatoshis
    const millisats = amountObj?.value ? parseInt(String(amountObj.value), 10) : 0;
    const amountSats = Math.round(millisats / 1000);

    return {
      amountSats: amountSats || 0,
      memo: descObj?.value ? String(descObj.value) : "Cypher Guide Lightning Payment",
      paymentHash: paymentHashObj?.value ? String(paymentHashObj.value) : "",
      timestamp: timestampObj?.value ? Number(timestampObj.value) : Math.floor(Date.now() / 1000),
      expirySeconds: expiryObj?.value ? Number(expiryObj.value) : 3600,
    };
  } catch (err) {
    console.error('[BOLT11] Failed to decode invoice with light-bolt11-decoder:', err);
    return null;
  }
}

// Check for WebLN support
export function isWebLNAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.webln !== 'undefined';
}

// Multi-tier robust resolver for Lightning Address (Server API -> Direct Browser LNURL -> Local Fallback)
export async function resolveLightningAddressToInvoice(
  address: string,
  amountSats: number
): Promise<{ invoice: string; isReal: boolean; error?: string }> {
  const cleanAddress = address.trim().toLowerCase();
  
  if (!cleanAddress || !cleanAddress.includes('@')) {
    return {
      invoice: '',
      isReal: false,
      error: 'Địa chỉ Lightning Address không hợp lệ (yêu cầu định dạng user@domain.com).'
    };
  }

  // Tier 1: Try Server API endpoint with safe JSON check and SSRF defense
  try {
    const res = await fetch(`/api/lightning/resolve-invoice?address=${encodeURIComponent(cleanAddress)}&amount=${amountSats}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.invoice) {
        return { invoice: data.invoice, isReal: true };
      }
    }
  } catch (e) {
    // Silent fail over to Tier 2
  }

  // Tier 2: Direct Client-Side LNURL-pay fetch (Wallet of Satoshi, Blink, Strike, Voltage, LNbits open CORS)
  try {
    const [username, domain] = cleanAddress.split('@');
    if (username && domain) {
      const metaRes = await fetch(`https://${domain}/.well-known/lnurlp/${username}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (metaRes.ok) {
        const metadata = await metaRes.json();
        if (metadata.status !== 'ERROR' && metadata.callback) {
          const millisats = amountSats * 1000;
          const callbackUrl = new URL(metadata.callback);
          callbackUrl.searchParams.set('amount', millisats.toString());
          callbackUrl.searchParams.set('comment', 'Booking Payment Cypher Guide');

          const invoiceRes = await fetch(callbackUrl.toString(), {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (invoiceRes.ok) {
            const invoiceData = await invoiceRes.json();
            if (invoiceData.status !== 'ERROR' && invoiceData.pr) {
              return { invoice: invoiceData.pr, isReal: true };
            }
          }
        }
      }
    }
  } catch (e) {
    // Silent fail over
  }

  // Require authentic resolution; do NOT return simulated invoices
  return {
    invoice: '',
    isReal: false,
    error: `Không thể phân giải hóa đơn từ máy chủ LNURL của địa chỉ Lightning (${cleanAddress}). Vui lòng kiểm tra lại địa chỉ hoặc kết nối node.`
  };
}

// Pay via WebLN (safe handling: sends genuine invoice to wallet and verifies preimage)
export async function payViaWebLN(invoice: string): Promise<{ success: boolean; preimage?: string; error?: string }> {
  if (!isWebLNAvailable()) {
    return { success: false, error: 'WebLN provider not detected' };
  }
  
  try {
    await window.webln!.enable();
    const result = await window.webln!.sendPayment(invoice);
    if (!result || !result.preimage) {
      return { success: false, error: 'Ví WebLN không trả về bằng chứng Preimage thanh toán.' };
    }

    const parsedInv = parseBolt11(invoice);
    if (parsedInv && parsedInv.paymentHash) {
      const isValid = await verifyLightningPreimage(result.preimage, parsedInv.paymentHash);
      if (!isValid) {
        return { success: false, error: 'Chữ ký preimage từ ví không khớp payment_hash của invoice!' };
      }
    }

    return { success: true, preimage: result.preimage };
  } catch (error: any) {
    console.error('WebLN Payment failed:', error);
    return { success: false, error: error.message || 'Payment rejected by wallet' };
  }
}
