# Domain Module

Core types, schemas, and business logic for POF. This is the source of truth for all data structures.

## Purpose

The domain module defines:
- **Types**: TypeScript interfaces and type aliases
- **Validation**: Zod schemas for runtime validation
- **Constants**: Enums and readonly values
- **Pure functions**: Business logic with no side effects

## Key Files

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript type definitions |
| `validation.ts` | Zod schemas for runtime validation |
| `index.ts` | Public exports |

## Core Types

### Task
Represents a unit of work.

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: Date;
  projectId?: string;
  dependsOn: string[];
  tags: string[];
}
```

**Status:** `inbox | available | scheduled | blocked | completed | dropped`
**Priority:** `low | normal | high | critical`

### Project
Container for tasks with execution semantics.

```typescript
interface Project {
  id: string;
  name: string;
  type: ProjectType;  // parallel | sequential
  status: ProjectStatus;
  dueDate?: Date;
  parentId?: string;
}
```

**Sequential projects** expose only one available task at a time.
**Parallel projects** allow multiple tasks to be worked on simultaneously.

### Insight
Knowledge extracted from user interactions.

```typescript
interface Insight {
  id: string;
  type: InsightType;
  content: string;
  confidence: number;
  sourceRefs: string[];
  extractedAt: Date;
  lastReinforcedAt?: Date;
}
```

**Types:**
- `preference`: User preferences and style
- `stable_fact`: Biographical info, relationships
- `commitment`: Promises and deadlines
- `recurring_constraint`: Availability patterns
- `theme`: Recurring topics

### AgentRun
Execution record for AI agent invocations.

```typescript
interface AgentRun {
  id: string;
  agentType: AgentType;
  status: AgentStatus;
  objective: string;
  request: AgentRunRequest;
  response?: AgentRunResponse;
  retryCount: number;
  error?: string;
}
```

**Agent Types:** `research_agent | writer_agent | planner_agent | integrations_agent`

## Validation Schemas

All types have corresponding Zod schemas in `validation.ts`:

```typescript
import { taskSchema, projectSchema } from '@/domain';

// Runtime validation
const result = taskSchema.safeParse(input);
if (!result.success) {
  console.error(result.error.issues);
}
```

## Usage

```typescript
import type { Task, Project, Insight } from '@/domain';
import { taskSchema, projectSchema, TaskStatus, Priority } from '@/domain';

// Use types for TypeScript checking
const task: Task = {
  id: uuid(),
  title: 'Research AI frameworks',
  status: TaskStatus.INBOX,
  priority: Priority.HIGH,
  dependsOn: [],
  tags: ['research', 'ai'],
};

// Validate at runtime
const validation = taskSchema.safeParse(task);
```

## Design Principles

1. **No dependencies**: Domain types don't import from other modules (except Zod)
2. **Immutable**: Types use `readonly` where appropriate
3. **Validation**: Every type has a Zod schema
4. **Enums as const**: Use `as const` objects for type-safe enums
5. **Export everything**: All types are exported from `index.ts`

## Adding New Types

1. Define TypeScript type in `types.ts`
2. Add Zod schema in `validation.ts`
3. Export from `index.ts`
4. Update this README
