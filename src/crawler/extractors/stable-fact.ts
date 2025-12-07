/**
 * Stable Fact Extractor
 * Extracts biographical and persistent information about users, people, organizations
 */

import type { InsightType } from '@/domain';
import type {
  InsightExtractor,
  ExtractionSource,
  ExtractedInsight,
} from './base';
import { extractKeywords } from './base';

// ============================================================================
// STABLE FACT PATTERNS
// ============================================================================

const PERSONAL_INFO_PATTERNS = [
  // Job/Role
  /(?:i am|i'm|i work as|my role is|my title is|my job is) (?:a |an |the )?(.+?)(?:\.|,|$)/gi,
  /(?:i|we) (?:work|am|are) (?:at|for|with) (.+?)(?:\.|,|$)/gi,

  // Location
  /(?:i live|i'm based|i'm located|we're located|our office is) (?:in|at) (.+?)(?:\.|,|$)/gi,
  /(?:my|our) (?:office|headquarters|location) is (?:in|at) (.+?)(?:\.|,|$)/gi,

  // Contact info
  /(?:my email|email me at|reach me at|contact me at) ([^\s,]+@[^\s,]+)/gi,
  /(?:my phone|call me at|reach me at) ([\d\-\+\(\)\s]{10,})/gi,

  // Team/Organization
  /(?:my team|our team|the team) (?:is called|is named|is) (.+?)(?:\.|,|$)/gi,
  /(?:i manage|i lead|i'm on) (?:the )?(.+?) team/gi,
  /(?:our company|we are|the company is) (.+?)(?:\.|,|$)/gi,

  // Reporting structure
  /(?:i report to|my manager is|my boss is) (.+?)(?:\.|,|$)/gi,
  /(.+?) (?:reports to me|is on my team|works for me)/gi,
];

const RELATIONSHIP_PATTERNS = [
  // Professional relationships
  /(.+?) is (?:my|our) (?:client|customer|partner|vendor|supplier)/gi,
  /(?:working with|collaborating with|partnering with) (.+?)(?:\.|,|$)/gi,

  // Personal mentions
  /(?:my (?:wife|husband|partner|spouse)) (.+?)(?:\.|,|$)/gi,
  /(?:my (?:assistant|EA|admin)) (?:is )?(.+?)(?:\.|,|$)/gi,
];

const TOOL_PATTERNS = [
  // Tools and systems
  /(?:we use|i use|our team uses|we work with) (.+?) (?:for|to)/gi,
  /(?:our|my) (?:crm|erp|pm tool|project management|calendar) is (.+?)(?:\.|,|$)/gi,
];

// ============================================================================
// STABLE FACT EXTRACTOR
// ============================================================================

export const stableFactExtractor: InsightExtractor = {
  type: 'stable_fact' as InsightType,
  name: 'Stable Fact Extractor',

  canHandle(source: ExtractionSource): boolean {
    return ['user_interaction', 'email', 'agent_output'].includes(source.type);
  },

  async extract(source: ExtractionSource): Promise<ExtractedInsight[]> {
    const insights: ExtractedInsight[] = [];

    // Extract personal info
    for (const pattern of PERSONAL_INFO_PATTERNS) {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const factText = match[1]?.trim();

        if (!factText || factText.length < 2 || factText.length > 150) {
          continue;
        }

        const factType = classifyPersonalFact(pattern.source);

        insights.push({
          type: 'stable_fact' as InsightType,
          content: factText,
          confidence: 0.8,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            factType,
            category: 'personal',
            originalMatch: match[0].slice(0, 100),
          },
        });
      }
    }

    // Extract relationships
    for (const pattern of RELATIONSHIP_PATTERNS) {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const entity = match[1]?.trim();

        if (!entity || entity.length < 2 || entity.length > 100) {
          continue;
        }

        const relationshipType = classifyRelationship(pattern.source);

        insights.push({
          type: 'stable_fact' as InsightType,
          content: entity,
          confidence: 0.75,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            factType: 'relationship',
            relationshipType,
            category: 'relationship',
            originalMatch: match[0].slice(0, 100),
          },
        });
      }
    }

    // Extract tool preferences
    for (const pattern of TOOL_PATTERNS) {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const tool = match[1]?.trim();

        if (!tool || tool.length < 2 || tool.length > 50) {
          continue;
        }

        insights.push({
          type: 'stable_fact' as InsightType,
          content: tool,
          confidence: 0.7,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            factType: 'tool',
            category: 'technology',
            originalMatch: match[0].slice(0, 100),
          },
        });
      }
    }

    // Extract email addresses and names
    const emailPattern = /([A-Za-z][A-Za-z\s]+?) ?<([^\s@]+@[^\s@]+\.[^\s@]+)>/g;
    let emailMatch;
    while ((emailMatch = emailPattern.exec(source.content)) !== null) {
      const name = emailMatch[1].trim();
      const email = emailMatch[2];

      if (name.length >= 2 && name.length <= 50) {
        insights.push({
          type: 'stable_fact' as InsightType,
          content: `${name} (${email})`,
          confidence: 0.9,
          sourceRefs: [source.sourceRef || `${source.type}:${source.timestamp}`],
          metadata: {
            factType: 'contact',
            category: 'contact',
            name,
            email,
          },
        });
      }
    }

    return deduplicateFacts(insights);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type PersonalFactType =
  | 'job_title'
  | 'organization'
  | 'location'
  | 'contact'
  | 'team'
  | 'reporting';

function classifyPersonalFact(patternSource: string): PersonalFactType {
  if (/role|title|job|work as/i.test(patternSource)) {
    return 'job_title';
  }
  if (/work (?:at|for|with)|company/i.test(patternSource)) {
    return 'organization';
  }
  if (/live|based|located|office|headquarters/i.test(patternSource)) {
    return 'location';
  }
  if (/email|phone|call|reach/i.test(patternSource)) {
    return 'contact';
  }
  if (/team|manage|lead/i.test(patternSource)) {
    return 'team';
  }
  if (/report|manager|boss/i.test(patternSource)) {
    return 'reporting';
  }

  return 'organization';
}

type RelationshipType =
  | 'client'
  | 'partner'
  | 'vendor'
  | 'colleague'
  | 'personal'
  | 'assistant';

function classifyRelationship(patternSource: string): RelationshipType {
  if (/client|customer/i.test(patternSource)) {
    return 'client';
  }
  if (/partner/i.test(patternSource)) {
    return 'partner';
  }
  if (/vendor|supplier/i.test(patternSource)) {
    return 'vendor';
  }
  if (/wife|husband|spouse/i.test(patternSource)) {
    return 'personal';
  }
  if (/assistant|ea|admin/i.test(patternSource)) {
    return 'assistant';
  }

  return 'colleague';
}

function deduplicateFacts(insights: ExtractedInsight[]): ExtractedInsight[] {
  const seen = new Map<string, ExtractedInsight>();

  for (const insight of insights) {
    const key = insight.content.toLowerCase().trim();

    const existing = seen.get(key);
    if (!existing || insight.confidence > existing.confidence) {
      seen.set(key, insight);
    }
  }

  return Array.from(seen.values());
}
