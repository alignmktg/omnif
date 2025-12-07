/**
 * Recurring Constraint Extractor
 * Extracts availability patterns, recurring commitments, and time constraints
 */

import type { InsightType } from '@/domain';
import type {
  InsightExtractor,
  ExtractionSource,
  ExtractedInsight,
} from './base';

// ============================================================================
// CONSTRAINT PATTERNS
// ============================================================================

const AVAILABILITY_PATTERNS = [
  // Blocked time
  /(?:i'm|i am|we're|we are) (?:busy|unavailable|booked|out) (?:on|every|each) (.+?)(?:\.|,|$)/gi,
  /(?:don't|do not|never) (?:schedule|book|plan) (?:anything|meetings|calls) (?:on|during|for) (.+?)(?:\.|,|$)/gi,
  /(.+?) (?:is|are) (?:blocked|reserved|off-limits)/gi,

  // Available time
  /(?:i'm|i am|we're) (?:free|available|open) (?:on|every|each) (.+?)(?:\.|,|$)/gi,
  /(?:best time|good time|preferred time) (?:is|for|to) (.+?)(?:\.|,|$)/gi,
  /(?:schedule|book|reach me) (?:during|between|from) (.+?)(?:\.|,|$)/gi,

  // Regular commitments
  /(?:every|each) (monday|tuesday|wednesday|thursday|friday|saturday|sunday) (.+?)(?:\.|,|$)/gi,
  /(?:weekly|daily|monthly|biweekly) (.+?)(?:\.|,|$)/gi,
  /(?:standing|recurring) (?:meeting|call|sync) (.+?)(?:\.|,|$)/gi,

  // Time zone
  /(?:i'm|i am|we're|we are) (?:in|on) (.+?) (?:time|timezone|tz)/gi,
  /(?:my|our) (?:timezone|time zone|tz) is (.+?)(?:\.|,|$)/gi,

  // Working hours
  /(?:i|we) (?:work|am available|start|finish) (?:from|at|until|by) (.+?)(?:\.|,|$)/gi,
  /(?:office hours|working hours|business hours) (?:are|is) (.+?)(?:\.|,|$)/gi,
];

const RECURRING_PATTERNS = [
  // Day patterns
  /(every|each) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
  /(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)/gi,

  // Frequency patterns
  /(weekly|daily|monthly|biweekly|quarterly|annually)/gi,
  /every (\d+) (days?|weeks?|months?)/gi,

  // Time of day
  /(morning|afternoon|evening|night)s?/gi,
  /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
];

// ============================================================================
// RECURRING CONSTRAINT EXTRACTOR
// ============================================================================

export const recurringConstraintExtractor: InsightExtractor = {
  type: 'recurring_constraint' as InsightType,
  name: 'Recurring Constraint Extractor',

  canHandle(source: ExtractionSource): boolean {
    return ['user_interaction', 'email', 'task_pattern'].includes(source.type);
  },

  async extract(source: ExtractionSource): Promise<ExtractedInsight[]> {
    const insights: ExtractedInsight[] = [];

    for (const pattern of AVAILABILITY_PATTERNS) {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const constraintText = (match[1] + (match[2] || '')).trim();

        if (constraintText.length < 3 || constraintText.length > 150) {
          continue;
        }

        const constraintType = classifyConstraint(match[0]);
        const recurrence = extractRecurrence(constraintText);
        const timeRange = extractTimeRange(constraintText);

        let confidence = 0.65;
        if (recurrence) {
          confidence += 0.15;
        }
        if (timeRange) {
          confidence += 0.1;
        }
        if (/always|never|every/i.test(match[0])) {
          confidence += 0.1;
        }

        insights.push({
          type: 'recurring_constraint' as InsightType,
          content: constraintText,
          confidence: Math.min(0.95, confidence),
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            constraintType,
            isAvailable: constraintType === 'availability',
            recurrence,
            timeRange,
            originalMatch: match[0].slice(0, 100),
          },
        });
      }
    }

    // Extract timezone mentions
    const tzPattern = /(?:pacific|eastern|central|mountain|utc|gmt|pst|est|cst|mst|pdt|edt|cdt|mdt)(?:\s*time)?/gi;
    let tzMatch;
    while ((tzMatch = tzPattern.exec(source.content)) !== null) {
      insights.push({
        type: 'recurring_constraint' as InsightType,
        content: tzMatch[0].toUpperCase(),
        confidence: 0.85,
        sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
        metadata: {
          constraintType: 'timezone',
          isAvailable: true,
        },
      });
    }

    return deduplicateConstraints(insights);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type ConstraintType =
  | 'availability'
  | 'blocked'
  | 'recurring_meeting'
  | 'working_hours'
  | 'timezone';

function classifyConstraint(text: string): ConstraintType {
  const lower = text.toLowerCase();

  if (/busy|unavailable|booked|out|blocked|don't|never/i.test(lower)) {
    return 'blocked';
  }
  if (/free|available|open|best time|good time/i.test(lower)) {
    return 'availability';
  }
  if (/standing|recurring|weekly|daily|monthly/i.test(lower)) {
    return 'recurring_meeting';
  }
  if (/office hours|working hours|work from|start|finish/i.test(lower)) {
    return 'working_hours';
  }
  if (/timezone|time zone|tz/i.test(lower)) {
    return 'timezone';
  }

  return 'availability';
}

interface RecurrenceInfo {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  days?: string[];
  interval?: number;
}

function extractRecurrence(text: string): RecurrenceInfo | null {
  const lower = text.toLowerCase();

  // Check for frequency keywords
  if (/daily|every day/i.test(lower)) {
    return { frequency: 'daily' };
  }
  if (/weekly|every week/i.test(lower)) {
    return { frequency: 'weekly' };
  }
  if (/biweekly|every two weeks|every other week/i.test(lower)) {
    return { frequency: 'biweekly' };
  }
  if (/monthly|every month/i.test(lower)) {
    return { frequency: 'monthly' };
  }

  // Check for specific days
  const dayNames = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const foundDays = dayNames.filter((day) => lower.includes(day));

  if (foundDays.length > 0) {
    return {
      frequency: 'weekly',
      days: foundDays,
    };
  }

  // Check for interval pattern
  const intervalMatch = lower.match(/every (\d+) (days?|weeks?|months?)/);
  if (intervalMatch) {
    const interval = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2];

    let frequency: RecurrenceInfo['frequency'] = 'custom';
    if (unit.startsWith('day') && interval === 1) {
      frequency = 'daily';
    } else if (unit.startsWith('week') && interval === 1) {
      frequency = 'weekly';
    } else if (unit.startsWith('week') && interval === 2) {
      frequency = 'biweekly';
    } else if (unit.startsWith('month') && interval === 1) {
      frequency = 'monthly';
    }

    return { frequency, interval };
  }

  return null;
}

interface TimeRange {
  start: string | null;
  end: string | null;
  period: 'morning' | 'afternoon' | 'evening' | 'night' | null;
}

function extractTimeRange(text: string): TimeRange | null {
  const lower = text.toLowerCase();

  // Check for time range pattern
  const rangeMatch = lower.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (rangeMatch) {
    return {
      start: normalizeTime(rangeMatch[1]),
      end: normalizeTime(rangeMatch[2]),
      period: null,
    };
  }

  // Check for time period
  if (/morning/i.test(lower)) {
    return { start: '09:00', end: '12:00', period: 'morning' };
  }
  if (/afternoon/i.test(lower)) {
    return { start: '12:00', end: '17:00', period: 'afternoon' };
  }
  if (/evening/i.test(lower)) {
    return { start: '17:00', end: '21:00', period: 'evening' };
  }
  if (/night/i.test(lower)) {
    return { start: '21:00', end: '23:59', period: 'night' };
  }

  return null;
}

function normalizeTime(timeStr: string): string {
  const lower = timeStr.toLowerCase().trim();

  // Parse hour and minute
  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return timeStr;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  // Convert to 24-hour format
  if (period === 'pm' && hour !== 12) {
    hour += 12;
  } else if (period === 'am' && hour === 12) {
    hour = 0;
  }

  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function deduplicateConstraints(
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
