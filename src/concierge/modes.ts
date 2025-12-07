/**
 * Interaction Mode Classifier
 * Classifies user intent into interaction modes (PRD Section 3)
 */

import type { InteractionMode } from '@/domain';

// Re-export for convenience
export type { InteractionMode } from '@/domain';

export interface ModeClassification {
  mode: InteractionMode;
  confidence: number;
  signals: string[];
  suggestedPrompt?: string;
}

// ============================================================================
// MODE PATTERNS
// ============================================================================

const MODE_PATTERNS: Record<InteractionMode, {
  keywords: RegExp[];
  phrases: RegExp[];
  contexts: string[];
}> = {
  creative_director: {
    keywords: [
      /vision/i, /strategy/i, /goal/i, /outcome/i, /objective/i,
      /direction/i, /plan/i, /initiative/i, /roadmap/i, /mission/i,
    ],
    phrases: [
      /i want to/i, /we need to/i, /the goal is/i, /imagine if/i,
      /what if we/i, /how about/i, /let's explore/i, /big picture/i,
      /long term/i, /ultimately/i, /our vision/i,
    ],
    contexts: ['planning', 'strategy', 'vision', 'brainstorm'],
  },

  chief_of_staff: {
    keywords: [
      /task/i, /todo/i, /action/i, /deadline/i, /schedule/i,
      /meeting/i, /follow[\s-]?up/i, /status/i, /update/i, /progress/i,
      /remind/i, /track/i, /prioritize/i, /urgent/i,
    ],
    phrases: [
      /what's next/i, /what do i need/i, /remind me/i, /schedule/i,
      /follow up on/i, /check on/i, /status of/i, /update on/i,
      /need to do/i, /have to/i, /by when/i, /due date/i,
    ],
    contexts: ['execution', 'operations', 'tracking', 'scheduling'],
  },

  think_aloud_interpreter: {
    keywords: [
      /thinking/i, /wondering/i, /maybe/i, /perhaps/i, /possibly/i,
      /idea/i, /thought/i, /considering/i, /exploring/i,
    ],
    phrases: [
      /i'm not sure/i, /let me think/i, /what about/i, /could be/i,
      /on one hand/i, /on the other/i, /i wonder/i, /just thinking/i,
      /brain dump/i, /stream of/i, /help me think/i, /figure out/i,
    ],
    contexts: ['ideation', 'exploration', 'uncertainty', 'brainstorm'],
  },

  symbiotic_collaboration: {
    keywords: [
      /together/i, /collaborate/i, /draft/i, /write/i, /create/i,
      /build/i, /design/i, /iterate/i, /refine/i, /edit/i,
    ],
    phrases: [
      /let's work on/i, /help me write/i, /can you draft/i,
      /what do you think/i, /back and forth/i, /refine this/i,
      /together on/i, /co-create/i, /pair on/i, /work through/i,
    ],
    contexts: ['creation', 'collaboration', 'iteration', 'refinement'],
  },
};

// ============================================================================
// MODE CLASSIFIER
// ============================================================================

/**
 * Classify user input into an interaction mode
 */
export function classifyMode(input: string): ModeClassification {
  const scores: Record<InteractionMode, { score: number; signals: string[] }> = {
    creative_director: { score: 0, signals: [] },
    chief_of_staff: { score: 0, signals: [] },
    think_aloud_interpreter: { score: 0, signals: [] },
    symbiotic_collaboration: { score: 0, signals: [] },
  };

  // Score each mode
  for (const [mode, patterns] of Object.entries(MODE_PATTERNS) as [InteractionMode, typeof MODE_PATTERNS[InteractionMode]][]) {
    // Check keywords (1 point each)
    for (const keyword of patterns.keywords) {
      if (keyword.test(input)) {
        scores[mode].score += 1;
        scores[mode].signals.push(`keyword: ${keyword.source}`);
      }
    }

    // Check phrases (2 points each - more specific)
    for (const phrase of patterns.phrases) {
      if (phrase.test(input)) {
        scores[mode].score += 2;
        scores[mode].signals.push(`phrase: ${phrase.source}`);
      }
    }
  }

  // Apply contextual adjustments
  applyContextualSignals(input, scores);

  // Find highest scoring mode
  let bestMode: InteractionMode = 'chief_of_staff'; // Default
  let bestScore = 0;
  let totalScore = 0;

  for (const [mode, data] of Object.entries(scores) as [InteractionMode, { score: number; signals: string[] }][]) {
    totalScore += data.score;
    if (data.score > bestScore) {
      bestScore = data.score;
      bestMode = mode;
    }
  }

  // Calculate confidence
  const confidence = totalScore > 0
    ? Math.min(0.95, 0.3 + (bestScore / totalScore) * 0.5 + Math.min(bestScore, 5) * 0.1)
    : 0.3;

  return {
    mode: bestMode,
    confidence,
    signals: scores[bestMode].signals,
    suggestedPrompt: getSuggestedPrompt(bestMode),
  };
}

/**
 * Apply contextual signals based on input characteristics
 */
function applyContextualSignals(
  input: string,
  scores: Record<InteractionMode, { score: number; signals: string[] }>
): void {
  const wordCount = input.split(/\s+/).length;
  const hasQuestion = /\?/.test(input);
  const hasExclamation = /!/.test(input);
  const hasList = /\n[-•*]|\d+\./m.test(input);
  const isShort = wordCount < 10;
  const isLong = wordCount > 50;

  // Long rambling input suggests think_aloud
  if (isLong && !hasList) {
    scores.think_aloud_interpreter.score += 2;
    scores.think_aloud_interpreter.signals.push('context: long_form_input');
  }

  // Short direct commands suggest chief_of_staff
  if (isShort && !hasQuestion) {
    scores.chief_of_staff.score += 1;
    scores.chief_of_staff.signals.push('context: short_command');
  }

  // Lists suggest structured planning
  if (hasList) {
    scores.creative_director.score += 1;
    scores.creative_director.signals.push('context: has_list');
  }

  // Questions about drafts/writing suggest symbiotic
  if (hasQuestion && /draft|write|create|help/i.test(input)) {
    scores.symbiotic_collaboration.score += 2;
    scores.symbiotic_collaboration.signals.push('context: creation_question');
  }
}

/**
 * Get a suggested prompt for the classified mode
 */
function getSuggestedPrompt(mode: InteractionMode): string {
  const prompts: Record<InteractionMode, string> = {
    creative_director: 'What outcome are you hoping to achieve?',
    chief_of_staff: 'What would you like me to help you execute?',
    think_aloud_interpreter: 'Let me help structure your thoughts. What are the key elements?',
    symbiotic_collaboration: 'Let\'s work on this together. What should we focus on first?',
  };

  return prompts[mode];
}

// ============================================================================
// MODE BEHAVIORS
// ============================================================================

export interface ModeBehavior {
  /** How proactive should the agent be */
  proactivity: 'reactive' | 'balanced' | 'proactive';

  /** Level of detail in responses */
  detailLevel: 'brief' | 'standard' | 'comprehensive';

  /** Whether to suggest related actions */
  suggestActions: boolean;

  /** Whether to automatically create tasks */
  autoCreateTasks: boolean;

  /** Response style */
  style: 'directive' | 'collaborative' | 'supportive';
}

export function getModeBehavior(mode: InteractionMode): ModeBehavior {
  const behaviors: Record<InteractionMode, ModeBehavior> = {
    creative_director: {
      proactivity: 'balanced',
      detailLevel: 'comprehensive',
      suggestActions: true,
      autoCreateTasks: false,
      style: 'collaborative',
    },

    chief_of_staff: {
      proactivity: 'proactive',
      detailLevel: 'brief',
      suggestActions: true,
      autoCreateTasks: true,
      style: 'directive',
    },

    think_aloud_interpreter: {
      proactivity: 'reactive',
      detailLevel: 'standard',
      suggestActions: false,
      autoCreateTasks: false,
      style: 'supportive',
    },

    symbiotic_collaboration: {
      proactivity: 'balanced',
      detailLevel: 'standard',
      suggestActions: true,
      autoCreateTasks: false,
      style: 'collaborative',
    },
  };

  return behaviors[mode];
}

// ============================================================================
// MODE TRANSITIONS
// ============================================================================

/**
 * Suggest mode transition based on conversation flow
 */
export function suggestModeTransition(
  currentMode: InteractionMode,
  conversationContext: {
    turnCount: number;
    recentTopics: string[];
    userSatisfaction?: 'positive' | 'neutral' | 'negative';
  }
): InteractionMode | null {
  const { turnCount, recentTopics, userSatisfaction } = conversationContext;

  // After planning (creative_director), often need execution (chief_of_staff)
  if (
    currentMode === 'creative_director' &&
    turnCount > 3 &&
    recentTopics.some((t) => /task|action|next step/i.test(t))
  ) {
    return 'chief_of_staff';
  }

  // After think_aloud clarification, often ready for action
  if (
    currentMode === 'think_aloud_interpreter' &&
    turnCount > 2 &&
    userSatisfaction === 'positive'
  ) {
    return 'chief_of_staff';
  }

  // If user seems frustrated in symbiotic, maybe they want direct execution
  if (currentMode === 'symbiotic_collaboration' && userSatisfaction === 'negative') {
    return 'chief_of_staff';
  }

  return null;
}
