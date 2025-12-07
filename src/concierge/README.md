# Concierge Module

Main AI orchestrator and conversational interface. The "brain" of POF.

## Purpose

The concierge handles:
- **Conversation**: Natural language interaction
- **Mode Detection**: Classify how the user is working
- **Intent Parsing**: Extract what the user wants
- **Dispatch**: Route to appropriate agents/workflows
- **Briefing**: Generate morning summaries

## Architecture

```
User Message
     │
     ▼
┌─────────────────┐
│ Mode Classifier │ → creative_director, chief_of_staff,
└────────┬────────┘   think_aloud, symbiotic
         │
         ▼
┌─────────────────┐
│  Intent Parser  │ → category, action, entities, priority
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Dispatcher    │ → Route to agent(s), workflow, or direct response
└────────┬────────┘
         │
         ▼
    Response
```

## Key Files

| File | Purpose |
|------|---------|
| `orchestrator.ts` | Main conversation handler |
| `modes.ts` | Interaction mode classification |
| `intent.ts` | Intent parsing and entity extraction |
| `dispatch.ts` | Agent/workflow routing |
| `briefing.ts` | Morning briefing generation |

## Interaction Modes

The concierge adapts its behavior based on detected mode:

### Creative Director
**When:** User is doing vision/strategy work
**Signals:** "vision", "goal", "strategy", "imagine if"
**Behavior:**
- Comprehensive responses
- Suggest related actions
- Collaborative tone
- Don't auto-create tasks

### Chief of Staff
**When:** User needs operational execution
**Signals:** "task", "deadline", "schedule", "remind me"
**Behavior:**
- Brief, directive responses
- Proactively suggest actions
- Auto-create tasks
- High proactivity

### Think Aloud Interpreter
**When:** User is brainstorming or uncertain
**Signals:** "thinking", "maybe", "not sure", long rambling input
**Behavior:**
- Supportive tone
- Standard detail level
- Low proactivity
- Don't suggest actions

### Symbiotic Collaboration
**When:** User wants to co-create
**Signals:** "together", "collaborate", "help me write"
**Behavior:**
- Collaborative tone
- Suggest actions
- Standard detail
- Don't auto-create tasks

## Intent Categories

Parsed intents fall into categories:

- **task_management**: Create, update, query tasks
- **project_management**: Manage projects
- **planning**: Strategic planning, roadmaps
- **research**: Information gathering
- **communication**: Email, messages
- **decision**: Analysis, options, recommendations
- **status**: Check progress, what's next
- **general**: Conversation, questions

## Intent Actions

What the user wants to do:

- **create**: Make new item
- **update**: Modify existing
- **query**: Get information
- **execute**: Run something
- **analyze**: Deep dive analysis
- **plan**: Create structure

## Usage

### Simple Conversation

```typescript
import { processConversation } from '@/concierge';

const response = await processConversation({
  message: "What should I focus on today?",
  conversationId: null, // New conversation
});

console.log(response.text);
console.log(response.mode); // 'chief_of_staff'
```

### With Context

```typescript
const response = await processConversation({
  message: "Let's brainstorm ideas for the new feature",
  conversationId: existingId,
  userId: 'user-123',
});

// Mode: 'creative_director' or 'think_aloud_interpreter'
```

### Generate Briefing

```typescript
import { generateBriefing } from '@/concierge';

const briefing = await generateBriefing({
  userId: 'user-123',
  targetDate: new Date(),
});

console.log(briefing.summary);
console.log(briefing.topPriorities);
console.log(briefing.upcomingDeadlines);
```

## Dispatch Logic

Based on intent, the concierge routes to:

1. **Direct Response**: Simple queries, status checks
2. **Single Agent**: Research, writing, planning tasks
3. **Workflow**: Multi-step processes (email resolution, weekly planning)
4. **Task Creation**: When user describes work to be done

### Example Routing

```typescript
// Intent: { category: 'research', action: 'execute' }
// → Dispatch to research_agent

// Intent: { category: 'communication', action: 'create' }
// → Use 'email-resolution' workflow

// Intent: { category: 'task_management', action: 'query' }
// → Direct database query, return results
```

## Briefing Generation

Morning briefings include:

1. **Summary**: High-level overview of the day
2. **Top Priorities**: 3-5 most important tasks (by priority score)
3. **Upcoming Deadlines**: Tasks due soon
4. **Recent Insights**: New learnings about the user
5. **Blocked Tasks**: What needs attention

## Current Status

**✓ Complete:**
- Mode classification (4 modes)
- Intent parsing
- Dispatch routing
- Briefing generation
- Conversation state management

**⚠️ Stub Mode:**
- Agents return placeholder text
- Dispatch works but responses are generic

## Next Steps

1. Wire up real AI for conversation
2. Add conversation memory (vector store)
3. Implement semantic delta tracking
4. Add proactive suggestions
5. Support streaming responses
