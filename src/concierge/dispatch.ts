/**
 * Agent Dispatch
 * Routes intents to appropriate agents and workflows
 */

import type { AgentType, WorkflowPattern } from '@/domain';
import type { ParsedIntent, IntentCategory, IntentAction } from './intent';
import type { InteractionMode, ModeBehavior } from './modes';
import { getModeBehavior } from './modes';
import { getWorkflowPattern } from '@/workflows';

// ============================================================================
// LOCAL TYPES FOR DISPATCH
// ============================================================================

export interface AgentInput {
  prompt: string;
  context: {
    mode: InteractionMode;
    category: IntentCategory;
    action: IntentAction;
    entities: ParsedIntent['entities'];
    conversationLength: number;
  };
  constraints: {
    maxTokens: number;
    timeout: number;
  };
  expectedOutputType: 'text' | 'structured' | 'list';
}

export interface AgentOutput {
  success: boolean;
  content?: string;
  structuredData?: Record<string, unknown>;
  artifacts?: Array<{ type: string; content: string }>;
  error?: string;
}

// ============================================================================
// DISPATCH TYPES
// ============================================================================

export interface DispatchDecision {
  /** Whether to dispatch to an agent */
  shouldDispatch: boolean;

  /** Agent type to dispatch to */
  agentType?: AgentType;

  /** Workflow pattern to execute */
  workflowPattern?: WorkflowPattern;

  /** Input to provide to agent/workflow */
  input?: AgentInput;

  /** Reason for decision */
  reason: string;

  /** Alternative actions if dispatch fails */
  fallbackActions: FallbackAction[];
}

export interface FallbackAction {
  type: 'retry' | 'simplify' | 'human_handoff' | 'decompose';
  description: string;
  params?: Record<string, unknown>;
}

export interface DispatchContext {
  intent: ParsedIntent;
  mode: InteractionMode;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  activeProjects?: string[];
  userPreferences?: Record<string, unknown>;
}

// ============================================================================
// DISPATCH ROUTING
// ============================================================================

const INTENT_TO_AGENT: Record<IntentCategory, Record<IntentAction, AgentType | null>> = {
  task_management: {
    create: 'planner_agent',
    update: 'planner_agent',
    delete: null, // Direct operation
    complete: null, // Direct operation
    list: null, // Direct query
    search: 'research_agent',
    schedule: 'planner_agent',
    remind: 'planner_agent',
    send: null,
    draft: null,
    review: 'research_agent',
    plan: 'planner_agent',
    summarize: 'writer_agent',
    clarify: null,
  },
  project_management: {
    create: 'planner_agent',
    update: 'planner_agent',
    delete: null,
    complete: null,
    list: null,
    search: 'research_agent',
    schedule: 'planner_agent',
    remind: 'planner_agent',
    send: null,
    draft: null,
    review: 'research_agent',
    plan: 'planner_agent',
    summarize: 'writer_agent',
    clarify: null,
  },
  information: {
    create: null,
    update: null,
    delete: null,
    complete: null,
    list: null,
    search: 'research_agent',
    schedule: null,
    remind: null,
    send: null,
    draft: null,
    review: 'research_agent',
    plan: null,
    summarize: 'writer_agent',
    clarify: null,
  },
  scheduling: {
    create: 'integrations_agent',
    update: 'integrations_agent',
    delete: 'integrations_agent',
    complete: null,
    list: 'integrations_agent',
    search: 'integrations_agent',
    schedule: 'integrations_agent',
    remind: 'planner_agent',
    send: null,
    draft: null,
    review: null,
    plan: 'planner_agent',
    summarize: null,
    clarify: null,
  },
  communication: {
    create: 'writer_agent',
    update: 'writer_agent',
    delete: null,
    complete: null,
    list: 'integrations_agent',
    search: 'integrations_agent',
    schedule: 'integrations_agent',
    remind: 'planner_agent',
    send: 'integrations_agent',
    draft: 'writer_agent',
    review: 'research_agent',
    plan: 'planner_agent',
    summarize: 'writer_agent',
    clarify: null,
  },
  planning: {
    create: 'planner_agent',
    update: 'planner_agent',
    delete: null,
    complete: null,
    list: null,
    search: 'research_agent',
    schedule: 'planner_agent',
    remind: 'planner_agent',
    send: null,
    draft: 'writer_agent',
    review: 'research_agent',
    plan: 'planner_agent',
    summarize: 'writer_agent',
    clarify: null,
  },
  reflection: {
    create: null,
    update: null,
    delete: null,
    complete: null,
    list: null,
    search: 'research_agent',
    schedule: null,
    remind: null,
    send: null,
    draft: 'writer_agent',
    review: 'research_agent',
    plan: null,
    summarize: 'writer_agent',
    clarify: null,
  },
  general: {
    create: null,
    update: null,
    delete: null,
    complete: null,
    list: null,
    search: 'research_agent',
    schedule: null,
    remind: null,
    send: null,
    draft: null,
    review: null,
    plan: null,
    summarize: null,
    clarify: null,
  },
};

const INTENT_TO_WORKFLOW: Partial<Record<IntentCategory, Partial<Record<IntentAction, string>>>> = {
  information: {
    search: 'RESEARCH_SYNTHESIS',
    review: 'MULTI_STEP_RESEARCH',
  },
  communication: {
    draft: 'EMAIL_RESOLUTION',
    send: 'EMAIL_RESOLUTION',
  },
  planning: {
    plan: 'WEEKLY_PLANNING',
    review: 'DECISION_BRIEF',
  },
  scheduling: {
    schedule: 'MEETING_PREP',
  },
};

// ============================================================================
// DISPATCHER
// ============================================================================

/**
 * Decide how to dispatch a user intent
 */
export function decideDispatch(context: DispatchContext): DispatchDecision {
  const { intent, mode } = context;
  const behavior = getModeBehavior(mode);

  // Check if we should use a workflow
  const workflowName = INTENT_TO_WORKFLOW[intent.category]?.[intent.action];
  const agentTypeFallback = INTENT_TO_AGENT[intent.category]?.[intent.action];
  if (workflowName) {
    const pattern = getWorkflowPattern(workflowName.toLowerCase().replace(/_/g, '-'));
    if (pattern) {
      return {
        shouldDispatch: true,
        workflowPattern: pattern,
        agentType: agentTypeFallback ?? undefined, // Include agent as fallback
        input: buildAgentInput(context),
        reason: `Using ${workflowName} workflow for ${intent.category}/${intent.action}`,
        fallbackActions: generateFallbacks(intent, behavior),
      };
    }
  }

  // Check if we should dispatch to an agent
  const agentType = INTENT_TO_AGENT[intent.category]?.[intent.action];
  if (agentType) {
    return {
      shouldDispatch: true,
      agentType,
      input: buildAgentInput(context),
      reason: `Dispatching to ${agentType} agent for ${intent.category}/${intent.action}`,
      fallbackActions: generateFallbacks(intent, behavior),
    };
  }

  // No dispatch needed - handle directly
  return {
    shouldDispatch: false,
    reason: getDirectHandlingReason(intent),
    fallbackActions: [],
  };
}

/**
 * Build agent input from context
 */
function buildAgentInput(context: DispatchContext): AgentInput {
  const { intent, mode } = context;

  return {
    prompt: intent.originalInput,
    context: {
      mode,
      category: intent.category,
      action: intent.action,
      entities: intent.entities,
      conversationLength: context.conversationHistory?.length || 0,
    },
    constraints: {
      maxTokens: 2000,
      timeout: 30000,
    },
    expectedOutputType: getExpectedOutputType(intent),
  };
}

/**
 * Get expected output type based on intent
 */
function getExpectedOutputType(intent: ParsedIntent): AgentInput['expectedOutputType'] {
  switch (intent.action) {
    case 'create':
    case 'update':
    case 'schedule':
      return 'structured';
    case 'summarize':
    case 'draft':
      return 'text';
    case 'list':
    case 'search':
      return 'list';
    case 'plan':
      return 'structured';
    default:
      return 'text';
  }
}

/**
 * Generate fallback actions
 */
function generateFallbacks(
  intent: ParsedIntent,
  behavior: ModeBehavior
): FallbackAction[] {
  const fallbacks: FallbackAction[] = [];

  // Always allow retry
  fallbacks.push({
    type: 'retry',
    description: 'Retry with refined parameters',
  });

  // For complex intents, allow decomposition
  if (intent.entities.tasks && intent.entities.tasks.length > 1) {
    fallbacks.push({
      type: 'decompose',
      description: 'Break into smaller tasks',
      params: { taskCount: intent.entities.tasks.length },
    });
  }

  // For proactive modes, allow simplification
  if (behavior.proactivity === 'proactive') {
    fallbacks.push({
      type: 'simplify',
      description: 'Reduce scope and try simpler approach',
    });
  }

  // Always have human handoff as last resort
  fallbacks.push({
    type: 'human_handoff',
    description: 'Escalate to human for manual handling',
  });

  return fallbacks;
}

/**
 * Get reason for direct handling (no agent dispatch)
 */
function getDirectHandlingReason(intent: ParsedIntent): string {
  switch (intent.action) {
    case 'delete':
      return 'Delete operations are handled directly for safety';
    case 'complete':
      return 'Completion is a direct database operation';
    case 'list':
      return 'Listing is a direct query operation';
    case 'clarify':
      return 'Clarification requires direct conversation';
    default:
      return 'This operation can be handled without agent dispatch';
  }
}

// ============================================================================
// DISPATCH EXECUTION
// ============================================================================

export interface DispatchResult {
  success: boolean;
  output?: AgentOutput;
  error?: string;
  durationMs: number;
}

/**
 * Execute a dispatch decision
 * Note: Actual execution depends on agent executor being available
 */
export async function executeDispatch(
  decision: DispatchDecision,
  executor: {
    executeAgent?: (type: AgentType, input: AgentInput) => Promise<AgentOutput>;
    executeWorkflow?: (pattern: WorkflowPattern, input: AgentInput) => Promise<AgentOutput>;
  }
): Promise<DispatchResult> {
  const startTime = Date.now();

  if (!decision.shouldDispatch || !decision.input) {
    return {
      success: true,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    let output: AgentOutput | undefined;

    if (decision.workflowPattern && executor.executeWorkflow) {
      output = await executor.executeWorkflow(decision.workflowPattern, decision.input);
    } else if (decision.agentType && executor.executeAgent) {
      output = await executor.executeAgent(decision.agentType, decision.input);
    } else {
      return {
        success: false,
        error: 'No executor available for dispatch',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: output?.success ?? false,
      output,
      error: output?.error,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Dispatch execution failed',
      durationMs: Date.now() - startTime,
    };
  }
}
