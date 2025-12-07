# ADR 001: DAG Enforcement for Task Dependencies

## Status
Accepted

## Context
Tasks in POF can have dependencies on other tasks (e.g., "Write draft" depends on "Research topic"). We need to prevent circular dependencies that would create impossible execution scenarios.

## Decision
Implement Directed Acyclic Graph (DAG) enforcement at the database operation level.

When creating or updating task dependencies:
1. Check if adding the dependency would create a cycle
2. Use recursive SQL queries to detect cycles efficiently
3. Reject the operation with a clear error if a cycle is detected
4. Store dependency relationships in a normalized `task_dependencies` table

## Implementation
File: `/src/graph/operations/dag.ts`

```typescript
export async function validateDependencyDAG(
  taskId: string,
  newDependencies: string[]
): Promise<{ valid: boolean; cycle?: string[] }>;
```

The function uses a recursive CTE to traverse the dependency graph and detect cycles.

## Consequences

**Positive:**
- Prevents impossible execution states
- Clear error messages when cycles are detected
- Efficient cycle detection (single SQL query)
- Maintains data integrity

**Negative:**
- Adds validation overhead to dependency operations
- More complex query logic
- Need to handle edge cases (self-dependencies, transitive cycles)

## Alternatives Considered

1. **Application-level validation only**: Rejected because it can't prevent race conditions with concurrent updates
2. **No cycle prevention**: Rejected because it would allow broken dependency chains
3. **Client-side validation only**: Rejected because it's not enforceable

## Related
- Task dependency operations: `/src/graph/operations/tasks.ts`
- Database schema: `/src/graph/schema/tasks.ts`
