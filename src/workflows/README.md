# Workflows Module

Multi-agent workflow orchestration with declarative patterns, parallel/sequential execution, and artifact passing.

## Purpose

The workflows module handles:
- **Patterns**: 8 built-in workflow templates
- **Sequencing**: Parallel and blocking execution semantics
- **Composition**: Chain agents with artifact dependencies
- **Validation**: Ensure workflow integrity before execution
- **Context**: Pass user profile, tasks, projects through steps

## Architecture

```
┌──────────────────────────────────────────────┐
│          Workflow Pattern Library            │
│  (8 Built-in Templates: Research, Email,     │
│   Planning, Decision, Meeting, etc.)         │
└──────────────┬───────────────────────────────┘
               │
        ┌──────▼──────┐
        │  Sequencer  │
        │  (Planning, │
        │ Execution,  │
        │ Validation) │
        └──────┬──────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼───┐  ┌───▼────┐
│Parallel│  │Serial│  │Artifact│
│Groups  │  │Steps │  │Passing │
└────────┘  └──────┘  └────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `sequencer.ts` | Execution engine with planning and orchestration |
| `patterns/index.ts` | 8 built-in workflow patterns |
| `index.ts` | Public API and pattern registry |

## Built-in Patterns

8 workflow patterns covering common use cases:

### 1. Research & Synthesis (`research-synthesis`)
Multi-step research with synthesis into actionable insights.

**Steps:**
1. Gather information (research_agent)
2. Analyze themes and patterns (research_agent)
3. Synthesize into summary (writer_agent)

**Artifacts:** `synthesis`
**QA Profile:** `balanced`

---

### 2. Article Creation (`article-creation`)
Full article lifecycle from outline to polished draft.

**Steps:**
1. Create outline (planner_agent)
2. Write first draft (writer_agent)
3. Revise for clarity (writer_agent)
4. Polish final version (writer_agent)

**Artifacts:** `final_article`
**QA Profile:** `high_rigor`

---

### 3. Meeting Prep (`meeting-prep`)
Prepare for meetings with context and agenda.

**Steps:**
1. Gather meeting context (research_agent)
2. Create structured agenda (planner_agent)
3. Generate prep notes (writer_agent)

**Artifacts:** `agenda`, `prep_notes`
**QA Profile:** `balanced`

---

### 4. Email Resolution (`email-resolution`)
Analyze email threads and draft responses.

**Steps:**
1. Analyze thread (research_agent)
2. Draft professional response (writer_agent)

**Artifacts:** `draft_response`
**QA Profile:** `high_rigor`

---

### 5. Decision Brief (`decision-brief`)
Research options, analyze tradeoffs, recommend action.

**Steps:**
1. Gather options (research_agent)
2. Analyze tradeoffs (research_agent)
3. Provide recommendation (planner_agent)

**Artifacts:** `recommendation`
**QA Profile:** `high_rigor`

---

### 6. Deep Work Cycle (`deep-work-cycle`)
Plan and support focused work sessions.

**Steps:**
1. Define focus and criteria (planner_agent)
2. Prepare environment (integrations_agent)
3. Review session outcomes (planner_agent)

**Artifacts:** `focus_plan`, `session_review`
**QA Profile:** `fast_draft`

---

### 7. Multi-Step Research (`multi-step-research`)
Iterative research with expansion and validation.

**Steps:**
1. Initial research (research_agent)
2. Expand findings (research_agent)
3. Synthesize results (writer_agent)
4. Validate and identify gaps (research_agent)

**Artifacts:** `validated_research`
**QA Profile:** `balanced`

---

### 8. Weekly Planning (`weekly-planning`)
Review past week and plan upcoming week.

**Steps:**
1. Review past week (planner_agent)
2. Identify priorities (planner_agent)
3. Create schedule (integrations_agent)

**Artifacts:** `week_review`, `weekly_priorities`, `weekly_schedule`
**QA Profile:** `balanced`

## Workflow Sequencer

The sequencer handles workflow execution with sophisticated orchestration.

### Execution Semantics

**Blocking Steps:**
- Must complete before next group runs
- Executed sequentially within group
- Used for dependencies

**Non-Blocking Steps:**
- Can run in parallel with others in same group
- Used for independent operations

**Groups:**
- Steps with same `groupId` form an execution group
- Groups run sequentially
- Steps within a group can run parallel if non-blocking

### Artifact Passing

Artifacts flow between steps as dependencies:

```typescript
// Step 1 produces 'research-notes'
{
  stepId: 'research',
  outputArtifacts: ['research-notes']
}

// Step 2 consumes 'research-notes'
{
  stepId: 'synthesis',
  inputArtifacts: ['research-notes'],
  outputArtifacts: ['final-report']
}
```

Artifacts are:
- Stored in workflow execution context
- Passed to subsequent steps as input documents
- Available for template variable substitution

### Template Variables

Workflow steps support variable substitution:

```typescript
{
  objectiveTemplate: 'Research {{topic}} for {{audience}}',
  // Becomes: "Research AI agents for developers"
}
```

**Variable Sources:**
1. Context variables (custom key-value pairs)
2. Artifacts from previous steps
3. Standard context (project, tasks, outcome)

## Usage

### Execute a Built-in Pattern

```typescript
import { getWorkflowPattern, executeWorkflow } from '@/workflows';

const pattern = getWorkflowPattern('research-synthesis');

const result = await executeWorkflow(
  pattern,
  {
    userProfileSummary: 'Technical researcher',
    variables: {
      topic: 'AI agent frameworks'
    },
    project: currentProject,
    tasks: relatedTasks,
  },
  { actor: 'user' },
  (step, result) => {
    console.log(`Step ${step.stepId}: ${result.success ? 'OK' : 'FAILED'}`);
  }
);

if (result.success) {
  console.log('Final synthesis:', result.artifacts.synthesis);
} else {
  console.error('Failed at step:', result.failedStep);
}
```

### Plan Execution (Dry Run)

```typescript
import { planExecution } from '@/workflows';

const pattern = getWorkflowPattern('email-resolution');
const plan = planExecution(pattern);

console.log(`Total steps: ${plan.totalSteps}`);
for (const group of plan.groups) {
  console.log(`Group ${group.groupId}:`);
  console.log(`  Blocking: ${group.isBlocking}`);
  console.log(`  Parallel: ${group.canRunParallel}`);
  console.log(`  Steps: ${group.steps.length}`);
}
```

### Validate Pattern

```typescript
import { validatePattern } from '@/workflows';

const validation = validatePattern(customPattern);

if (!validation.valid) {
  console.error('Pattern errors:', validation.errors);
  // Example errors:
  // - "Step step-2 requires artifact 'data' which is not produced by any previous step"
  // - "Expected artifact 'final-output' is not produced by any step"
}
```

### Create Custom Pattern

```typescript
import type { WorkflowPattern } from '@/domain';

const customPattern: WorkflowPattern = {
  id: 'custom-research',
  name: 'Custom Research Flow',
  description: 'Tailored research workflow',
  steps: [
    {
      stepId: 'step-1',
      groupId: 'research',
      agentType: 'research_agent',
      objectiveTemplate: 'Research {{topic}}',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['findings'],
    },
    {
      stepId: 'step-2',
      groupId: 'write',
      agentType: 'writer_agent',
      objectiveTemplate: 'Summarize: {{findings}}',
      isBlocking: true,
      inputArtifacts: ['findings'],
      outputArtifacts: ['summary'],
    },
  ],
  qaProfileId: 'balanced',
  expectedArtifacts: ['summary'],
};

// Validate before use
const validation = validatePattern(customPattern);
if (validation.valid) {
  const result = await executeWorkflow(customPattern, context, auditContext);
}
```

### Parallel Step Groups

```typescript
const parallelPattern: WorkflowPattern = {
  id: 'parallel-research',
  name: 'Parallel Research',
  description: 'Multiple research streams in parallel',
  steps: [
    // Group 1: Two parallel research tasks
    {
      stepId: 'research-a',
      groupId: 'gather',
      agentType: 'research_agent',
      objectiveTemplate: 'Research aspect A',
      isBlocking: false, // Can run in parallel
      inputArtifacts: [],
      outputArtifacts: ['findings-a'],
    },
    {
      stepId: 'research-b',
      groupId: 'gather',
      agentType: 'research_agent',
      objectiveTemplate: 'Research aspect B',
      isBlocking: false, // Can run in parallel
      inputArtifacts: [],
      outputArtifacts: ['findings-b'],
    },
    // Group 2: Blocking synthesis (waits for both)
    {
      stepId: 'combine',
      groupId: 'synthesis',
      agentType: 'writer_agent',
      objectiveTemplate: 'Combine findings',
      isBlocking: true,
      inputArtifacts: ['findings-a', 'findings-b'],
      outputArtifacts: ['combined'],
    },
  ],
  qaProfileId: 'balanced',
  expectedArtifacts: ['combined'],
};
```

## Step Lifecycle

Each workflow step follows the agent lifecycle:

```
pending → running → completed
                 → blocked
                 → failed
```

**Workflow Failure:**
- Stops at first failed step
- Returns partial results (completed steps)
- Indicates which step failed

## Integration with Agents

Workflows compose agents transparently:

```typescript
// Workflow step definition
{
  stepId: 'research',
  agentType: 'research_agent', // Uses agent registry
  objectiveTemplate: 'Research {{topic}}',
  // ...
}

// Sequencer converts to AgentRunRequest
const request = instantiateStep(step, context, artifacts, qaProfile);

// Executes via agent executor
const result = await executeAgent(request, auditContext);
```

Each step:
1. Converts to `AgentRunRequest` via `instantiateStep()`
2. Executes through agent executor with retry
3. Returns `AgentRunResponse` with artifacts
4. Artifacts passed to next step

## QA Profiles

Workflows specify QA rigor level:

| Profile | Use Case | Latency | Thoroughness |
|---------|----------|---------|--------------|
| `fast_draft` | Quick iterations, low stakes | ~3-5s | Low |
| `balanced` | Default, most workflows | ~5-10s | Medium |
| `high_rigor` | Important decisions, emails | ~10-20s | High |

Applied to all steps in the workflow for consistent quality.

## Current Status

**✓ Infrastructure Complete:**
- 8 built-in patterns
- Execution planning
- Parallel/sequential orchestration
- Artifact dependency tracking
- Template variable substitution
- Pattern validation

**⚠️ Stub Mode:**
- Agent implementations return placeholder text
- Need to integrate OpenAI Responses API
- No actual web search or external integrations

## Next Steps

1. Integrate OpenAI in underlying agents
2. Add workflow execution monitoring/metrics
3. Support dynamic pattern generation
4. Add workflow pause/resume capability
5. Implement workflow versioning for reproducibility
