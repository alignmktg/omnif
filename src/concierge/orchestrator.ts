/**
 * Concierge Orchestrator
 * Main AI brain and user interface (PRD Section 2)
 */

import type { Task, Project, Insight, AgentRun, AgentType, WorkflowPattern, AgentRunRequest, ContextCapsule, QAProfile } from '@/domain';
import { classifyMode, getModeBehavior, suggestModeTransition, type InteractionMode, type ModeClassification } from './modes';
import { parseIntent, type ParsedIntent } from './intent';
import { decideDispatch, executeDispatch, type DispatchDecision, type DispatchResult, type AgentInput, type AgentOutput } from './dispatch';
import { generateBriefing, type Briefing, type BriefingType, type BriefingContext } from './briefing';
import { executeAgent } from '@/agents/executor';
import type { AuditContext } from '@/graph/audit';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    mode?: InteractionMode;
    intent?: ParsedIntent;
    dispatch?: DispatchDecision;
    agentRuns?: string[];
  };
}

export interface ConversationContext {
  turns: ConversationTurn[];
  currentMode: InteractionMode;
  activeTaskId?: string;
  activeProjectId?: string;
  sessionStarted: string;
}

export interface OrchestratorResponse {
  message: string;
  mode: InteractionMode;
  intent: ParsedIntent;
  dispatch?: DispatchDecision;
  dispatchResult?: DispatchResult;
  suggestions?: string[];
  briefing?: Briefing;
  createdTasks?: Task[];
  updatedTasks?: Task[];
  needsClarification: boolean;
}

export interface OrchestratorConfig {
  /** Maximum conversation history to maintain */
  maxHistoryTurns: number;

  /** Default interaction mode */
  defaultMode: InteractionMode;

  /** Whether to auto-dispatch to agents */
  autoDispatch: boolean;

  /** Target response time in ms */
  targetLatencyMs: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxHistoryTurns: 50,
  defaultMode: 'chief_of_staff',
  autoDispatch: true,
  targetLatencyMs: 3000,
};

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class ConciergeOrchestrator {
  private config: OrchestratorConfig;
  private conversations: Map<string, ConversationContext>;
  private agentExecutor?: (type: AgentType, input: AgentInput) => Promise<AgentOutput>;
  private workflowExecutor?: (pattern: WorkflowPattern, input: AgentInput) => Promise<AgentOutput>;
  private dataProvider?: {
    getTasks: () => Promise<Task[]>;
    getProjects: () => Promise<Project[]>;
    getInsights: () => Promise<Insight[]>;
    getAgentRuns: () => Promise<AgentRun[]>;
  };

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.conversations = new Map();
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Set the agent executor function
   */
  setAgentExecutor(
    executor: (type: AgentType, input: AgentInput) => Promise<AgentOutput>
  ): void {
    this.agentExecutor = executor;
  }

  /**
   * Set the workflow executor function
   */
  setWorkflowExecutor(
    executor: (pattern: WorkflowPattern, input: AgentInput) => Promise<AgentOutput>
  ): void {
    this.workflowExecutor = executor;
  }

  /**
   * Set the data provider for context
   */
  setDataProvider(provider: typeof this.dataProvider): void {
    this.dataProvider = provider;
  }

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  /**
   * Start or get a conversation
   */
  getOrCreateConversation(sessionId: string): ConversationContext {
    let context = this.conversations.get(sessionId);

    if (!context) {
      context = {
        turns: [],
        currentMode: this.config.defaultMode,
        sessionStarted: new Date().toISOString(),
      };
      this.conversations.set(sessionId, context);
    }

    return context;
  }

  /**
   * Add a turn to conversation history
   */
  private addTurn(sessionId: string, turn: ConversationTurn): void {
    const context = this.getOrCreateConversation(sessionId);
    context.turns.push(turn);

    // Trim history if too long
    if (context.turns.length > this.config.maxHistoryTurns) {
      context.turns = context.turns.slice(-this.config.maxHistoryTurns);
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  // ============================================================================
  // MAIN PROCESSING
  // ============================================================================

  /**
   * Process user input and generate response
   */
  async processInput(
    sessionId: string,
    userInput: string
  ): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    const context = this.getOrCreateConversation(sessionId);

    // Add user turn
    this.addTurn(sessionId, {
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
    });

    // Classify interaction mode
    const modeClassification = classifyMode(userInput);
    const mode = modeClassification.confidence > 0.6
      ? modeClassification.mode
      : context.currentMode;

    context.currentMode = mode;
    const behavior = getModeBehavior(mode);

    // Parse intent
    const intent = parseIntent(userInput);

    // Check for mode transition suggestion
    const suggestedTransition = suggestModeTransition(mode, {
      turnCount: context.turns.length,
      recentTopics: context.turns.slice(-3).map((t) => t.content),
    });

    // Decide dispatch
    const dispatchDecision = decideDispatch({
      intent,
      mode,
      conversationHistory: context.turns.map((t) => ({
        role: t.role === 'system' ? 'assistant' : t.role,
        content: t.content,
      })),
    });

    // Execute dispatch if configured and needed
    let dispatchResult: DispatchResult | undefined;
    if (this.config.autoDispatch && dispatchDecision.shouldDispatch) {
      dispatchResult = await executeDispatch(dispatchDecision, {
        executeAgent: this.agentExecutor,
        executeWorkflow: this.workflowExecutor,
      });
    }

    // Generate response message
    const message = await this.generateResponseMessage(
      intent,
      mode,
      dispatchDecision,
      dispatchResult
    );

    // Generate suggestions
    const suggestions = this.generateSuggestions(intent, mode, dispatchResult);

    // Add assistant turn
    this.addTurn(sessionId, {
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString(),
      metadata: {
        mode,
        intent,
        dispatch: dispatchDecision,
      },
    });

    // Check latency
    const latency = Date.now() - startTime;
    if (latency > this.config.targetLatencyMs) {
      console.warn(`Concierge response latency: ${latency}ms (target: ${this.config.targetLatencyMs}ms)`);
    }

    return {
      message,
      mode,
      intent,
      dispatch: dispatchDecision,
      dispatchResult,
      suggestions,
      needsClarification: intent.needsClarification,
    };
  }

  /**
   * Generate response message based on processing results
   */
  private async generateResponseMessage(
    intent: ParsedIntent,
    mode: InteractionMode,
    dispatch: DispatchDecision,
    result?: DispatchResult
  ): Promise<string> {
    const behavior = getModeBehavior(mode);

    // Handle clarification needed
    if (intent.needsClarification) {
      const prompt = intent.clarificationPrompts[0] || 'Could you tell me more?';
      return behavior.style === 'directive'
        ? prompt
        : `I want to make sure I understand. ${prompt}`;
    }

    // Handle dispatch result
    if (result) {
      if (result.success && result.output) {
        return this.formatAgentOutput(result.output, behavior.detailLevel);
      } else if (!result.success) {
        return `I ran into an issue: ${result.error}. Would you like me to try a different approach?`;
      }
    }

    // Handle no dispatch
    if (!dispatch.shouldDispatch) {
      return this.generateDirectResponse(intent, mode);
    }

    // Pending dispatch
    return `I'll work on that. ${dispatch.reason}`;
  }

  /**
   * Format agent output for user
   */
  private formatAgentOutput(
    output: AgentOutput,
    detailLevel: 'brief' | 'standard' | 'comprehensive'
  ): string {
    if (output.error) {
      return `There was an issue: ${output.error}`;
    }

    if (output.content) {
      if (detailLevel === 'brief' && output.content.length > 200) {
        return output.content.slice(0, 200) + '...';
      }
      return output.content;
    }

    if (output.structuredData) {
      if (detailLevel === 'brief') {
        return 'Processing complete.';
      }
      return JSON.stringify(output.structuredData, null, 2);
    }

    if (output.artifacts && output.artifacts.length > 0) {
      if (detailLevel === 'brief') {
        return `Generated ${output.artifacts.length} artifact(s).`;
      }
      return `Generated artifacts:\n${output.artifacts.map((a, idx) => `${idx + 1}. [${a.type}]`).join('\n')}`;
    }

    return 'Done.';
  }

  /**
   * Generate direct response for non-dispatch intents
   */
  private generateDirectResponse(
    intent: ParsedIntent,
    mode: InteractionMode
  ): string {
    const { category, action } = intent;

    // Common direct responses
    if (action === 'list') {
      return `I'll show you the ${category.replace('_', ' ')}.`;
    }

    if (action === 'complete') {
      const taskName = intent.entities.tasks?.[0]?.title || 'the task';
      return `I've marked "${taskName}" as complete.`;
    }

    if (action === 'delete') {
      return 'Done. I\'ve removed that item.';
    }

    // Default acknowledgment
    return 'Got it.';
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(
    intent: ParsedIntent,
    mode: InteractionMode,
    result?: DispatchResult
  ): string[] {
    const suggestions: string[] = [];
    const behavior = getModeBehavior(mode);

    if (!behavior.suggestActions) {
      return suggestions;
    }

    // Suggest based on intent category
    switch (intent.category) {
      case 'task_management':
        suggestions.push('Show my priority tasks');
        suggestions.push('What\'s due this week?');
        break;

      case 'project_management':
        suggestions.push('Show project status');
        suggestions.push('What projects need attention?');
        break;

      case 'scheduling':
        suggestions.push('Show my calendar for today');
        suggestions.push('What meetings do I have coming up?');
        break;

      case 'communication':
        suggestions.push('Check recent emails');
        suggestions.push('Draft a follow-up');
        break;
    }

    // Suggest based on mode
    if (mode === 'creative_director') {
      suggestions.push('Create a plan for this');
      suggestions.push('Break this into tasks');
    }

    if (mode === 'chief_of_staff') {
      suggestions.push('What should I focus on next?');
      suggestions.push('Give me a briefing');
    }

    return suggestions.slice(0, 3);
  }

  // ============================================================================
  // BRIEFINGS
  // ============================================================================

  /**
   * Generate a briefing
   */
  async generateBriefing(type: BriefingType): Promise<Briefing> {
    const context = await this.getBriefingContext();
    return generateBriefing(type, context);
  }

  /**
   * Get context for briefing generation
   */
  private async getBriefingContext(): Promise<BriefingContext> {
    if (!this.dataProvider) {
      return {
        tasks: [],
        projects: [],
        insights: [],
        recentAgentRuns: [],
      };
    }

    const [tasks, projects, insights, agentRuns] = await Promise.all([
      this.dataProvider.getTasks(),
      this.dataProvider.getProjects(),
      this.dataProvider.getInsights(),
      this.dataProvider.getAgentRuns(),
    ]);

    return {
      tasks,
      projects,
      insights,
      recentAgentRuns: agentRuns,
    };
  }

  // ============================================================================
  // PROACTIVE FEATURES
  // ============================================================================

  /**
   * Check for proactive notifications
   */
  async checkProactiveNotifications(): Promise<Array<{
    type: 'reminder' | 'deadline' | 'insight' | 'suggestion';
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>> {
    const notifications: Array<{
      type: 'reminder' | 'deadline' | 'insight' | 'suggestion';
      message: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    if (!this.dataProvider) {
      return notifications;
    }

    const tasks = await this.dataProvider.getTasks();
    const now = new Date();

    // Check for imminent deadlines
    for (const task of tasks) {
      if (task.dueDate && task.status !== 'completed') {
        const due = new Date(task.dueDate);
        const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilDue > 0 && hoursUntilDue < 2) {
          notifications.push({
            type: 'deadline',
            message: `"${task.title}" is due in less than 2 hours`,
            priority: 'high',
          });
        } else if (hoursUntilDue > 0 && hoursUntilDue < 24) {
          notifications.push({
            type: 'deadline',
            message: `"${task.title}" is due today`,
            priority: 'medium',
          });
        }
      }
    }

    // Check for blocked high-priority tasks
    const blockedHighPriority = tasks.filter(
      (t) => t.status === 'blocked' && t.priority === 'high'
    );

    if (blockedHighPriority.length > 0) {
      notifications.push({
        type: 'suggestion',
        message: `${blockedHighPriority.length} high-priority task(s) are blocked`,
        priority: 'medium',
      });
    }

    return notifications;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const concierge = new ConciergeOrchestrator();

// ============================================================================
// AGENT EXECUTOR WIRING
// ============================================================================

/**
 * Adapter to convert AgentInput to AgentRunRequest and wire up executor
 */
async function agentExecutorAdapter(
  type: AgentType,
  input: AgentInput
): Promise<AgentOutput> {
  // Build ContextCapsule from AgentInput
  const contextCapsule: ContextCapsule = {
    userProfile: {
      summary: 'User interacting with concierge',
    },
    projectSnapshot: {
      project: null,
      tasks: [],
      outcome: null,
    },
    inputDocuments: [
      {
        docId: uuidv4(),
        title: 'User Input',
        content: input.prompt,
        type: 'note',
      },
    ],
    constraints: {
      speedVsQuality: 'balanced' as QAProfile,
      lengthLimits: { maxWords: input.constraints.maxTokens / 4 },
      style: input.context.mode,
    },
    expectedArtifacts: [input.expectedOutputType],
  };

  // Build AgentRunRequest
  const request: AgentRunRequest = {
    runId: uuidv4(),
    agentType: type,
    objective: input.prompt,
    contextCapsule,
    workflowPatternId: null,
    linkedGraphHandles: {
      outcomeIds: [],
      taskIds: [],
      projectId: null,
    },
    qaProfileId: 'balanced' as QAProfile,
  };

  // Create audit context for the agent execution
  const auditContext: AuditContext = {
    actor: 'concierge',
    actorId: 'concierge-orchestrator',
  };

  try {
    // Execute the agent
    const result = await executeAgent(request, auditContext);

    // Convert ExecutionResult to AgentOutput
    if (result.success && result.response) {
      return {
        success: true,
        content: result.response.artifacts.primaryOutput,
        structuredData: result.response.semanticDeltas.length > 0
          ? { deltas: result.response.semanticDeltas }
          : undefined,
        artifacts: result.response.artifacts.attachments.map((a) => ({
          type: a.type,
          content: a.content,
        })),
      };
    } else {
      return {
        success: false,
        error: result.error || 'Agent execution failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Wire up the executor
concierge.setAgentExecutor(agentExecutorAdapter);
