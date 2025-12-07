/**
 * Workflow Step Sequencer
 * Executes workflow patterns with parallel/blocking semantics
 */

import type {
  WorkflowPattern,
  WorkflowStep,
  AgentRunRequest,
  AgentRunResponse,
  Task,
  Project,
  Outcome,
  InputDocument,
  QAProfile,
} from '@/domain';
import { buildAgentRunRequest } from '@/agents/capsule';
import { executeAgent, executeAgentsParallel } from '@/agents/executor';
import type { AuditContext } from '@/graph/audit';

// ============================================================================
// EXECUTION PLAN TYPES
// ============================================================================

export interface ExecutionGroup {
  groupId: string;
  steps: WorkflowStep[];
  isBlocking: boolean;
  canRunParallel: boolean;
}

export interface ExecutionPlan {
  patternId: string;
  patternName: string;
  groups: ExecutionGroup[];
  totalSteps: number;
}

export interface WorkflowContext {
  userProfileSummary: string;
  project?: Project | null;
  tasks?: Task[];
  outcome?: Outcome | null;
  inputDocuments?: InputDocument[];
  variables?: Record<string, string>;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  response?: AgentRunResponse;
  error?: string;
  executionTimeMs: number;
}

export interface WorkflowResult {
  patternId: string;
  success: boolean;
  stepResults: StepResult[];
  artifacts: Record<string, string>;
  totalExecutionTimeMs: number;
  completedSteps: number;
  failedStep?: string;
}

// ============================================================================
// EXECUTION PLANNING
// ============================================================================

/**
 * Convert a workflow pattern into an execution plan
 */
export function planExecution(pattern: WorkflowPattern): ExecutionPlan {
  // Group steps by groupId
  const groupMap = new Map<string, WorkflowStep[]>();

  for (const step of pattern.steps) {
    if (!groupMap.has(step.groupId)) {
      groupMap.set(step.groupId, []);
    }
    groupMap.get(step.groupId)!.push(step);
  }

  // Create execution groups
  const groups: ExecutionGroup[] = [];
  const processedGroups = new Set<string>();

  for (const step of pattern.steps) {
    if (processedGroups.has(step.groupId)) continue;
    processedGroups.add(step.groupId);

    const groupSteps = groupMap.get(step.groupId)!;
    const isBlocking = groupSteps.some((s) => s.isBlocking);
    const canRunParallel = groupSteps.length > 1 && !isBlocking;

    groups.push({
      groupId: step.groupId,
      steps: groupSteps,
      isBlocking,
      canRunParallel,
    });
  }

  return {
    patternId: pattern.id,
    patternName: pattern.name,
    groups,
    totalSteps: pattern.steps.length,
  };
}

// ============================================================================
// STEP INSTANTIATION
// ============================================================================

/**
 * Instantiate a workflow step into an AgentRunRequest
 */
export function instantiateStep(
  step: WorkflowStep,
  context: WorkflowContext,
  artifacts: Record<string, string>,
  qaProfile: QAProfile
): AgentRunRequest {
  // Replace template variables in objective
  let objective = step.objectiveTemplate;

  // Replace standard variables
  if (context.variables) {
    for (const [key, value] of Object.entries(context.variables)) {
      objective = objective.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  // Replace artifact references
  for (const inputArtifact of step.inputArtifacts) {
    if (artifacts[inputArtifact]) {
      objective = objective.replace(
        new RegExp(`\\{\\{${inputArtifact}\\}\\}`, 'g'),
        artifacts[inputArtifact]
      );
    }
  }

  // Build input documents from artifacts
  const inputDocs: InputDocument[] = [
    ...(context.inputDocuments ?? []),
    ...step.inputArtifacts
      .filter((a) => artifacts[a])
      .map((a) => ({
        docId: a,
        title: a,
        content: artifacts[a],
        type: 'artifact' as const,
      })),
  ];

  return buildAgentRunRequest({
    agentType: step.agentType,
    objective,
    userProfileSummary: context.userProfileSummary,
    project: context.project,
    tasks: context.tasks,
    outcome: context.outcome,
    inputDocuments: inputDocs,
    expectedArtifacts: step.outputArtifacts,
    qaProfileId: qaProfile,
  });
}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

/**
 * Execute a workflow pattern with full orchestration
 */
export async function executeWorkflow(
  pattern: WorkflowPattern,
  context: WorkflowContext,
  auditContext: AuditContext,
  onStepComplete?: (step: WorkflowStep, result: StepResult) => void
): Promise<WorkflowResult> {
  const startTime = Date.now();
  const plan = planExecution(pattern);
  const artifacts: Record<string, string> = {};
  const stepResults: StepResult[] = [];
  let failedStep: string | undefined;

  for (const group of plan.groups) {
    if (failedStep) break;

    if (group.canRunParallel) {
      // Execute steps in parallel
      const requests = group.steps.map((step) =>
        instantiateStep(step, context, artifacts, pattern.qaProfileId)
      );

      const results = await executeAgentsParallel(requests, auditContext);

      for (let i = 0; i < group.steps.length; i++) {
        const step = group.steps[i];
        const result = results[i];

        const stepResult: StepResult = {
          stepId: step.stepId,
          success: result.success,
          response: result.response ?? undefined,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
        };

        stepResults.push(stepResult);

        if (result.success && result.response) {
          // Store output artifacts
          for (const outputArtifact of step.outputArtifacts) {
            artifacts[outputArtifact] = result.response.artifacts.primaryOutput;
          }
        } else {
          failedStep = step.stepId;
        }

        onStepComplete?.(step, stepResult);
      }
    } else {
      // Execute steps sequentially
      for (const step of group.steps) {
        if (failedStep) break;

        const request = instantiateStep(step, context, artifacts, pattern.qaProfileId);
        const result = await executeAgent(request, auditContext);

        const stepResult: StepResult = {
          stepId: step.stepId,
          success: result.success,
          response: result.response ?? undefined,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
        };

        stepResults.push(stepResult);

        if (result.success && result.response) {
          // Store output artifacts
          for (const outputArtifact of step.outputArtifacts) {
            artifacts[outputArtifact] = result.response.artifacts.primaryOutput;
          }
        } else {
          failedStep = step.stepId;
        }

        onStepComplete?.(step, stepResult);
      }
    }
  }

  return {
    patternId: pattern.id,
    success: !failedStep,
    stepResults,
    artifacts,
    totalExecutionTimeMs: Date.now() - startTime,
    completedSteps: stepResults.filter((r) => r.success).length,
    failedStep,
  };
}

// ============================================================================
// WORKFLOW VALIDATION
// ============================================================================

/**
 * Validate a workflow pattern definition
 */
export function validatePattern(pattern: WorkflowPattern): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pattern.id) errors.push('Pattern ID is required');
  if (!pattern.name) errors.push('Pattern name is required');
  if (!pattern.steps || pattern.steps.length === 0) {
    errors.push('Pattern must have at least one step');
  }

  // Check for artifact dependency issues
  const producedArtifacts = new Set<string>();
  for (const step of pattern.steps) {
    for (const inputArtifact of step.inputArtifacts) {
      if (!producedArtifacts.has(inputArtifact)) {
        errors.push(
          `Step ${step.stepId} requires artifact "${inputArtifact}" which is not produced by any previous step`
        );
      }
    }
    for (const outputArtifact of step.outputArtifacts) {
      producedArtifacts.add(outputArtifact);
    }
  }

  // Check expected artifacts are produced
  for (const expected of pattern.expectedArtifacts) {
    if (!producedArtifacts.has(expected)) {
      errors.push(`Expected artifact "${expected}" is not produced by any step`);
    }
  }

  return { valid: errors.length === 0, errors };
}
