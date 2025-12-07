/**
 * QA Profile Selection
 * Automatic selection based on PRD Section 13 thresholds
 */

import type { PriorityScore, QAProfile, Task } from '@/domain';
import { calculatePriorityScore } from '@/execution/priority';

// ============================================================================
// SELECTION THRESHOLDS (from PRD Section 13)
// ============================================================================

const URGENCY_RISK_HIGH_RIGOR_THRESHOLD = 1.3;
const EXTERNAL_RISK_HIGH_RIGOR_THRESHOLD = 0.7;
const EXTERNAL_CONTENT_TYPE_THRESHOLD = 0.9;
const BRAINSTORMING_THRESHOLD = 0.3;

// ============================================================================
// PROFILE SELECTION
// ============================================================================

/**
 * Select QA profile based on priority score
 * PRD Section 13 threshold logic:
 * - urgency + risk > 1.3 → high_rigor
 * - external + risk > 0.7 → high_rigor
 * - brainstorming → fast_draft
 * - otherwise → balanced
 */
export function selectQAProfile(
  score: PriorityScore,
  taskContext?: { type?: string; tags?: string[] }
): QAProfile {
  // High rigor conditions
  if (score.urgency + score.risk > URGENCY_RISK_HIGH_RIGOR_THRESHOLD) {
    return 'high_rigor';
  }

  if (
    score.contentType >= EXTERNAL_CONTENT_TYPE_THRESHOLD &&
    score.risk > EXTERNAL_RISK_HIGH_RIGOR_THRESHOLD
  ) {
    return 'high_rigor';
  }

  // Check for brainstorming context
  const isBrainstorming =
    taskContext?.type === 'brainstorming' ||
    taskContext?.tags?.some((t) =>
      ['brainstorm', 'draft', 'idea', 'exploration', 'thinking'].includes(
        t.toLowerCase()
      )
    );

  if (isBrainstorming || score.composite < BRAINSTORMING_THRESHOLD) {
    return 'fast_draft';
  }

  // Default to balanced
  return 'balanced';
}

/**
 * Select QA profile for a task
 */
export function selectQAProfileForTask(task: Task, insights: unknown[] = []): QAProfile {
  const score = calculatePriorityScore(task, insights as never);
  return selectQAProfile(score, {
    type: task.type,
    tags: task.tags,
  });
}

// ============================================================================
// CONTEXT-BASED SELECTION
// ============================================================================

export interface SelectionContext {
  isExternal?: boolean;
  isClientFacing?: boolean;
  isHighStakes?: boolean;
  isBrainstorming?: boolean;
  isInternal?: boolean;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Select QA profile based on explicit context
 */
export function selectQAProfileFromContext(context: SelectionContext): QAProfile {
  // High rigor for external/client-facing/high-stakes
  if (context.isExternal || context.isClientFacing || context.isHighStakes) {
    return 'high_rigor';
  }

  // High rigor for critical urgency
  if (context.urgencyLevel === 'critical') {
    return 'high_rigor';
  }

  // Fast draft for brainstorming
  if (context.isBrainstorming) {
    return 'fast_draft';
  }

  // Fast draft for purely internal, low-stakes work
  if (context.isInternal && context.urgencyLevel === 'low') {
    return 'fast_draft';
  }

  // Default to balanced
  return 'balanced';
}

// ============================================================================
// PROFILE ESCALATION
// ============================================================================

/**
 * Get the next stricter QA profile
 */
export function escalateProfile(currentProfile: QAProfile): QAProfile | null {
  switch (currentProfile) {
    case 'fast_draft':
      return 'balanced';
    case 'balanced':
      return 'high_rigor';
    case 'high_rigor':
      return null; // Already at strictest
    default:
      return 'balanced';
  }
}

/**
 * Get the next more lenient QA profile
 */
export function relaxProfile(currentProfile: QAProfile): QAProfile | null {
  switch (currentProfile) {
    case 'high_rigor':
      return 'balanced';
    case 'balanced':
      return 'fast_draft';
    case 'fast_draft':
      return null; // Already at most lenient
    default:
      return 'balanced';
  }
}

/**
 * Get all profiles in order of strictness
 */
export function getProfilesByStrictness(): QAProfile[] {
  return ['fast_draft', 'balanced', 'high_rigor'];
}

/**
 * Compare strictness of two profiles
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
export function compareProfileStrictness(a: QAProfile, b: QAProfile): number {
  const order: Record<QAProfile, number> = {
    fast_draft: 0,
    balanced: 1,
    high_rigor: 2,
  };
  return order[a] - order[b];
}
