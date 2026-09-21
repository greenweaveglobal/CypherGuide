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
export const PRIMARY_MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || '/api/media';

// Configured Fallback Servers
function getFallbackServerList(): MediaServerItem[] {
  const envList = import.meta.env.VITE_FALLBACK_MEDIA_SERVERS;
  const list: MediaServerItem[] = [];

  if (envList && typeof envList === 'string') {
    const splitUrls = envList.split(',').map((s: string) => s.trim()).filter(Boolean);
    splitUrls.forEach((url: string, idx: number) => {
      list.push({
        id: `custom_fallback_${idx}`,
        name: `Fallback #${idx + 1} (${new URL(url, window.location.href).hostname || url})`,
        url,
        isPrimary: false
      });
    });
  }

  // Always ensure our built-in backup node is included as resilient fallback
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

  const probeUrls: string[] = [];
  if (cleanUrl.startsWith('/api/') || cleanUrl.includes('/api/media')) {
    probeUrls.push(`${cleanUrl}/health`, cleanUrl);
  } else {
    probeUrls.push(`${cleanUrl}/.well-known/nostr/nip96.json`, cleanUrl);
  }

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

      const latency = Math.max(1, Math.round(performance.now() - start));
      if (res.status < 500) {
        return { online: true, latency };
      }
    } catch {
      // Continue to next probe candidate or fallback
    }
  }

  // Quick fallback probe with OPTIONS/HEAD
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(1500, timeoutMs));
    const targetEndpoint = cleanUrl.endsWith('/upload') ? cleanUrl : `${cleanUrl}/upload`;

    await fetch(targetEndpoint, {
      method: 'OPTIONS',
      signal: controller.signal
    });
    clearTimeout(timer);
    const latency = Math.max(1, Math.round(performance.now() - start));
    return { online: true, latency };
  } catch {
    return { online: false, latency: -1 };
  }
}

/**
 * Intelligent Media Server Selector:
 * 1. Always probes primary CypherGuide server with 3000ms timeout first.
 * 2. If primary is online, PRIMARY IS ALWAYS ABSOLUTELY PRIORITIZED (never compares speed with fallbacks).
 * 3. Only if primary times out (>3s) or fails, probes all fallbacks concurrently and picks the fastest online fallback.
 */
export async function selectBestMediaServer(): Promise<SelectedServerResult> {
  const primaryName = PRIMARY_MEDIA_SERVER_URL.startsWith('/api')
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

  // Step 2: Primary is offline/timed out. Probe fallbacks concurrently with 3s timeout
  const fallbacks = getFallbackServerList();
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
    return {
      server: chosen,
      isFallback: true,
      latency: chosen.latency ?? 0,
      warning: `Máy chủ chính (${primaryItem.name}) không phản hồi sau 3s. Đang tự động chuyển sang máy chủ dự phòng: ${chosen.name} (${chosen.latency}ms).`
    };
  }

  throw new Error('Máy chủ chính của CypherGuide và tất cả máy chủ dự phòng đều không khả dụng. Vui lòng kiểm tra lại kết nối mạng.');
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
    const xhr = new XMLHttpRequest();
    const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    const targetEndpoint = cleanUrl.endsWith('/upload') ? cleanUrl : `${cleanUrl}/upload`;

    xhr.open('POST', targetEndpoint, true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          onProgress({ percent, loaded: e.loaded, total: e.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
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
          const errJson = JSON.parse(xhr.responseText);
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
