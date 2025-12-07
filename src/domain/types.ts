/**
 * POF Domain Types
 * Core entity schemas from PRD Section 6
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const TaskStatus = {
  INBOX: 'inbox',
  AVAILABLE: 'available',
  SCHEDULED: 'scheduled',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskType = {
  USER_ACTION: 'user_action',
  AGENT_ACTION: 'agent_action',
  EXTERNAL_WAIT: 'external_wait',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const Priority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ProjectType = {
  PARALLEL: 'parallel',
  SEQUENTIAL: 'sequential',
} as const;
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];

export const ProjectStatus = {
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const OutcomeStatus = {
  ACTIVE: 'active',
  ACHIEVED: 'achieved',
  ABANDONED: 'abandoned',
} as const;
export type OutcomeStatus = (typeof OutcomeStatus)[keyof typeof OutcomeStatus];

export const AssertionType = {
  CONSTRAINT: 'constraint',
  STRATEGY: 'strategy',
  PREFERENCE: 'preference',
} as const;
export type AssertionType = (typeof AssertionType)[keyof typeof AssertionType];

export const InsightType = {
  PREFERENCE: 'preference',
  THEME: 'theme',
  STABLE_FACT: 'stable_fact',
  COMMITMENT: 'commitment',
  RECURRING_CONSTRAINT: 'recurring_constraint',
} as const;
export type InsightType = (typeof InsightType)[keyof typeof InsightType];

export const AgentType = {
  RESEARCH: 'research_agent',
  WRITER: 'writer_agent',
  PLANNER: 'planner_agent',
  INTEGRATIONS: 'integrations_agent',
} as const;
export type AgentType = (typeof AgentType)[keyof typeof AgentType];

export const AgentStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  FAILED: 'failed',
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const QAProfile = {
  FAST_DRAFT: 'fast_draft',
  BALANCED: 'balanced',
  HIGH_RIGOR: 'high_rigor',
} as const;
export type QAProfile = (typeof QAProfile)[keyof typeof QAProfile];

export const InteractionMode = {
  CREATIVE_DIRECTOR: 'creative_director',
  CHIEF_OF_STAFF: 'chief_of_staff',
  THINK_ALOUD_INTERPRETER: 'think_aloud_interpreter',
  SYMBIOTIC_COLLABORATION: 'symbiotic_collaboration',
} as const;
export type InteractionMode = (typeof InteractionMode)[keyof typeof InteractionMode];

export const MutationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;
export type MutationType = (typeof MutationType)[keyof typeof MutationType];

export const MutationActor = {
  USER: 'user',
  CONCIERGE: 'concierge',
  AGENT: 'agent',
  SYSTEM: 'system',
} as const;
export type MutationActor = (typeof MutationActor)[keyof typeof MutationActor];

// ============================================================================
// CORE ENTITIES
// ============================================================================

/**
 * External reference linking task to external systems
 */
export interface ExternalRef {
  kind: string;
  ref: string;
}

/**
 * Task - Actionable unit of work (PRD Section 6.1)
 */
export interface Task {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string; // 1-120 chars, required
  notes: string | null;
  status: TaskStatus;
  type: TaskType;
  orderIndex: number;
  deferDate: string | null; // ISO8601
  dueDate: string | null; // ISO8601, must be >= deferDate
  estimatedMinutes: number | null;
  priority: Priority;
  tags: string[];
  dependencies: string[]; // Task IDs, must maintain DAG invariants
  assertionIds: string[];
  agentRunId: string | null;
  externalRefs: ExternalRef[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Project - Collection of tasks with execution semantics
 */
export interface Project {
  id: string;
  name: string;
  notes: string | null;
  type: ProjectType;
  status: ProjectStatus;
  reviewIntervalDays: number | null;
  lastReviewedAt: string | null;
  outcomeId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Outcome - Desired end state
 */
export interface Outcome {
  id: string;
  title: string;
  description: string | null;
  status: OutcomeStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Assertion - Constraint, strategy, or preference
 */
export interface Assertion {
  id: string;
  content: string;
  type: AssertionType;
  outcomeId: string | null;
  createdAt: string;
}

/**
 * Insight - Crawler-extracted knowledge
 */
export interface Insight {
  id: string;
  type: InsightType;
  content: string;
  confidence: number; // 0-1
  sourceRefs: string[];
  extractedAt: string;
  lastReinforcedAt: string;
  reinforcementCount: number;
}

// ============================================================================
// WORKFLOW ENTITIES
// ============================================================================

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  stepId: string;
  agentType: AgentType;
  objectiveTemplate: string;
  groupId: string;
  isBlocking: boolean;
  inputArtifacts: string[];
  outputArtifacts: string[];
}

/**
 * Workflow pattern - Reusable process template
 */
export interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  qaProfileId: QAProfile;
  expectedArtifacts: string[];
}

// ============================================================================
// AGENT ENTITIES
// ============================================================================

/**
 * Input document for agent context
 */
export interface InputDocument {
  docId: string;
  title: string;
  content: string;
  type: 'email' | 'note' | 'document' | 'artifact';
}

/**
 * Agent constraints
 */
export interface AgentConstraints {
  speedVsQuality: QAProfile;
  lengthLimits: { maxWords: number };
  style: string;
}

/**
 * Context capsule for agent execution (PRD Section 10.1)
 */
export interface ContextCapsule {
  userProfile: { summary: string };
  projectSnapshot: {
    project: Project | null;
    tasks: Task[];
    outcome: Outcome | null;
  };
  inputDocuments: InputDocument[];
  constraints: AgentConstraints;
  expectedArtifacts: string[];
}

/**
 * Graph handles linking agent run to entities
 */
export interface LinkedGraphHandles {
  outcomeIds: string[];
  taskIds: string[];
  projectId: string | null;
}

/**
 * Agent run request (PRD Section 10.1)
 */
export interface AgentRunRequest {
  runId: string;
  agentType: AgentType;
  objective: string;
  contextCapsule: ContextCapsule;
  workflowPatternId: string | null;
  linkedGraphHandles: LinkedGraphHandles;
  qaProfileId: QAProfile;
}

/**
 * Artifact produced by agent
 */
export interface AgentArtifact {
  type: string;
  content: string;
}

/**
 * Semantic delta - proposed change to graph
 */
export interface SemanticDelta {
  type: 'task_update' | 'new_task' | 'outcome_update' | 'insight';
  description: string;
  proposedChanges: Record<string, unknown>;
  confidence: number;
}

/**
 * Proposed next step from agent
 */
export interface ProposedStep {
  type: 'agent_action' | 'user_decision';
  description: string;
  autoExecutable: boolean;
}

/**
 * Agent run response (PRD Section 10.2)
 */
export interface AgentRunResponse {
  runId: string;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  artifacts: {
    primaryOutput: string;
    attachments: AgentArtifact[];
  };
  semanticDeltas: SemanticDelta[];
  proposedNextSteps: ProposedStep[];
  confidenceScores: {
    overall: number;
    alignmentWithConstraints: number;
  };
  metadata: {
    executionTimeMs: number;
    schemaVersion: string;
  };
}

/**
 * Agent run record in database
 */
export interface AgentRun {
  id: string;
  agentType: AgentType;
  status: AgentStatus;
  objective: string;
  workflowPatternId: string | null;
  linkedTaskIds: string[];
  linkedProjectId: string | null;
  retryCount: number;
  request: AgentRunRequest | null;
  response: AgentRunResponse | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AUDIT & SYSTEM ENTITIES
// ============================================================================

/**
 * Mutation event for audit log
 */
export interface MutationEvent {
  id: string;
  entityType: string;
  entityId: string;
  mutationType: MutationType;
  beforeState: unknown | null;
  afterState: unknown;
  actor: MutationActor;
  actorId: string | null;
  timestamp: string;
}

/**
 * User profile for concierge context
 */
export interface UserProfile {
  id: string;
  summary: string;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// BRIEFING ENTITIES
// ============================================================================

/**
 * Pending decision requiring user input
 */
export interface PendingDecision {
  id: string;
  description: string;
  options: string[];
  sourceAgentRunId: string | null;
  createdAt: string;
}

/**
 * Daily briefing structure (PRD Section 12)
 */
export interface DailyBriefing {
  generatedAt: string;
  summary: string;
  sections: {
    dueToday: Task[];
    overdue: Task[];
    activeAgents: AgentRun[];
    pendingDecisions: PendingDecision[];
    highImpactOutcomes: Outcome[];
    salientInsights: Insight[];
  };
  recommendedFocus: Task[];
  autoDispatched: AgentRun[];
}

// ============================================================================
// INTEGRATION ENTITIES
// ============================================================================

/**
 * Email thread from integration
 */
export interface EmailThread {
  threadId: string;
  subject: string;
  participants: string[];
  messages: EmailMessage[];
  lastUpdated: string;
}

/**
 * Email message
 */
export interface EmailMessage {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  timestamp: string;
}

/**
 * Email draft for sending
 */
export interface EmailDraft {
  threadId: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  eventId: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string | null;
}

/**
 * Calendar event proposal
 */
export interface EventProposal {
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string | null;
}

// ============================================================================
// EXECUTION ENTITIES
// ============================================================================

/**
 * Priority score calculation result (PRD Section 13)
 */
export interface PriorityScore {
  urgency: number; // 1.0 if due < 48h, else 0.3
  risk: number; // domain_risk_score 0-1
  contentType: number; // based on task type
  preference: number; // user_pref_curve 0-1
  composite: number; // weighted combination
}

/**
 * Forecast day for projections
 */
export interface ForecastDay {
  date: string;
  tasks: Task[];
  events: CalendarEvent[];
}

/**
 * Project tree for hierarchical projection
 */
export interface ProjectTree {
  project: Project;
  tasks: Task[];
  childProjects: ProjectTree[];
}
