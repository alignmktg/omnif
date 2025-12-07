# ADR 003: Agent Registry Pattern

## Status
Accepted

## Context
POF has four types of agents (research, writer, planner, integrations), each with different implementations. We need a way to:
1. Execute agents with consistent lifecycle management
2. Allow swapping implementations without changing calling code
3. Support multiple implementations of the same agent type (e.g., GPT-4 vs Claude)

## Decision
Use a registry pattern where agent implementations are registered at startup and retrieved by type at execution time.

## Implementation
File: `/src/agents/executor.ts`

```typescript
type AgentImplementation = (
  request: AgentRunRequest,
  onProgress: (update: ProgressUpdate) => void
) => Promise<AgentRunResponse>;

const agentImplementations = new Map<AgentType, AgentImplementation>();

export function registerAgent(
  agentType: AgentType,
  implementation: AgentImplementation
): void {
  agentImplementations.set(agentType, implementation);
}

export function getAgentImplementation(
  agentType: AgentType
): AgentImplementation | undefined {
  return agentImplementations.get(agentType);
}
```

**Registration:**
```typescript
registerAgent('research_agent', researchAgentImpl);
registerAgent('writer_agent', writerAgentImpl);
registerAgent('planner_agent', plannerAgentImpl);
registerAgent('integrations_agent', integrationsAgentImpl);
```

**Execution:**
```typescript
const implementation = getAgentImplementation(request.agentType);
if (!implementation) {
  throw new Error(`No implementation for ${request.agentType}`);
}
const response = await implementation(request, progressCallback);
```

## Consequences

**Positive:**
- Clean separation between agent logic and infrastructure
- Easy to swap implementations (OpenAI → Anthropic)
- Supports A/B testing different models
- Can register multiple implementations per type
- Testable (can register mock implementations)

**Negative:**
- Indirection makes code flow less obvious
- Must ensure agents are registered before use
- Runtime error if implementation missing (not compile-time)

## Alternatives Considered

1. **Direct imports**: Rejected because it tightly couples executor to implementations
2. **Dependency injection**: Rejected as overkill for this use case
3. **Factory pattern**: Rejected because registry is simpler and more flexible
4. **Class hierarchy**: Rejected because functional approach is more flexible

## Future Enhancements
- Support multiple implementations per agent type with versioning
- Add implementation metrics (latency, cost, success rate)
- Allow runtime implementation selection based on context

## Related
- Agent lifecycle: `/src/agents/lifecycle.ts`
- Retry logic: `/src/agents/retry.ts`
- Capsule isolation: `/src/agents/capsule.ts`
