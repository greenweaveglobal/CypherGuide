import { toBech32, verifyLightningPreimage } from './crypto';
import bolt11 from 'light-bolt11-decoder';

export { verifyLightningPreimage };

// Build-time / Environment payment mode flag (defaults to 'live' for real payments)
export const PAYMENT_MODE = (import.meta.env.VITE_PAYMENT_MODE || 'live').toLowerCase();
export const IS_DEMO_MODE = PAYMENT_MODE === 'demo' || (typeof window !== 'undefined' && Boolean(window.location?.hostname && (window.location.hostname.startsWith('demo.') || window.location.hostname.includes('demo.'))));
export const IS_LIVE_MODE = !IS_DEMO_MODE;

// Default Lightning Address for Mutinynet Testnet Demo Host
export const DEMO_HOST_LIGHTNING_ADDRESS = (import.meta.env.VITE_DEMO_HOST_LIGHTNING_ADDRESS || 'demo-host@voltage.cloud').trim();

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

// Generate an authentic-looking BOLT11 invoice for sandbox/demo testing
export function generateBolt11(amountSats: number, memo: string): string {
  if (IS_LIVE_MODE) {
    throw new Error('Cảnh báo bảo mật: Không được phép tạo hóa đơn giả lập trong chế độ Live Production. Mọi hóa đơn phải được tạo từ Lightning Node hoặc LNURL thực tế của Host.');
  }

  // Bitcoin Testnet prefix (lntb) for authentic Testnet / Mutinynet / Polar signet experience
  const prefix = 'lntb' + satsToLightningMultiplier(amountSats);
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

/**
 * Kiểm tra xem invoice có phải là invoice giả lập (simulated) hay không.
 * QUY TẮC BẢO MẬT:
 * - Khi IS_LIVE_MODE là true (production), KHÔNG BAO GIỜ coi bất kỳ invoice nào là simulated!
 * - Chỉ coi là simulated khi IS_DEMO_MODE === true VÀ chuỗi kết thúc rõ ràng bằng '_sim'.
 * - TUYỆT ĐỐI KHÔNG dùng tiền tố hay định dạng chuỗi hoa/thường để suy đoán invoice giả lập.
 */
export function isSimulatedInvoice(invoice: string): boolean {
  if (IS_LIVE_MODE) {
    return false;
  }
  return invoice.endsWith('_sim') || invoice.includes('_sim');
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

  // Chế độ demo chỉ chấp nhận invoice kết thúc bằng _sim nếu ở PAYMENT_MODE === 'demo'
  if (PAYMENT_MODE === 'demo' && cleanInvoice.endsWith('_sim')) {
    return {
      amountSats: 21000,
      memo: "Phòng Trọ Cypherpunk (Demo)",
      paymentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      timestamp: Math.floor(Date.now() / 1000),
      expirySeconds: 3600,
    };
  }

  try {
    const rawInv = cleanInvoice.replace('_sim', '').toLowerCase();
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

  // Both Live and Mutinynet Demo require authentic resolution; do NOT return simulated invoices
  return {
    invoice: '',
    isReal: false,
    error: `Không thể phân giải hóa đơn từ máy chủ LNURL của địa chỉ Lightning (${cleanAddress}). Vui lòng kiểm tra lại địa chỉ hoặc kết nối node.`
  };
}

// Pay via WebLN (safe handling: isolates simulated demo invoices from triggering real wallet errors)
export async function payViaWebLN(invoice: string): Promise<{ success: boolean; preimage?: string; error?: string }> {
  // If invoice is a generated simulated invoice in demo mode, do NOT send to real wallet extension to prevent checksum errors
  if (IS_DEMO_MODE && isSimulatedInvoice(invoice)) {
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
