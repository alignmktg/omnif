# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

POF (Productivity Orchestration Framework) is an AI-first execution infrastructure that transforms user intent into structured plans, workflows, and completed work. The system handles planning, prioritization, structuring, execution, QA, and follow-through while keeping human cognitive load near zero.

## Architecture (from PRD)

The system consists of 9 core components:

1. **Concierge Orchestrator** - Primary AI brain and user interface
2. **Sub-Agent Runtime** - Specialized agents (research, writer, planner, integrations) running in parallel/sequence
3. **Workflow Pattern Library** - Reusable processes (Research & Synthesis, Article Creation, Meeting Prep, Email Resolution, Decision Brief, Deep Work Cycle, Multi-Step Research, Weekly Planning)
4. **Execution Engine** - OmniFocus-like tasks/projects with DAG semantics
5. **Knowledge Graph** - Persistent semantic memory for concepts, people, orgs, insights
6. **QA Layer** - Correctness, alignment, safety checks
7. **Crawler** - Autonomous insight extraction (preferences, themes, commitments)
8. **Integrations Layer** - Email, calendar, artifact adapters
9. **User-Facing Views** - Inbox, Projects, Tags, Forecast, Review projections

## Key Concepts

**Work Representation (5 Layers):**
- Outcome → Assertion → Task → Workflow → AgentAction
- Lower layers derive from higher ones automatically

**Interaction Modes:**
- Creative Director (vision → plan)
- Chief of Staff (operational execution)
- Think-Aloud Interpreter (messy input → structure)
- Symbiotic Collaboration (rapid co-creation)

**Agent Lifecycle:** pending → running → completed/blocked/failed (one auto-retry on transient failure)

## Implementation Notes

- Strongly type all schemas (see PRD Section 6 for Task schema)
- Use workflow patterns declaratively
- DAG invariants must be maintained for dependencies
- Sequential projects expose only one available task at a time
- All agent invocations must be explicit and inspectable
- Target < 3-5 seconds latency for concierge responses

## Current Status

Project is in initial setup phase. PRD is complete at `docs/prd.md`.
