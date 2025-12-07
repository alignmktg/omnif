# Execution Module

Task availability computation, priority scoring, and forecast projections.

## Purpose

The execution module handles:
- **Availability**: Calculate task status based on dependencies, defer dates, and sequential constraints
- **Priority**: Salience-based scoring using urgency, risk, content type, and user preferences
- **Projections**: Derived views (Inbox, Projects, Tags, Forecast, Review)
- **Status Updates**: Propagate completion effects through dependency graph
- **QA Profiling**: Determine quality assurance rigor based on task characteristics

## Architecture

```
┌──────────────────────────────────────────────┐
│           Execution Engine                   │
│  (Availability, Priority, Projections)       │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────┬────────────┐
        │             │            │
   ┌────▼────┐   ┌────▼────┐  ┌───▼──────┐
   │Available│   │Priority │  │Forecast  │
   │Status   │   │Scoring  │  │Views     │
   └─────────┘   └─────────┘  └──────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `availability.ts` | Task availability computation and status propagation |
| `priority.ts` | Salience-based priority scoring algorithm |
| `projections.ts` | Derived views (Inbox, Projects, Tags, Forecast, Review) |
| `index.ts` | Public API exports |

## Availability Calculation

Task status is computed using these rules (PRD Section 11):

1. **Terminal states** → `completed` or `dropped` (no recalculation)
2. **Deferred** → `scheduled` if `deferDate > now`
3. **Dependencies** → `blocked` if any dependency incomplete
4. **Sequential** → `blocked` if not first incomplete task in sequential project
5. **Inbox** → `inbox` if no project assigned
6. **Otherwise** → `available`

### Status Flow

```
inbox → available → completed
          ↓           dropped
      blocked
     scheduled
```

### Key Functions

```typescript
// Calculate availability for a single task
const status = await calculateTaskAvailability(
  task,
  project,
  incompleteDependencyIds,
  isFirstInSequentialProject
);

// Recalculate and update status in database
const newStatus = await recalculateTaskStatus(taskId);

// Propagate completion effects to dependent tasks
await propagateCompletionEffects(completedTaskId);

// Get all currently available tasks
const availableIds = await getAvailableTasks();
```

## Priority Scoring

Salience-based algorithm from PRD Section 13 that combines multiple factors:

### Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| **Urgency** | 35% | Due date proximity (overdue +0.2 boost) |
| **Risk** | 25% | External refs, tags, priority level |
| **Content Type** | 20% | Task type weighting (email_external: 0.9, internal_note: 0.2) |
| **Preference** | 10% | User insight matching |
| **Base Priority** | 10% | Task priority field |

### Urgency Calculation

```typescript
// Overdue tasks
if (hoursUntilDue < 0) return 1.2;

// Due within 48 hours
if (hoursUntilDue < 48) return 1.0;

// Due within 7 days
if (daysUntilDue < 7) return 0.7;

// Due within 14 days
if (daysUntilDue < 14) return 0.5;

// Further out
return 0.3;
```

### Risk Factors

- Email references: +0.3
- External/client references: +0.4
- High-risk tags (urgent, critical, deadline, blocker): +0.3
- Critical priority: +0.3, High priority: +0.2
- Matching commitment insights: +0.2

### Content Type Weights

```typescript
const CONTENT_TYPE_WEIGHTS = {
  email_external: 0.9,    // High priority
  external_wait: 0.7,      // External dependency
  analysis: 0.6,           // Medium priority
  user_action: 0.5,        // Standard
  research: 0.4,           // Lower priority
  agent_action: 0.4,       // Agent work
  internal_note: 0.2,      // Low priority
};
```

### Usage Examples

```typescript
import {
  calculatePriorityScore,
  sortByPriority,
  determineQAProfile,
  groupByPriorityTier
} from '@/execution';

// Calculate score for a single task
const score = calculatePriorityScore(task, insights);
console.log(score);
// {
//   urgency: 1.0,
//   risk: 0.7,
//   contentType: 0.9,
//   preference: 0.6,
//   composite: 0.83
// }

// Sort tasks by priority
const sorted = sortByPriority(tasks, insights);
sorted.forEach(({ task, score }) => {
  console.log(`${task.title}: ${score.composite}`);
});

// Determine QA rigor level
const qaProfile = determineQAProfile(score, task.type);
// 'high_rigor' | 'balanced' | 'fast_draft'

// Group into tiers
const tiers = groupByPriorityTier(tasks, insights);
console.log(`Critical: ${tiers.critical.length}`);
console.log(`High: ${tiers.high.length}`);
console.log(`Normal: ${tiers.normal.length}`);
console.log(`Low: ${tiers.low.length}`);
```

## QA Profile Determination

Quality assurance rigor is automatically determined based on task characteristics:

```typescript
// High rigor if urgent AND risky
if (urgency + risk > 1.3) return 'high_rigor';

// High rigor if external AND risky
if (contentType >= 0.9 && risk > 0.7) return 'high_rigor';

// Fast draft for brainstorming or low priority
if (taskType === 'brainstorming' || composite < 0.3) return 'fast_draft';

// Balanced for everything else
return 'balanced';
```

## Projections

Derived views of the execution graph (PRD Section 11):

### Inbox Projection

```typescript
// Get unassigned tasks
const inboxTasks = await getInboxProjection();
// Returns tasks with no projectId, ordered by creation date
```

### Projects Projection

```typescript
// Get hierarchical project tree
const projectTrees = await getProjectsProjection();
// Returns: { project, tasks, childProjects }[]

// Get single project with tasks
const result = await getProjectWithTasks(projectId);
// Returns: { project, tasks } | null
```

### Tags Projection

```typescript
// Get tasks grouped by tag
const tasksByTag = await getTagsProjection();
// Returns: Map<string, Task[]>

// Get tag summary with counts
const summary = await getTagSummary();
// Returns: [{ tag: 'urgent', count: 12 }, ...]

// Get tasks for specific tag
const tasks = await getTasksByTag('external');
```

### Forecast Projection

```typescript
// Get forecast for next 14 days
const forecast = await getForecastProjection(14, calendarEvents);
// Returns: [
//   { date: 'overdue', tasks: [...], events: [] },
//   { date: '2025-12-07', tasks: [...], events: [...] },
//   { date: '2025-12-08', tasks: [...], events: [...] },
// ]

// Get tasks due today
const dueToday = await getDueToday();

// Get overdue tasks
const overdue = await getOverdue();
```

### Review Projection

```typescript
// Get projects due for review
const reviewProjects = await getReviewProjection();
// Returns projects where:
//   lastReviewedAt + reviewIntervalDays < now

// Get never-reviewed projects
const neverReviewed = await getNeverReviewed();
```

### Summary Dashboard

```typescript
// Get all counts at once
const summary = await getProjectionSummary();
console.log(summary);
// {
//   inbox: 12,
//   available: 8,
//   scheduled: 4,
//   blocked: 3,
//   dueToday: 2,
//   overdue: 1,
//   projectsForReview: 2
// }
```

## Dependency Propagation

When tasks are completed, availability is recalculated for dependent tasks:

```typescript
import {
  propagateCompletionEffects,
  recalculateProjectTaskStatuses
} from '@/execution';

// Mark task complete and update dependents
await markTaskComplete(taskId);
await propagateCompletionEffects(taskId);

// Recalculate all tasks in a project
await recalculateProjectTaskStatuses(projectId);
```

## Sequential Project Handling

Sequential projects expose only one available task at a time:

```typescript
// Check if task is first incomplete
const isFirst = await isFirstIncompleteInProject(taskId, projectId);

// Sequential project logic
if (project.type === 'sequential' && !isFirst) {
  status = 'blocked'; // Not first incomplete
}
```

Tasks are ordered by `orderIndex` field. Only the first incomplete task is `available`, all others are `blocked`.

## Integration Example

Complete workflow using all execution components:

```typescript
import {
  getAvailableTasks,
  calculatePriorityScore,
  sortByPriority,
  getForecastProjection,
  recalculateTaskStatus,
  propagateCompletionEffects,
} from '@/execution';
import { getInsights } from '@/knowledge';

// Get available work
const availableIds = await getAvailableTasks();
const tasks = await Promise.all(
  availableIds.map(id => getTaskById(id))
);

// Get user insights for preference scoring
const insights = await getInsights({ type: 'preference' });

// Sort by priority
const prioritized = sortByPriority(tasks, insights);

// Get next task to work on
const nextTask = prioritized[0].task;
console.log(`Next: ${nextTask.title} (score: ${prioritized[0].score.composite})`);

// Get forecast for planning
const forecast = await getForecastProjection(7);
forecast.forEach(day => {
  console.log(`${day.date}: ${day.tasks.length} tasks, ${day.events.length} events`);
});

// After completing task
await markTaskComplete(nextTask.id);
await propagateCompletionEffects(nextTask.id);
```

## Current Status

**✓ Availability Engine Complete:**
- Dependency checking
- Sequential project constraints
- Status propagation
- Deferred date handling

**✓ Priority Scoring Complete:**
- Multi-factor salience algorithm
- Urgency calculation
- Risk assessment
- Preference matching
- QA profile determination

**✓ Projections Complete:**
- Inbox, Projects, Tags, Forecast, Review
- Summary dashboard
- Calendar integration support

**⚠️ Performance:**
- Sequential processing of tasks
- Could benefit from batch operations
- No caching layer yet

## Next Steps

1. Add batch status recalculation for better performance
2. Implement caching layer for frequently accessed projections
3. Add real-time status updates via WebSocket
4. Integrate calendar sync for forecast accuracy
5. Add metrics tracking for priority scoring accuracy
