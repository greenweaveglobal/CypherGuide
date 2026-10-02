/**
 * CypherGuide Media Server Utility
 * RFC-compliant NIP-96 / NIP-94 media server integration with intelligent fallback and real-time upload progress.
 */

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

  // Built-in backup node (only effective when running server.ts)
  if (!list.some(s => s.url === '/api/media-fallback')) {
    list.push({
      id: 'cypherguide_backup_node',
      name: 'CypherGuide Backup Node (/api/media-fallback)',
      url: '/api/media-fallback',
      isPrimary: false
    });
  }

  // Public NIP-96 fallbacks
  if (!list.some(s => s.url.includes('nostr.build'))) {
    list.push({
      id: 'nostr_build_nip96',
      name: 'Nostr.build Public NIP-96',
      url: 'https://nostr.build/api/v2/nip96',
      isPrimary: false
    });
  }

  if (!list.some(s => s.url.includes('nostpic.com'))) {
    list.push({
      id: 'nostpic_nip96',
      name: 'Nostpic Public NIP-96',
      url: 'https://nostpic.com/api/v2/nip96',
      isPrimary: false
    });
  }

  return list;
}

// Dev/Test simulation flag to simulate primary server failure
let _simulatePrimaryOffline = false;

export function setSimulatePrimaryOffline(simulated: boolean): void {
  _simulatePrimaryOffline = simulated;
}

export function getSimulatePrimaryOffline(): boolean {
  return _simulatePrimaryOffline;
}

/**
 * Probe a single media server within timeoutMs (default: 3000ms)
 * - Self-hosted (/api/... or .../api/media): online ONLY when response is 2xx AND JSON has { status: "ok" }.
 *   404, 401, 403, 500, non-JSON 200, timeout are all strictly offline.
 * - External NIP-96: online when /.well-known/nostr/nip96.json or serverUrl returns 2xx (status >= 200 && status < 300).
 * - Removed loose OPTIONS fallback to eliminate false positives on 404 endpoints.
 */
export async function probeMediaServer(
  serverUrl: string,
  timeoutMs: number = 3000
): Promise<{ online: boolean; latency: number }> {
  // If this is the primary server and simulation is active, immediately fail
  if ((serverUrl === PRIMARY_MEDIA_SERVER_URL || serverUrl === '/api/media') && _simulatePrimaryOffline) {
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
    return { online: false, latency: -1 };
  }

  // 2. External NIP-96 server check
  const probeUrls: string[] = [];
  try {
    const parsed = new URL(cleanUrl, typeof window !== 'undefined' ? window.location?.href : 'http://localhost');
    probeUrls.push(`${parsed.origin}/.well-known/nostr/nip96.json`);
  } catch {
    // ignore parse error
  }
  if (!probeUrls.includes(`${cleanUrl}/.well-known/nostr/nip96.json`)) {
    probeUrls.push(`${cleanUrl}/.well-known/nostr/nip96.json`);
  }
  probeUrls.push(cleanUrl);

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

      // External NIP-96 server must respond with 2xx
      if (res.ok && res.status >= 200 && res.status < 300) {
        const latency = Math.max(1, Math.round(performance.now() - start));
        return { online: true, latency };
      }
    } catch {
      // Continue to next candidate
    }
  }

  return { online: false, latency: -1 };
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
    return {
      server: { ...primaryItem, latency: primaryResult.latency, status: 'online' },
      isFallback: false,
      latency: primaryResult.latency
    };
  }

  // Step 2: Primary is offline (e.g. Vercel deployment where /api/media is 404).
  // Filter out unreachable local /api/ fallbacks when local primary is dead.
  const fallbacks = getFallbackServerList().filter(fb => {
    if (isPrimaryLocal && isSelfHostedUrl(fb.url)) {
      return false;
    }
    return true;
  });

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
    const warning = isPrimaryLocal
      ? `Máy chủ cục bộ (/api/media) không khả dụng trên môi trường serverless (Vercel). Đang tự động kết nối máy chủ NIP-96: ${chosen.name} (${chosen.latency}ms).`
      : `Máy chủ chính (${primaryItem.name}) không phản hồi sau 3s. Đang tự động chuyển sang máy chủ dự phòng: ${chosen.name} (${chosen.latency}ms).`;

    return {
      server: chosen,
      isFallback: true,
      latency: chosen.latency ?? 0,
      warning
    };
  }

  throw new Error('Máy chủ chính của CypherGuide và tất cả máy chủ NIP-96 dự phòng đều không khả dụng. Vui lòng kiểm tra lại kết nối mạng hoặc dán URL ảnh trực tiếp.');
}

/**
 * Upload single blob to target server using XMLHttpRequest for real byte-level progress reporting
 */
export function uploadFileXHR(
  serverUrl: string,
  blob: Blob,
  filename: string,
  onProgress?: (info: UploadProgressInfo) => void
): Promise<{ url: string; hash: string }> {
  return new Promise((resolve, reject) => {
    const XHRClass = typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : (globalThis as any).XMLHttpRequest;
    if (!XHRClass) {
      reject(new Error('XMLHttpRequest is not available in current environment.'));
      return;
    }
    const xhr = new XHRClass();
    const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    const targetEndpoint = cleanUrl.endsWith('/upload') ? cleanUrl : `${cleanUrl}/upload`;

    xhr.open('POST', targetEndpoint, true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e: any) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          onProgress({ percent, loaded: e.loaded, total: e.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = typeof xhr.response === 'object' && xhr.response !== null ? xhr.response : JSON.parse(xhr.responseText);
          let url = '';
          let hash = '';

          // NIP-94 event structure
          if (data.status === 'success' && data.nip94_event?.tags) {
            const urlTag = data.nip94_event.tags.find((t: string[]) => t[0] === 'url');
            const hashTag = data.nip94_event.tags.find((t: string[]) => t[0] === 'ox');
            url = urlTag ? urlTag[1] : '';
            hash = hashTag ? hashTag[1] : '';
          } else if (data.data?.url) {
            url = data.data.url;
            hash = data.data.sha256 || data.data.ox || '';
          } else if (data.url) {
            url = data.url;
            hash = data.sha256 || data.ox || data.hash || '';
          }

          if (url) {
            resolve({ url, hash });
          } else {
            reject(new Error(data.error || data.message || 'Dữ liệu phản hồi từ Media Server không chứa URL hợp lệ.'));
          }
        } catch (parseErr: any) {
          reject(new Error(`Phản hồi từ Media Server không hợp lệ: ${parseErr.message}`));
        }
      } else {
        let errDetail = `Media Server lỗi HTTP ${xhr.status}`;
        try {
          const errJson = typeof xhr.response === 'object' && xhr.response !== null ? xhr.response : JSON.parse(xhr.responseText);
          if (errJson.error || errJson.message) {
            errDetail = errJson.error || errJson.message;
          }
        } catch {
          if (xhr.statusText) errDetail += ` (${xhr.statusText})`;
        }
        reject(new Error(errDetail));
      }
    };

    xhr.onerror = () => {
      reject(new Error(`Lỗi kết nối mạng đến máy chủ Media Server (${serverUrl})`));
    };

    xhr.ontimeout = () => {
      reject(new Error(`Hết thời gian chờ (Timeout) khi tải ảnh lên ${serverUrl}`));
    };

    // 60-second timeout for upload
    xhr.timeout = 60000;

    const formData = new FormData();
    formData.append('file', blob, filename);
    xhr.send(formData);
  });
}

export interface UploadWithFallbackOptions {
  preferredServerUrl?: string;
  onProgress?: (info: UploadProgressInfo) => void;
  onServerSuccess?: (server: MediaServerItem) => void;
  onServerFailed?: (server: MediaServerItem, error: Error) => void;
}

/**
 * Upload file with automatic sequential failover to fallback servers.
 * - Tries preferred/selected server first.
 * - If it returns an error (404, 5xx, network error, timeout), automatically tries the next server in fallback list.
 * - If all servers fail, throws an aggregated error listing attempted servers and suggesting URL paste / NIP-94.
 */
export async function uploadFileWithFallback(
  blob: Blob,
  filename: string,
  options?: UploadWithFallbackOptions
): Promise<UploadResult> {
  const preferredUrl = options?.preferredServerUrl || PRIMARY_MEDIA_SERVER_URL;
  const isPrimaryLocal = isSelfHostedUrl(preferredUrl);

  // Build candidate servers list in priority order
  const allServers: MediaServerItem[] = [];

  // 1. Add preferred server
  if (preferredUrl === PRIMARY_MEDIA_SERVER_URL) {
    allServers.push({
      id: 'primary',
      name: isPrimaryLocal
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

  // 2. Add fallback servers (skip other local /api/ servers if local primary was requested/dead)
  for (const fb of getFallbackServerList()) {
    if (isPrimaryLocal && isSelfHostedUrl(fb.url)) {
      continue;
    }
    if (!allServers.some(s => s.url === fb.url)) {
      allServers.push(fb);
    }
  }

  const attemptedLog: { name: string; url: string; error: string }[] = [];

  for (let i = 0; i < allServers.length; i++) {
    const candidate = allServers[i];

    // Reset progress before each attempt
    options?.onProgress?.({ percent: 0, loaded: 0, total: blob.size });

    try {
      const res = await uploadFileXHR(
        candidate.url,
        blob,
        filename,
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
      const errMsg = err?.message || 'Lỗi không xác định';
      attemptedLog.push({
        name: candidate.name,
        url: candidate.url,
        error: errMsg
      });
      options?.onServerFailed?.(candidate, err);

      console.warn(`[MediaServer] Upload failed on ${candidate.name} (${candidate.url}): ${errMsg}. Trying next server...`);
    }
  }

  // All candidate servers failed
  const failureSummary = attemptedLog
    .map(a => `• ${a.name} (${a.url}): ${a.error}`)
    .join('\n');

  throw new Error(
    `Tải ảnh thất bại trên tất cả máy chủ đã thử:\n${failureSummary}\n\nGợi ý: Bạn có thể dán trực tiếp URL ảnh công khai vào ô nhập liệu hoặc tải ảnh qua luồng NIP-94.`
  );
}
