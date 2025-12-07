# POF Autonomous Development Plan

## Executive Summary

This plan transforms the POF PRD into 8 sequential development phases, ordered by dependency. Each phase produces testable, deployable artifacts. The plan is designed for autonomous execution with minimal human input.

---

## Architecture Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Postgres (Supabase/Neon) | DAG queries via recursive CTEs, defer graph DB migration |
| ORM | Drizzle | Type-safe schemas, good DX |
| Audit Strategy | Event Sourcing | Explicit mutations, replay capability |
| Agent Interface | Capsule Protocol only | Clean separation, semantic deltas as proposals |
| Mutation Model | Proposals → Concierge approval | Agents never directly mutate graph |
| LLM Provider | OpenAI Responses API | Per user defaults, gpt-5-nano for test |

---

## Phase Dependency Graph

```
Phase 1: Foundation
    ↓
    ├──────────────────────┐
    ↓                      ↓
Phase 2: Execution    Phase 3: Agents    Phase 6: Integrations
    ↓                      ↓                      ↓
    │                Phase 4: QA                  │
    │                      ↓                      │
    │                Phase 5: Workflows           │
    │                      ↓                      ↓
    │                      └──────────────────────┤
    ↓                                             ↓
    └──────────────→ Phase 7: Crawler ←───────────┘
                           ↓
                    Phase 8: Concierge
```

---

## Phase 1: Foundation (Data Model + Graph)

### Objective
Establish typed domain schemas, database infrastructure, DAG invariant enforcement, and audit logging.

### Deliverables

**1.1 Domain Schemas** (`/src/domain/`)
```typescript
// Task - fully specified in PRD Section 6
interface Task {
  id: string;                    // uuid
  project_id: string | null;
  parent_task_id: string | null;
  title: string;                 // 1-120 chars, required
  notes: string | null;
  status: 'inbox' | 'available' | 'scheduled' | 'blocked' | 'completed' | 'dropped';
  type: 'user_action' | 'agent_action' | 'external_wait';
  order_index: number;           // >= 0
  defer_date: string | null;     // ISO8601
  due_date: string | null;       // ISO8601, >= defer_date
  estimated_minutes: number | null;
  priority: 'low' | 'normal' | 'high' | 'critical';
  tags: string[];
  dependencies: string[];        // uuid[], must maintain DAG invariants
  assertion_ids: string[];
  agent_run_id: string | null;
  external_refs: Array<{ kind: string; ref: string }>;
  created_at: string;
  updated_at: string;
}

// Project
interface Project {
  id: string;
  name: string;
  notes: string | null;
  type: 'parallel' | 'sequential';  // sequential = only one available task
  status: 'active' | 'on_hold' | 'completed' | 'dropped';
  review_interval_days: number | null;
  last_reviewed_at: string | null;
  outcome_id: string | null;
  created_at: string;
  updated_at: string;
}

// Outcome
interface Outcome {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  created_at: string;
  updated_at: string;
}

// Assertion
interface Assertion {
  id: string;
  content: string;               // constraint, strategy, or preference
  type: 'constraint' | 'strategy' | 'preference';
  outcome_id: string | null;
  created_at: string;
}

// Insight (for Crawler)
interface Insight {
  id: string;
  type: 'preference' | 'theme' | 'stable_fact' | 'commitment' | 'recurring_constraint';
  content: string;
  confidence: number;            // 0-1
  source_refs: string[];
  extracted_at: string;
  last_reinforced_at: string;
  reinforcement_count: number;
}

// WorkflowPattern
interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  qa_profile_id: string;
  expected_artifacts: string[];
}

interface WorkflowStep {
  step_id: string;
  agent_type: 'research_agent' | 'writer_agent' | 'planner_agent' | 'integrations_agent';
  objective_template: string;
  group_id: string;
  is_blocking: boolean;
  input_artifacts: string[];
  output_artifacts: string[];
}
```

**1.2 Database Schema** (`/src/graph/schema.ts`)
- Drizzle schema definitions for all entities
- Indexes for common query patterns
- Foreign key relationships

**1.3 DAG Invariant Enforcement** (`/src/graph/dag.ts`)
```typescript
// Cycle detection before dependency insertion
function validateDependencyAddition(taskId: string, newDepId: string): boolean;

// Check if adding edge creates cycle using DFS
function wouldCreateCycle(graph: DependencyGraph, from: string, to: string): boolean;

// Validate due_date >= defer_date
function validateDateConstraints(task: Task): ValidationResult;
```

**1.4 Audit Log** (`/src/graph/audit.ts`)
```typescript
interface MutationEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  mutation_type: 'create' | 'update' | 'delete';
  before_state: unknown | null;
  after_state: unknown;
  actor: 'user' | 'concierge' | 'agent';
  actor_id: string | null;
  timestamp: string;
}

function recordMutation(event: Omit<MutationEvent, 'id' | 'timestamp'>): Promise<void>;
```

**1.5 CRUD Operations** (`/src/graph/operations.ts`)
- Create/Read/Update/Delete for all entities
- All mutations go through audit log
- Validation enforced on write

### Validation Criteria
- [ ] All TypeScript schemas compile with strict mode
- [ ] Database migrations run successfully
- [ ] Cycle detection correctly rejects circular dependencies
- [ ] Audit log captures all mutations
- [ ] CRUD operations enforce all validation rules

---

## Phase 2: Execution Engine

### Objective
Implement task availability calculation, OmniFocus-style projections, and priority scoring.

### Deliverables

**2.1 Task Availability State Machine** (`/src/execution/availability.ts`)
```typescript
type TaskStatus = 'inbox' | 'available' | 'scheduled' | 'blocked' | 'completed' | 'dropped';

function calculateAvailability(task: Task, project: Project | null, now: Date): TaskStatus {
  // Rules from PRD Section 11:
  // 1. If defer_date > now → scheduled
  // 2. If any dependency incomplete → blocked
  // 3. If project.type = sequential AND task != first_incomplete → blocked
  // 4. Otherwise → available
}
```

**2.2 Projection Generators** (`/src/execution/projections.ts`)
```typescript
// Inbox: tasks with no project assignment
function getInbox(): Promise<Task[]>;

// Projects: hierarchical tree of projects and their tasks
function getProjects(): Promise<ProjectTree[]>;

// Tags: tasks grouped by tag
function getTasksByTag(): Promise<Map<string, Task[]>>;

// Forecast: tasks organized by due date + calendar events
function getForecast(days: number): Promise<ForecastDay[]>;

// Review: projects due for review based on review_interval
function getProjectsForReview(): Promise<Project[]>;
```

**2.3 Priority Calculator** (`/src/execution/priority.ts`)
```typescript
// From PRD Section 13
interface PriorityScore {
  urgency: number;      // 1.0 if due < 48h, else 0.3
  risk: number;         // domain_risk_score 0-1
  content_type: number; // email_external=0.9, internal_note=0.2, etc.
  preference: number;   // user_pref_curve 0-1
  composite: number;    // weighted combination
}

function calculatePriority(task: Task, insights: Insight[]): PriorityScore;

// Determine QA rigor from priority
function determineQAProfile(score: PriorityScore): 'fast_draft' | 'balanced' | 'high_rigor';
```

### Validation Criteria
- [ ] Availability correctly handles all edge cases (defer, dependencies, sequential)
- [ ] Projections return correct subsets
- [ ] Priority scoring matches PRD formulas
- [ ] QA profile selection matches threshold logic

---

## Phase 3: Sub-Agent Runtime

### Objective
Implement agent lifecycle management, capsule protocol, and timeout/retry logic.

### Deliverables

**3.1 Agent Lifecycle** (`/src/agents/lifecycle.ts`)
```typescript
type AgentStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'failed';

interface AgentRun {
  run_id: string;
  agent_type: 'research_agent' | 'writer_agent' | 'planner_agent' | 'integrations_agent';
  status: AgentStatus;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

// State transitions
function transitionAgent(run: AgentRun, event: AgentEvent): AgentRun;
```

**3.2 Capsule Protocol** (`/src/agents/capsule.ts`)
```typescript
// Request (PRD Section 10.1)
interface AgentRunRequest {
  run_id: string;
  agent_type: AgentType;
  objective: string;
  context_capsule: {
    user_profile: { summary: string };
    project_snapshot: ProjectSnapshot;
    input_documents: InputDocument[];
    constraints: {
      speed_vs_quality: 'fast_draft' | 'balanced' | 'high_rigor';
      length_limits: { max_words: number };
      style: string;
    };
    expected_artifacts: string[];
  };
  workflow_pattern_id: string;
  linked_graph_handles: {
    outcome_ids: string[];
    task_ids: string[];
    project_id: string;
  };
  qa_profile_id: string;
}

// Response (PRD Section 10.2)
interface AgentRunResponse {
  run_id: string;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  artifacts: {
    primary_output: string;
    attachments: Array<{ type: string; content: string }>;
  };
  semantic_deltas: SemanticDelta[];
  proposed_next_steps: ProposedStep[];
  confidence_scores: {
    overall: number;
    alignment_with_constraints: number;
  };
  metadata: {
    execution_time_ms: number;
    schema_version: string;
  };
}

interface SemanticDelta {
  type: 'task_update' | 'new_task' | 'outcome_update' | 'insight';
  description: string;
  proposed_changes: Record<string, unknown>;
  confidence: number;
}
```

**3.3 Timeout/Retry** (`/src/agents/retry.ts`)
```typescript
interface RetryPolicy {
  max_retries: 1;                    // PRD: one automatic retry
  soft_timeout_ms: number;           // emit progress_required
  hard_timeout_ms: number;           // transition to blocked
}

function shouldRetry(run: AgentRun, error: AgentError): boolean;
function handleTimeout(run: AgentRun, type: 'soft' | 'hard'): AgentEvent;
```

**3.4 Agent Executor** (`/src/agents/executor.ts`)
```typescript
// Execute agent with streaming updates
function executeAgent(
  request: AgentRunRequest,
  onProgress: (event: ProgressEvent) => void
): Promise<AgentRunResponse>;
```

### Validation Criteria
- [ ] Lifecycle state machine handles all transitions
- [ ] Capsule protocol matches PRD schemas exactly
- [ ] Retry logic triggers once on transient failure
- [ ] Timeouts correctly transition states
- [ ] Progress events stream during execution

---

## Phase 4: QA Layer

### Objective
Implement quality assurance checks, profile management, and escalation handling.

### Deliverables

**4.1 QA Profiles** (`/src/qa/profiles.ts`)
```typescript
interface QAProfile {
  id: string;
  name: 'fast_draft' | 'balanced' | 'high_rigor';
  checks: QACheck[];
  confidence_threshold: number;      // minimum to pass
  max_failures_before_escalate: 2;   // PRD: fails twice → escalate
}

interface QACheck {
  type: 'correctness' | 'alignment' | 'safety';
  weight: number;
  enabled: boolean;
}
```

**4.2 Check Implementations** (`/src/qa/checks/`)
```typescript
// Correctness: does output match objective?
function checkCorrectness(response: AgentRunResponse, request: AgentRunRequest): CheckResult;

// Alignment: does output match constraints?
function checkAlignment(response: AgentRunResponse, constraints: Constraints): CheckResult;

// Safety: no harmful content
function checkSafety(response: AgentRunResponse): CheckResult;
```

**4.3 Profile Selection** (`/src/qa/selection.ts`)
```typescript
// Automatic selection based on PRD Section 13 thresholds
function selectProfile(priorityScore: PriorityScore, taskType: string): QAProfile {
  // urgency + risk > 1.3 → high_rigor
  // external + risk > 0.7 → high_rigor
  // brainstorming → fast_draft
  // otherwise → balanced
}
```

**4.4 Escalation Handler** (`/src/qa/escalation.ts`)
```typescript
interface EscalationResult {
  action: 'retry_stricter' | 'require_user_input';
  new_profile_id?: string;
  user_prompt?: string;
}

function handleQAFailure(
  run: AgentRun,
  failureCount: number,
  currentProfile: QAProfile
): EscalationResult;
```

### Validation Criteria
- [ ] All check types implemented
- [ ] Profile selection matches PRD thresholds
- [ ] Escalation triggers after 2 failures
- [ ] Stricter profile available for retry

---

## Phase 5: Workflow Patterns

### Objective
Implement declarative workflow definitions and step sequencing with parallel/blocking semantics.

### Deliverables

**5.1 Pattern Schema** (uses types from Phase 1)

**5.2 Step Sequencer** (`/src/workflows/sequencer.ts`)
```typescript
interface ExecutionPlan {
  groups: ExecutionGroup[];
}

interface ExecutionGroup {
  group_id: string;
  steps: WorkflowStep[];
  is_blocking: boolean;
  can_run_parallel: boolean;
}

// Convert pattern to execution plan
function planExecution(pattern: WorkflowPattern): ExecutionPlan;

// Execute plan with group ordering
async function executeWorkflow(
  plan: ExecutionPlan,
  context: WorkflowContext,
  onStepComplete: (step: WorkflowStep, result: AgentRunResponse) => void
): Promise<WorkflowResult>;
```

**5.3 Built-in Patterns** (`/src/workflows/patterns/`)

| Pattern | Steps | Agent Types |
|---------|-------|-------------|
| Research & Synthesis | gather → analyze → synthesize | research, writer |
| Article Creation | outline → draft → revise → finalize | planner, writer, writer, writer |
| Meeting Prep | gather_context → create_agenda → prep_notes | research, planner, writer |
| Email Thread Resolution | analyze_thread → draft_response → qa_check | research, writer, - |
| Decision Support Brief | gather_options → analyze_tradeoffs → recommend | research, research, planner |
| Deep Work Cycle | define_focus → block_time → execute → review | planner, integrations, -, planner |
| Multi-Step Research | initial_query → expand → synthesize → validate | research, research, writer, research |
| Weekly Planning | review_past → identify_priorities → schedule | planner, planner, integrations |

**5.4 Pattern Instantiation** (`/src/workflows/instantiate.ts`)
```typescript
// Create concrete AgentRuns from pattern template
function instantiatePattern(
  pattern: WorkflowPattern,
  context: {
    outcome: Outcome;
    project: Project;
    user_profile: UserProfile;
    input_documents: InputDocument[];
  }
): AgentRunRequest[];
```

### Validation Criteria
- [ ] All 8 patterns defined
- [ ] Blocking groups complete before next starts
- [ ] Parallel groups execute concurrently
- [ ] Artifact passing between steps works
- [ ] Pattern instantiation produces valid AgentRunRequests

---

## Phase 6: Integrations Layer

### Objective
Implement external system adapters for email and calendar.

### Deliverables

**6.1 Adapter Interface** (`/src/integrations/adapter.ts`)
```typescript
interface IntegrationAdapter<TRead, TWrite> {
  type: 'email' | 'calendar' | 'artifact';

  // Read from external system
  read(query: AdapterQuery): Promise<TRead[]>;

  // Write to external system
  write(data: TWrite): Promise<WriteResult>;

  // Extract metadata for external_ref
  extractRef(raw: unknown): ExternalRef;
}
```

**6.2 Email Adapter** (`/src/integrations/email/`)
```typescript
interface EmailThread {
  thread_id: string;
  subject: string;
  participants: string[];
  messages: EmailMessage[];
  last_updated: string;
}

interface EmailDraft {
  thread_id: string | null;  // null for new thread
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

class EmailAdapter implements IntegrationAdapter<EmailThread, EmailDraft> {
  // Read threads
  // Write drafts (not auto-send in v1)
  // Extract metadata
}
```

**6.3 Calendar Adapter** (`/src/integrations/calendar/`)
```typescript
interface CalendarEvent {
  event_id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string | null;
}

interface EventProposal {
  title: string;
  start: string;
  end: string;
  attendees: string[];
}

class CalendarAdapter implements IntegrationAdapter<CalendarEvent, EventProposal> {
  // Read events
  // Propose events (requires approval in v1)
}
```

**6.4 External Ref Management** (`/src/integrations/refs.ts`)
```typescript
// Link tasks to external systems
function linkExternalRef(taskId: string, ref: ExternalRef): Promise<void>;

// Resolve ref to external data
function resolveRef(ref: ExternalRef): Promise<unknown>;
```

### Validation Criteria
- [ ] Email adapter reads threads
- [ ] Email adapter creates drafts (no auto-send)
- [ ] Calendar adapter reads events
- [ ] Calendar adapter proposes events
- [ ] External refs link correctly to tasks

---

## Phase 7: Crawler

### Objective
Implement autonomous insight extraction from completed work and user interactions.

### Deliverables

**7.1 Insight Extraction Pipelines** (`/src/crawler/extractors/`)
```typescript
// Base extractor interface
interface InsightExtractor {
  type: InsightType;
  extract(source: ExtractionSource): Promise<ExtractedInsight[]>;
}

// Preference extractor: user style/behavior patterns
class PreferenceExtractor implements InsightExtractor { }

// Theme extractor: recurring topics
class ThemeExtractor implements InsightExtractor { }

// Commitment extractor: promises, deadlines
class CommitmentExtractor implements InsightExtractor { }

// Stable fact extractor: biographical info
class StableFactExtractor implements InsightExtractor { }

// Recurring constraint extractor: availability patterns
class RecurringConstraintExtractor implements InsightExtractor { }
```

**7.2 Confidence Scoring** (`/src/crawler/confidence.ts`)
```typescript
function scoreConfidence(
  insight: ExtractedInsight,
  existingInsights: Insight[]
): number {
  // Increase confidence if reinforced
  // Decrease if conflicting evidence
  // Consider source reliability
}
```

**7.3 Crawler Scheduler** (`/src/crawler/scheduler.ts`)
```typescript
// Background execution
async function runCrawlerBatch(
  sources: ExtractionSource[],
  onInsight: (insight: Insight) => void
): Promise<CrawlerResult>;

// Triggered after task completion
function scheduleExtractionAfterTaskComplete(taskId: string): void;
```

**7.4 Insight Application** (`/src/crawler/apply.ts`)
```typescript
// How insights affect execution (PRD Section 13)
function applyInsightsToExecution(
  insights: Insight[],
  context: ExecutionContext
): ExecutionModifications {
  // - Adjust writing style in agent prompts
  // - Influence planning heuristics
  // - Modify project review intervals
  // - Auto-generate new outcomes
  // - Boost priority for related tasks
}
```

### Validation Criteria
- [ ] All 5 insight types extractable
- [ ] Confidence scoring works correctly
- [ ] Reinforcement increases confidence
- [ ] Insights affect agent prompts
- [ ] Insights affect priority calculations

---

## Phase 8: Concierge Orchestrator

### Objective
Implement the primary AI brain: mode classification, intent parsing, agent dispatch, and briefing generation.

### Deliverables

**8.1 Mode Classifier** (`/src/concierge/modes.ts`)
```typescript
type InteractionMode =
  | 'creative_director'      // vision → plan
  | 'chief_of_staff'         // operational execution
  | 'think_aloud_interpreter' // messy input → structure
  | 'symbiotic_collaboration'; // rapid co-creation

function classifyMode(
  userInput: string,
  conversationContext: ConversationContext,
  insights: Insight[]
): { mode: InteractionMode; confidence: number };
```

**8.2 Intent Parser** (`/src/concierge/intent.ts`)
```typescript
interface ParsedIntent {
  primary_action: 'create' | 'update' | 'query' | 'delegate' | 'clarify';
  entities: {
    outcomes: string[];
    projects: string[];
    tasks: string[];
    people: string[];
  };
  workflow_pattern_hint: string | null;
  urgency: 'immediate' | 'soon' | 'eventual';
}

function parseIntent(
  input: string,
  mode: InteractionMode
): ParsedIntent;
```

**8.3 Agent Dispatch** (`/src/concierge/dispatch.ts`)
```typescript
interface DispatchDecision {
  should_dispatch: boolean;
  workflow_pattern_id: string | null;
  agent_requests: AgentRunRequest[];
  direct_response: string | null;  // if no dispatch needed
}

function decideDispatch(
  intent: ParsedIntent,
  context: ConciergeContext
): DispatchDecision;

async function dispatchAndMonitor(
  requests: AgentRunRequest[],
  onProgress: (update: ProgressUpdate) => void
): Promise<DispatchResult>;
```

**8.4 Semantic Delta Application** (`/src/concierge/apply.ts`)
```typescript
// Concierge decides which deltas to apply
function reviewDeltas(
  deltas: SemanticDelta[],
  confidence_threshold: number
): {
  auto_apply: SemanticDelta[];
  require_confirmation: SemanticDelta[];
  reject: SemanticDelta[];
};

// Apply approved deltas to graph
async function applyDeltas(deltas: SemanticDelta[]): Promise<MutationResult[]>;
```

**8.5 Daily Briefing Generator** (`/src/concierge/briefing.ts`)
```typescript
interface DailyBriefing {
  generated_at: string;
  summary: string;
  sections: {
    due_today: Task[];
    overdue: Task[];
    active_agents: AgentRun[];
    pending_decisions: PendingDecision[];
    high_impact_outcomes: Outcome[];
    salient_insights: Insight[];
  };
  recommended_focus: Task[];
  auto_dispatched: AgentRun[];  // agents started by briefing
}

function generateBriefing(userId: string): Promise<DailyBriefing>;
```

**8.6 User API** (`/src/api/concierge/`)
```typescript
// Main interaction endpoint
POST /api/concierge/message
  → { response: string, actions_taken: Action[], pending_agents: AgentRun[] }

// Get current status
GET /api/concierge/status
  → { active_agents: AgentRun[], pending_decisions: Decision[] }

// Get briefing
GET /api/concierge/briefing
  → DailyBriefing

// Approve/reject pending actions
POST /api/concierge/approve
  → { applied: Delta[], rejected: Delta[] }
```

### Validation Criteria
- [ ] Mode classification accuracy > 85%
- [ ] Intent parsing extracts entities correctly
- [ ] Dispatch decisions match expected patterns
- [ ] Delta application respects confidence thresholds
- [ ] Briefings generate within latency target
- [ ] API endpoints respond < 3-5 seconds

---

## Development Execution Order

### Sprint 1: Foundation
- [ ] Project setup (Next.js, TypeScript strict, Drizzle, Postgres)
- [ ] All domain schemas implemented and validated
- [ ] Database migrations created and tested
- [ ] DAG cycle detection implemented
- [ ] Audit log infrastructure working
- [ ] Basic CRUD API for tasks/projects

### Sprint 2: Execution + Agents (Parallel Tracks)

**Track A: Execution Engine**
- [ ] Task availability calculator
- [ ] All 5 projection generators
- [ ] Priority scoring engine

**Track B: Agent Runtime**
- [ ] Agent lifecycle state machine
- [ ] Capsule protocol types
- [ ] Executor with timeout/retry
- [ ] Progress streaming

### Sprint 3: QA + Workflows
- [ ] QA profiles and checks
- [ ] Profile auto-selection
- [ ] Escalation handling
- [ ] Workflow pattern schema
- [ ] Step sequencer
- [ ] 8 built-in patterns

### Sprint 4: Integrations + Crawler
- [ ] Adapter interface
- [ ] Email adapter (mock for testing)
- [ ] Calendar adapter (mock for testing)
- [ ] Insight extractors
- [ ] Confidence scoring
- [ ] Crawler scheduler

### Sprint 5: Concierge + Polish
- [ ] Mode classifier
- [ ] Intent parser
- [ ] Agent dispatch logic
- [ ] Delta application
- [ ] Briefing generator
- [ ] User API endpoints
- [ ] End-to-end testing

---

## V1 Scope Boundaries (from PRD Section 2.1)

### In Scope
- Single user
- Concierge orchestrator
- Execution graph with CRUD + projections
- Sub-agent runtime with capsule protocol
- QA layer
- 6-8 workflow patterns
- Email + calendar adapters
- Crawler for preferences/commitments
- Daily/weekly briefings

### Explicitly Out of Scope (V2)
- Multi-user support
- Autonomous external actions (auto-send)
- Rich document integrations
- Strategy modeling across projects
- Salience-driven continual reprioritization
- Deep observability interfaces

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| DAG cycles corrupt graph | Strict validation on every write, no bypass |
| Lost agent runs | Persistent state, recovery on restart |
| 3-5s latency too aggressive | Defer non-critical operations, async where possible |
| QA false positives block work | Tunable confidence thresholds, manual override |
| LLM costs escalate | Rate limiting, cost tracking, cheaper models for low-rigor |

---

## Success Metrics

- [ ] All 8 workflow patterns executable end-to-end
- [ ] Concierge response latency p95 < 5 seconds
- [ ] Zero DAG invariant violations in production
- [ ] 100% mutation audit coverage
- [ ] Briefing generation works without errors
