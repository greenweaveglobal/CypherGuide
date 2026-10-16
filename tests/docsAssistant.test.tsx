import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LocaleProvider } from '../src/hooks/useTranslation';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockGenerateContent
    };
  }
}));

import { searchLocalKnowledgeBase, queryDocsAssistant } from '../lib/docsAssistant';
import { clientDocsLookup } from '../src/services/docsSearchService';
import { DocsAssistant } from '../src/components/DocsAssistant';

describe('Documentation Assistant & Knowledge Lookup (Task 4)', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalEnv) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    vi.clearAllMocks();
  });

  describe('searchLocalKnowledgeBase', () => {
    it('matches known topic keywords in Vietnamese', () => {
      const res = searchLocalKnowledgeBase('Địa chỉ donate chính thức của dự án là gì?', 'vi');
      expect(res.matched).toBe(true);
      expect(res.answer).toContain('npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qa');
    });

    it('matches known topic keywords in English', () => {
      const res = searchLocalKnowledgeBase('How does proof of stay work?', 'en');
      expect(res.matched).toBe(true);
      expect(res.answer).toContain('Proof of Stay');
    });

    it('returns matched: false for off-topic query', () => {
      const res = searchLocalKnowledgeBase('Cách làm pizza ngon tại nhà', 'vi');
      expect(res.matched).toBe(false);
      expect(res.answer).toBe('Chưa có tài liệu về việc này');
    });
  });

  describe('clientDocsLookup (Client fallback)', () => {
    it('returns success: true and source: local-index on matched topic', async () => {
      const res = await clientDocsLookup('quy trình RFC-0002 tính phí thế nào', 'vi');
      expect(res.success).toBe(true);
      expect(res.source).toBe('local-index');
      expect(res.answer).toBeDefined();
    });

    it('returns success: false and source: fallback-default on unmatched topic in Vietnamese', async () => {
      const res = await clientDocsLookup('thời tiết ngày mai thế nào', 'vi');
      expect(res.success).toBe(false);
      expect(res.source).toBe('fallback-default');
      expect(res.answer).toBe('Chưa có tài liệu về việc này');
    });

    it('returns success: false and source: fallback-default on unmatched topic in English', async () => {
      const res = await clientDocsLookup('what is the weather tomorrow', 'en');
      expect(res.success).toBe(false);
      expect(res.source).toBe('fallback-default');
      expect(res.answer).toBe('There is no documentation about this yet');
    });
  });

  describe('queryDocsAssistant without GEMINI_API_KEY (degraded local mode)', () => {
    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('returns source: local-index and success: true when topic matches', async () => {
      const res = await queryDocsAssistant('Địa chỉ donate của CypherGuide', 'vi');
      expect(res.success).toBe(true);
      expect(res.source).toBe('local-index');
      expect(res.degraded).toBe(true);
      expect(res.answer).toContain('npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qa');
    });

    it('returns source: fallback-default and success: false when topic does NOT match', async () => {
      const res = await queryDocsAssistant('Làm thế nào để bay lên mặt trăng?', 'vi');
      expect(res.success).toBe(false);
      expect(res.source).toBe('fallback-default');
      expect(res.degraded).toBe(true);
      expect(res.answer).toBe('Chưa có tài liệu về việc này');
    });

    it('returns English fallback phrase when locale is en and topic does NOT match', async () => {
      const res = await queryDocsAssistant('What is the recipe for chocolate cake?', 'en');
      expect(res.success).toBe(false);
      expect(res.source).toBe('fallback-default');
      expect(res.degraded).toBe(true);
      expect(res.answer).toBe('There is no documentation about this yet');
    });
  });

  describe('queryDocsAssistant with GEMINI_API_KEY', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'mock_api_key_test';
    });

    it('returns source: gemini and success: true when model responds', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Theo RFC-0016, phí protocol được phân tách trực tiếp vào Treasury Quỹ Thưởng.'
      });

      const res = await queryDocsAssistant('Giải thích RFC-0016', 'vi');
      expect(res.success).toBe(true);
      expect(res.source).toBe('gemini');
      expect(res.answer).toContain('RFC-0016');
    });

    it('returns source: fallback-default and success: false when model responds with fallback phrase', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Chưa có tài liệu về việc này'
      });

      const res = await queryDocsAssistant('Câu hỏi không có trong docs', 'vi');
      expect(res.success).toBe(false);
      expect(res.source).toBe('fallback-default');
      expect(res.degraded).toBe(true);
      expect(res.answer).toBe('Chưa có tài liệu về việc này');
    });
  });

  describe('DocsAssistant Component UI Output Verification', () => {
    it('renders dialog with mandatory disclaimer and sample questions in English when locale is en', () => {
      const htmlEn = renderToString(
        <LocaleProvider>
          <DocsAssistant isOpen={true} onClose={() => {}} />
        </LocaleProvider>
      );
      expect(htmlEn).toContain('Documentation Lookup Assistant');
      expect(htmlEn).toContain('Automatic document lookup tool');
      expect(htmlEn).toContain('Sample Lookup Queries:');
    });

    it('does not render when isOpen is false', () => {
      const html = renderToString(
        <LocaleProvider>
          <DocsAssistant isOpen={false} onClose={() => {}} />
        </LocaleProvider>
      );
      expect(html).toBe('');
    });
  });
});
