/**
 * POF Validation Schemas
 * Zod schemas for runtime validation
 */

import { z } from 'zod';
import {
  TaskStatus,
  TaskType,
  Priority,
  ProjectType,
  ProjectStatus,
  OutcomeStatus,
  AssertionType,
  InsightType,
  AgentType,
  AgentStatus,
  QAProfile,
  InteractionMode,
  MutationType,
  MutationActor,
} from './types';

// ============================================================================
// PRIMITIVE SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid();
export const iso8601Schema = z.string().datetime();
export const titleSchema = z.string().min(1).max(120);

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const taskStatusSchema = z.enum([
  TaskStatus.INBOX,
  TaskStatus.AVAILABLE,
  TaskStatus.SCHEDULED,
  TaskStatus.BLOCKED,
  TaskStatus.COMPLETED,
  TaskStatus.DROPPED,
]);

export const taskTypeSchema = z.enum([
  TaskType.USER_ACTION,
  TaskType.AGENT_ACTION,
  TaskType.EXTERNAL_WAIT,
]);

export const prioritySchema = z.enum([
  Priority.LOW,
  Priority.NORMAL,
  Priority.HIGH,
  Priority.CRITICAL,
]);

export const projectTypeSchema = z.enum([
  ProjectType.PARALLEL,
  ProjectType.SEQUENTIAL,
]);

export const projectStatusSchema = z.enum([
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
  ProjectStatus.DROPPED,
]);

export const outcomeStatusSchema = z.enum([
  OutcomeStatus.ACTIVE,
  OutcomeStatus.ACHIEVED,
  OutcomeStatus.ABANDONED,
]);

export const assertionTypeSchema = z.enum([
  AssertionType.CONSTRAINT,
  AssertionType.STRATEGY,
  AssertionType.PREFERENCE,
]);

export const insightTypeSchema = z.enum([
  InsightType.PREFERENCE,
  InsightType.THEME,
  InsightType.STABLE_FACT,
  InsightType.COMMITMENT,
  InsightType.RECURRING_CONSTRAINT,
]);

export const agentTypeSchema = z.enum([
  AgentType.RESEARCH,
  AgentType.WRITER,
  AgentType.PLANNER,
  AgentType.INTEGRATIONS,
]);

export const agentStatusSchema = z.enum([
  AgentStatus.PENDING,
  AgentStatus.RUNNING,
  AgentStatus.COMPLETED,
  AgentStatus.BLOCKED,
  AgentStatus.FAILED,
]);

export const qaProfileSchema = z.enum([
  QAProfile.FAST_DRAFT,
  QAProfile.BALANCED,
  QAProfile.HIGH_RIGOR,
]);

export const interactionModeSchema = z.enum([
  InteractionMode.CREATIVE_DIRECTOR,
  InteractionMode.CHIEF_OF_STAFF,
  InteractionMode.THINK_ALOUD_INTERPRETER,
  InteractionMode.SYMBIOTIC_COLLABORATION,
]);

export const mutationTypeSchema = z.enum([
  MutationType.CREATE,
  MutationType.UPDATE,
  MutationType.DELETE,
]);

export const mutationActorSchema = z.enum([
  MutationActor.USER,
  MutationActor.CONCIERGE,
  MutationActor.AGENT,
  MutationActor.SYSTEM,
]);

// ============================================================================
// ENTITY SCHEMAS
// ============================================================================

export const externalRefSchema = z.object({
  kind: z.string(),
  ref: z.string(),
});

export const taskSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema.nullable(),
  parentTaskId: uuidSchema.nullable(),
  title: titleSchema,
  notes: z.string().nullable(),
  status: taskStatusSchema,
  type: taskTypeSchema,
  orderIndex: z.number().int().min(0),
  deferDate: iso8601Schema.nullable(),
  dueDate: iso8601Schema.nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  priority: prioritySchema,
  tags: z.array(z.string()),
  dependencies: z.array(uuidSchema),
  assertionIds: z.array(uuidSchema),
  agentRunId: uuidSchema.nullable(),
  externalRefs: z.array(externalRefSchema),
  createdAt: iso8601Schema,
  updatedAt: iso8601Schema,
}).refine(
  (data) => {
    // due_date >= defer_date if both present
    if (data.dueDate && data.deferDate) {
      return new Date(data.dueDate) >= new Date(data.deferDate);
    }
    return true;
  },
  { message: 'dueDate must be >= deferDate' }
);

export const createTaskSchema = z.object({
  projectId: uuidSchema.nullable().optional(),
  parentTaskId: uuidSchema.nullable().optional(),
  title: titleSchema,
  notes: z.string().nullable().optional(),
  type: taskTypeSchema.optional().default(TaskType.USER_ACTION),
  deferDate: iso8601Schema.nullable().optional(),
  dueDate: iso8601Schema.nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  priority: prioritySchema.optional().default(Priority.NORMAL),
  tags: z.array(z.string()).optional().default([]),
  dependencies: z.array(uuidSchema).optional().default([]),
  assertionIds: z.array(uuidSchema).optional().default([]),
  externalRefs: z.array(externalRefSchema).optional().default([]),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatusSchema.optional(),
  orderIndex: z.number().int().min(0).optional(),
  agentRunId: uuidSchema.nullable().optional(),
});

export const projectSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  notes: z.string().nullable(),
  type: projectTypeSchema,
  status: projectStatusSchema,
  reviewIntervalDays: z.number().int().positive().nullable(),
  lastReviewedAt: iso8601Schema.nullable(),
  outcomeId: uuidSchema.nullable(),
  createdAt: iso8601Schema,
  updatedAt: iso8601Schema,
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().nullable().optional(),
  type: projectTypeSchema.optional().default(ProjectType.PARALLEL),
  reviewIntervalDays: z.number().int().positive().nullable().optional(),
  outcomeId: uuidSchema.nullable().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: projectStatusSchema.optional(),
  lastReviewedAt: iso8601Schema.nullable().optional(),
});

export const outcomeSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  status: outcomeStatusSchema,
  createdAt: iso8601Schema,
  updatedAt: iso8601Schema,
});

export const createOutcomeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
});

export const updateOutcomeSchema = createOutcomeSchema.partial().extend({
  status: outcomeStatusSchema.optional(),
});

export const assertionSchema = z.object({
  id: uuidSchema,
  content: z.string().min(1),
  type: assertionTypeSchema,
  outcomeId: uuidSchema.nullable(),
  createdAt: iso8601Schema,
});

export const createAssertionSchema = z.object({
  content: z.string().min(1),
  type: assertionTypeSchema,
  outcomeId: uuidSchema.nullable().optional(),
});

export const insightSchema = z.object({
  id: uuidSchema,
  type: insightTypeSchema,
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceRefs: z.array(z.string()),
  extractedAt: iso8601Schema,
  lastReinforcedAt: iso8601Schema,
  reinforcementCount: z.number().int().min(0),
});

export const createInsightSchema = z.object({
  type: insightTypeSchema,
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceRefs: z.array(z.string()).optional().default([]),
});

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

export const workflowStepSchema = z.object({
  stepId: z.string(),
  agentType: agentTypeSchema,
  objectiveTemplate: z.string(),
  groupId: z.string(),
  isBlocking: z.boolean(),
  inputArtifacts: z.array(z.string()),
  outputArtifacts: z.array(z.string()),
});

export const workflowPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(workflowStepSchema),
  qaProfileId: qaProfileSchema,
  expectedArtifacts: z.array(z.string()),
});

// ============================================================================
// AGENT SCHEMAS
// ============================================================================

export const inputDocumentSchema = z.object({
  docId: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.enum(['email', 'note', 'document', 'artifact']),
});

export const agentConstraintsSchema = z.object({
  speedVsQuality: qaProfileSchema,
  lengthLimits: z.object({ maxWords: z.number().int().positive() }),
  style: z.string(),
});

export const contextCapsuleSchema = z.object({
  userProfile: z.object({ summary: z.string() }),
  projectSnapshot: z.object({
    project: projectSchema.nullable(),
    tasks: z.array(taskSchema),
    outcome: outcomeSchema.nullable(),
  }),
  inputDocuments: z.array(inputDocumentSchema),
  constraints: agentConstraintsSchema,
  expectedArtifacts: z.array(z.string()),
});

export const linkedGraphHandlesSchema = z.object({
  outcomeIds: z.array(uuidSchema),
  taskIds: z.array(uuidSchema),
  projectId: uuidSchema.nullable(),
});

export const agentRunRequestSchema = z.object({
  runId: uuidSchema,
  agentType: agentTypeSchema,
  objective: z.string(),
  contextCapsule: contextCapsuleSchema,
  workflowPatternId: z.string().nullable(),
  linkedGraphHandles: linkedGraphHandlesSchema,
  qaProfileId: qaProfileSchema,
});

export const agentArtifactSchema = z.object({
  type: z.string(),
  content: z.string(),
});

export const semanticDeltaSchema = z.object({
  type: z.enum(['task_update', 'new_task', 'outcome_update', 'insight']),
  description: z.string(),
  proposedChanges: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
});

export const proposedStepSchema = z.object({
  type: z.enum(['agent_action', 'user_decision']),
  description: z.string(),
  autoExecutable: z.boolean(),
});

export const agentRunResponseSchema = z.object({
  runId: uuidSchema,
  status: z.enum(['completed', 'partial', 'blocked', 'failed']),
  artifacts: z.object({
    primaryOutput: z.string(),
    attachments: z.array(agentArtifactSchema),
  }),
  semanticDeltas: z.array(semanticDeltaSchema),
  proposedNextSteps: z.array(proposedStepSchema),
  confidenceScores: z.object({
    overall: z.number().min(0).max(1),
    alignmentWithConstraints: z.number().min(0).max(1),
  }),
  metadata: z.object({
    executionTimeMs: z.number().int().min(0),
    schemaVersion: z.string(),
  }),
});

export const agentRunSchema = z.object({
  id: uuidSchema,
  agentType: agentTypeSchema,
  status: agentStatusSchema,
  objective: z.string(),
  workflowPatternId: z.string().nullable(),
  linkedTaskIds: z.array(uuidSchema),
  linkedProjectId: uuidSchema.nullable(),
  retryCount: z.number().int().min(0),
  request: agentRunRequestSchema.nullable(),
  response: agentRunResponseSchema.nullable(),
  error: z.string().nullable(),
  startedAt: iso8601Schema.nullable(),
  completedAt: iso8601Schema.nullable(),
  createdAt: iso8601Schema,
  updatedAt: iso8601Schema,
});

// ============================================================================
// AUDIT SCHEMAS
// ============================================================================

export const mutationEventSchema = z.object({
  id: uuidSchema,
  entityType: z.string(),
  entityId: z.string(),
  mutationType: mutationTypeSchema,
  beforeState: z.unknown().nullable(),
  afterState: z.unknown(),
  actor: mutationActorSchema,
  actorId: z.string().nullable(),
  timestamp: iso8601Schema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TaskInput = z.infer<typeof createTaskSchema>;
export type TaskUpdate = z.infer<typeof updateTaskSchema>;
export type ProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectUpdate = z.infer<typeof updateProjectSchema>;
export type OutcomeInput = z.infer<typeof createOutcomeSchema>;
export type OutcomeUpdate = z.infer<typeof updateOutcomeSchema>;
export type AssertionInput = z.infer<typeof createAssertionSchema>;
export type InsightInput = z.infer<typeof createInsightSchema>;
