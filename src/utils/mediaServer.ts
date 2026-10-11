/**
 * CypherGuide Media Server Utility
 * RFC-compliant NIP-96 / NIP-94 media server integration with NIP-98 authentication,
 * dynamic discovery, resilient multi-server fallback, and real-time upload progress.
 */

import { createNip98AuthHeader } from './nip98Auth';
import { useAppStore } from '../store/useAppStore';
import { hasVault } from './crypto';
import { translate } from '../hooks/useTranslation';

export interface MediaServerItem {
  id: string;
  name: string;
  url: string;
  isPrimary: boolean;
  latency?: number;
  status?: 'idle' | 'testing' | 'online' | 'offline';
}

export interface SelectedServerResult {
  server: MediaServerItem;
  isFallback: boolean;
  latency: number;
  warning?: string;
}

export interface UploadProgressInfo {
  percent: number;
  loaded: number;
  total: number;
}

export interface UploadResult {
  url: string;
  hash: string;
  serverUrl: string;
  serverName: string;
}

export interface Nip96Descriptor {
  apiUrl: string;
  downloadUrl?: string;
  supportedNips?: number[];
  isNip98Required: boolean;
}

// Configured Primary Server (default to built-in /api/media)
// Note: When deploying to Vercel/serverless where server.ts is not running, /api/media is not present.
// In that case, VITE_MEDIA_SERVER_URL can be set to an absolute URL (e.g. https://media.cypherguide.org/api/media)
// as a build-time environment variable, or the client automatically falls back to public NIP-96 servers.
export const PRIMARY_MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || '/api/media';

/**
 * Checks if a URL points to self-hosted Express endpoints (/api/media, /api/media-fallback, etc.)
 */
export function isSelfHostedUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('/api/') ||
    url.includes('/api/media') ||
    url === '/api/media' ||
    url === '/api/media-fallback'
  );
}

// In-memory cache for discovered descriptors (TTL: 10 minutes)
const descriptorCache = new Map<string, { desc: Nip96Descriptor; cachedAt: number }>();

export function clearNip96DescriptorCache(): void {
  descriptorCache.clear();
}

/**
 * Fetch NIP-96 descriptor document from <origin>/.well-known/nostr/nip96.json
 */
export async function fetchNip96Descriptor(
  serverUrl: string,
  timeoutMs: number = 3000
): Promise<Nip96Descriptor | null> {
  if (isSelfHostedUrl(serverUrl)) {
    return null;
  }

  let origin: string;
  try {
    const parsed = new URL(serverUrl, typeof window !== 'undefined' ? window.location?.href : 'http://localhost');
    origin = parsed.origin;
  } catch {
    return null;
  }

  const cached = descriptorCache.get(origin);
  if (cached && Date.now() - cached.cachedAt < 10 * 60 * 1000) {
    return cached.desc;
  }

  const discoveryUrl = `${origin}/.well-known/nostr/nip96.json`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(discoveryUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data || typeof data.api_url !== 'string' || !data.api_url.trim()) {
      return null;
    }

    const isNip98Required = Boolean(
      data.plans?.free?.is_nip98_required ??
      data.is_nip98_required ??
      data.supported_nips?.includes(98) ??
      true
    );

    const descriptor: Nip96Descriptor = {
      apiUrl: data.api_url.trim(),
      downloadUrl: typeof data.download_url === 'string' ? data.download_url.trim() : undefined,
      supportedNips: Array.isArray(data.supported_nips) ? data.supported_nips : [],
      isNip98Required
    };

    descriptorCache.set(origin, { desc: descriptor, cachedAt: Date.now() });
    return descriptor;
  } catch {
    return null;
  }
}

// Track whether the local backend (/api/media) was confirmed online or offline
let _isLocalBackendAvailable: boolean | null = null;

export function setIsLocalBackendAvailable(available: boolean | null): void {
  _isLocalBackendAvailable = available;
}

export function getIsLocalBackendAvailable(): boolean | null {
  return _isLocalBackendAvailable;
}

// Configured Fallback Servers
export function getFallbackServerList(): MediaServerItem[] {
  const envList = import.meta.env.VITE_FALLBACK_MEDIA_SERVERS;
  const list: MediaServerItem[] = [];

  if (envList && typeof envList === 'string') {
    const splitUrls = envList.split(',').map((s: string) => s.trim()).filter(Boolean);
    splitUrls.forEach((url: string, idx: number) => {
      let host = url;
      try {
        host = new URL(url, typeof window !== 'undefined' ? window.location?.href : 'http://localhost').hostname || url;
      } catch {
        // use raw url
      }
      list.push({
        id: `custom_fallback_${idx}`,
        name: `Fallback #${idx + 1} (${host})`,
        url,
        isPrimary: false
      });
    });
  }

  // Built-in backup node (only effective when running server.ts where local backend is confirmed online)
  if (_isLocalBackendAvailable === true && !list.some(s => s.url === '/api/media-fallback')) {
    list.push({
      id: 'cypherguide_backup_node',
      name: 'CypherGuide Backup Node (/api/media-fallback)',
      url: '/api/media-fallback',
      isPrimary: false
    });
  }

  // Public NIP-96 fallbacks (using origin domains; discovery finds api_url dynamically)
  if (!list.some(s => s.url.includes('nostr.build'))) {
    list.push({
      id: 'nostr_build_nip96',
      name: 'Nostr.build Public NIP-96',
      url: 'https://nostr.build',
      isPrimary: false
    });
  }

  if (!list.some(s => s.url.includes('nostpic.com'))) {
    list.push({
      id: 'nostpic_nip96',
      name: 'Nostpic Public NIP-96',
      url: 'https://nostpic.com',
      isPrimary: false
    });
  }

  return list;
}

// Dev/Test simulation flag to simulate primary server failure
let _simulatePrimaryOffline = false;

export function setSimulatePrimaryOffline(simulated: boolean): void {
  _simulatePrimaryOffline = simulated;
  if (simulated) {
    _isLocalBackendAvailable = false;
  }
}

export function getSimulatePrimaryOffline(): boolean {
  return _simulatePrimaryOffline;
}

/**
 * Probe a single media server within timeoutMs (default: 3000ms)
 * - Self-hosted (/api/... or .../api/media): online ONLY when response is 2xx AND JSON has { status: "ok" }.
 *   404, 401, 403, 500, non-JSON 200, timeout are all strictly offline.
 * - External NIP-96: online when /.well-known/nostr/nip96.json returns 2xx with valid api_url.
 */
export async function probeMediaServer(
  serverUrl: string,
  timeoutMs: number = 3000
): Promise<{ online: boolean; latency: number }> {
  // If this is the primary server and simulation is active, immediately fail
  if ((serverUrl === PRIMARY_MEDIA_SERVER_URL || serverUrl === '/api/media') && _simulatePrimaryOffline) {
    _isLocalBackendAvailable = false;
    return { online: false, latency: -1 };
  }

  const start = performance.now();
  const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;

  // 1. Self-hosted endpoint check
  if (isSelfHostedUrl(cleanUrl)) {
    const probeUrls = [`${cleanUrl}/health`, cleanUrl];
    for (const testUrl of probeUrls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timer);

        // Strictly check for 2xx status AND valid JSON containing { status: "ok" }
        if (res.ok && res.status >= 200 && res.status < 300) {
          try {
            const data = await res.json();
            if (data && data.status === 'ok') {
              _isLocalBackendAvailable = true;
              const latency = Math.max(1, Math.round(performance.now() - start));
              return { online: true, latency };
            }
          } catch {
            // 200 OK returned non-JSON body (e.g. HTML 404 or index) -> NOT online
          }
        }
      } catch {
        // Network error, abort, timeout -> NOT online
      }
    }
    if (cleanUrl === '/api/media' || cleanUrl === PRIMARY_MEDIA_SERVER_URL) {
      _isLocalBackendAvailable = false;
    }
    return { online: false, latency: -1 };
  }

  // 2. External NIP-96 server check via discovery document
  const descriptor = await fetchNip96Descriptor(cleanUrl, timeoutMs);
  if (!descriptor || !descriptor.apiUrl) {
    return { online: false, latency: -1 };
  }

  const latency = Math.max(1, Math.round(performance.now() - start));
  return { online: true, latency };
}

/**
 * Intelligent Media Server Selector:
 * 1. Probes primary server with 3000ms timeout first.
 *    If primary is online (2xx + { status: "ok" }), PRIMARY IS ABSOLUTELY PRIORITIZED.
 * 2. If primary is offline (e.g. on Vercel where /api/media returns 404):
 *    Does NOT display /api/media as primary!
 *    Instead, probes external NIP-96 fallbacks (nostr.build, nostpic, etc.) concurrently,
 *    skipping unreachable local /api/ routes, and selects the fastest online external NIP-96 server.
 */
export async function selectBestMediaServer(): Promise<SelectedServerResult> {
  const isPrimaryLocal = isSelfHostedUrl(PRIMARY_MEDIA_SERVER_URL);
  const primaryName = isPrimaryLocal
    ? 'CypherGuide Primary Node (/api/media)'
    : `CypherGuide Dedicated Server (${PRIMARY_MEDIA_SERVER_URL})`;

  const primaryItem: MediaServerItem = {
    id: 'primary',
    name: primaryName,
    url: PRIMARY_MEDIA_SERVER_URL,
    isPrimary: true
  };

  // Step 1: Probe Primary with 3-second timeout
  const primaryResult = await probeMediaServer(PRIMARY_MEDIA_SERVER_URL, 3000);

  if (primaryResult.online) {
    _isLocalBackendAvailable = true;
    return {
      server: { ...primaryItem, latency: primaryResult.latency, status: 'online' },
      isFallback: false,
      latency: primaryResult.latency
    };
  }

  // Primary is offline (e.g. Vercel deployment where /api/media is 404)
  _isLocalBackendAvailable = false;

  // Filter out unreachable local /api/ fallbacks when local primary is dead
  const fallbacks = getFallbackServerList().filter(fb => !isSelfHostedUrl(fb.url));

  const probePromises = fallbacks.map(async (fb) => {
    const res = await probeMediaServer(fb.url, 3000);
    return {
      ...fb,
      latency: res.latency,
      status: res.online ? ('online' as const) : ('offline' as const)
    };
  });

  const testedFallbacks = await Promise.all(probePromises);
  const onlineFallbacks = testedFallbacks
    .filter(fb => fb.status === 'online')
    .sort((a, b) => (a.latency ?? 9999) - (b.latency ?? 9999));

  if (onlineFallbacks.length > 0) {
    const chosen = onlineFallbacks[0];
    const latencyStr = chosen.latency ? ` (${chosen.latency}ms)` : '';
    const warning = isPrimaryLocal
      ? translate('mediaServer.warningVercelFallback', { name: chosen.name, latency: latencyStr })
      : translate('mediaServer.warningTimeoutFallback', { primary: primaryItem.name, name: chosen.name, latency: latencyStr });

    return {
      server: chosen,
      isFallback: true,
      latency: chosen.latency ?? 0,
      warning
    };
  }

  throw new Error(translate('mediaServer.errAllServersDown'));
}

/**
 * Upload single blob to target server using XMLHttpRequest for real byte-level progress reporting
 * Supports Authorization header (e.g. NIP-98).
 */
export function uploadFileXHR(
  targetEndpoint: string,
  blob: Blob,
  filename: string,
  authHeader?: string | null,
  onProgress?: (info: UploadProgressInfo) => void
): Promise<{ url: string; hash: string }> {
  return new Promise((resolve, reject) => {
    const XHRClass = typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : (globalThis as any).XMLHttpRequest;
    if (!XHRClass) {
      reject(new Error('XMLHttpRequest is not available in current environment.'));
      return;
    }
    const xhr = new XHRClass();
    xhr.open('POST', targetEndpoint, true);

    if (authHeader) {
      xhr.setRequestHeader('Authorization', authHeader);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e: any) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          onProgress({ percent, loaded: e.loaded, total: e.total });
        }
      };
    }

    xhr.onload = () => {
      let data: any = null;
      try {
        data = typeof xhr.response === 'object' && xhr.response !== null ? xhr.response : JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response
      }

      // Check for NIP-96 error status inside HTTP response
      if (data && data.status === 'error') {
        reject(new Error(data.message || data.error || translate('mediaServer.errNip96ErrorStatus')));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (!data) {
          reject(new Error(translate('mediaServer.errInvalidJsonResponse', { status: xhr.status })));
          return;
        }

        let url = '';
        let hash = '';

        // NIP-94 event tags structure (NIP-96 standard)
        if (data.nip94_event?.tags) {
          const urlTag = data.nip94_event.tags.find((t: string[]) => t[0] === 'url');
          const hashTag = data.nip94_event.tags.find((t: string[]) => t[0] === 'ox' || t[0] === 'x');
          url = urlTag ? urlTag[1] : '';
          hash = hashTag ? hashTag[1] : '';
        } else if (data.data?.url) {
          url = data.data.url;
          hash = data.data.ox || data.data.x || data.data.sha256 || '';
        } else if (data.url) {
          url = data.url;
          hash = data.ox || data.x || data.sha256 || data.hash || '';
        }

        if (url) {
          resolve({ url, hash });
        } else {
          reject(new Error(data.error || data.message || translate('mediaServer.errMissingMediaUrl')));
        }
      } else {
        let errDetail = `HTTP ${xhr.status}`;
        if (xhr.status === 401) {
          errDetail = translate('mediaServer.errAuthRequired');
        } else if (xhr.status === 404) {
          errDetail = translate('mediaServer.errEndpointNotFound');
        } else if (data?.error || data?.message) {
          errDetail = data.error || data.message;
        } else if (xhr.statusText) {
          errDetail += ` (${xhr.statusText})`;
        }
        reject(new Error(errDetail));
      }
    };

    xhr.onerror = () => {
      reject(new Error(translate('mediaServer.errNetworkConnection', { endpoint: targetEndpoint })));
    };

    xhr.ontimeout = () => {
      reject(new Error(translate('mediaServer.errUploadTimeout', { endpoint: targetEndpoint })));
    };

    // 60-second timeout for upload
    xhr.timeout = 60000;

    const formData = new FormData();
    formData.append('file', blob, filename);
    xhr.send(formData);
  });
}

/**
 * Concise error summarizer for Task 4
 */
export function summarizeError(errMsg: string): string {
  if (!errMsg) return translate('mediaServer.errUnknown');
  const lower = errMsg.toLowerCase();
  if (
    lower.includes('nip-98') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('auth') ||
    lower.includes('login') ||
    lower.includes('signer') ||
    lower.includes('locked')
  ) {
    return translate('mediaServer.summaryAuthNeeded');
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return translate('mediaServer.summaryNotFound');
  }
  if (lower.includes('timeout')) {
    return translate('mediaServer.summaryTimeout');
  }
  if (lower.includes('network') || lower.includes('connection') || lower.includes('abort') || lower.includes('fetch')) {
    return translate('mediaServer.summaryNetwork');
  }
  if (lower.includes('size') || lower.includes('413') || lower.includes('payload') || lower.includes('limit')) {
    return translate('mediaServer.summarySizeLimit');
  }
  return errMsg.length > 45 ? `${errMsg.slice(0, 42)}...` : errMsg;
}

export interface UploadWithFallbackOptions {
  preferredServerUrl?: string;
  privKeyHex?: string;
  onProgress?: (info: UploadProgressInfo) => void;
  onServerSuccess?: (server: MediaServerItem) => void;
  onServerFailed?: (server: MediaServerItem, error: Error) => void;
}

/**
 * Upload file with automatic sequential failover to fallback servers.
 * - Discovers NIP-96 api_url dynamically via /.well-known/nostr/nip96.json.
 * - Attaches valid NIP-98 authorization token.
 * - Skips relative /api/ endpoints if local backend is down.
 * - Displays concise summary if all servers fail.
 */
export async function uploadFileWithFallback(
  blob: Blob,
  filename: string,
  options?: UploadWithFallbackOptions
): Promise<UploadResult> {
  const preferredUrl = options?.preferredServerUrl || PRIMARY_MEDIA_SERVER_URL;
  const isLocalDown = _isLocalBackendAvailable === false || _simulatePrimaryOffline;

  // Build candidate servers list in priority order
  const allServers: MediaServerItem[] = [];

  // 1. Add preferred server (unless local backend is known to be dead and preferred is local)
  const isPreferredLocal = isSelfHostedUrl(preferredUrl);
  if (!(isLocalDown && isPreferredLocal)) {
    if (preferredUrl === PRIMARY_MEDIA_SERVER_URL) {
      allServers.push({
        id: 'primary',
        name: isPreferredLocal
          ? 'CypherGuide Primary Node (/api/media)'
          : `CypherGuide Dedicated Server (${PRIMARY_MEDIA_SERVER_URL})`,
        url: PRIMARY_MEDIA_SERVER_URL,
        isPrimary: true
      });
    } else {
      const match = getFallbackServerList().find(s => s.url === preferredUrl);
      if (match) {
        allServers.push(match);
      } else {
        allServers.push({
          id: 'selected_server',
          name: `Selected Server (${preferredUrl})`,
          url: preferredUrl,
          isPrimary: false
        });
      }
    }
  }

  // 2. Add fallback servers (Task 3: strictly SKIP any relative/self-hosted servers if local backend is down or preferred was local)
  for (const fb of getFallbackServerList()) {
    if (isSelfHostedUrl(fb.url) && (isLocalDown || isPreferredLocal)) {
      continue; // Strictly do not attempt /api/media-fallback when local backend is down!
    }
    if (!allServers.some(s => s.url === fb.url)) {
      allServers.push(fb);
    }
  }

  if (allServers.length === 0) {
    throw new Error(translate('mediaServer.errNoServerAvailable'));
  }

  const attemptedLog: { name: string; url: string; error: string }[] = [];

  for (let i = 0; i < allServers.length; i++) {
    const candidate = allServers[i];

    // Reset progress before each attempt
    options?.onProgress?.({ percent: 0, loaded: 0, total: blob.size });

    let targetUploadUrl: string;
    let authHeader: string | null = null;

    if (isSelfHostedUrl(candidate.url)) {
      targetUploadUrl = candidate.url.endsWith('/upload') ? candidate.url : `${candidate.url}/upload`;
    } else {
      // External NIP-96: Discover api_url via /.well-known/nostr/nip96.json
      const descriptor = await fetchNip96Descriptor(candidate.url, 4000);
      if (!descriptor || !descriptor.apiUrl) {
        const descErr = translate('mediaServer.errDescriptorMissing');
        attemptedLog.push({ name: candidate.name, url: candidate.url, error: descErr });
        console.warn(`[MediaServer] Discovery failed on ${candidate.name} (${candidate.url}): ${descErr}`);
        continue; // Task 1 & 3: Skip server without guessing or sending upload
      }

      targetUploadUrl = descriptor.apiUrl;

      // NIP-98 Authentication
      const privKeyHex =
        options?.privKeyHex ||
        (typeof window !== 'undefined' ? useAppStore.getState().identity?.privKeyHex : undefined);
      const hasSigner = Boolean(
        privKeyHex || (typeof window !== 'undefined' && (window as any).nostr?.signEvent)
      );

      if (descriptor.isNip98Required || true) {
        if (!hasSigner) {
          const authErr = hasVault()
            ? translate('mediaServer.errVaultLocked')
            : translate('mediaServer.errLoginRequired');
          attemptedLog.push({ name: candidate.name, url: candidate.url, error: authErr });
          console.warn(`[MediaServer] Missing signer on ${candidate.name}: ${authErr}`);
          continue;
        }

        try {
          authHeader = await createNip98AuthHeader(targetUploadUrl, 'POST', privKeyHex, blob);
        } catch (signErr: any) {
          console.error('[MediaServer] Error creating NIP-98 auth header:', signErr);
        }

        if (!authHeader) {
          const signFailErr = translate('mediaServer.errSignFailed');
          attemptedLog.push({ name: candidate.name, url: candidate.url, error: signFailErr });
          continue;
        }
      }
    }

    try {
      const res = await uploadFileXHR(
        targetUploadUrl,
        blob,
        filename,
        authHeader,
        options?.onProgress
      );

      // Succeeded!
      options?.onServerSuccess?.(candidate);
      return {
        url: res.url,
        hash: res.hash,
        serverUrl: candidate.url,
        serverName: candidate.name
      };
    } catch (err: any) {
      const errMsg = err?.message || translate('mediaServer.errUnknown');
      // If local self-hosted endpoint returned 404, mark local backend as down
      if (isSelfHostedUrl(candidate.url) && errMsg.includes('404')) {
        _isLocalBackendAvailable = false;
      }

      attemptedLog.push({
        name: candidate.name,
        url: candidate.url,
        error: errMsg
      });
      options?.onServerFailed?.(candidate, err);

      console.warn(
        `[MediaServer] Upload failed on ${candidate.name} (${targetUploadUrl}): ${errMsg}. Trying next server...`
      );
    }
  }

  // All candidate servers failed -> Task 4: Concise Error Summary
  const summaryLines = attemptedLog
    .map(a => `• ${a.name}: ${summarizeError(a.error)}`)
    .join('\n');

  throw new Error(
    translate('mediaServer.uploadFailedSummary', {
      count: attemptedLog.length,
      summary: summaryLines
    })
  );
}
