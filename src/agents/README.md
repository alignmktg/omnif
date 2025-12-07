# Agents Module

AI agent runtime with lifecycle management, retry logic, and capsule isolation.

## Purpose

The agents module handles:
- **Execution**: Running AI agents with proper lifecycle
- **Retry**: Automatic retry on transient failures
- **Progress**: Streaming progress updates
- **Isolation**: Capsule pattern for independent execution
- **Registry**: Pluggable agent implementations

## Architecture

```
┌──────────────────────────────────────────────┐
│           Agent Executor                     │
│  (Lifecycle, Retry, Progress Streaming)      │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   ┌────▼────┐   ┌────▼────────┐
   │Registry │   │Capsule      │
   │Pattern  │   │Isolation    │
   └─────────┘   └─────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `executor.ts` | Main agent executor with registry |
| `lifecycle.ts` | Agent state machine |
| `retry.ts` | Retry policy and exponential backoff |
| `capsule.ts` | Response building and isolation |

## Agent Types

Four specialized agent types:

1. **Research Agent** (`research_agent`)
   - Gather information on topics
   - Web search, document analysis
   - Returns research notes

2. **Writer Agent** (`writer_agent`)
   - Create written content
   - Drafts, emails, reports
   - Returns formatted text

3. **Planner Agent** (`planner_agent`)
   - Organize and structure work
   - Create plans, roadmaps
   - Returns structured plans

4. **Integrations Agent** (`integrations_agent`)
   - Connect to external services
   - Email, calendar, APIs
   - Returns integration results

## Lifecycle

Agent execution follows this lifecycle:

```
pending → running → completed
                 → blocked
                 → failed (with retry) → running
                 → failed (no retry)
```

### States

- **pending**: Waiting to start
- **running**: Currently executing
- **completed**: Successfully finished
- **blocked**: Cannot proceed (e.g., missing input)
- **failed**: Error occurred, no more retries

## Retry Policy

Automatic retry on transient failures:

```typescript
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 1,              // One automatic retry
  initialDelayMs: 1000,       // Wait 1s before first retry
  maxDelayMs: 5000,           // Cap at 5s
  backoffMultiplier: 2,       // Exponential backoff
  hardTimeoutMs: 300000,      // 5 minute hard limit
  softTimeoutMs: 120000,      // 2 minute soft warning
};
```

**Transient failures** (will retry):
- Network errors
- Rate limits
- Timeouts
- 5xx server errors

**Permanent failures** (won't retry):
- Invalid input
- Permission errors
- 4xx client errors

## Usage

### Register an Agent

```typescript
import { registerAgent } from '@/agents';

registerAgent('research_agent', async (request, onProgress) => {
  onProgress({ progress: 0, message: 'Starting research...' });

  // Call OpenAI or other LLM
  const result = await callLLM(request.objective);

  onProgress({ progress: 100, message: 'Complete' });

  return buildAgentRunResponse({
    runId: request.runId,
    status: 'completed',
    primaryOutput: result,
    overallConfidence: 0.9,
  });
});
```

### Execute an Agent

```typescript
import { executeAgent } from '@/agents';

const result = await executeAgent(
  {
    runId: uuid(),
    agentType: 'research_agent',
    objective: 'Research AI agent frameworks',
    linkedGraphHandles: { taskIds: [], projectId: null },
  },
  { actor: 'user' },
  {
    onProgress: (update) => console.log(update.message),
    onEvent: (event) => console.log(event.type),
  }
);

if (result.success) {
  console.log(result.response?.primaryOutput);
} else {
  console.error(result.error);
}
```

### Batch Execution

```typescript
// Parallel execution
const results = await executeAgentsParallel(requests, context);

// Sequential execution (stops on first failure)
const results = await executeAgentsSequential(requests, context);
```

## Capsule Pattern

Each agent run is isolated:
- No shared state between runs
- Independent progress tracking
- Clean error boundaries
- Reproducible results

## Current Status

**✓ Infrastructure Complete:**
- Lifecycle management
- Retry logic
- Progress streaming
- Registry pattern

**⚠️ Stub Mode:**
- Agent implementations return placeholder text
- Need to integrate OpenAI Responses API

## Next Steps

1. Integrate OpenAI in agent implementations
2. Add streaming support for real-time output
3. Implement cost tracking per agent run
4. Add agent performance metrics
