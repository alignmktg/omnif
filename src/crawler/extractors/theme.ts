/**
 * Theme Extractor
 * Extracts recurring topics and themes from sources
 */

import type { InsightType } from '@/domain';
import type {
  InsightExtractor,
  ExtractionSource,
  ExtractedInsight,
} from './base';
import { extractKeywords, calculateSimilarity } from './base';

// ============================================================================
// THEME DETECTION
// ============================================================================

interface ThemeCandidate {
  topic: string;
  keywords: string[];
  occurrences: number;
  contexts: string[];
  confidence: number;
}

// Domain-specific theme categories
const DOMAIN_THEMES = {
  productivity: ['task', 'project', 'deadline', 'goal', 'priority', 'focus', 'efficiency'],
  communication: ['email', 'meeting', 'call', 'message', 'discussion', 'feedback'],
  planning: ['plan', 'schedule', 'timeline', 'roadmap', 'strategy', 'milestone'],
  learning: ['learn', 'research', 'study', 'course', 'training', 'skill'],
  health: ['health', 'exercise', 'sleep', 'wellness', 'stress', 'balance'],
  finance: ['budget', 'cost', 'revenue', 'investment', 'expense', 'profit'],
  relationships: ['team', 'client', 'partner', 'stakeholder', 'collaboration'],
  technology: ['software', 'tool', 'system', 'platform', 'integration', 'automation'],
};

// ============================================================================
// THEME EXTRACTOR
// ============================================================================

export const themeExtractor: InsightExtractor = {
  type: 'theme' as InsightType,
  name: 'Theme Extractor',

  canHandle(source: ExtractionSource): boolean {
    // Themes can be extracted from any source type
    return true;
  },

  async extract(source: ExtractionSource): Promise<ExtractedInsight[]> {
    const insights: ExtractedInsight[] = [];
    const keywords = extractKeywords(source.content, 4);

    // Count keyword frequencies
    const keywordCounts = new Map<string, number>();
    for (const keyword of keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    }

    // Detect domain-specific themes
    for (const [domain, domainKeywords] of Object.entries(DOMAIN_THEMES)) {
      const matchingKeywords = domainKeywords.filter((dk) =>
        keywords.some((k) => k.includes(dk) || dk.includes(k))
      );

      if (matchingKeywords.length >= 2) {
        // Calculate confidence based on keyword density
        const totalMatches = matchingKeywords.reduce(
          (sum, mk) => sum + (keywordCounts.get(mk) || 1),
          0
        );
        const confidence = Math.min(0.9, 0.5 + totalMatches * 0.1);

        insights.push({
          type: 'theme' as InsightType,
          content: domain,
          confidence,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            category: 'domain_theme',
            matchingKeywords,
            keywordDensity: matchingKeywords.length / domainKeywords.length,
          },
        });
      }
    }

    // Extract emergent themes from high-frequency keywords
    const frequentKeywords = Array.from(keywordCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [keyword, count] of frequentKeywords) {
      // Skip if already covered by domain theme
      const isDomainKeyword = Object.values(DOMAIN_THEMES)
        .flat()
        .some((dk) => dk.includes(keyword) || keyword.includes(dk));

      if (!isDomainKeyword && keyword.length > 4) {
        const confidence = Math.min(0.8, 0.4 + count * 0.15);

        insights.push({
          type: 'theme' as InsightType,
          content: keyword,
          confidence,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            category: 'emergent_theme',
            frequency: count,
            contexts: extractContexts(source.content, keyword),
          },
        });
      }
    }

    // Extract named entity themes (capitalized multi-word phrases)
    const namedEntities = extractNamedEntities(source.content);
    for (const entity of namedEntities) {
      insights.push({
        type: 'theme' as InsightType,
        content: entity.name,
        confidence: entity.confidence,
        sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
        metadata: {
          category: 'named_entity',
          entityType: entity.type,
        },
      });
    }

    return deduplicateThemes(insights);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractContexts(text: string, keyword: string): string[] {
  const contexts: string[] = [];
  const sentences = text.split(/[.!?]+/);

  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10 && trimmed.length < 200) {
        contexts.push(trimmed);
      }
    }
  }

  return contexts.slice(0, 3);
}

interface NamedEntity {
  name: string;
  type: 'project' | 'organization' | 'product' | 'concept';
  confidence: number;
}

function extractNamedEntities(text: string): NamedEntity[] {
  const entities: NamedEntity[] = [];

  // Match capitalized phrases (2-4 words)
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  let match: RegExpExecArray | null;

  while ((match = capitalizedPattern.exec(text)) !== null) {
    const phrase = match[1];

    // Skip common titles and phrases
    if (isCommonPhrase(phrase)) continue;

    // Determine entity type heuristically
    let type: NamedEntity['type'] = 'concept';
    let confidence = 0.5;

    if (/project|initiative|program/i.test(phrase)) {
      type = 'project';
      confidence = 0.7;
    } else if (/inc|corp|llc|company|team|group/i.test(phrase)) {
      type = 'organization';
      confidence = 0.7;
    } else if (/app|platform|tool|system/i.test(phrase)) {
      type = 'product';
      confidence = 0.6;
    }

    entities.push({ name: phrase, type, confidence });
  }

  return entities;
}

function isCommonPhrase(phrase: string): boolean {
  const commonPhrases = [
    'The',
    'This',
    'That',
    'These',
    'Those',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return commonPhrases.some(
    (cp) => phrase === cp || phrase.startsWith(cp + ' ')
  );
}

function deduplicateThemes(insights: ExtractedInsight[]): ExtractedInsight[] {
  const seen = new Map<string, ExtractedInsight>();

  for (const insight of insights) {
    const key = insight.content.toLowerCase();

    const existing = seen.get(key);
    if (!existing || insight.confidence > existing.confidence) {
      seen.set(key, insight);
    }
  }

  return Array.from(seen.values());
}
