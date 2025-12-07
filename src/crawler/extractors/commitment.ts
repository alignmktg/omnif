/**
 * Commitment Extractor
 * Extracts promises, deadlines, and commitments from sources
 */

import type { InsightType } from '@/domain';
import type {
  InsightExtractor,
  ExtractionSource,
  ExtractedInsight,
} from './base';
import { extractKeywords } from './base';

// ============================================================================
// COMMITMENT PATTERNS
// ============================================================================

const COMMITMENT_PATTERNS = [
  // Promises
  /i (?:will|'ll|am going to|promise to|commit to) (.+?)(?:\.|$)/gi,
  /(?:we|i) (?:need to|have to|must|should) (.+?)(?:\.|$)/gi,

  // Deadlines
  /(?:by|before|until|due|deadline[: ]*) (.+?)(?:\.|$)/gi,
  /(?:deliver|complete|finish|submit|send) (?:by|before) (.+?)(?:\.|$)/gi,

  // Scheduled events
  /(?:scheduled|planned|set) for (.+?)(?:\.|$)/gi,
  /(?:meeting|call|review|presentation) (?:on|at) (.+?)(?:\.|$)/gi,

  // Agreements
  /(?:agreed|committed|promised) to (.+?)(?:\.|$)/gi,
  /(?:action item|todo|task)[: ]* (.+?)(?:\.|$)/gi,

  // Follow-ups
  /(?:follow up|get back|respond|reply) (?:by|on|within) (.+?)(?:\.|$)/gi,
  /(?:waiting for|expecting|pending) (.+?)(?:\.|$)/gi,
];

// Date patterns for deadline extraction
const DATE_PATTERNS = [
  // Relative dates
  /today|tomorrow|tonight/i,
  /next (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /(?:this|coming) (?:week|month|monday|tuesday|wednesday|thursday|friday)/i,
  /in (\d+) (?:days?|weeks?|months?|hours?)/i,
  /end of (?:day|week|month|quarter|year)/i,

  // Absolute dates
  /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?(?:,? \d{4})?/i,
  /\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/,
  /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,

  // Time patterns
  /\d{1,2}(?::\d{2})?\s*(?:am|pm)/i,
  /(?:morning|afternoon|evening|noon|midnight)/i,
];

// ============================================================================
// COMMITMENT EXTRACTOR
// ============================================================================

export const commitmentExtractor: InsightExtractor = {
  type: 'commitment' as InsightType,
  name: 'Commitment Extractor',

  canHandle(source: ExtractionSource): boolean {
    return ['user_interaction', 'email', 'agent_output'].includes(source.type);
  },

  async extract(source: ExtractionSource): Promise<ExtractedInsight[]> {
    const insights: ExtractedInsight[] = [];

    for (const pattern of COMMITMENT_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const commitmentText = match[1]?.trim() || match[0].trim();

        if (commitmentText.length < 5 || commitmentText.length > 300) {
          continue;
        }

        // Extract deadline if present
        const deadline = extractDeadline(commitmentText, source.content);

        // Determine commitment type
        const commitmentType = classifyCommitment(match[0]);

        // Calculate confidence
        let confidence = 0.6;
        if (deadline) {
          confidence += 0.15;
        }
        if (/promise|commit|agreed|must/i.test(match[0])) {
          confidence += 0.1;
        }
        if (/action item|todo|task/i.test(match[0])) {
          confidence += 0.1;
        }

        insights.push({
          type: 'commitment' as InsightType,
          content: commitmentText,
          confidence: Math.min(0.95, confidence),
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            commitmentType,
            deadline: deadline?.text || null,
            deadlineDate: deadline?.date || null,
            owner: extractOwner(match[0]),
            keywords: extractKeywords(commitmentText),
          },
        });
      }
    }

    return deduplicateCommitments(insights);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type CommitmentType = 'promise' | 'deadline' | 'meeting' | 'action_item' | 'follow_up' | 'general';

function classifyCommitment(text: string): CommitmentType {
  const lower = text.toLowerCase();

  if (/promise|commit|will|going to/i.test(lower)) {
    return 'promise';
  }
  if (/deadline|due|by|before/i.test(lower)) {
    return 'deadline';
  }
  if (/meeting|call|review|presentation/i.test(lower)) {
    return 'meeting';
  }
  if (/action item|todo|task/i.test(lower)) {
    return 'action_item';
  }
  if (/follow up|get back|respond|reply/i.test(lower)) {
    return 'follow_up';
  }

  return 'general';
}

interface DeadlineInfo {
  text: string;
  date: string | null;
}

function extractDeadline(
  commitmentText: string,
  fullContent: string
): DeadlineInfo | null {
  // Check commitment text and surrounding context
  const searchText = commitmentText + ' ' + getContext(fullContent, commitmentText, 50);

  for (const pattern of DATE_PATTERNS) {
    const match = searchText.match(pattern);
    if (match) {
      const dateText = match[0];
      const parsedDate = parseRelativeDate(dateText);

      return {
        text: dateText,
        date: parsedDate,
      };
    }
  }

  return null;
}

function getContext(fullText: string, snippet: string, chars: number): string {
  const index = fullText.indexOf(snippet);
  if (index === -1) return '';

  const start = Math.max(0, index - chars);
  const end = Math.min(fullText.length, index + snippet.length + chars);

  return fullText.slice(start, end);
}

function parseRelativeDate(dateText: string): string | null {
  const now = new Date();
  const lower = dateText.toLowerCase();

  // Handle relative dates
  if (lower === 'today') {
    return now.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Handle "in X days/weeks/months"
  const inMatch = lower.match(/in (\d+) (days?|weeks?|months?)/);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const future = new Date(now);

    if (unit.startsWith('day')) {
      future.setDate(future.getDate() + amount);
    } else if (unit.startsWith('week')) {
      future.setDate(future.getDate() + amount * 7);
    } else if (unit.startsWith('month')) {
      future.setMonth(future.getMonth() + amount);
    }

    return future.toISOString().split('T')[0];
  }

  // Handle "next week/month"
  if (/next week/i.test(lower)) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }
  if (/next month/i.test(lower)) {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split('T')[0];
  }

  // Handle "end of week/month"
  if (/end of week/i.test(lower)) {
    const endOfWeek = new Date(now);
    const daysUntilFriday = (5 - endOfWeek.getDay() + 7) % 7;
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilFriday);
    return endOfWeek.toISOString().split('T')[0];
  }
  if (/end of month/i.test(lower)) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return endOfMonth.toISOString().split('T')[0];
  }

  return null;
}

function extractOwner(text: string): 'self' | 'other' | 'shared' {
  const lower = text.toLowerCase();

  if (/^i |i will|i'll|i am|i need|i have/i.test(lower)) {
    return 'self';
  }
  if (/^we |we will|we'll|we need|we have/i.test(lower)) {
    return 'shared';
  }
  if (/they|he|she|you|waiting for|expecting/i.test(lower)) {
    return 'other';
  }

  return 'self';
}

function deduplicateCommitments(
  insights: ExtractedInsight[]
): ExtractedInsight[] {
  const seen = new Map<string, ExtractedInsight>();

  for (const insight of insights) {
    // Create a normalized key
    const key = insight.content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);

    const existing = seen.get(key);
    if (!existing || insight.confidence > existing.confidence) {
      seen.set(key, insight);
    }
  }

  return Array.from(seen.values());
}
