/**
 * Preference Extractor
 * Extracts user style and behavior preferences from sources
 */

import type { InsightType } from '@/domain';
import type {
  InsightExtractor,
  ExtractionSource,
  ExtractedInsight,
} from './base';
import { extractKeywords } from './base';

// ============================================================================
// PREFERENCE PATTERNS
// ============================================================================

const PREFERENCE_INDICATORS = [
  // Explicit preferences
  /i (?:always|usually|prefer|like|want|need) (?:to )?(.+)/gi,
  /(?:my|i) (?:favorite|preferred|default) (?:is|are) (.+)/gi,
  /i (?:don't|do not|never|hate|avoid) (.+)/gi,

  // Style patterns
  /(?:keep|make) (?:it|things) (.+)/gi,
  /(?:i|we) (?:work|communicate|operate) (?:best|better) (?:when|with) (.+)/gi,

  // Time preferences
  /i (?:work|prefer|like) (?:in the )?(morning|afternoon|evening|night)/gi,
  /(?:before|after|by) (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,

  // Communication style
  /(?:keep|be) (?:brief|concise|detailed|thorough)/gi,
  /(?:no|avoid|skip) (?:small talk|pleasantries|formalities)/gi,
];

const NEGATIVE_PREFERENCES = [
  /don't|do not|never|hate|avoid|dislike|can't stand/i,
];

// ============================================================================
// PREFERENCE EXTRACTOR
// ============================================================================

export const preferenceExtractor: InsightExtractor = {
  type: 'preference' as InsightType,
  name: 'Preference Extractor',

  canHandle(source: ExtractionSource): boolean {
    return ['user_interaction', 'agent_output', 'email'].includes(source.type);
  },

  async extract(source: ExtractionSource): Promise<ExtractedInsight[]> {
    const insights: ExtractedInsight[] = [];
    const content = source.content.toLowerCase();

    for (const pattern of PREFERENCE_INDICATORS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const preferenceText = match[1]?.trim() || match[0].trim();

        if (preferenceText.length < 3 || preferenceText.length > 200) {
          continue;
        }

        const matchText = match[0];

        // Determine if negative preference
        const isNegative = NEGATIVE_PREFERENCES.some((neg) =>
          neg.test(matchText)
        );

        // Calculate confidence based on explicitness
        let confidence = 0.6;
        if (/always|never|must|require/i.test(matchText)) {
          confidence = 0.85;
        } else if (/prefer|like|usually/i.test(matchText)) {
          confidence = 0.7;
        }

        // Extract keywords for categorization
        const keywords = extractKeywords(preferenceText);

        insights.push({
          type: 'preference' as InsightType,
          content: preferenceText,
          confidence,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            isNegative,
            keywords,
            originalMatch: matchText,
            category: categorizePreference(preferenceText, keywords),
          },
        });
      }
    }

    // Deduplicate similar preferences
    return deduplicatePreferences(insights);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type PreferenceCategory =
  | 'communication'
  | 'timing'
  | 'style'
  | 'tool'
  | 'process'
  | 'general';

function categorizePreference(
  text: string,
  keywords: string[]
): PreferenceCategory {
  const lowerText = text.toLowerCase();

  if (
    /email|message|call|meeting|chat|slack|teams/i.test(lowerText) ||
    keywords.some((k) => ['email', 'message', 'call', 'meeting'].includes(k))
  ) {
    return 'communication';
  }

  if (
    /morning|afternoon|evening|night|hour|time|day|week/i.test(lowerText) ||
    keywords.some((k) => ['morning', 'afternoon', 'evening', 'time'].includes(k))
  ) {
    return 'timing';
  }

  if (
    /brief|concise|detailed|formal|casual|tone|style/i.test(lowerText) ||
    keywords.some((k) => ['brief', 'concise', 'detailed', 'formal'].includes(k))
  ) {
    return 'style';
  }

  if (
    /tool|app|software|use|using/i.test(lowerText) ||
    keywords.some((k) => ['tool', 'app', 'software'].includes(k))
  ) {
    return 'tool';
  }

  if (
    /process|workflow|step|method|approach/i.test(lowerText) ||
    keywords.some((k) => ['process', 'workflow', 'step', 'method'].includes(k))
  ) {
    return 'process';
  }

  return 'general';
}

function deduplicatePreferences(
  insights: ExtractedInsight[]
): ExtractedInsight[] {
  const seen = new Map<string, ExtractedInsight>();

  for (const insight of insights) {
    const key = insight.content.toLowerCase().replace(/\s+/g, ' ').trim();

    const existing = seen.get(key);
    if (!existing || insight.confidence > existing.confidence) {
      seen.set(key, insight);
    }
  }

  return Array.from(seen.values());
}
