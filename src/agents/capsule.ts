/**
 * Capsule Protocol Implementation
 * Request/Response handling for agent communication (PRD Section 10)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentRunRequest,
  AgentRunResponse,
  AgentType,
  ContextCapsule,
  LinkedGraphHandles,
  QAProfile,
  SemanticDelta,
  ProposedStep,
  Task,
  Project,
  Outcome,
  InputDocument,
} from '@/domain';

// ============================================================================
// REQUEST BUILDING
// ============================================================================

export interface BuildRequestOptions {
  agentType: AgentType;
  objective: string;
  userProfileSummary: string;
  project?: Project | null;
  tasks?: Task[];
  outcome?: Outcome | null;
  inputDocuments?: InputDocument[];
  constraints?: {
    speedVsQuality?: QAProfile;
    maxWords?: number;
    style?: string;
  };
  expectedArtifacts?: string[];
  workflowPatternId?: string | null;
  linkedHandles?: Partial<LinkedGraphHandles>;
  qaProfileId?: QAProfile;
}

/**
 * Build a complete AgentRunRequest from options
 */
export function buildAgentRunRequest(options: BuildRequestOptions): AgentRunRequest {
  const contextCapsule: ContextCapsule = {
    userProfile: { summary: options.userProfileSummary },
    projectSnapshot: {
      project: options.project ?? null,
      tasks: options.tasks ?? [],
      outcome: options.outcome ?? null,
    },
    inputDocuments: options.inputDocuments ?? [],
    constraints: {
      speedVsQuality: options.constraints?.speedVsQuality ?? 'balanced',
      lengthLimits: { maxWords: options.constraints?.maxWords ?? 2000 },
      style: options.constraints?.style ?? 'professional',
    },
    expectedArtifacts: options.expectedArtifacts ?? [],
  };

  const linkedGraphHandles: LinkedGraphHandles = {
    outcomeIds: options.linkedHandles?.outcomeIds ?? [],
    taskIds: options.linkedHandles?.taskIds ?? options.tasks?.map((t) => t.id) ?? [],
    projectId: options.linkedHandles?.projectId ?? options.project?.id ?? null,
  };

  return {
    runId: uuidv4(),
    agentType: options.agentType,
    objective: options.objective,
    contextCapsule,
    workflowPatternId: options.workflowPatternId ?? null,
    linkedGraphHandles,
    qaProfileId: options.qaProfileId ?? 'balanced',
  };
}

// ============================================================================
// RESPONSE BUILDING
// ============================================================================

export interface BuildResponseOptions {
  runId: string;
  status: AgentRunResponse['status'];
  primaryOutput: string;
  attachments?: Array<{ type: string; content: string }>;
  semanticDeltas?: SemanticDelta[];
  proposedNextSteps?: ProposedStep[];
  overallConfidence?: number;
  alignmentConfidence?: number;
  executionTimeMs?: number;
}

/**
 * Build a complete AgentRunResponse from options
 */
export function buildAgentRunResponse(options: BuildResponseOptions): AgentRunResponse {
  return {
    runId: options.runId,
    status: options.status,
    artifacts: {
      primaryOutput: options.primaryOutput,
      attachments: options.attachments ?? [],
    },
    semanticDeltas: options.semanticDeltas ?? [],
    proposedNextSteps: options.proposedNextSteps ?? [],
    confidenceScores: {
      overall: options.overallConfidence ?? 0.8,
      alignmentWithConstraints: options.alignmentConfidence ?? 0.85,
    },
    metadata: {
      executionTimeMs: options.executionTimeMs ?? 0,
      schemaVersion: '1.0',
    },
  };
}

// ============================================================================
// SEMANTIC DELTA BUILDERS
// ============================================================================

/**
 * Create a task update delta
 */
export function createTaskUpdateDelta(
  description: string,
  taskId: string,
  changes: Partial<Task>,
  confidence = 0.85
): SemanticDelta {
  return {
    type: 'task_update',
    description,
    proposedChanges: { taskId, changes },
    confidence,
  };
}

/**
 * Create a new task delta
 */
export function createNewTaskDelta(
  description: string,
  taskData: Partial<Task>,
  confidence = 0.8
): SemanticDelta {
  return {
    type: 'new_task',
    description,
    proposedChanges: { task: taskData },
    confidence,
  };
}

/**
 * Create an outcome update delta
 */
export function createOutcomeUpdateDelta(
  description: string,
  outcomeId: string,
  changes: Partial<Outcome>,
  confidence = 0.9
): SemanticDelta {
  return {
    type: 'outcome_update',
    description,
    proposedChanges: { outcomeId, changes },
    confidence,
  };
}

/**
 * Create an insight delta
 */
export function createInsightDelta(
  description: string,
  insightType: string,
  content: string,
  confidence = 0.75
): SemanticDelta {
  return {
    type: 'insight',
    description,
    proposedChanges: { type: insightType, content },
    confidence,
  };
}

// ============================================================================
// PROPOSED STEP BUILDERS
// ============================================================================

/**
 * Create an agent action step
 */
export function createAgentActionStep(
  description: string,
  autoExecutable = false
): ProposedStep {
  return {
    type: 'agent_action',
    description,
    autoExecutable,
  };
}

/**
 * Create a user decision step
 */
export function createUserDecisionStep(description: string): ProposedStep {
  return {
    type: 'user_decision',
    description,
    autoExecutable: false,
  };
}

// ============================================================================
// CAPSULE REPORT GENERATION
// ============================================================================

/**
 * Generate a natural language capsule report from response
 */
export function generateCapsuleReport(response: AgentRunResponse): string {
  const sections: string[] = [];

  // Status summary
  sections.push(`## Agent Run Summary\n`);
  sections.push(`**Status:** ${response.status}`);
  sections.push(
    `**Confidence:** ${(response.confidenceScores.overall * 100).toFixed(0)}%`
  );
  sections.push(
    `**Execution Time:** ${response.metadata.executionTimeMs}ms\n`
  );

  // Primary output preview
  if (response.artifacts.primaryOutput) {
    const preview = response.artifacts.primaryOutput.slice(0, 500);
    sections.push(`## Output Preview\n`);
    sections.push(preview + (response.artifacts.primaryOutput.length > 500 ? '...' : ''));
    sections.push('');
  }

  // Semantic deltas
  if (response.semanticDeltas.length > 0) {
    sections.push(`## Proposed Changes (${response.semanticDeltas.length})\n`);
    for (const delta of response.semanticDeltas) {
      sections.push(
        `- **${delta.type}** (${(delta.confidence * 100).toFixed(0)}%): ${delta.description}`
      );
    }
    sections.push('');
  }

  // Next steps
  if (response.proposedNextSteps.length > 0) {
    sections.push(`## Proposed Next Steps\n`);
    for (const step of response.proposedNextSteps) {
      const auto = step.autoExecutable ? ' [auto]' : '';
      sections.push(`- [${step.type}]${auto} ${step.description}`);
    }
    sections.push('');
  }

  // Attachments
  if (response.artifacts.attachments.length > 0) {
    sections.push(`## Attachments\n`);
    for (const attachment of response.artifacts.attachments) {
      sections.push(`- ${attachment.type}: ${attachment.content.slice(0, 100)}...`);
    }
  }

  return sections.join('\n');
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate an AgentRunRequest
 */
export function validateRequest(request: AgentRunRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!request.runId) errors.push('runId is required');
  if (!request.agentType) errors.push('agentType is required');
  if (!request.objective) errors.push('objective is required');
  if (!request.contextCapsule) errors.push('contextCapsule is required');

  if (request.contextCapsule) {
    if (!request.contextCapsule.userProfile?.summary) {
      errors.push('contextCapsule.userProfile.summary is required');
    }
    if (!request.contextCapsule.constraints) {
      errors.push('contextCapsule.constraints is required');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an AgentRunResponse
 */
export function validateResponse(response: AgentRunResponse): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!response.runId) errors.push('runId is required');
  if (!response.status) errors.push('status is required');
  if (!response.artifacts) errors.push('artifacts is required');
  if (!response.confidenceScores) errors.push('confidenceScores is required');
  if (!response.metadata) errors.push('metadata is required');

  if (response.confidenceScores) {
    if (
      response.confidenceScores.overall < 0 ||
      response.confidenceScores.overall > 1
    ) {
      errors.push('confidenceScores.overall must be between 0 and 1');
    }
  }

  return { valid: errors.length === 0, errors };
}
