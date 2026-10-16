// Client-side fallback lookup for Cypher Guide RFC Documentation
import { DOCS_KNOWLEDGE_BASE, KnowledgeTopic } from '../../lib/docsKnowledgeBase';
import { translate } from '../hooks/useTranslation';

export interface DocsQueryResult {
  answer: string;
  success: boolean;
  source?: "gemini" | "local-index" | "fallback-default";
}

const RFC_KNOWLEDGE_BASE = DOCS_KNOWLEDGE_BASE as Record<string, KnowledgeTopic>;

export async function clientDocsLookup(question: string, locale: string = 'vi'): Promise<DocsQueryResult> {
  const isEn = locale === 'en';
  const qLower = question.toLowerCase();

  for (const topic of Object.values(RFC_KNOWLEDGE_BASE)) {
    if (topic.keywords && topic.keywords.some((kw) => qLower.includes(kw))) {
      return {
        answer: isEn ? topic.en : topic.vi,
        success: true,
        source: 'local-index'
      };
    }
  }

  return {
    answer: isEn 
      ? "There is no documentation about this yet" 
      : translate('docs.noDocYet', undefined, 'vi'),
    success: false,
    source: 'fallback-default'
  };
}
