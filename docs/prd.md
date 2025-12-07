# Product Spec — Productivity Orchestration Framework (POF)
**Version:** v2 (Integrated Improvements)

---

# Executive Summary

The Productivity Orchestration Framework (POF) is an **AI-first execution infrastructure** that transforms user intent into structured plans, workflows, and completed work. The human provides **direction**, and the system handles **planning**, **prioritization**, **structuring**, **execution**, **QA**, and **follow-through**. Unlike traditional tools, POF maximizes **agent-produced throughput**, keeps cognitive load near zero, and models work using an OmniFocus-inspired execution DAG combined with a long-term knowledge graph.

A concierge AI orchestrator routes tasks through workflow patterns, dispatches specialized agents for research/writing/planning, ensures all loops close, and adapts interaction mode (Creative Director, Chief of Staff, Think-Aloud Interpreter, Symbiotic Collaboration) automatically. A background crawler extracts lasting insights, preferences, and commitments, feeding them back into execution.

---

# 1. High-Level System Overview

The system is composed of:

1. **Concierge Orchestrator** — primary AI brain and user interface  
2. **Sub-Agent Runtime** — specialized agents running in parallel or sequence  
3. **Workflow Pattern Library** — reusable processes for consistent quality  
4. **Execution Engine** — OmniFocus-like tasks/projects + execution DAG  
5. **Knowledge Graph** — persistent semantic memory  
6. **QA Layer** — correctness, alignment, safety  
7. **Crawler** — autonomous insight extraction  
8. **Integrations Layer** — email, calendar, artifacts  
9. **User-Facing Views** — projections of the execution graph (Inbox, Projects, Tags, Forecast, Review)

---

# 2. Goals & Non-Goals

## 2.1 v1 Must-Haves
- Concierge orchestrator  
- Execution graph with CRUD + projections  
- Sub-agent runtime (eventing, capsule protocol)  
- QA layer (safety + correctness)  
- 6–8 workflow patterns  
- Email + calendar minimal adapters  
- Crawler extracting preferences + commitments  
- Daily/weekly briefing generation  

## 2.2 v2 (Not in v1 but planned)
- Multi-user support  
- Autonomous external actions (auto-send)  
- Rich document integrations  
- Strategy modeling across projects  
- Salience-driven continual reprioritization  
- Deep observability interfaces  

---

# 3. User Persona & Core Use Cases

## Persona
Solo founder/executive/knowledge worker overwhelmed by operational load but rich in creative ideas.

## Core Use Cases
1. **Idea → Execution**  
2. **Think-aloud → Structured plan**  
3. **Email delegation → Completed thread**  
4. **Background crawler → Persistent preferences/knowledge**  
5. **Daily briefing → High-impact focus**  

---

# 4. Conceptual Model: Hybrid Graph Architecture

POF uses a **Hybrid Graph**:

1. **Knowledge Graph Core**
   - Nodes: concepts, people, orgs, outcomes, assertions, insights.  
   - Edges: `related_to`, `influences`, `depends_on`, `precedes`, etc.  

2. **Execution DAG**
   - Nodes: tasks, workflows, agent actions.  
   - Edges: `depends_on`, `precedes`, `produces_artifact`.  
   - Supports parallel/sequential semantics like OmniFocus.  

3. **Hierarchical Projections**
   - Inbox, Projects, Tags, Forecast, Review  
   - Derived views, not separate storage.

---

# 5. Work Representation (5 Layers)

1. **Outcome** — desired end state  
2. **Assertion** — constraints, strategy, preferences  
3. **Task** — actionable units  
4. **Workflow** — reusable template pattern  
5. **AgentAction** — atomic execution primitives  

Lower layers are derived from higher ones automatically.

---

# 6. Entity Schemas (Concrete, Typed)

## 6.1 Task (Concrete)

```json
{
  "id": "uuid",
  "project_id": "uuid | null",
  "parent_task_id": "uuid | null",
  "title": "string (1–120 chars)",
  "notes": "string | null",
  "status": "inbox | available | scheduled | blocked | completed | dropped",
  "type": "user_action | agent_action | external_wait",
  "order_index": "integer >= 0",
  "defer_date": "ISO8601 | null",
  "due_date": "ISO8601 | null",
  "estimated_minutes": "integer | null",
  "priority": "low | normal | high | critical",
  "tags": "string[]",
  "dependencies": "uuid[]",
  "assertion_ids": "uuid[]",
  "agent_run_id": "uuid | null",
  "external_refs": "array<{ kind: string, ref: string }>",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### Validation Rules
- `title` required  
- A project with type `sequential` must expose **only one** available task  
- `dependencies` must maintain DAG invariants  
- `due_date >= defer_date` if both present  

---

## 6.2 Outcome, Assertion, Project, WorkflowPattern, Insight  
*(All rewritten for clarity, detail preserved; omitted here for brevity unless you request full schemas.)*

---

# 7. Interaction Modes (Classifier-Driven)

1. **Creative Director** — amplify vision → structured plan  
2. **Chief of Staff** — execute operational tasks end-to-end  
3. **Think-Aloud Interpreter** — convert messy monologue → structure  
4. **Symbiotic Collaboration** — rapid, dialogic co-creation

Concierge auto-selects based on context; asks clarifying questions only if confidence is low.

---

# 8. Sub-Agent Runtime

## Agent Lifecycle
- `pending` → `running` → `completed`  
- `running` → `blocked` (missing input or human decision)  
- `running` → `failed` (retryable once)  

## Retry Logic
- One automatic retry on transient failure  
- No retry on semantic error → escalate to concierge  

## Timeout Behavior
- Soft timeout → “progress_required” event  
- Hard timeout → `blocked`  

## Escalation Rules
- QA fails twice → re-run with stricter rigor or require user input  

---

# 9. Workflow Pattern Library

Minimum patterns (v1):

- Research & Synthesis  
- Article Creation  
- Meeting Prep & Summary  
- Email Thread Resolution  
- Decision Support Brief  

Additional patterns added (per improvements):

- **Deep Work Cycle**  
- **Multi-Step Research Loop**  
- **Weekly Planning Workflow**  

Each pattern defines:
- steps  
- agent types  
- blocking vs parallel groups  
- expected artifacts  
- QA profile  

---

# 10. Hybrid Capsule-Report Protocol

## 10.1 AgentRun Request

```json
{
  "run_id": "uuid",
  "agent_type": "research_agent | writer_agent | planner_agent | integrations_agent",
  "objective": "string",
  "context_capsule": {
    "user_profile": { "summary": "string" },
    "project_snapshot": { /* structured project/task/outcome data */ },
    "input_documents": [
      { "doc_id": "string", "title": "string", "content": "string", "type": "email|note" }
    ],
    "constraints": {
      "speed_vs_quality": "fast_draft | balanced | high_rigor",
      "length_limits": { "max_words": 2000 },
      "style": "string"
    },
    "expected_artifacts": ["summary_memo", "draft_email"]
  },
  "workflow_pattern_id": "string",
  "linked_graph_handles": {
    "outcome_ids": ["uuid"],
    "task_ids": ["uuid"],
    "project_id": "uuid"
  },
  "qa_profile_id": "default"
}
```

---

## 10.2 AgentRun Response

```json
{
  "run_id": "uuid",
  "status": "completed | partial | blocked | failed",
  "artifacts": {
    "primary_output": "string",
    "attachments": [
      { "type": "outline", "content": "..." }
    ]
  },
  "semantic_deltas": [
    {
      "type": "task_update | new_task | outcome_update | insight",
      "description": "string",
      "proposed_changes": {},
      "confidence": 0.9
    }
  ],
  "proposed_next_steps": [
    { "type": "agent_action | user_decision", "description": "string", "auto_executable": false }
  ],
  "confidence_scores": {
    "overall": 0.87,
    "alignment_with_constraints": 0.85
  },
  "metadata": {
    "execution_time_ms": 2345,
    "schema_version": "1.0"
  }
}
```

### Capsule Report (Natural Language)
Summarizes reasoning, risks, key assumptions, and next steps.

---

# 11. Execution Engine (OmniFocus-Like Semantics)

- Task availability derived from:
  - defer/due  
  - project type  
  - dependencies  
- Sequential project → only first incomplete task is available  
- Projections:
  - **Inbox**
  - **Projects**
  - **Tags**
  - **Forecast** (tasks + calendar events)
  - **Review** (projects due for review)

These projections power daily briefings and agent prioritization.

---

# 12. Daily Briefing (Concierge-Initiated)

Concierge compiles:
- tasks due/overdue  
- active agent runs  
- pending decisions  
- high-impact outcomes  
- crawler-derived salience insights  

User receives a compressed, decision-oriented summary.  
Concierge updates graph and dispatches agents automatically.

---

# 13. Crawler & Insight Integration

### Insight Types
- preferences  
- themes  
- stable facts  
- commitments  
- recurring constraints  

### Salience-Based Prioritization Formula

```pseudocode
urgency_weight = (1.0 if due < 48h else 0.3)

risk_weight = domain_risk_score  # 0–1

content_type_weight = {
    "email_external": 0.9,
    "internal_note": 0.2,
    "analysis": 0.6,
    "research": 0.4
}[task.type]

preference_weight = user_pref_curve  # 0–1
```

### Threshold Logic
- `urgency + risk > 1.3` → high_rigor  
- external + risk > 0.7 → high_rigor  
- brainstorming → fast_draft  
- otherwise → balanced  

### How insights affect execution:
- adjust writing style  
- influence planning heuristics  
- modify project review intervals  
- auto-generate new outcomes  
- boost prioritization for related tasks  

---

# 14. Integrations Layer

Minimum:
- Email adapter (thread read, draft write, metadata extraction)  
- Calendar adapter (read, propose events)  
- Artifact link abstraction (URLs, IDs)

---

# 15. Non-Functional Requirements

- Schema extensibility  
- Full audit log of graph mutations  
- Safe external actions (QA-gated)  
- Round-trip latency target < 3–5 seconds for concierge responses  
- Agents long-running with event-stream updates  

---

# 16. Implementation Guidance (Claude Code)

- Strongly type all schemas  
- Use workflow patterns declaratively  
- Keep reasoning profiles (speed/quality) configurable  
- Make all agent invocations explicit and inspectable  
- Use one graph DB or document store with DAG invariants  

---

# END OF SPEC