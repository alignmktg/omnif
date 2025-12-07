/**
 * POF Database Schema
 * Drizzle ORM schema definitions
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const taskStatusEnum = pgEnum('task_status', [
  'inbox',
  'available',
  'scheduled',
  'blocked',
  'completed',
  'dropped',
]);

export const taskTypeEnum = pgEnum('task_type', [
  'user_action',
  'agent_action',
  'external_wait',
]);

export const priorityEnum = pgEnum('priority', ['low', 'normal', 'high', 'critical']);

export const projectTypeEnum = pgEnum('project_type', ['parallel', 'sequential']);

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'on_hold',
  'completed',
  'dropped',
]);

export const outcomeStatusEnum = pgEnum('outcome_status', [
  'active',
  'achieved',
  'abandoned',
]);

export const assertionTypeEnum = pgEnum('assertion_type', [
  'constraint',
  'strategy',
  'preference',
]);

export const insightTypeEnum = pgEnum('insight_type', [
  'preference',
  'theme',
  'stable_fact',
  'commitment',
  'recurring_constraint',
]);

export const agentTypeEnum = pgEnum('agent_type', [
  'research_agent',
  'writer_agent',
  'planner_agent',
  'integrations_agent',
]);

export const agentStatusEnum = pgEnum('agent_status', [
  'pending',
  'running',
  'completed',
  'blocked',
  'failed',
]);

export const qaProfileEnum = pgEnum('qa_profile', [
  'fast_draft',
  'balanced',
  'high_rigor',
]);

export const mutationTypeEnum = pgEnum('mutation_type', ['create', 'update', 'delete']);

export const mutationActorEnum = pgEnum('mutation_actor', [
  'user',
  'concierge',
  'agent',
  'system',
]);

// ============================================================================
// CORE TABLES
// ============================================================================

export const outcomes = pgTable(
  'outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    status: outcomeStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outcomes_status_idx').on(table.status),
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    notes: text('notes'),
    type: projectTypeEnum('type').notNull().default('parallel'),
    status: projectStatusEnum('status').notNull().default('active'),
    reviewIntervalDays: integer('review_interval_days'),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    outcomeId: uuid('outcome_id').references(() => outcomes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('projects_status_idx').on(table.status),
    index('projects_outcome_idx').on(table.outcomeId),
  ]
);

export const assertions = pgTable(
  'assertions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    type: assertionTypeEnum('type').notNull(),
    outcomeId: uuid('outcome_id').references(() => outcomes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('assertions_type_idx').on(table.type),
    index('assertions_outcome_idx').on(table.outcomeId),
  ]
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentType: agentTypeEnum('agent_type').notNull(),
    status: agentStatusEnum('status').notNull().default('pending'),
    objective: text('objective').notNull(),
    workflowPatternId: text('workflow_pattern_id'),
    linkedTaskIds: jsonb('linked_task_ids').$type<string[]>().notNull().default([]),
    linkedProjectId: uuid('linked_project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    retryCount: integer('retry_count').notNull().default(0),
    request: jsonb('request'),
    response: jsonb('response'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agent_runs_status_idx').on(table.status),
    index('agent_runs_type_idx').on(table.agentType),
  ]
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    parentTaskId: uuid('parent_task_id'),
    title: text('title').notNull(),
    notes: text('notes'),
    status: taskStatusEnum('status').notNull().default('inbox'),
    type: taskTypeEnum('type').notNull().default('user_action'),
    orderIndex: integer('order_index').notNull().default(0),
    deferDate: timestamp('defer_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    estimatedMinutes: integer('estimated_minutes'),
    priority: priorityEnum('priority').notNull().default('normal'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    dependencies: jsonb('dependencies').$type<string[]>().notNull().default([]),
    assertionIds: jsonb('assertion_ids').$type<string[]>().notNull().default([]),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    externalRefs: jsonb('external_refs')
      .$type<Array<{ kind: string; ref: string }>>()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tasks_project_idx').on(table.projectId),
    index('tasks_status_idx').on(table.status),
    index('tasks_due_date_idx').on(table.dueDate),
    index('tasks_priority_idx').on(table.priority),
    index('tasks_parent_idx').on(table.parentTaskId),
  ]
);

// Self-reference for parent task
// Note: handled via parentTaskId field with manual validation

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: insightTypeEnum('type').notNull(),
    content: text('content').notNull(),
    confidence: integer('confidence').notNull(), // stored as 0-100, converted to 0-1
    sourceRefs: jsonb('source_refs').$type<string[]>().notNull().default([]),
    extractedAt: timestamp('extracted_at', { withTimezone: true }).notNull().defaultNow(),
    lastReinforcedAt: timestamp('last_reinforced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reinforcementCount: integer('reinforcement_count').notNull().default(1),
  },
  (table) => [
    index('insights_type_idx').on(table.type),
    index('insights_confidence_idx').on(table.confidence),
  ]
);

export const workflowPatterns = pgTable('workflow_patterns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  steps: jsonb('steps').notNull(),
  qaProfileId: qaProfileEnum('qa_profile_id').notNull().default('balanced'),
  expectedArtifacts: jsonb('expected_artifacts').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// AUDIT LOG TABLE
// ============================================================================

export const mutationEvents = pgTable(
  'mutation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    mutationType: mutationTypeEnum('mutation_type').notNull(),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state').notNull(),
    actor: mutationActorEnum('actor').notNull(),
    actorId: text('actor_id'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('mutation_events_entity_idx').on(table.entityType, table.entityId),
    index('mutation_events_timestamp_idx').on(table.timestamp),
    index('mutation_events_actor_idx').on(table.actor),
  ]
);

// ============================================================================
// USER PROFILE TABLE
// ============================================================================

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  summary: text('summary').notNull().default(''),
  preferences: jsonb('preferences').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// PENDING DECISIONS TABLE
// ============================================================================

export const pendingDecisions = pgTable(
  'pending_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    description: text('description').notNull(),
    options: jsonb('options').$type<string[]>().notNull(),
    sourceAgentRunId: uuid('source_agent_run_id').references(() => agentRuns.id, {
      onDelete: 'set null',
    }),
    resolved: boolean('resolved').notNull().default(false),
    resolvedOption: text('resolved_option'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('pending_decisions_resolved_idx').on(table.resolved),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const outcomesRelations = relations(outcomes, ({ many }) => ({
  projects: many(projects),
  assertions: many(assertions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  outcome: one(outcomes, {
    fields: [projects.outcomeId],
    references: [outcomes.id],
  }),
  tasks: many(tasks),
  agentRuns: many(agentRuns),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'taskHierarchy',
  }),
  childTasks: many(tasks, {
    relationName: 'taskHierarchy',
  }),
  agentRun: one(agentRuns, {
    fields: [tasks.agentRunId],
    references: [agentRuns.id],
  }),
}));

export const assertionsRelations = relations(assertions, ({ one }) => ({
  outcome: one(outcomes, {
    fields: [assertions.outcomeId],
    references: [outcomes.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [agentRuns.linkedProjectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
  pendingDecisions: many(pendingDecisions),
}));

export const pendingDecisionsRelations = relations(pendingDecisions, ({ one }) => ({
  agentRun: one(agentRuns, {
    fields: [pendingDecisions.sourceAgentRunId],
    references: [agentRuns.id],
  }),
}));
