/**
 * QA Escalation Handler
 * Handles QA failures and escalation logic (PRD Section 8)
 */

import type { AgentRun, QAProfile } from '@/domain';
import { escalateProfile } from './selection';
import type { CompositeCheckResult } from './checks';
import type { QAProfileDefinition } from './profiles';
import { getProfile } from './profiles';

// ============================================================================
// ESCALATION TYPES
// ============================================================================

export type EscalationAction = 'retry_stricter' | 'require_user_input' | 'auto_approve';

export interface EscalationResult {
  action: EscalationAction;
  newProfileId?: QAProfile;
  userPrompt?: string;
  reason: string;
}

export interface EscalationContext {
  failureCount: number;
  currentProfile: QAProfile;
  checkResult: CompositeCheckResult;
  agentRun?: AgentRun;
}

// ============================================================================
// ESCALATION LOGIC
// ============================================================================

/**
 * Handle a QA failure and determine next action
 * PRD Section 8: QA fails twice → re-run with stricter rigor or require user input
 */
export function handleQAFailure(context: EscalationContext): EscalationResult {
  const profile = getProfile(context.currentProfile);
  const maxFailures = profile.maxFailuresBeforeEscalate;

  // First failure - retry with same profile
  if (context.failureCount < maxFailures - 1) {
    return {
      action: 'retry_stricter',
      newProfileId: context.currentProfile,
      reason: `QA check failed (attempt ${context.failureCount + 1}/${maxFailures}). Retrying...`,
    };
  }

  // Can escalate to stricter profile
  const stricterProfile = escalateProfile(context.currentProfile);
  if (stricterProfile) {
    return {
      action: 'retry_stricter',
      newProfileId: stricterProfile,
      reason: `QA check failed ${context.failureCount + 1} times. Escalating to ${stricterProfile} profile.`,
    };
  }

  // Already at strictest profile - require user input
  return {
    action: 'require_user_input',
    userPrompt: generateUserPrompt(context),
    reason: `QA check failed at highest rigor level. User decision required.`,
  };
}

/**
 * Generate a user-friendly prompt for escalation
 */
function generateUserPrompt(context: EscalationContext): string {
  const issues = context.checkResult.allIssues;
  const score = (context.checkResult.overallScore * 100).toFixed(0);

  let prompt = `## QA Check Failed\n\n`;
  prompt += `**Score:** ${score}%\n`;
  prompt += `**Profile:** ${context.currentProfile}\n`;
  prompt += `**Attempts:** ${context.failureCount + 1}\n\n`;

  if (issues.length > 0) {
    prompt += `### Issues Found\n`;
    for (const issue of issues) {
      prompt += `- ${issue}\n`;
    }
    prompt += '\n';
  }

  prompt += `### Options\n`;
  prompt += `1. **Approve anyway** - Accept the output despite issues\n`;
  prompt += `2. **Provide guidance** - Give additional context or constraints\n`;
  prompt += `3. **Retry manually** - Re-run with modified objective\n`;
  prompt += `4. **Cancel** - Abandon this task\n`;

  return prompt;
}

// ============================================================================
// ESCALATION STATE TRACKING
// ============================================================================

export interface EscalationState {
  runId: string;
  failureCount: number;
  profileHistory: QAProfile[];
  checkHistory: CompositeCheckResult[];
  lastAction?: EscalationAction;
  resolved: boolean;
}

/**
 * Create initial escalation state
 */
export function createEscalationState(runId: string): EscalationState {
  return {
    runId,
    failureCount: 0,
    profileHistory: [],
    checkHistory: [],
    resolved: false,
  };
}

/**
 * Update escalation state after a check
 */
export function updateEscalationState(
  state: EscalationState,
  profile: QAProfile,
  result: CompositeCheckResult,
  action: EscalationAction
): EscalationState {
  return {
    ...state,
    failureCount: result.passed ? 0 : state.failureCount + 1,
    profileHistory: [...state.profileHistory, profile],
    checkHistory: [...state.checkHistory, result],
    lastAction: action,
    resolved: result.passed || action === 'auto_approve',
  };
}

// ============================================================================
// AUTO-APPROVAL RULES
// ============================================================================

/**
 * Check if output can be auto-approved despite not passing all checks
 */
export function canAutoApprove(
  result: CompositeCheckResult,
  profile: QAProfile
): boolean {
  // Never auto-approve safety failures
  if (result.checkResults.safety && !result.checkResults.safety.passed) {
    return false;
  }

  // Auto-approve if score is close to threshold for fast_draft
  if (profile === 'fast_draft' && result.overallScore >= 0.4) {
    return true;
  }

  // Auto-approve if only minor alignment issues for balanced
  if (
    profile === 'balanced' &&
    result.overallScore >= 0.6 &&
    result.checkResults.correctness?.passed &&
    result.checkResults.safety?.passed
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// REMEDIATION SUGGESTIONS
// ============================================================================

export interface RemediationSuggestion {
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate remediation suggestions based on check results
 */
export function generateRemediations(
  result: CompositeCheckResult
): RemediationSuggestion[] {
  const suggestions: RemediationSuggestion[] = [];

  // Correctness remediations
  if (result.checkResults.correctness && !result.checkResults.correctness.passed) {
    for (const issue of result.checkResults.correctness.issues) {
      if (issue.includes('empty')) {
        suggestions.push({
          issue,
          suggestion: 'Provide more specific instructions or examples in the objective',
          priority: 'high',
        });
      } else if (issue.includes('short')) {
        suggestions.push({
          issue,
          suggestion: 'Request more detailed output or break into smaller tasks',
          priority: 'medium',
        });
      } else if (issue.includes('relevance')) {
        suggestions.push({
          issue,
          suggestion: 'Clarify the objective with more specific keywords',
          priority: 'high',
        });
      }
    }
  }

  // Alignment remediations
  if (result.checkResults.alignment && !result.checkResults.alignment.passed) {
    for (const issue of result.checkResults.alignment.issues) {
      if (issue.includes('word limit')) {
        suggestions.push({
          issue,
          suggestion: 'Increase the word limit or request a more concise format',
          priority: 'low',
        });
      } else if (issue.includes('artifact')) {
        suggestions.push({
          issue,
          suggestion: 'Adjust expected artifacts or provide format examples',
          priority: 'medium',
        });
      }
    }
  }

  // Safety remediations
  if (result.checkResults.safety && !result.checkResults.safety.passed) {
    for (const issue of result.checkResults.safety.issues) {
      suggestions.push({
        issue,
        suggestion: 'Review and sanitize the input content; consider rephrasing the objective',
        priority: 'high',
      });
    }
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
