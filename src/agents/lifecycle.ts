/**
 * Agent Lifecycle State Machine
 * Manages agent run state transitions (PRD Section 8)
 */

import type { AgentRun, AgentStatus } from '@/domain';

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

export type AgentEvent =
  | { type: 'START' }
  | { type: 'COMPLETE'; response: unknown }
  | { type: 'FAIL'; error: string; isTransient: boolean }
  | { type: 'BLOCK'; reason: string }
  | { type: 'RETRY' }
  | { type: 'SOFT_TIMEOUT' }
  | { type: 'HARD_TIMEOUT' }
  | { type: 'ESCALATE' };

export interface StateTransitionResult {
  newStatus: AgentStatus;
  shouldRetry: boolean;
  shouldEscalate: boolean;
  error?: string;
}

// ============================================================================
// VALID TRANSITIONS
// ============================================================================

const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  pending: ['running'],
  running: ['completed', 'blocked', 'failed'],
  completed: [], // Terminal state
  blocked: ['pending', 'running'], // Can retry or be unblocked
  failed: ['pending'], // Can retry once
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

/**
 * Process a state machine event and determine the new state
 */
export function processEvent(
  currentState: AgentStatus,
  retryCount: number,
  event: AgentEvent
): StateTransitionResult {
  switch (event.type) {
    case 'START':
      if (currentState !== 'pending') {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: false,
          error: `Cannot start agent from ${currentState} state`,
        };
      }
      return {
        newStatus: 'running',
        shouldRetry: false,
        shouldEscalate: false,
      };

    case 'COMPLETE':
      if (currentState !== 'running') {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: false,
          error: `Cannot complete agent from ${currentState} state`,
        };
      }
      return {
        newStatus: 'completed',
        shouldRetry: false,
        shouldEscalate: false,
      };

    case 'FAIL':
      if (currentState !== 'running') {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: false,
          error: `Cannot fail agent from ${currentState} state`,
        };
      }

      // PRD: One automatic retry on transient failure
      if (event.isTransient && retryCount < 1) {
        return {
          newStatus: 'failed',
          shouldRetry: true,
          shouldEscalate: false,
          error: event.error,
        };
      }

      // Semantic error or max retries reached - escalate
      return {
        newStatus: 'failed',
        shouldRetry: false,
        shouldEscalate: true,
        error: event.error,
      };

    case 'BLOCK':
      if (currentState !== 'running') {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: false,
          error: `Cannot block agent from ${currentState} state`,
        };
      }
      return {
        newStatus: 'blocked',
        shouldRetry: false,
        shouldEscalate: false,
        error: event.reason,
      };

    case 'RETRY':
      if (currentState !== 'failed' && currentState !== 'blocked') {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: false,
          error: `Cannot retry agent from ${currentState} state`,
        };
      }
      if (retryCount >= 1) {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: true,
          error: 'Max retries exceeded',
        };
      }
      return {
        newStatus: 'pending',
        shouldRetry: true,
        shouldEscalate: false,
      };

    case 'SOFT_TIMEOUT':
      // Emit progress_required event, don't change state
      return {
        newStatus: currentState,
        shouldRetry: false,
        shouldEscalate: false,
      };

    case 'HARD_TIMEOUT':
      if (currentState !== 'running') {
        return {
          newStatus: currentState,
          shouldRetry: false,
          shouldEscalate: false,
        };
      }
      return {
        newStatus: 'blocked',
        shouldRetry: false,
        shouldEscalate: false,
        error: 'Hard timeout reached',
      };

    case 'ESCALATE':
      return {
        newStatus: currentState,
        shouldRetry: false,
        shouldEscalate: true,
      };

    default:
      return {
        newStatus: currentState,
        shouldRetry: false,
        shouldEscalate: false,
        error: 'Unknown event type',
      };
  }
}

// ============================================================================
// LIFECYCLE HELPERS
// ============================================================================

/**
 * Check if an agent run can be started
 */
export function canStart(run: AgentRun): boolean {
  return run.status === 'pending';
}

/**
 * Check if an agent run can be retried
 */
export function canRetry(run: AgentRun): boolean {
  return (
    (run.status === 'failed' || run.status === 'blocked') &&
    run.retryCount < 1
  );
}

/**
 * Check if an agent run is in a terminal state
 */
export function isTerminal(run: AgentRun): boolean {
  return run.status === 'completed' || (run.status === 'failed' && run.retryCount >= 1);
}

/**
 * Check if an agent run is active (pending or running)
 */
export function isActive(run: AgentRun): boolean {
  return run.status === 'pending' || run.status === 'running';
}

/**
 * Check if an agent run needs attention (blocked or failed)
 */
export function needsAttention(run: AgentRun): boolean {
  return run.status === 'blocked' || run.status === 'failed';
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return 'Waiting to start';
    case 'running':
      return 'Currently executing';
    case 'completed':
      return 'Successfully completed';
    case 'blocked':
      return 'Blocked - requires input or decision';
    case 'failed':
      return 'Failed - may be retryable';
    default:
      return 'Unknown status';
  }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an error as transient or semantic
 */
export function classifyError(error: Error | string): { isTransient: boolean; message: string } {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Transient errors that can be retried
  const transientPatterns = [
    'timeout',
    'network',
    'connection',
    'rate limit',
    'rate_limit',
    '429',
    '500',
    '502',
    '503',
    '504',
    'temporarily',
    'retry',
    'econnreset',
    'enotfound',
    'etimedout',
  ];

  const isTransient = transientPatterns.some((pattern) =>
    lowerMessage.includes(pattern)
  );

  return { isTransient, message };
}
