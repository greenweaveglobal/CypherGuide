/**
 * CypherGuide Fiat Rate Estimation Service (RFC-0018 / Round 7)
 * Cung cấp tỷ giá tham khảo Bitcoin sang VND & USD.
 *
 * RÀNG BUỘC KIẾN TRÚC & QUYỀN RIÊNG TƯ:
 * 1. MẶC ĐỊNH TẮT: Tránh rò rỉ IP của người dùng qua dịch vụ bên ngoài trừ khi người dùng chủ động bật.
 * 2. TẢI THEO YÊU CẦU & CACHE: Cache trong bộ nhớ 5 phút (300.000ms), không spam API.
 * 3. BẢO VỆ GIAO DỊCH: Tỷ giá NÀY TUYỆT ĐỐI CHỈ DÙNG ĐỂ THAM KHẢO HIỂN THỊ TRÊN THẺ,
 *    không bao giờ được dùng để tính toán thanh toán Lightning hay trừ phí.
 * 4. NGUỒN CÔNG KHAI KHÔNG CẦN KEY:
 *    - Primary: CoinGecko Simple Price API (https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,vnd)
 *    - Fallback: Coinbase Exchange Rates (https://api.coinbase.com/v2/exchange-rates?currency=BTC)
 */

export const FIAT_RATE_PRIMARY_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,vnd';
export const FIAT_RATE_FALLBACK_API_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=BTC';

export interface BtcFiatRates {
  vnd: number; // 1 BTC = ? VND
  usd: number; // 1 BTC = ? USD
  fetchedAt: number;
}

let cachedRates: BtcFiatRates | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

export function getCachedRates(): BtcFiatRates | null {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return cachedRates;
  }
  return null;
}

export function clearFiatRateCache(): void {
  cachedRates = null;
}

/**
 * Lấy tỷ giá BTC sang VND và USD.
 * Nếu có lỗi mạng hoặc API không phản hồi, trả về null để giao diện ẩn hoàn toàn ước tính.
 */
export async function fetchBtcFiatRates(): Promise<BtcFiatRates | null> {
  // 1. Kiểm tra cache RAM
  const cached = getCachedRates();
  if (cached) {
    return cached;
  }

  // 2. Thử nguồn chính (CoinGecko)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(FIAT_RATE_PRIMARY_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const usd = Number(data?.bitcoin?.usd);
      const vnd = Number(data?.bitcoin?.vnd);
      if (usd > 0 && vnd > 0) {
        cachedRates = { usd, vnd, fetchedAt: Date.now() };
        return cachedRates;
      }
    }
  } catch {
    // Chuyển sang nguồn fallback
  }

  // 3. Thử nguồn phụ (Coinbase Exchange Rates)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(FIAT_RATE_FALLBACK_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const rates = data?.data?.rates;
      const usd = Number(rates?.USD);
      const vnd = Number(rates?.VND);
      if (usd > 0 && vnd > 0) {
        cachedRates = { usd, vnd, fetchedAt: Date.now() };
        return cachedRates;
      }
    }
  } catch {
    // Không thể lấy tỷ giá -> ẩn ước tính
  }

  return null;
}

/**
 * Định dạng số Sats thành chuỗi tiền pháp định ước tính (ví dụ: "≈ 210.000 VND" hoặc "≈ $8.40").
 * Nếu sats <= 0 hoặc không có tỷ giá, trả về null để giao diện ẩn hoàn toàn.
 */
export function formatSatsToEstimatedFiat(
  sats: number,
  currency: 'VND' | 'USD' = 'VND',
  rates: BtcFiatRates | null = cachedRates
): string | null {
  if (sats <= 0 || !rates) {
    return null;
  }

  const btcAmount = sats / 100_000_000;

  if (currency === 'VND') {
    if (!rates.vnd || rates.vnd <= 0) return null;
    const vndAmount = Math.round(btcAmount * rates.vnd);
    // Làm tròn đến hàng nghìn nếu > 10.000 VND
    const displayVnd = vndAmount >= 10000 ? Math.round(vndAmount / 1000) * 1000 : vndAmount;
    return `≈ ${displayVnd.toLocaleString('vi-VN')} VND`;
  }

  if (currency === 'USD') {
    if (!rates.usd || rates.usd <= 0) return null;
    const usdAmount = btcAmount * rates.usd;
    return `≈ $${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return null;
}
