import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  probeMediaServer,
  selectBestMediaServer,
  uploadFileWithFallback,
  isSelfHostedUrl,
  PRIMARY_MEDIA_SERVER_URL
} from '../src/utils/mediaServer';

describe('Media Server Resilience & NIP-96 Fallback Suite (Round 5)', () => {
  const originalFetch = globalThis.fetch;
  const originalXHR = (globalThis as any).XMLHttpRequest;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).XMLHttpRequest = originalXHR;
    vi.restoreAllMocks();
  });

  describe('Task 1: Strict Health Probe (probeMediaServer)', () => {
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

    it('returns online when external NIP-96 descriptor returns 200', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('.well-known/nostr/nip96.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96' })
          };
        }
        return { ok: false, status: 404 };
      });

      const result = await probeMediaServer('https://nostr.build/api/v2/nip96', 500);
      expect(result.online).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('returns offline when external NIP-96 server returns 404 or 403', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await probeMediaServer('https://nostpic.com/api/v2/nip96', 500);
      expect(result.online).toBe(false);
      expect(result.latency).toBe(-1);
    });
  });

  describe('Task 2: Automatic Upload Failover to Secondary Server', () => {
    it('automatically fails over to secondary server when primary returns 404 and succeeds', async () => {
      const attempts: string[] = [];

      class MockXHR {
        status: number = 0;
        responseText: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        upload: any = { onprogress: null };
        timeout: number = 0;
        private url: string = '';

        open(method: string, url: string) {
          this.url = url;
          attempts.push(url);
        }

        send(_data: any) {
          setTimeout(() => {
            if (this.url.includes('/api/media')) {
              // Primary node returns 404 (simulating Vercel missing endpoint)
              this.status = 404;
              this.responseText = JSON.stringify({ error: 'Endpoint Not Found on Serverless' });
              this.onload?.();
            } else if (this.url.includes('nostr.build')) {
              // Secondary fallback node succeeds with NIP-94 tags
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

      const dummyBlob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      const result = await uploadFileWithFallback(dummyBlob, 'test.jpg', {
        preferredServerUrl: '/api/media'
      });

      expect(result.url).toBe('https://nostr.build/i/cypher_stay_photo.jpg');
      expect(result.hash).toBe('sha256_hash_987654321');
      expect(result.serverUrl).toBe('https://nostr.build/api/v2/nip96');
      expect(attempts[0]).toContain('/api/media/upload');
      expect(attempts[1]).toContain('nostr.build');
    });

    it('throws actionable error listing attempted servers when all fail, suggesting URL paste / NIP-94', async () => {
      class FailingMockXHR {
        status: number = 500;
        responseText: string = JSON.stringify({ error: 'Service Unavailable' });
        onload: (() => void) | null = null;
        upload: any = { onprogress: null };

        open(_method: string, _url: string) {}
        send(_data: any) {
          setTimeout(() => {
            this.onload?.();
          }, 5);
        }
      }

      (globalThis as any).XMLHttpRequest = FailingMockXHR;

      const dummyBlob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      await expect(
        uploadFileWithFallback(dummyBlob, 'test.jpg', {
          preferredServerUrl: '/api/media'
        })
      ).rejects.toThrow(/Tải ảnh thất bại trên tất cả máy chủ đã thử/);
    });
  });

  describe('Task 3: Display Logic & Fallback Selection when Backend is Missing', () => {
    it('does NOT select /api/media as primary when it returns 404, selecting live external fallback instead', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/media')) {
          // /api/media returns 404 (Vercel)
          return { ok: false, status: 404 };
        }
        if (url.includes('nostr.build')) {
          // nostr.build is online
          return {
            ok: true,
            status: 200,
            json: async () => ({ api_url: 'https://nostr.build/api/v2/nip96' })
          };
        }
        return { ok: false, status: 500 };
      });

      const selected = await selectBestMediaServer();
      expect(selected.server.url).not.toBe('/api/media');
      expect(selected.server.url).toBe('https://nostr.build/api/v2/nip96');
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
      expect(isSelfHostedUrl('https://nostr.build/api/v2/nip96')).toBe(false);
      expect(isSelfHostedUrl('https://nostpic.com/api/v2/nip96')).toBe(false);
    });
  });
});
