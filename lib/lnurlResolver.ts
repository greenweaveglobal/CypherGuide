import dns from 'dns';
import bolt11 from 'light-bolt11-decoder';

/**
 * Checks whether an IP address belongs to private, loopback, link-local, or restricted ranges.
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;

  // IPv4 Checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // Invalid format treated as restricted
    }

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;

    // 10.0.0.0/8 (Private network)
    if (parts[0] === 10) return true;

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255, Private network)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16 (Private network)
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation/TEST-NET)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6 Checks
  const normalized = ip.toLowerCase();
  if (
    normalized === '::1' || // Loopback
    normalized === '::' || // Unspecified
    normalized.startsWith('fc') || normalized.startsWith('fd') || // Unique local (fc00::/7)
    normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') // Link-local (fe80::/10)
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves a hostname to its IP address and validates against SSRF.
 */
export async function assertSafePublicHost(hostname: string): Promise<void> {
  const cleanHost = hostname.trim().toLowerCase();
  
  if (
    cleanHost === 'localhost' ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal')
  ) {
    throw new Error(`SSRF Blocked: Hostname ${cleanHost} points to internal or restricted network.`);
  }

  // If already an IP address
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) || cleanHost.includes(':')) {
    if (isPrivateIp(cleanHost)) {
      throw new Error(`SSRF Blocked: IP ${cleanHost} is within private or link-local range.`);
    }
    return;
  }

  try {
    const results = await dns.promises.lookup(cleanHost, { all: true });
    for (const record of results) {
      if (isPrivateIp(record.address)) {
        throw new Error(`SSRF Blocked: Resolved IP ${record.address} for host ${cleanHost} is private or restricted.`);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('SSRF Blocked')) {
      throw err;
    }
    throw new Error(`DNS resolution error for host ${cleanHost}: ${err.message}`);
  }
}

export interface ResolveInvoiceResult {
  success: boolean;
  invoice?: string;
  isReal?: boolean;
  address?: string;
  amountSats?: number;
  error?: string;
  fallback?: boolean;
}

/**
 * Safely resolves a Lightning Address (user@domain.com) into a real BOLT11 invoice
 * with strict SSRF defense, HTTPS scheme enforcement, and LUD-06 amount validation.
 */
export async function resolveLightningInvoice(
  addressParam: string,
  amountSatsParam: number
): Promise<ResolveInvoiceResult> {
  const address = (addressParam || '').trim().toLowerCase();
  const amountSats = amountSatsParam || 21000;

  if (!address || !address.includes('@')) {
    return { success: false, error: 'Invalid Lightning Address (must be user@domain.com)' };
  }

  const [username, domain] = address.split('@');
  if (!username || !domain) {
    return { success: false, error: 'Malformed Lightning Address' };
  }

  // Step 1: SSRF Pre-flight on domain
  try {
    await assertSafePublicHost(domain);
  } catch (err: any) {
    return { success: false, error: err.message, fallback: false };
  }

  // Step 2: Fetch LNURL metadata using strict HTTPS
  const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${encodeURIComponent(username)}`;
  let metaRes: Response;
  try {
    metaRes = await fetch(lnurlEndpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CypherGuide-Security/1.1'
      },
      signal: AbortSignal.timeout(6000)
    });
  } catch (err: any) {
    return { success: false, error: `Failed to contact domain ${domain}: ${err.message}`, fallback: true };
  }

  if (!metaRes.ok) {
    return {
      success: false,
      error: `Lightning domain ${domain} returned HTTP ${metaRes.status}`,
      fallback: true
    };
  }

  let metadata: any;
  try {
    metadata = await metaRes.json();
  } catch (err) {
    return { success: false, error: `Malformed JSON response from domain ${domain}`, fallback: true };
  }

  if (metadata.status === 'ERROR') {
    return {
      success: false,
      error: metadata.reason || 'LNURL error returned by wallet provider',
      fallback: true
    };
  }

  // Step 3: Validate LUD-06 Callback URL and Amounts
  const callback = metadata.callback;
  if (!callback || typeof callback !== 'string') {
    return { success: false, error: 'Missing or invalid callback URL in LNURL metadata', fallback: true };
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callback);
  } catch (err) {
    return { success: false, error: 'Malformed callback URL provided by LNURL metadata', fallback: true };
  }

  // Enforce HTTPS scheme only
  if (callbackUrl.protocol !== 'https:') {
    return { success: false, error: `Insecure callback protocol (${callbackUrl.protocol}). Only https: is permitted.`, fallback: false };
  }

  // Step 4: SSRF check on callback hostname
  try {
    await assertSafePublicHost(callbackUrl.hostname);
  } catch (err: any) {
    return { success: false, error: err.message, fallback: false };
  }

  const minSendable = metadata.minSendable || 1000; // millisats
  const maxSendable = metadata.maxSendable || 100000000000; // millisats
  const millisats = amountSats * 1000;

  if (millisats < minSendable || millisats > maxSendable) {
    return {
      success: false,
      error: `Amount must be between ${Math.ceil(minSendable / 1000)} and ${Math.floor(maxSendable / 1000)} Sats`,
      fallback: true
    };
  }

  callbackUrl.searchParams.set('amount', millisats.toString());
  callbackUrl.searchParams.set('comment', 'Donation V4V Cypher Guide');

  let invoiceRes: Response;
  try {
    invoiceRes = await fetch(callbackUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CypherGuide-Security/1.1'
      },
      signal: AbortSignal.timeout(6000)
    });
  } catch (err: any) {
    return { success: false, error: `Failed to request invoice from callback: ${err.message}`, fallback: true };
  }

  if (!invoiceRes.ok) {
    return {
      success: false,
      error: `Callback provider ${callbackUrl.hostname} failed with HTTP ${invoiceRes.status}`,
      fallback: true
    };
  }

  let invoiceData: any;
  try {
    invoiceData = await invoiceRes.json();
  } catch (err) {
    return { success: false, error: 'Invalid JSON returned from invoice callback', fallback: true };
  }

  if (invoiceData.status === 'ERROR' || !invoiceData.pr) {
    return {
      success: false,
      error: invoiceData.reason || 'No invoice payment request returned from provider',
      fallback: true
    };
  }

  const rawInvoice = (invoiceData.pr as string).trim();

  // Step 5: BOLT11 Decode and Exact Amount Verification
  try {
    const decoded = bolt11.decode(rawInvoice.toLowerCase());
    const amountSection = (decoded as any).sections?.find((s: any) => s.name === 'amount');
    if (amountSection && amountSection.value) {
      const invoiceMillisats = parseInt(String(amountSection.value), 10);
      const invoiceSats = Math.round(invoiceMillisats / 1000);
      if (invoiceSats !== amountSats) {
        return {
          success: false,
          error: `Invoice amount mismatch: requested ${amountSats} Sats but provider generated ${invoiceSats} Sats!`,
          fallback: false
        };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to verify decoded invoice structure: ${err.message}`,
      fallback: false
    };
  }

  return {
    success: true,
    invoice: rawInvoice,
    isReal: true,
    address,
    amountSats
  };
}
