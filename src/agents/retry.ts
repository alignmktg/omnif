/**
 * Agent Retry & Timeout Logic
 * Handles transient failures and timeouts (PRD Section 8)
 */

import type { AgentRun, AgentRunRequest } from '@/domain';
import { classifyError } from './lifecycle';

// ============================================================================
// RETRY POLICY
// ============================================================================

export interface RetryPolicy {
  maxRetries: number;
  softTimeoutMs: number;
  hardTimeoutMs: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 1, // PRD: one automatic retry
  softTimeoutMs: 30000, // 30 seconds - emit progress_required
  hardTimeoutMs: 120000, // 2 minutes - transition to blocked
  backoffBaseMs: 1000, // 1 second initial backoff
  backoffMaxMs: 10000, // 10 seconds max backoff
};

// ============================================================================
// RETRY DECISION
// ============================================================================

export interface RetryDecision {
  shouldRetry: boolean;
  reason: string;
  delayMs: number;
}

/**
 * Determine if a failed agent run should be retried
 */
export function shouldRetry(
  run: AgentRun,
  error: Error | string,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): RetryDecision {
  // Check retry count
  if (run.retryCount >= policy.maxRetries) {
    return {
      shouldRetry: false,
      reason: `Max retries (${policy.maxRetries}) exceeded`,
      delayMs: 0,
    };
  }

  // Classify the error
  const { isTransient, message } = classifyError(error);

  // Only retry transient errors
  if (!isTransient) {
    return {
      shouldRetry: false,
      reason: `Semantic error (not transient): ${message}`,
      delayMs: 0,
    };
  }

  // Calculate backoff delay
  const delayMs = calculateBackoff(run.retryCount, policy);

  return {
    shouldRetry: true,
    reason: `Transient error, will retry after ${delayMs}ms: ${message}`,
    delayMs,
  };
}

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoff(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  // Exponential backoff: base * 2^retry
  const exponentialDelay = policy.backoffBaseMs * Math.pow(2, retryCount);

  // Cap at max
  const cappedDelay = Math.min(exponentialDelay, policy.backoffMaxMs);

  // Add jitter (±20%)
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

// ============================================================================
// TIMEOUT HANDLING
// ============================================================================

export type TimeoutType = 'soft' | 'hard';

export interface TimeoutEvent {
  type: TimeoutType;
  elapsedMs: number;
  message: string;
}

/**
 * Check if a timeout has been reached
 */
export function checkTimeout(
  startTime: Date,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): TimeoutEvent | null {
  const elapsedMs = Date.now() - startTime.getTime();

  if (elapsedMs >= policy.hardTimeoutMs) {
    return {
      type: 'hard',
      elapsedMs,
      message: `Hard timeout reached after ${elapsedMs}ms (limit: ${policy.hardTimeoutMs}ms)`,
    };
  }

  if (elapsedMs >= policy.softTimeoutMs) {
    return {
      type: 'soft',
      elapsedMs,
      message: `Soft timeout reached after ${elapsedMs}ms (limit: ${policy.softTimeoutMs}ms)`,
    };
  }

  return null;
}

/**
 * Get remaining time until timeout
 */
export function getRemainingTime(
  startTime: Date,
  timeoutType: TimeoutType = 'hard',
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  const elapsedMs = Date.now() - startTime.getTime();
  const timeoutMs =
    timeoutType === 'hard' ? policy.hardTimeoutMs : policy.softTimeoutMs;

  return Math.max(0, timeoutMs - elapsedMs);
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export interface ProgressUpdate {
  runId: string;
  timestamp: string;
  elapsedMs: number;
  progress?: number; // 0-100
  message?: string;
  isComplete: boolean;
}

/**
 * Create a progress update event
 */
export function createProgressUpdate(
  runId: string,
  startTime: Date,
  options: {
    progress?: number;
    message?: string;
    isComplete?: boolean;
  } = {}
): ProgressUpdate {
  return {
    runId,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - startTime.getTime(),
    progress: options.progress,
    message: options.message,
    isComplete: options.isComplete ?? false,
  };
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
  cooldownUntil: Date | null;
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60000; // 1 minute

/**
 * Create initial circuit breaker state
 */
export function createCircuitBreaker(): CircuitBreakerState {
  return {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    cooldownUntil: null,
  };
}

/**
 * Record a failure in the circuit breaker
 */
export function recordCircuitFailure(state: CircuitBreakerState): CircuitBreakerState {
  const now = new Date();
  const failures = state.failures + 1;

  if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
    return {
      failures,
      lastFailure: now,
      isOpen: true,
      cooldownUntil: new Date(now.getTime() + CIRCUIT_BREAKER_COOLDOWN_MS),
    };
  }

  return {
    ...state,
    failures,
    lastFailure: now,
  };
}

/**
 * Record a success in the circuit breaker (resets failures)
 */
export function recordCircuitSuccess(state: CircuitBreakerState): CircuitBreakerState {
  return {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    cooldownUntil: null,
  };
}

/**
 * Check if the circuit breaker allows requests
 */
export function canExecute(state: CircuitBreakerState): boolean {
  if (!state.isOpen) {
    return true;
  }

  // Check if cooldown has passed
  if (state.cooldownUntil && new Date() >= state.cooldownUntil) {
    return true; // Half-open state - allow one request
  }

  return false;
}
