# POF Prompt Architecture Overview

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INPUT (Chat UI)                       │
│                  /api/concierge/chat (POST)                     │
│                  { message: "Help me plan my day" }             │
│                  OR [AUTO_GREET] on page load                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │        API Route Handler             │
        │  - Handle [AUTO_GREET] magic message │
        │  - Pass to simple chat function      │
        └──────────────────────┬───────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │        Simple Concierge              │
        │  src/concierge/simple.ts             │
        │                                      │
        │  1. Build context from DB            │
        │  2. Inject context into system prompt│
        │  3. Call OpenAI with tools           │
        │  4. Execute any tool calls           │
        │  5. Return response                  │
        └──────────────────────┬───────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
     No tool calls      Tool calls        Tool calls
            │           (CRUD)             executed
            │              │                  │
            ▼              ▼                  ▼
      Direct LLM      Execute tool      Final LLM
       response       functions          response
            │              │                  │
            └──────────────┴──────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │          Return Response             │
        │  { message, toolsUsed }              │
        └──────────────────────────────────────┘
```

---

## Architecture

### Core Principle
**Single smart LLM with tools** - no regex, no classification, no routing logic. The LLM decides what to do based on context and available tools.

### Key Files

| Purpose | Path |
|---------|------|
| API Entry | `src/app/api/concierge/chat/route.ts` |
| Simple Concierge | `src/concierge/simple.ts` |
| Chat UI | `src/app/chat/page.tsx` |
| DB Schema | `src/graph/schema.ts` |
| OpenAI Utils | `src/lib/openai.ts` |

---

## 1. User Input Flow

**Entry Point:** `POST /api/concierge/chat`

**File:** `src/app/api/concierge/chat/route.ts`

```typescript
// Regular message
{ "message": "Create a task for reviewing metrics", "sessionId": "..." }

// Auto-greet (sent automatically on page load)
{ "message": "[AUTO_GREET]", "sessionId": "..." }
```

**Auto-Greet Prompt:**
```
Suggest 5 ways you can help me today based on my current tasks and projects.
Number them 1-5. Be specific and personalized based on what you see in my context.
If I have no tasks yet, suggest ways to get started.
```

---

## 2. Context Building

**File:** `src/concierge/simple.ts` → `buildContext()`

The LLM receives real-time context about the user's tasks and projects:

```typescript
async function buildContext(): Promise<string> {
  const [taskList, projectList] = await Promise.all([
    db.select().from(tasks).where(ne(tasks.status, 'completed')),
    db.select().from(projects).where(eq(projects.status, 'active'))
  ]);

  // Build context string with:
  // - Task counts by status (inbox, available, blocked)
  // - Active project names
  // - Critical and high-priority tasks
  // - Recent task list (up to 10)
}
```

**Example Context:**
```
Tasks: 12 active (3 inbox, 7 available, 2 blocked)
Projects: Q4 Launch, Website Redesign

CRITICAL TASKS:
- Fix production bug

High Priority:
- Review quarterly metrics
- Prepare board presentation

Recent tasks:
- [available] Review weekly metrics
- [inbox] Call with Sarah
- [blocked] Waiting for design assets
```

---

## 3. System Prompt

**File:** `src/concierge/simple.ts`

```typescript
const SYSTEM_PROMPT = `You are POF, a helpful productivity assistant.

CURRENT CONTEXT:
{context}

You can help with anything, but you have special abilities to manage tasks:
- Create new tasks
- Update existing tasks
- Mark tasks as complete
- List and search tasks

Be concise, friendly, and action-oriented. When the user mentions something
that sounds like a task, offer to create it. When they want to do something,
check if there's a relevant task.

If the user asks you to suggest ways to help, look at their current tasks
and projects and make personalized suggestions based on what you see.`;
```

---

## 4. Tools (Function Calling)

**File:** `src/concierge/simple.ts`

The LLM can call these tools to perform CRUD operations:

### `create_task`
```typescript
{
  name: 'create_task',
  description: 'Create a new task. Use when user wants to add something to their todo list.',
  parameters: {
    title: string,        // required
    priority?: 'critical' | 'high' | 'normal' | 'low',
    notes?: string,
    projectId?: string
  }
}
```

### `update_task`
```typescript
{
  name: 'update_task',
  description: 'Update an existing task by ID',
  parameters: {
    id: string,           // required
    title?: string,
    priority?: 'critical' | 'high' | 'normal' | 'low',
    notes?: string,
    status?: 'inbox' | 'available' | 'scheduled' | 'blocked' | 'completed' | 'dropped'
  }
}
```

### `complete_task`
```typescript
{
  name: 'complete_task',
  description: 'Mark a task as completed. Use when user says they finished something.',
  parameters: {
    id: string            // required
  }
}
```

### `list_tasks`
```typescript
{
  name: 'list_tasks',
  description: 'List tasks, optionally filtered by status',
  parameters: {
    status?: 'inbox' | 'available' | 'scheduled' | 'blocked' | 'completed' | 'all'
  }
}
```

---

## 5. LLM Call Flow

**File:** `src/concierge/simple.ts` → `chat()`

```typescript
export async function chat(message: string, sessionId: string): Promise<ChatResult> {
  // 1. Build context from DB
  const context = await buildContext();
  const systemPrompt = SYSTEM_PROMPT.replace('{context}', context);

  // 2. Create OpenAI client with standard params
  const client = createOpenAIClient();
  const { model, temperature, max_tokens, top_p } = buildChatCompletionParams();

  // 3. First LLM call with tools
  const response = await client.chat.completions.create({
    model,
    temperature,
    max_tokens,
    top_p,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    tools: TOOLS,
    tool_choice: 'auto',
  });

  // 4. If tool calls, execute them
  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      const result = await executeToolCall(toolCall.function.name, args);
      // Add tool result to messages
    }

    // 5. Second LLM call for final response
    const finalResponse = await client.chat.completions.create({
      model,
      messages, // includes tool results
    });

    return { message: finalResponse, toolsUsed };
  }

  // 6. No tools - return direct response
  return { message: response.message };
}
```

---

## 6. Model Configuration

**File:** `pof.config.yaml` → `src/lib/config/loader.ts`

```yaml
# Default model (used by simple concierge)
model:
  default:
    model_name: gpt-4o
    temperature: 0.7
    max_tokens: 500
```

---

## Architecture Summary

| Component | File | LLM Used | Model | Purpose |
|-----------|------|----------|-------|---------|
| Simple Concierge | `concierge/simple.ts` | Yes | gpt-4o | All user interactions |
| Tool Execution | `concierge/simple.ts` | No | N/A | Direct DB operations |
| Context Builder | `concierge/simple.ts` | No | N/A | Fetch tasks/projects |

---

## What Was Removed

The previous architecture (~2,200 lines) included:

| File | Lines | What It Did |
|------|-------|-------------|
| `concierge/orchestrator.ts` | 692 | Complex orchestration layer |
| `concierge/modes.ts` | 298 | Keyword-based mode detection |
| `concierge/intent.ts` | 460 | Regex-based intent parsing |
| `concierge/dispatch.ts` | 443 | Agent/workflow routing |
| `concierge/briefing.ts` | 300 | Daily briefing generation |

**Why removed:** Over-engineered. A single smart LLM with tools handles everything better.

---

## Example Interactions

### Auto-Greet (Page Load)
```
User: [AUTO_GREET]
→ Context: 5 tasks, 2 projects
→ LLM: Returns 5 personalized suggestions based on actual tasks

Response:
"Based on your current tasks and projects, here are 5 ways I can help:
1. Review your 3 inbox items and prioritize them
2. Help plan your blocked task 'Waiting for design assets'
3. Create action items for the Q4 Launch project
4. Mark 'Fix production bug' complete if you've resolved it
5. Draft a meeting agenda for your call with Sarah"
```

### Task Creation
```
User: "Create a task to review weekly metrics"
→ LLM calls: create_task({ title: "Review weekly metrics" })
→ Tool executes: INSERT INTO tasks...
→ LLM: "Created task 'Review weekly metrics'"
```

### General Chat
```
User: "What should I focus on today?"
→ Context shows critical task + high priority items
→ LLM: "I'd focus on the critical 'Fix production bug' first,
        then tackle 'Review quarterly metrics' and
        'Prepare board presentation'."
```
