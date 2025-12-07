/**
 * Confidence Scoring Module
 * Implements confidence scoring and decay for insights
 */

import type { Insight, InsightType } from '@/domain';

// ============================================================================
// CONFIDENCE SCORING TYPES
// ============================================================================

export interface ConfidenceFactors {
  /** Base confidence from extraction (0-1) */
  extractionConfidence: number;

  /** Number of times this insight has been corroborated */
  corroborationCount: number;

  /** Age of the insight in days */
  ageInDays: number;

  /** Number of distinct sources */
  sourceCount: number;

  /** Whether the user has explicitly confirmed */
  userConfirmed: boolean;

  /** Whether the user has explicitly denied */
  userDenied: boolean;
}

export interface ConfidenceScore {
  /** Final confidence score (0-1) */
  score: number;

  /** Individual factor contributions */
  factors: {
    base: number;
    corroboration: number;
    recency: number;
    sourceVariety: number;
    userFeedback: number;
  };

  /** Confidence level label */
  level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

  /** Whether the insight should be considered reliable */
  isReliable: boolean;
}

// ============================================================================
// CONFIDENCE CONFIGURATION
// ============================================================================

const CONFIDENCE_CONFIG = {
  // Decay settings
  halfLifeDays: {
    preference: 180, // Preferences decay slowly
    theme: 90, // Themes decay moderately
    commitment: 7, // Commitments decay quickly after deadline
    stable_fact: 365, // Stable facts decay very slowly
    recurring_constraint: 60, // Constraints need periodic validation
  } as Record<InsightType, number>,

  // Corroboration boost (diminishing returns)
  corroborationBoost: {
    first: 0.15,
    second: 0.1,
    third: 0.05,
    subsequent: 0.02,
  },

  // Source variety boost
  sourceVarietyBoost: 0.05, // Per additional unique source

  // User feedback impact
  userConfirmBoost: 0.3,
  userDenyPenalty: -0.8,

  // Reliability threshold
  reliabilityThreshold: 0.6,
};

// ============================================================================
// CONFIDENCE CALCULATOR
// ============================================================================

/**
 * Calculate comprehensive confidence score for an insight
 */
export function calculateConfidenceScore(
  insightType: InsightType,
  factors: ConfidenceFactors
): ConfidenceScore {
  // Start with base extraction confidence
  let score = factors.extractionConfidence;
  const factorContributions = {
    base: factors.extractionConfidence,
    corroboration: 0,
    recency: 0,
    sourceVariety: 0,
    userFeedback: 0,
  };

  // Apply corroboration boost
  const corroborationBoost = calculateCorroborationBoost(
    factors.corroborationCount
  );
  score += corroborationBoost;
  factorContributions.corroboration = corroborationBoost;

  // Apply recency decay
  const halfLife = CONFIDENCE_CONFIG.halfLifeDays[insightType] || 90;
  const decayFactor = calculateDecayFactor(factors.ageInDays, halfLife);
  const recencyAdjustment = (decayFactor - 1) * score;
  score *= decayFactor;
  factorContributions.recency = recencyAdjustment;

  // Apply source variety boost
  const sourceBoost = Math.min(
    0.2,
    (factors.sourceCount - 1) * CONFIDENCE_CONFIG.sourceVarietyBoost
  );
  score += sourceBoost;
  factorContributions.sourceVariety = sourceBoost;

  // Apply user feedback
  if (factors.userConfirmed) {
    score += CONFIDENCE_CONFIG.userConfirmBoost;
    factorContributions.userFeedback = CONFIDENCE_CONFIG.userConfirmBoost;
  } else if (factors.userDenied) {
    score += CONFIDENCE_CONFIG.userDenyPenalty;
    factorContributions.userFeedback = CONFIDENCE_CONFIG.userDenyPenalty;
  }

  // Clamp to valid range
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    factors: factorContributions,
    level: getConfidenceLevel(score),
    isReliable: score >= CONFIDENCE_CONFIG.reliabilityThreshold,
  };
}

/**
 * Calculate simple confidence with just age decay
 */
export function calculateSimpleConfidence(
  insightType: InsightType,
  baseConfidence: number,
  ageInDays: number
): number {
  const halfLife = CONFIDENCE_CONFIG.halfLifeDays[insightType] || 90;
  const decayFactor = calculateDecayFactor(ageInDays, halfLife);
  return Math.max(0, Math.min(1, baseConfidence * decayFactor));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateCorroborationBoost(count: number): number {
  if (count <= 0) return 0;

  let boost = 0;
  const { corroborationBoost } = CONFIDENCE_CONFIG;

  if (count >= 1) boost += corroborationBoost.first;
  if (count >= 2) boost += corroborationBoost.second;
  if (count >= 3) boost += corroborationBoost.third;
  if (count >= 4) boost += (count - 3) * corroborationBoost.subsequent;

  return Math.min(0.35, boost); // Cap at 35% boost
}

function calculateDecayFactor(ageInDays: number, halfLifeDays: number): number {
  if (ageInDays <= 0) return 1;

  // Exponential decay: factor = 2^(-age/halfLife)
  return Math.pow(2, -ageInDays / halfLifeDays);
}

function getConfidenceLevel(
  score: number
): ConfidenceScore['level'] {
  if (score >= 0.85) return 'very_high';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.3) return 'low';
  return 'very_low';
}

// ============================================================================
// INSIGHT CONFIDENCE OPERATIONS
// ============================================================================

/**
 * Update an insight's confidence based on new corroboration
 */
export function corroborateInsight(
  insight: Insight,
  newSourceRef: string
): Insight {
  const currentSources = insight.sourceRefs || [];
  const newSources = currentSources.includes(newSourceRef)
    ? currentSources
    : [...currentSources, newSourceRef];

  const ageInDays = calculateAgeInDays(insight.extractedAt);

  const newScore = calculateConfidenceScore(insight.type, {
    extractionConfidence: insight.confidence,
    corroborationCount: newSources.length - 1,
    ageInDays,
    sourceCount: newSources.length,
    userConfirmed: false,
    userDenied: false,
  });

  return {
    ...insight,
    confidence: newScore.score,
    sourceRefs: newSources,
    lastReinforcedAt: new Date().toISOString(),
  };
}

/**
 * Apply user feedback to insight confidence
 */
export function applyUserFeedback(
  insight: Insight,
  feedback: 'confirm' | 'deny'
): Insight {
  const ageInDays = calculateAgeInDays(insight.extractedAt);

  const newScore = calculateConfidenceScore(insight.type, {
    extractionConfidence: insight.confidence,
    corroborationCount: (insight.sourceRefs?.length || 1) - 1,
    ageInDays,
    sourceCount: insight.sourceRefs?.length || 1,
    userConfirmed: feedback === 'confirm',
    userDenied: feedback === 'deny',
  });

  return {
    ...insight,
    confidence: newScore.score,
    lastReinforcedAt: new Date().toISOString(),
  };
}

/**
 * Get insights that need revalidation
 */
export function getStaleInsights(
  insights: Insight[],
  thresholdDays: number = 30
): Insight[] {
  const now = Date.now();

  return insights.filter((insight) => {
    const ageInDays = calculateAgeInDays(insight.lastReinforcedAt || insight.extractedAt);
    const halfLife = CONFIDENCE_CONFIG.halfLifeDays[insight.type] || 90;

    // Consider stale if:
    // 1. Age exceeds threshold, or
    // 2. Confidence has decayed significantly
    return (
      ageInDays > thresholdDays ||
      calculateSimpleConfidence(insight.type, insight.confidence, ageInDays) <
        insight.confidence * 0.7
    );
  });
}

/**
 * Merge duplicate insights
 */
export function mergeInsights(
  existing: Insight,
  duplicate: Insight
): Insight {
  // Combine source refs
  const allSources = new Set([
    ...(existing.sourceRefs || []),
    ...(duplicate.sourceRefs || []),
  ]);

  // Take higher confidence
  const baseConfidence = Math.max(existing.confidence, duplicate.confidence);

  // Recalculate with corroboration
  const newScore = calculateConfidenceScore(existing.type, {
    extractionConfidence: baseConfidence,
    corroborationCount: allSources.size - 1,
    ageInDays: 0, // Fresh merge
    sourceCount: allSources.size,
    userConfirmed: false,
    userDenied: false,
  });

  return {
    ...existing,
    confidence: newScore.score,
    sourceRefs: Array.from(allSources),
    lastReinforcedAt: new Date().toISOString(),
  };
}

function calculateAgeInDays(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
