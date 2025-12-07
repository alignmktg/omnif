# Graph Module

Database schema, operations, and audit logging for POF's execution infrastructure.

## Purpose

The graph module handles:
- **Schema**: Drizzle ORM definitions for all entities
- **CRUD**: Type-safe database operations
- **DAG**: Dependency validation and cycle detection
- **Audit**: Event sourcing for all mutations
- **Integrity**: Referential constraints and validation

## Architecture

```
┌──────────────────────────────────────────────┐
│            Graph Module                      │
│  (Database Layer + Business Logic)           │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────┬──────────────┐
        │             │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │Schema   │   │DAG      │   │Audit    │
   │Drizzle  │   │Validator│   │Logger   │
   └────┬────┘   └─────────┘   └─────────┘
        │
   ┌────▼────────────────────────────┐
   │ Operations (CRUD + Queries)     │
   │ tasks | projects | outcomes     │
   │ assertions | agent_runs         │
   │ insights                        │
   └─────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `schema.ts` | Drizzle ORM schema definitions |
| `dag.ts` | DAG validation and cycle detection |
| `audit.ts` | Event sourcing and mutation tracking |
| `operations/tasks.ts` | Task CRUD with DAG validation |
| `operations/projects.ts` | Project CRUD with sequential logic |
| `operations/outcomes.ts` | Outcome CRUD operations |
| `operations/assertions.ts` | Assertion CRUD operations |
| `operations/agent-runs.ts` | Agent run lifecycle management |
| `operations/insights.ts` | Insight CRUD with reinforcement |

## Schema Overview

### Core Entities

**5-Layer Work Hierarchy:**
1. **Outcomes** - High-level goals and desired states
2. **Assertions** - Constraints, strategies, preferences
3. **Projects** - Collections of related tasks (parallel or sequential)
4. **Tasks** - Actionable work items with dependencies
5. **Agent Runs** - Execution records for AI agents

**Knowledge Layer:**
- **Insights** - Extracted patterns, preferences, themes, commitments

**Supporting Tables:**
- **Workflow Patterns** - Reusable process templates
- **Mutation Events** - Audit log for all changes
- **User Profiles** - User preferences and summary
- **Pending Decisions** - Unresolved choices requiring user input

### Key Enums

```typescript
// Task lifecycle
task_status: 'inbox' | 'available' | 'scheduled' | 'blocked' | 'completed' | 'dropped'

// Task types
task_type: 'user_action' | 'agent_action' | 'external_wait'

// Project modes
project_type: 'parallel' | 'sequential'

// Agent states
agent_status: 'pending' | 'running' | 'completed' | 'blocked' | 'failed'

// Insight categories
insight_type: 'preference' | 'theme' | 'stable_fact' | 'commitment' | 'recurring_constraint'

// Mutation tracking
mutation_actor: 'user' | 'concierge' | 'agent' | 'system'
```

## DAG Enforcement

The DAG module prevents circular dependencies in task relationships.

### Validation Functions

```typescript
// Check if adding a dependency would create a cycle
const result = await wouldCreateCycle(taskId, newDependencyId);
if (!result.valid) {
  console.error(result.error);
  // Error: "Adding dependency would create cycle: A -> B -> C -> A"
}

// Validate all dependencies for a task
const result = await validateDependencies(taskId, ['dep1', 'dep2']);
if (!result.valid) {
  throw new Error(result.error);
}

// Check date constraints
const result = validateDateConstraints(deferDate, dueDate);
// Ensures dueDate >= deferDate
```

### Dependency Queries

```typescript
// Get tasks that depend on this task
const dependents = await getDependentTasks(taskId);

// Get all transitive dependencies (full chain)
const allDeps = await getTransitiveDependencies(taskId);

// Check if dependencies are complete
const ready = await areDependenciesComplete(taskId);
```

### Cycle Detection

Uses DFS with color marking:
- **WHITE (0)**: Unvisited
- **GRAY (1)**: In progress (cycle if revisited)
- **BLACK (2)**: Completed

## Audit Trail

All mutations are automatically logged with before/after state.

### Audit Context

```typescript
const context: AuditContext = {
  actor: 'user',      // 'user' | 'concierge' | 'agent' | 'system'
  actorId: 'user-123' // Optional identifier
};
```

### Audit Decorators

```typescript
// Automatically logs create operations
const task = await auditCreate('task', context, async () => {
  return await db.insert(tasks).values(data).returning();
});

// Logs update with before/after state
const updated = await auditUpdate(
  'task',
  taskId,
  context,
  async () => getTask(taskId),  // Before state
  async () => updateTaskInDb()  // After state
);

// Logs deletion
await auditDelete('task', taskId, context, getBeforeState, deleteOp);
```

### Query Audit History

```typescript
// Get history for an entity
const events = await getEntityHistory('task', taskId, 50);

// Get all mutations by an actor
const userChanges = await getMutationsByActor('user', 'user-123');

// Get changes in time range
const todayChanges = await getMutationsInRange(
  startOfDay,
  endOfDay,
  'task' // optional entity type filter
);

// Recent activity across all entities
const recent = await getRecentMutations(100);
```

## Operations

### Tasks

```typescript
// Create with validation
const task = await createTask({
  title: 'Build feature',
  projectId: 'proj-123',
  dependencies: ['task-abc'],  // Validated for cycles
  dueDate: '2024-01-15',
  priority: 'high',
  tags: ['engineering', 'frontend'],
}, { actor: 'user' });

// Read operations
const task = await getTask(taskId);
const inbox = await getInboxTasks();
const overdue = await getOverdueTasks();
const today = await getTasksDueToday();
const byTag = await getTasksByTags(['urgent']);

// Update with validation
const updated = await updateTask(taskId, {
  status: 'completed',
  dependencies: [...],  // Re-validated
}, { actor: 'user' });

// Batch operations
await reorderTasks(projectId, ['task-1', 'task-2', 'task-3']);
await createTasks([input1, input2, input3]);
```

### Projects

```typescript
// Create project
const project = await createProject({
  name: 'Q1 Launch',
  type: 'sequential',  // or 'parallel'
  outcomeId: 'outcome-xyz',
  reviewIntervalDays: 7,
}, { actor: 'user' });

// Sequential project helpers
const firstTask = await getFirstAvailableTask(projectId);
const isAvailable = await isTaskAvailableInProject(taskId, projectId);

// Review tracking
const needsReview = await getProjectsForReview();
await markProjectReviewed(projectId);

// Status updates
await completeProject(projectId);
```

### Outcomes

```typescript
// Create high-level goal
const outcome = await createOutcome({
  title: 'Launch product successfully',
  description: '10k users in first month',
}, { actor: 'user' });

// Query
const active = await getActiveOutcomes();
const specific = await getOutcome(outcomeId);

// Lifecycle
await achieveOutcome(outcomeId);
await abandonOutcome(outcomeId);
```

### Assertions

```typescript
// Create constraints/strategies/preferences
const assertion = await createAssertion({
  content: 'All features require tests',
  type: 'constraint',
  outcomeId: 'outcome-abc',
}, { actor: 'concierge' });

// Query by type
const constraints = await getAssertionsByType('constraint');
const strategies = await getAssertionsByType('strategy');

// Query by outcome
const outcomeAssertions = await getAssertionsByOutcome(outcomeId);

// Bulk fetch
const assertions = await getAssertionsByIds(['id1', 'id2']);
```

### Agent Runs

```typescript
// Create agent run
const run = await createAgentRun({
  agentType: 'research_agent',
  objective: 'Research competitors',
  linkedProjectId: projectId,
  linkedTaskIds: [taskId],
}, { actor: 'concierge' });

// State transitions
await startAgentRun(runId);
await completeAgentRun(runId, response);
await failAgentRun(runId, errorMessage);
await blockAgentRun(runId, reason);

// Retry logic (max 1 retry)
await retryAgentRun(runId);  // Throws if already retried

// Queries
const active = await getActiveAgentRuns();
const byProject = await getAgentRunsByProject(projectId);
const byType = await getAgentRunsByType('writer_agent');
```

### Insights

```typescript
// Extract insight
const insight = await createInsight({
  type: 'preference',
  content: 'Prefers async communication',
  confidence: 0.8,
  sourceRefs: ['email-123', 'chat-456'],
}, { actor: 'system' });

// Reinforce with additional evidence
await reinforceInsight(
  insightId,
  ['email-789'],  // Additional source refs
  0.05            // Confidence boost
);

// Query
const preferences = await getInsightsByType('preference');
const highConf = await getHighConfidenceInsights(0.7);
const recent = await getRecentInsights(50);

// Search
const similar = await findSimilarInsights('async communication');
```

## Database Structure

### Indexes

Optimized for common query patterns:

**Tasks:**
- `projectId`, `status`, `dueDate`, `priority`, `parentTaskId`

**Projects:**
- `status`, `outcomeId`

**Agent Runs:**
- `status`, `agentType`

**Insights:**
- `type`, `confidence`

**Mutation Events:**
- `(entityType, entityId)`, `timestamp`, `actor`

### Relations

Drizzle relations for type-safe joins:

```typescript
// Outcomes -> Projects (one-to-many)
// Outcomes -> Assertions (one-to-many)
// Projects -> Tasks (one-to-many)
// Projects -> Agent Runs (one-to-many)
// Tasks -> Project (many-to-one)
// Tasks -> Parent Task (self-reference)
// Tasks -> Agent Run (many-to-one)
// Agent Runs -> Pending Decisions (one-to-many)
```

## Data Integrity

### Constraints

**Unique:**
- All entities have UUID primary keys

**Foreign Keys:**
- Cascade handled via `onDelete` policies
- Most use `'set null'` to preserve history
- Deletes blocked if dependent entities exist

**Validation:**
- DAG validation on task dependencies
- Date constraints (dueDate >= deferDate)
- Sequential project logic enforcement

### JSONB Fields

Type-safe JSON storage:

```typescript
// Task dependencies
dependencies: string[]

// Tags
tags: string[]

// External references
externalRefs: Array<{ kind: string; ref: string }>

// Agent request/response
request: AgentRunRequest
response: AgentRunResponse

// Insight sources
sourceRefs: string[]
```

## Sequential Projects

Special logic for ordered execution:

```typescript
// Only first incomplete task is "available"
const task = await getFirstAvailableTask(projectId);

// Check if task can be worked on
const canWork = await isTaskAvailableInProject(taskId, projectId);
// Returns true for parallel projects
// Returns true only for first task in sequential projects
```

**Sequential invariant:** Tasks must be completed in `orderIndex` order.

## Mutation Events

Complete audit trail of all changes:

```typescript
interface MutationEvent {
  id: string;
  entityType: string;      // 'task', 'project', etc.
  entityId: string;
  mutationType: 'create' | 'update' | 'delete';
  beforeState: unknown | null;
  afterState: unknown;
  actor: 'user' | 'concierge' | 'agent' | 'system';
  actorId?: string;
  timestamp: string;
}
```

**Use cases:**
- Undo/redo functionality
- Debugging state changes
- User activity tracking
- System health monitoring
- Compliance and auditing

## Usage Patterns

### Creating Work Hierarchy

```typescript
// 1. Create outcome
const outcome = await createOutcome({
  title: 'Launch MVP',
}, context);

// 2. Add assertions
const assertion = await createAssertion({
  content: 'Ship by end of Q1',
  type: 'constraint',
  outcomeId: outcome.id,
}, context);

// 3. Create project
const project = await createProject({
  name: 'MVP Development',
  type: 'sequential',
  outcomeId: outcome.id,
}, context);

// 4. Add tasks with dependencies
const task1 = await createTask({
  title: 'Design',
  projectId: project.id,
}, context);

const task2 = await createTask({
  title: 'Build',
  projectId: project.id,
  dependencies: [task1.id],  // DAG validated
}, context);
```

### Agent Execution

```typescript
// Create run
const run = await createAgentRun({
  agentType: 'research_agent',
  objective: 'Research pricing',
  linkedProjectId: project.id,
}, { actor: 'concierge' });

// Start execution
await startAgentRun(run.id);

// Complete with results
await completeAgentRun(run.id, {
  runId: run.id,
  status: 'completed',
  primaryOutput: 'Research findings...',
  artifacts: [...],
  overallConfidence: 0.9,
});

// Link to task
await updateTask(taskId, {
  agentRunId: run.id,
  status: 'completed',
});
```

### Knowledge Extraction

```typescript
// Extract insight from interaction
const insight = await createInsight({
  type: 'preference',
  content: 'Prefers morning meetings',
  confidence: 0.6,
  sourceRefs: ['calendar-analysis-123'],
}, { actor: 'system' });

// Reinforce over time
await reinforceInsight(insight.id, ['email-456'], 0.05);
// Confidence: 0.6 -> 0.65

await reinforceInsight(insight.id, ['chat-789'], 0.05);
// Confidence: 0.65 -> 0.70

// Use in planning
const preferences = await getHighConfidenceInsights(0.7);
```

## Current Status

**✓ Complete:**
- Full schema definitions
- DAG validation with cycle detection
- Audit logging infrastructure
- CRUD operations for all entities
- Type-safe operations
- Database constraints and indexes

**⚠️ TODO:**
- Workflow patterns implementation
- User profiles integration
- Pending decisions workflow
- Vector search for insights (semantic)
- Soft deletes (archive pattern)
- Database migrations setup

## Next Steps

1. Add migration system (Drizzle Kit)
2. Implement workflow patterns CRUD
3. Build user profile management
4. Add semantic search for insights
5. Create database backup/restore
6. Add performance monitoring
7. Implement soft delete pattern
