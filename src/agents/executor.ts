/**
 * Agent Executor
 * Executes agents with lifecycle management, retry, and streaming
 */

import OpenAI from 'openai';
import { createOpenAIClient } from '@/lib/openai';
import type {
  AgentRun,
  AgentRunRequest,
  AgentRunResponse,
  AgentType,
} from '@/domain';
import {
  createAgentRun,
  updateAgentRun,
  startAgentRun,
  completeAgentRun,
  failAgentRun,
  blockAgentRun,
  getAgentRun,
} from '@/graph/operations/agent-runs';
import { processEvent, classifyError, type AgentEvent } from './lifecycle';
import {
  shouldRetry,
  checkTimeout,
  createProgressUpdate,
  DEFAULT_RETRY_POLICY,
  type RetryPolicy,
  type ProgressUpdate,
} from './retry';
import { buildAgentRunResponse } from './capsule';
import type { AuditContext } from '@/graph/audit';
import { getAgentConfig, getModelParams, isGpt5Model, getGpt5Params } from '@/lib/config';

// ============================================================================
// EXECUTOR TYPES
// ============================================================================

export interface ExecutorOptions {
  retryPolicy?: RetryPolicy;
  onProgress?: (update: ProgressUpdate) => void;
  onEvent?: (event: AgentEvent) => void;
}

export interface ExecutionResult {
  run: AgentRun;
  response: AgentRunResponse | null;
  success: boolean;
  error?: string;
  wasRetried: boolean;
  executionTimeMs: number;
}

// ============================================================================
// AGENT IMPLEMENTATION REGISTRY
// ============================================================================

type AgentImplementation = (
  request: AgentRunRequest,
  onProgress: (update: ProgressUpdate) => void
) => Promise<AgentRunResponse>;

const agentImplementations = new Map<AgentType, AgentImplementation>();

/**
 * Register an agent implementation
 */
export function registerAgent(
  agentType: AgentType,
  implementation: AgentImplementation
): void {
  agentImplementations.set(agentType, implementation);
}

/**
 * Get an agent implementation
 */
export function getAgentImplementation(
  agentType: AgentType
): AgentImplementation | undefined {
  return agentImplementations.get(agentType);
}

// ============================================================================
// EXECUTOR
// ============================================================================

/**
 * Execute an agent run with full lifecycle management
 */
export async function executeAgent(
  request: AgentRunRequest,
  context: AuditContext,
  options: ExecutorOptions = {}
): Promise<ExecutionResult> {
  const retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
  const startTime = new Date();
  let wasRetried = false;

  // Get agent implementation
  const implementation = getAgentImplementation(request.agentType);
  if (!implementation) {
    return {
      run: null as unknown as AgentRun,
      response: null,
      success: false,
      error: `No implementation registered for agent type: ${request.agentType}`,
      wasRetried: false,
      executionTimeMs: 0,
    };
  }

  // Create agent run record
  let run = await createAgentRun(
    {
      agentType: request.agentType,
      objective: request.objective,
      workflowPatternId: request.workflowPatternId ?? undefined,
      linkedTaskIds: request.linkedGraphHandles.taskIds,
      linkedProjectId: request.linkedGraphHandles.projectId ?? undefined,
      request,
    },
    context
  );

  // Progress callback wrapper
  const progressCallback = (update: ProgressUpdate) => {
    options.onProgress?.(update);

    // Check for timeouts
    const timeout = checkTimeout(startTime, retryPolicy);
    if (timeout?.type === 'hard') {
      throw new Error(timeout.message);
    }
  };

  // Execution loop with retry
  let lastError: Error | null = null;

  while (true) {
    try {
      // Start the run
      run = await startAgentRun(run.id, context);
      options.onEvent?.({ type: 'START' });

      // Send initial progress
      progressCallback(
        createProgressUpdate(run.id, startTime, {
          message: 'Agent started',
          progress: 0,
        })
      );

      // Execute the agent
      const response = await implementation(request, progressCallback);

      // Complete the run
      run = await completeAgentRun(run.id, response, context);
      options.onEvent?.({ type: 'COMPLETE', response });

      return {
        run,
        response,
        success: true,
        wasRetried,
        executionTimeMs: Date.now() - startTime.getTime(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const { isTransient, message } = classifyError(lastError);

      options.onEvent?.({ type: 'FAIL', error: message, isTransient });

      // Check if we should retry
      const retryDecision = shouldRetry(run, lastError, retryPolicy);

      if (retryDecision.shouldRetry) {
        wasRetried = true;
        run = await updateAgentRun(
          run.id,
          {
            status: 'pending',
            retryCount: run.retryCount + 1,
            error: message,
          },
          context
        );

        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, retryDecision.delayMs)
        );

        options.onEvent?.({ type: 'RETRY' });
        continue;
      }

      // No retry - fail the run
      run = await failAgentRun(run.id, message, context);

      return {
        run,
        response: null,
        success: false,
        error: message,
        wasRetried,
        executionTimeMs: Date.now() - startTime.getTime(),
      };
    }
  }
}

/**
 * Execute an agent run by ID (for retrying existing runs)
 */
export async function executeAgentById(
  runId: string,
  context: AuditContext,
  options: ExecutorOptions = {}
): Promise<ExecutionResult> {
  const run = await getAgentRun(runId);
  if (!run) {
    throw new Error(`Agent run ${runId} not found`);
  }

  if (!run.request) {
    throw new Error(`Agent run ${runId} has no request data`);
  }

  return executeAgent(run.request, context, options);
}

// ============================================================================
// BATCH EXECUTION
// ============================================================================

/**
 * Execute multiple agents in parallel
 */
export async function executeAgentsParallel(
  requests: AgentRunRequest[],
  context: AuditContext,
  options: ExecutorOptions = {}
): Promise<ExecutionResult[]> {
  return Promise.all(
    requests.map((request) => executeAgent(request, context, options))
  );
}

/**
 * Execute multiple agents sequentially
 */
export async function executeAgentsSequential(
  requests: AgentRunRequest[],
  context: AuditContext,
  options: ExecutorOptions = {}
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const request of requests) {
    const result = await executeAgent(request, context, options);
    results.push(result);

    // Stop on failure unless configured otherwise
    if (!result.success) {
      break;
    }
  }

  return results;
}

// ============================================================================
// DEFAULT AGENT IMPLEMENTATIONS
// ============================================================================

/**
 * Build context string from ContextCapsule
 */
function buildContextString(request: AgentRunRequest): string {
  if (!request.contextCapsule) {
    return '';
  }

  const contextParts = [
    `User Profile: ${request.contextCapsule.userProfile.summary}`,
    request.contextCapsule.projectSnapshot.project
      ? `Project: ${request.contextCapsule.projectSnapshot.project.name}`
      : null,
    request.contextCapsule.projectSnapshot.tasks.length > 0
      ? `Tasks: ${request.contextCapsule.projectSnapshot.tasks.map((t) => t.title).join(', ')}`
      : null,
    request.contextCapsule.inputDocuments.length > 0
      ? `Documents: ${request.contextCapsule.inputDocuments.map((d) => d.title).join(', ')}`
      : null,
  ].filter(Boolean);

  return contextParts.length > 0 ? `\n\nContext:\n${contextParts.join('\n')}` : '';
}

/**
 * Research agent implementation using OpenAI Responses API
 */
async function researchAgentImpl(
  request: AgentRunRequest,
  onProgress: (update: ProgressUpdate) => void
): Promise<AgentRunResponse> {
  const startTime = new Date();

  // Starting progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 10,
      message: 'Starting research...',
    })
  );

  // Initialize OpenAI client
  const openai = createOpenAIClient({ agentRunId: request.runId });

  // Build user prompt combining objective with context capsule
  const userPrompt = request.objective + buildContextString(request);

  // Get model params from config
  const modelParams = getModelParams('research');

  // Call OpenAI Chat Completions API
  const response = await openai.chat.completions.create({
    ...modelParams,
    messages: [
      {
        role: 'system',
        content:
          'You are a research assistant analyzing information and providing comprehensive research findings.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  // Finalizing progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 90,
      message: 'Finalizing research...',
    })
  );

  // Extract response content
  const primaryOutput = response.choices[0].message.content || '';

  return buildAgentRunResponse({
    runId: request.runId,
    status: 'completed',
    primaryOutput,
    overallConfidence: 0.85,
    executionTimeMs: Date.now() - startTime.getTime(),
  });
}

/**
 * Writer agent implementation using OpenAI Responses API
 */
async function writerAgentImpl(
  request: AgentRunRequest,
  onProgress: (update: ProgressUpdate) => void
): Promise<AgentRunResponse> {
  const startTime = new Date();

  // Initialize OpenAI client
  const openai = createOpenAIClient({ agentRunId: request.runId });

  // Report starting progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 10,
      message: 'Starting content generation...',
    })
  );

  // Build user prompt from objective and context
  const userPrompt = request.objective + buildContextString(request);

  // Get model params from config
  const modelParams = getModelParams('writer');

  // Call OpenAI Chat Completions API
  const response = await openai.chat.completions.create({
    ...modelParams,
    messages: [
      {
        role: 'system',
        content:
          'You are a professional content writer creating clear, compelling content.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  // Report finalizing progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 90,
      message: 'Finalizing content...',
    })
  );

  // Extract generated content
  const primaryOutput = response.choices[0].message.content || '';

  return buildAgentRunResponse({
    runId: request.runId,
    status: 'completed',
    primaryOutput,
    overallConfidence: 0.9,
    executionTimeMs: Date.now() - startTime.getTime(),
  });
}

/**
 * Planner agent implementation using OpenAI Responses API
 */
async function plannerAgentImpl(
  request: AgentRunRequest,
  onProgress: (update: ProgressUpdate) => void
): Promise<AgentRunResponse> {
  const startTime = new Date();

  // Initialize OpenAI client
  const openai = createOpenAIClient({ agentRunId: request.runId });

  // Report starting progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 10,
      message: 'Starting planning...',
    })
  );

  // Build user prompt from objective and context
  const userPrompt = request.objective + buildContextString(request);

  // Get model params from config
  const modelParams = getModelParams('planner');

  // Call OpenAI Chat Completions API
  const response = await openai.chat.completions.create({
    ...modelParams,
    messages: [
      {
        role: 'system',
        content:
          'You are a strategic planning assistant creating actionable plans and breaking down complex objectives.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  // Report finalizing progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 90,
      message: 'Finalizing plan...',
    })
  );

  // Extract response content
  const primaryOutput = response.choices[0].message.content || '';

  return buildAgentRunResponse({
    runId: request.runId,
    status: 'completed',
    primaryOutput,
    overallConfidence: 0.88,
    executionTimeMs: Date.now() - startTime.getTime(),
  });
}

/**
 * Integrations agent implementation using OpenAI Responses API
 */
async function integrationsAgentImpl(
  request: AgentRunRequest,
  onProgress: (update: ProgressUpdate) => void
): Promise<AgentRunResponse> {
  const startTime = new Date();

  // Initialize OpenAI client
  const openai = createOpenAIClient({ agentRunId: request.runId });

  // Report starting progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 10,
      message: 'Starting integration orchestration...',
    })
  );

  // Build user prompt from objective and context capsule
  const userPrompt = request.objective + buildContextString(request);

  // Get model params from config
  const modelParams = getModelParams('integrations');

  // Call OpenAI Chat Completions API
  const response = await openai.chat.completions.create({
    ...modelParams,
    messages: [
      {
        role: 'system',
        content:
          'You are an integration orchestrator managing connections to external services like email, calendar, and other tools.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  // Report finalizing progress
  onProgress(
    createProgressUpdate(request.runId, startTime, {
      progress: 90,
      message: 'Finalizing integration response...',
    })
  );

  // Extract response content
  const primaryOutput = response.choices[0].message.content || '';

  return buildAgentRunResponse({
    runId: request.runId,
    status: 'completed',
    primaryOutput,
    overallConfidence: 0.92,
    executionTimeMs: Date.now() - startTime.getTime(),
  });
}

// Register default implementations
registerAgent('research_agent', researchAgentImpl);
registerAgent('writer_agent', writerAgentImpl);
registerAgent('planner_agent', plannerAgentImpl);
registerAgent('integrations_agent', integrationsAgentImpl);
