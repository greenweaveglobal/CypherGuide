// Client-side fallback lookup for Cypher Guide RFC Documentation
import docsKnowledgeBase from '../locales/docsKnowledgeBase.json';
import { translate } from '../hooks/useTranslation';

export interface DocsQueryResult {
  answer: string;
  success: boolean;
}

interface KnowledgeTopic {
  keywords?: string[];
  vi: string;
  en: string;
}

const RFC_KNOWLEDGE_BASE = docsKnowledgeBase as Record<string, KnowledgeTopic>;

export async function clientDocsLookup(question: string, locale: string = 'vi'): Promise<DocsQueryResult> {
  const isEn = locale === 'en';
  const qLower = question.toLowerCase();

  for (const topic of Object.values(RFC_KNOWLEDGE_BASE)) {
    if (topic.keywords && topic.keywords.some((kw) => qLower.includes(kw))) {
      return {
        answer: isEn ? topic.en : topic.vi,
        success: true
      };
    }
  }

  return {
    answer: isEn 
      ? "There is no documentation about this yet" 
      : translate('docs.noDocYet'),
    success: true
  };
}
