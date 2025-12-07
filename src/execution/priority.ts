/**
 * Priority Scoring Engine
 * Salience-based prioritization from PRD Section 13
 */

import type { Task, Insight, PriorityScore, QAProfile } from '@/domain';

// ============================================================================
// CONSTANTS
// ============================================================================

const URGENCY_HIGH_THRESHOLD_HOURS = 48;
const URGENCY_HIGH_WEIGHT = 1.0;
const URGENCY_LOW_WEIGHT = 0.3;

const CONTENT_TYPE_WEIGHTS: Record<string, number> = {
  email_external: 0.9,
  internal_note: 0.2,
  analysis: 0.6,
  research: 0.4,
  user_action: 0.5,
  agent_action: 0.4,
  external_wait: 0.7,
};

const PRIORITY_BASE_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.8,
  normal: 0.5,
  low: 0.2,
};

// ============================================================================
// URGENCY CALCULATION
// ============================================================================

/**
 * Calculate urgency weight based on due date proximity
 */
export function calculateUrgency(task: Task): number {
  if (!task.dueDate) {
    return URGENCY_LOW_WEIGHT;
  }

  const now = new Date();
  const dueDate = new Date(task.dueDate);
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Overdue tasks are most urgent
  if (hoursUntilDue < 0) {
    return URGENCY_HIGH_WEIGHT + 0.2; // Boost for overdue
  }

  // Due within threshold = high urgency
  if (hoursUntilDue < URGENCY_HIGH_THRESHOLD_HOURS) {
    return URGENCY_HIGH_WEIGHT;
  }

  // Gradual decay for tasks further out
  const daysUntilDue = hoursUntilDue / 24;
  if (daysUntilDue < 7) {
    return 0.7;
  }
  if (daysUntilDue < 14) {
    return 0.5;
  }

  return URGENCY_LOW_WEIGHT;
}

// ============================================================================
// RISK CALCULATION
// ============================================================================

/**
 * Calculate risk weight based on task properties
 * Domain risk is derived from external refs, tags, and content type
 */
export function calculateRisk(task: Task, insights: Insight[] = []): number {
  let risk = 0;

  // External references increase risk
  if (task.externalRefs.length > 0) {
    const hasEmail = task.externalRefs.some((r) => r.kind === 'email');
    const hasExternal = task.externalRefs.some((r) =>
      ['client', 'customer', 'partner', 'external'].includes(r.kind)
    );

    if (hasEmail) risk += 0.3;
    if (hasExternal) risk += 0.4;
  }

  // Check for high-risk tags
  const highRiskTags = ['urgent', 'critical', 'external', 'client', 'deadline', 'blocker'];
  const hasHighRiskTag = task.tags.some((t) =>
    highRiskTags.some((hr) => t.toLowerCase().includes(hr))
  );
  if (hasHighRiskTag) risk += 0.3;

  // Priority affects risk
  if (task.priority === 'critical') risk += 0.3;
  else if (task.priority === 'high') risk += 0.2;

  // Check for related insights that might indicate risk
  const riskInsights = insights.filter(
    (i) =>
      i.type === 'commitment' &&
      i.content.toLowerCase().includes(task.title.toLowerCase().slice(0, 20))
  );
  if (riskInsights.length > 0) risk += 0.2;

  return Math.min(1, risk);
}

// ============================================================================
// CONTENT TYPE WEIGHT
// ============================================================================

/**
 * Calculate content type weight based on task type and properties
 */
export function calculateContentTypeWeight(task: Task): number {
  // Check external refs for content type hints
  if (task.externalRefs.some((r) => r.kind === 'email')) {
    const hasExternal = task.externalRefs.some((r) =>
      ['external', 'client', 'customer'].includes(r.kind)
    );
    return hasExternal
      ? CONTENT_TYPE_WEIGHTS.email_external
      : CONTENT_TYPE_WEIGHTS.internal_note;
  }

  // Fall back to task type
  return CONTENT_TYPE_WEIGHTS[task.type] ?? 0.5;
}

// ============================================================================
// PREFERENCE WEIGHT
// ============================================================================

/**
 * Calculate preference weight based on user insights
 */
export function calculatePreferenceWeight(task: Task, insights: Insight[]): number {
  if (insights.length === 0) return 0.5;

  // Find preference insights that match this task
  const preferenceInsights = insights.filter((i) => i.type === 'preference');

  let preferenceScore = 0.5;
  let matchCount = 0;

  for (const insight of preferenceInsights) {
    // Check for tag matches
    const insightTerms = insight.content.toLowerCase().split(/\s+/);
    const taskTerms = [
      ...task.tags.map((t) => t.toLowerCase()),
      task.title.toLowerCase(),
    ];

    const hasMatch = insightTerms.some((term) =>
      taskTerms.some((tt) => tt.includes(term) || term.includes(tt))
    );

    if (hasMatch) {
      preferenceScore += insight.confidence * 0.2;
      matchCount++;
    }
  }

  // Normalize
  if (matchCount > 0) {
    preferenceScore = Math.min(1, preferenceScore);
  }

  return preferenceScore;
}

// ============================================================================
// COMPOSITE SCORE
// ============================================================================

/**
 * Calculate full priority score for a task
 */
export function calculatePriorityScore(
  task: Task,
  insights: Insight[] = []
): PriorityScore {
  const urgency = calculateUrgency(task);
  const risk = calculateRisk(task, insights);
  const contentType = calculateContentTypeWeight(task);
  const preference = calculatePreferenceWeight(task, insights);

  // Composite score with weighted combination
  const composite =
    urgency * 0.35 +
    risk * 0.25 +
    contentType * 0.2 +
    preference * 0.1 +
    PRIORITY_BASE_WEIGHTS[task.priority] * 0.1;

  return {
    urgency,
    risk,
    contentType,
    preference,
    composite: Math.min(1, composite),
  };
}

// ============================================================================
// QA PROFILE DETERMINATION
// ============================================================================

/**
 * Determine QA profile based on priority score
 * From PRD Section 13 threshold logic
 */
export function determineQAProfile(score: PriorityScore, taskType?: string): QAProfile {
  // urgency + risk > 1.3 → high_rigor
  if (score.urgency + score.risk > 1.3) {
    return 'high_rigor';
  }

  // external + risk > 0.7 → high_rigor
  if (score.contentType >= 0.9 && score.risk > 0.7) {
    return 'high_rigor';
  }

  // brainstorming → fast_draft
  if (taskType === 'brainstorming' || score.composite < 0.3) {
    return 'fast_draft';
  }

  // otherwise → balanced
  return 'balanced';
}

// ============================================================================
// SORTING & RANKING
// ============================================================================

/**
 * Sort tasks by priority score
 */
export function sortByPriority(
  tasks: Task[],
  insights: Insight[] = []
): Array<{ task: Task; score: PriorityScore }> {
  return tasks
    .map((task) => ({
      task,
      score: calculatePriorityScore(task, insights),
    }))
    .sort((a, b) => b.score.composite - a.score.composite);
}

/**
 * Get top N priority tasks
 */
export function getTopPriorityTasks(
  tasks: Task[],
  n: number,
  insights: Insight[] = []
): Task[] {
  return sortByPriority(tasks, insights)
    .slice(0, n)
    .map((item) => item.task);
}

/**
 * Group tasks by priority tier
 */
export function groupByPriorityTier(
  tasks: Task[],
  insights: Insight[] = []
): {
  critical: Task[];
  high: Task[];
  normal: Task[];
  low: Task[];
} {
  const scored = sortByPriority(tasks, insights);

  return {
    critical: scored.filter((s) => s.score.composite >= 0.8).map((s) => s.task),
    high: scored
      .filter((s) => s.score.composite >= 0.6 && s.score.composite < 0.8)
      .map((s) => s.task),
    normal: scored
      .filter((s) => s.score.composite >= 0.4 && s.score.composite < 0.6)
      .map((s) => s.task),
    low: scored.filter((s) => s.score.composite < 0.4).map((s) => s.task),
  };
}
