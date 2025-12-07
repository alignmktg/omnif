/**
 * QA Profiles
 * Quality assurance profile definitions (PRD Section 8)
 */

import type { QAProfile } from '@/domain';

// ============================================================================
// CHECK TYPES
// ============================================================================

export type QACheckType = 'correctness' | 'alignment' | 'safety';

export interface QACheck {
  type: QACheckType;
  name: string;
  description: string;
  weight: number; // 0-1, contribution to overall score
  enabled: boolean;
}

// ============================================================================
// PROFILE DEFINITION
// ============================================================================

export interface QAProfileDefinition {
  id: QAProfile;
  name: string;
  description: string;
  checks: QACheck[];
  confidenceThreshold: number; // minimum to pass (0-1)
  maxFailuresBeforeEscalate: number;
}

// ============================================================================
// DEFAULT CHECKS
// ============================================================================

const correctnessCheck: QACheck = {
  type: 'correctness',
  name: 'Correctness Check',
  description: 'Verifies output matches the stated objective',
  weight: 0.4,
  enabled: true,
};

const alignmentCheck: QACheck = {
  type: 'alignment',
  name: 'Alignment Check',
  description: 'Verifies output matches constraints (style, length, format)',
  weight: 0.35,
  enabled: true,
};

const safetyCheck: QACheck = {
  type: 'safety',
  name: 'Safety Check',
  description: 'Verifies no harmful, inappropriate, or sensitive content',
  weight: 0.25,
  enabled: true,
};

// ============================================================================
// PROFILE DEFINITIONS
// ============================================================================

export const QA_PROFILES: Record<QAProfile, QAProfileDefinition> = {
  fast_draft: {
    id: 'fast_draft',
    name: 'Fast Draft',
    description: 'Minimal checks for brainstorming and rapid iteration',
    checks: [
      { ...safetyCheck, enabled: true }, // Safety always on
      { ...correctnessCheck, enabled: false },
      { ...alignmentCheck, enabled: false },
    ],
    confidenceThreshold: 0.5,
    maxFailuresBeforeEscalate: 3,
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Standard checks for most use cases',
    checks: [
      { ...correctnessCheck, enabled: true },
      { ...alignmentCheck, enabled: true },
      { ...safetyCheck, enabled: true },
    ],
    confidenceThreshold: 0.7,
    maxFailuresBeforeEscalate: 2,
  },
  high_rigor: {
    id: 'high_rigor',
    name: 'High Rigor',
    description: 'Extensive validation for external-facing or high-risk content',
    checks: [
      { ...correctnessCheck, enabled: true, weight: 0.35 },
      { ...alignmentCheck, enabled: true, weight: 0.35 },
      { ...safetyCheck, enabled: true, weight: 0.3 },
    ],
    confidenceThreshold: 0.85,
    maxFailuresBeforeEscalate: 2,
  },
};

// ============================================================================
// PROFILE HELPERS
// ============================================================================

/**
 * Get a QA profile definition by ID
 */
export function getProfile(profileId: QAProfile): QAProfileDefinition {
  return QA_PROFILES[profileId];
}

/**
 * Get all enabled checks for a profile
 */
export function getEnabledChecks(profileId: QAProfile): QACheck[] {
  const profile = getProfile(profileId);
  return profile.checks.filter((check) => check.enabled);
}

/**
 * Get the confidence threshold for a profile
 */
export function getConfidenceThreshold(profileId: QAProfile): number {
  return getProfile(profileId).confidenceThreshold;
}

/**
 * Check if a score passes the profile threshold
 */
export function passesThreshold(profileId: QAProfile, score: number): boolean {
  return score >= getProfile(profileId).confidenceThreshold;
}
