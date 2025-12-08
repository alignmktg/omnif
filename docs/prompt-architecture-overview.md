# POF Prompt Architecture Overview

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INPUT (Chat UI)                       │
│                  /api/concierge/chat (POST)                     │
│                  { message: "Help me plan my day" }             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   ConciergeOrchestrator.processInput  │
        │   - Validate message                  │
        │   - Get/create conversation context   │
        └──────────────────────┬────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
        ┌────────────────────┐  ┌──────────────────┐
        │  classifyMode()    │  │   parseIntent()  │
        │                    │  │                  │
        │ Keyword scoring:   │  │ Pattern matching │
        │ - keywords (+1)    │  │ - Categories     │
        │ - phrases (+2)     │  │ - Actions        │
        │ - context signals  │  │ - Entities       │
        │                    │  │ - Confidence     │
        └────────┬───────────┘  └────────┬─────────┘
                 │ mode                   │ intent
                 │                        │
                 └────────────┬───────────┘
                              │
                              ▼
        ┌─────────────────────────────────┐
        │    decideDispatch()             │
        │ Check INTENT_TO_AGENT routing   │
        │ Check INTENT_TO_WORKFLOW routing│
        │ Build AgentInput if needed      │
        └────────────┬────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
     shouldDispatch=true    shouldDispatch=false
        │                         │
        ▼                         ▼
    executeDispatch()    generateDirectResponse()
        │                         │
    ┌───┴────┐                   │
    │         │                   │
    ▼         ▼                   ▼
workflow  agent          AI or canned response
    │         │                   │
    └───┬─────┘                   │
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │  generateResponseMessage()   │
        │  - Format output             │
        │  - Apply mode behaviors      │
        │  - Generate suggestions      │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Return OrchestratorResponse │
        │  - message                   │
        │  - mode                      │
        │  - intent                    │
        │  - dispatch decision         │
        │  - suggestions               │
        └──────────────────────────────┘
```

---

## 1. User Input Flow

**Entry Point:** `POST /api/concierge/chat`

**File:** `src/app/api/concierge/chat/route.ts`

```json
{
  "message": "Help me plan my day",
  "sessionId": "optional-session-id"
}
```

---

## 2. Intent Parsing (No LLM - Pattern Matching)

**File:** `src/concierge/intent.ts`

### Categories
- `task_management` - tasks, todos, action items
- `project_management` - projects, initiatives
- `information` - research, lookup, questions
- `scheduling` - calendar, meetings, appointments
- `communication` - email, messages, notifications
- `planning` - plans, goals, roadmaps
- `reflection` - review, retrospective
- `general` - everything else

### Actions
```typescript
create, update, delete, complete, list, search,
schedule, remind, send, draft, review, plan, summarize, clarify
```

### Pattern Examples
```typescript
// Category detection
task_management: [
  /\b(task|todo|action|item|thing to do)\b/i,
  /\b(create|add|make|complete|finish|done)\b/i,
]

// Action detection
ACTION_PATTERNS = {
  create: [/\b(create|add|make|new|start)\b/i],
  plan: [/\b(plan|strategy|roadmap|outline)\b/i],
  complete: [/\b(complete|finish|done|mark as done)\b/i],
}
```

---

## 3. Mode Detection (No LLM - Keyword Scoring)

**File:** `src/concierge/modes.ts`

### Modes
| Mode | Use Case | Style |
|------|----------|-------|
| `creative_director` | Vision, strategy | Collaborative |
| `chief_of_staff` | Execution (default) | Directive |
| `think_aloud_interpreter` | Exploration | Exploratory |
| `symbiotic_collaboration` | Co-creation | Iterative |

### Detection Keywords
```typescript
creative_director: {
  keywords: [/vision/i, /strategy/i, /goal/i, /roadmap/i],
  phrases: [/i want to/i, /what if we/i, /big picture/i]
}

chief_of_staff: {
  keywords: [/task/i, /action/i, /execute/i, /deliver/i],
  phrases: [/get it done/i, /make it happen/i, /let's do/i]
}
```

### Mode Behaviors
```typescript
creative_director: {
  proactivity: "balanced",
  detailLevel: "comprehensive",
  suggestActions: true,
  autoCreateTasks: false
}

chief_of_staff: {
  proactivity: "proactive",
  detailLevel: "brief",
  suggestActions: true,
  autoCreateTasks: true
}
```

---

## 4. Dispatch Logic

**File:** `src/concierge/dispatch.ts`

### Intent-to-Agent Routing
```typescript
INTENT_TO_AGENT = {
  task_management: {
    create: "planner_agent",
    search: "research_agent",
    complete: null,  // direct operation
    list: null,      // direct query
  },
  information: {
    search: "research_agent",
    summarize: "writer_agent",
  },
  communication: {
    draft: "writer_agent",
    send: "integrations_agent",
    review: "research_agent",
  },
  planning: {
    plan: "planner_agent",
    draft: "writer_agent",
  },
  scheduling: {
    schedule: "integrations_agent",
    create: "integrations_agent",
  }
}
```

### Intent-to-Workflow Routing
```typescript
INTENT_TO_WORKFLOW = {
  information + search → "RESEARCH_SYNTHESIS"
  communication + draft → "EMAIL_RESOLUTION"
  planning + plan → "WEEKLY_PLANNING"
  scheduling + schedule → "MEETING_PREP"
}
```

---

## 5. Agent System Prompts

**File:** `src/agents/executor.ts`

### Research Agent
```typescript
system: "You are a research assistant analyzing information
         and providing comprehensive research findings."
model: gpt-4o
temperature: 0.3  // factual accuracy
max_tokens: 4000
```

### Writer Agent
```typescript
system: "You are a professional content writer creating
         clear, compelling content."
model: gpt-4o
temperature: 0.8  // creative
max_tokens: 4000
```

### Planner Agent
```typescript
system: "You are a strategic planning assistant creating
         actionable plans and breaking down complex objectives."
model: gpt-4o
temperature: 0.5  // balanced
max_tokens: 3000
```

### Integrations Agent
```typescript
system: "You are an integration orchestrator managing connections
         to external services like email, calendar, and other tools."
model: gpt-4o
temperature: 0.2  // precise
max_tokens: 2000
```

---

## 6. Concierge System Prompt

**File:** `src/concierge/orchestrator.ts` (line 364-372)

```typescript
{
  role: "system",
  content: `You are POF Concierge, an AI productivity assistant.

Mode: ${mode}
Style: ${behavior.style}
Detail Level: ${behavior.detailLevel}
Proactivity: ${behavior.proactivity}

You help users manage tasks, projects, and workflows.
Be helpful, concise, and actionable.
You have access to specialized agents (research, writer, planner, integrations)
but for general conversation, respond directly.`
}
```

**Config:**
```yaml
model: gpt-4o
temperature: 0.7
max_tokens: 500
target_latency: < 3 seconds
```

---

## 7. Response Generation

**File:** `src/concierge/orchestrator.ts` (line 277-311)

### Flow
1. Check if clarification needed → return clarification prompt
2. If dispatch succeeded → format agent output based on detailLevel
3. If dispatch failed → suggest alternative approach
4. If no dispatch → generate direct response

### Canned Responses (No LLM)
```typescript
complete: "I've marked '{taskName}' as complete."
delete: "Done. I've removed that item."
list: "I'll show you the {category}."
```

---

## Architecture Summary

| Component | File | LLM Used | Model | Temp |
|-----------|------|----------|-------|------|
| Intent Parser | `concierge/intent.ts` | No (regex) | N/A | N/A |
| Mode Classifier | `concierge/modes.ts` | No (regex) | N/A | N/A |
| Concierge | `concierge/orchestrator.ts` | Yes | gpt-4o | 0.7 |
| Research Agent | `agents/executor.ts` | Yes | gpt-4o | 0.3 |
| Writer Agent | `agents/executor.ts` | Yes | gpt-4o | 0.8 |
| Planner Agent | `agents/executor.ts` | Yes | gpt-4o | 0.5 |
| Integrations Agent | `agents/executor.ts` | Yes | gpt-4o | 0.2 |

---

## Key Files

| Purpose | Path |
|---------|------|
| API Entry | `src/app/api/concierge/chat/route.ts` |
| Orchestrator | `src/concierge/orchestrator.ts` |
| Intent Parsing | `src/concierge/intent.ts` |
| Mode Detection | `src/concierge/modes.ts` |
| Dispatch Logic | `src/concierge/dispatch.ts` |
| Agent Execution | `src/agents/executor.ts` |
| Config Loader | `src/lib/config/loader.ts` |
| YAML Config | `pof.config.yaml` |
