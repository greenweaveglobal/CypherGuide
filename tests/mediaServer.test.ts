import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  probeMediaServer,
  selectBestMediaServer,
  uploadFileWithFallback,
  isSelfHostedUrl,
  fetchNip96Descriptor,
  clearNip96DescriptorCache,
  setIsLocalBackendAvailable,
  PRIMARY_MEDIA_SERVER_URL
} from '../src/utils/mediaServer';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex } from '../src/utils/crypto';

describe('Media Server Resilience & NIP-96 / NIP-98 Suite (Round 5 & 6)', () => {
  const originalFetch = globalThis.fetch;
  const originalXHR = (globalThis as any).XMLHttpRequest;

  beforeEach(() => {
    clearNip96DescriptorCache();
    setIsLocalBackendAvailable(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).XMLHttpRequest = originalXHR;
    clearNip96DescriptorCache();
    setIsLocalBackendAvailable(null);
    vi.restoreAllMocks();
  });

  describe('Task 1: Strict Health Probe & Dynamic Discovery (probeMediaServer)', () => {
    it('returns offline when self-hosted endpoint returns 404', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' })
      });

      const result = await probeMediaServer('/api/media', 500);
      expect(result.online).toBe(false);
      expect(result.latency).toBe(-1);
    });

    it('returns offline when self-hosted endpoint returns 200 with non-JSON body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
      });

      const result = await probeMediaServer('/api/media', 500);
      expect(result.online).toBe(false);
      expect(result.latency).toBe(-1);
    });

    it('returns online when self-hosted endpoint returns 200 with valid JSON status: "ok"', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', service: 'CypherGuide Primary Media Server' })
      });

      const result = await probeMediaServer('/api/media', 500);
      expect(result.online).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('returns offline when self-hosted endpoint returns 500 server error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      });

      const result = await probeMediaServer('/api/media', 500);
      expect(result.online).toBe(false);
      expect(result.latency).toBe(-1);
    });

    it('returns offline when self-hosted endpoint times out or network aborts', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      const result = await probeMediaServer('/api/media', 500);
      expect(result.online).toBe(false);
      expect(result.latency).toBe(-1);
    });

    it('returns online when external NIP-96 descriptor returns 200 with valid api_url', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96/upload' })
          };
        }
        return { ok: false, status: 404 };
      });

      const result = await probeMediaServer('https://nostr.build', 500);
      expect(result.online).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('returns offline when external NIP-96 discovery returns 404 or missing api_url', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await probeMediaServer('https://nostpic.com', 500);
      expect(result.online).toBe(false);
      expect(result.latency).toBe(-1);
    });

    it('skips server and does not send upload when discovery returns 404 or missing api_url (Round 6 Criterion 3)', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('broken-server.com')) {
          return { ok: true, status: 200, json: async () => ({}) }; // Missing api_url!
        }
        if (url.includes('nostr.build')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96/upload' })
          };
        }
        return { ok: false, status: 404 };
      });

      const requestedUploadEndpoints: string[] = [];

      class MockXHR {
        status: number = 0;
        responseText: string = '';
        onload: (() => void) | null = null;
        upload: any = { onprogress: null };
        private url: string = '';

        open(_method: string, url: string) {
          this.url = url;
          requestedUploadEndpoints.push(url);
        }
        setRequestHeader() {}
        send() {
          setTimeout(() => {
            if (this.url.includes('nostr.build')) {
              this.status = 200;
              this.responseText = JSON.stringify({
                status: 'success',
                nip94_event: { tags: [['url', 'https://nostr.build/i/ok.jpg'], ['ox', 'sha123']] }
              });
            } else {
              this.status = 404;
              this.responseText = 'Not Found';
            }
            this.onload?.();
          }, 5);
        }
      }

      (globalThis as any).XMLHttpRequest = MockXHR;

      const dummyBlob = new Blob(['sample-image'], { type: 'image/jpeg' });
      const privKeyHex = bytesToHex(generateSecretKey());

      await uploadFileWithFallback(dummyBlob, 'test.jpg', {
        preferredServerUrl: 'https://broken-server.com',
        privKeyHex
      });

      // broken-server.com had missing api_url in discovery, so it must NEVER have been targeted for upload!
      expect(requestedUploadEndpoints.some(u => u.includes('broken-server.com'))).toBe(false);
      expect(requestedUploadEndpoints.some(u => u.includes('nostr.build'))).toBe(true);
    });
  });

  describe('Task 2: NIP-98 Authenticated Uploads & Failover (Round 6 Criterion 2)', () => {
    it('succeeds when NIP-98 Authorization header is valid, and rejects when missing (Criterion 2)', async () => {
      const dummyBlob = new Blob(['binary-cypherguide-room-data'], { type: 'image/jpeg' });
      const privKey = generateSecretKey();
      const privKeyHex = bytesToHex(privKey);
      const expectedPubkey = getPublicKey(privKey);

      // Calculate expected payload hash of blob
      const subtle = (globalThis as any).crypto?.subtle;
      const arrayBuffer = await dummyBlob.arrayBuffer();
      const hashBuffer = await subtle.digest('SHA-256', arrayBuffer);
      const expectedPayloadHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      let capturedAuthHeader: string | null = null;

      class MockNip96XHR {
        status: number = 0;
        responseText: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        upload: any = { onprogress: null };
        private headers: Record<string, string> = {};
        private url: string = '';

        open(method: string, url: string) {
          this.url = url;
        }

        setRequestHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        }

        send() {
          setTimeout(() => {
            const auth = this.headers['authorization'];
            capturedAuthHeader = auth || null;

            if (!auth || !auth.startsWith('Nostr ')) {
              this.status = 401;
              this.responseText = JSON.stringify({
                status: 'error',
                message: 'Unauthorized, please provide a valid nip-98 token'
              });
              this.onload?.();
              return;
            }

            try {
              const base64Str = auth.replace('Nostr ', '').trim();
              const eventJson = JSON.parse(Buffer.from(base64Str, 'base64').toString('utf8'));

              const uTag = eventJson.tags?.find((t: string[]) => t[0] === 'u')?.[1];
              const methodTag = eventJson.tags?.find((t: string[]) => t[0] === 'method')?.[1];
              const payloadTag = eventJson.tags?.find((t: string[]) => t[0] === 'payload')?.[1];

              // Verify kind 27235, pubkey, method, url, and payload SHA-256
              if (
                eventJson.kind === 27235 &&
                eventJson.pubkey === expectedPubkey &&
                methodTag === 'POST' &&
                uTag === this.url &&
                payloadTag === expectedPayloadHex
              ) {
                this.status = 200;
                this.responseText = JSON.stringify({
                  status: 'success',
                  nip94_event: {
                    tags: [
                      ['url', 'https://nostr.build/i/verified_authenticated.jpg'],
                      ['ox', expectedPayloadHex],
                      ['x', expectedPayloadHex]
                    ]
                  }
                });
                this.onload?.();
              } else {
                this.status = 401;
                this.responseText = JSON.stringify({ status: 'error', message: 'NIP-98 verification failed' });
                this.onload?.();
              }
            } catch (err: any) {
              this.status = 400;
              this.responseText = JSON.stringify({ error: err.message });
              this.onload?.();
            }
          }, 5);
        }
      }

      (globalThis as any).XMLHttpRequest = MockNip96XHR;

      // Mock discovery for nostr.build
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              api_url: 'https://nostr.build/api/v2/nip96/upload',
              plans: { free: { is_nip98_required: true } }
            })
          };
        }
        return { ok: false, status: 404 };
      });

      const res = await uploadFileWithFallback(dummyBlob, 'room.jpg', {
        preferredServerUrl: 'https://nostr.build',
        privKeyHex
      });

      expect(res.url).toBe('https://nostr.build/i/verified_authenticated.jpg');
      expect(res.hash).toBe(expectedPayloadHex);
      expect(capturedAuthHeader).toBeTruthy();
      expect(capturedAuthHeader).toContain('Nostr ');
    });

    it('fails over to secondary server when primary returns 404 and succeeds', async () => {
      const attempts: string[] = [];

      class MockXHR {
        status: number = 0;
        responseText: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        upload: any = { onprogress: null };
        private url: string = '';

        open(_method: string, url: string) {
          this.url = url;
          attempts.push(url);
        }
        setRequestHeader() {}

        send() {
          setTimeout(() => {
            if (this.url.includes('/api/media')) {
              this.status = 404;
              this.responseText = JSON.stringify({ error: 'Endpoint Not Found on Serverless' });
              this.onload?.();
            } else if (this.url.includes('nostr.build')) {
              this.status = 200;
              this.responseText = JSON.stringify({
                status: 'success',
                nip94_event: {
                  tags: [
                    ['url', 'https://nostr.build/i/cypher_stay_photo.jpg'],
                    ['ox', 'sha256_hash_987654321']
                  ]
                }
              });
              this.onload?.();
            } else {
              this.status = 500;
              this.responseText = 'Error';
              this.onload?.();
            }
          }, 5);
        }
      }

      (globalThis as any).XMLHttpRequest = MockXHR;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96/upload' })
          };
        }
        return { ok: false, status: 404 };
      });

      const dummyBlob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      const privKeyHex = bytesToHex(generateSecretKey());
      const result = await uploadFileWithFallback(dummyBlob, 'test.jpg', {
        preferredServerUrl: '/api/media',
        privKeyHex
      });

      expect(result.url).toBe('https://nostr.build/i/cypher_stay_photo.jpg');
      expect(result.hash).toBe('sha256_hash_987654321');
      expect(attempts[0]).toContain('/api/media/upload');
      expect(attempts[1]).toContain('nostr.build');
    });

    it('summarizes errors concisely when all candidate servers fail (Task 4)', async () => {
      class FailingMockXHR {
        status: number = 500;
        responseText: string = JSON.stringify({ error: 'Service Unavailable' });
        onload: (() => void) | null = null;
        upload: any = { onprogress: null };

        open() {}
        setRequestHeader() {}
        send() {
          setTimeout(() => this.onload?.(), 5);
        }
      }

      (globalThis as any).XMLHttpRequest = FailingMockXHR;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96/upload' })
          };
        }
        return { ok: false, status: 404 };
      });

      const dummyBlob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      const privKeyHex = bytesToHex(generateSecretKey());

      await expect(
        uploadFileWithFallback(dummyBlob, 'test.jpg', {
          preferredServerUrl: 'https://nostr.build',
          privKeyHex
        })
      ).rejects.toThrow(/Tải ảnh thất bại sau khi thử/);
    });
  });

  describe('Task 3: Skipping Relative /api/media-fallback when Backend is Missing (Criterion 4)', () => {
    it('strictly does NOT attempt /api/media-fallback when /api/media returns 404 (Criterion 4)', async () => {
      const openedEndpoints: string[] = [];

      class MockTrackerXHR {
        status: number = 0;
        responseText: string = '';
        onload: (() => void) | null = null;
        upload: any = { onprogress: null };
        private target: string = '';

        open(_method: string, url: string) {
          this.target = url;
          openedEndpoints.push(url);
        }
        setRequestHeader() {}

        send() {
          setTimeout(() => {
            if (this.target.includes('/api/media/upload')) {
              this.status = 404; // Primary is 404 on Vercel
              this.responseText = 'Not Found';
              this.onload?.();
            } else if (this.target.includes('nostr.build')) {
              this.status = 200;
              this.responseText = JSON.stringify({
                status: 'success',
                nip94_event: { tags: [['url', 'https://nostr.build/fallback.jpg']] }
              });
              this.onload?.();
            } else {
              this.status = 500;
              this.responseText = 'Error';
              this.onload?.();
            }
          }, 5);
        }
      }

      (globalThis as any).XMLHttpRequest = MockTrackerXHR;

      // Mock probe: /api/media is 404, nostr.build discovery is 200
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96/upload' })
          };
        }
        return { ok: false, status: 404 };
      });

      const dummyBlob = new Blob(['data'], { type: 'image/jpeg' });
      const privKeyHex = bytesToHex(generateSecretKey());

      const res = await uploadFileWithFallback(dummyBlob, 'test.jpg', {
        preferredServerUrl: '/api/media',
        privKeyHex
      });

      expect(res.url).toBe('https://nostr.build/fallback.jpg');

      // CRITICAL CHECK: /api/media-fallback must NEVER be in openedEndpoints!
      const attemptedFallback = openedEndpoints.some(u => u.includes('media-fallback'));
      expect(attemptedFallback).toBe(false);
    });

    it('does NOT select /api/media as primary when it returns 404, selecting live external fallback instead', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/media')) {
          return { ok: false, status: 404 };
        }
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96/upload' })
          };
        }
        return { ok: false, status: 500 };
      });

      const selected = await selectBestMediaServer();
      expect(selected.server.url).not.toBe('/api/media');
      expect(selected.server.url).toBe('https://nostr.build');
      expect(selected.isFallback).toBe(true);
      expect(selected.warning).toContain('Vercel');
    });

    it('preserves /api/media as primary when backend responds with 200 { status: "ok" } (server.ts)', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'ok',
              service: 'CypherGuide Primary Media Server'
            })
          };
        }
        return { ok: false, status: 500 };
      });

      const selected = await selectBestMediaServer();
      expect(selected.server.url).toBe('/api/media');
      expect(selected.isFallback).toBe(false);
      expect(selected.server.isPrimary).toBe(true);
      expect(selected.warning).toBeUndefined();
    });
  });

  describe('Helper Utilities', () => {
    it('correctly identifies self-hosted endpoints vs external servers', () => {
      expect(isSelfHostedUrl('/api/media')).toBe(true);
      expect(isSelfHostedUrl('/api/media-fallback')).toBe(true);
      expect(isSelfHostedUrl('https://example.com/api/media')).toBe(true);
      expect(isSelfHostedUrl('https://nostr.build')).toBe(false);
      expect(isSelfHostedUrl('https://nostpic.com')).toBe(false);
    });
  });
});
