# POF - Productivity Orchestration Framework

An AI-first execution infrastructure that transforms user intent into structured plans, workflows, and completed work.

## Overview

POF handles the full lifecycle of getting things done:
- **Planning**: User intent → structured tasks & projects
- **Prioritization**: Smart scoring based on deadlines, dependencies, urgency
- **Execution**: Specialized AI agents (research, writing, planning, integrations)
- **QA**: Fact-checking, alignment verification, safety rails
- **Memory**: Knowledge graph that learns your preferences, constraints, and context
- **Orchestration**: Natural conversation interface with mode awareness

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Concierge Orchestrator                    │
│  (Natural language interface, mode classification, dispatch) │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼──────┐ ┌──▼─────┐ ┌──▼──────────┐
│ Agent Runtime│ │Workflow │ │ QA Layer    │
│ (4 types)    │ │Patterns │ │(verification)│
└───────┬──────┘ └────────┘ └──────────────┘
        │
┌───────▼──────────────────────────────┐
│       Execution Engine                │
│ (Tasks, Projects, Dependencies, DAG)  │
└───────┬──────────────────────────────┘
        │
┌───────▼──────────────────────────────┐
│      Knowledge Graph (Postgres)       │
│  (Insights, Preferences, Constraints) │
└──────────────────────────────────────┘
```

### Core Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Domain** | Types, schemas, business logic | `/src/domain` |
| **Graph** | Database schema, operations, migrations | `/src/graph` |
| **Execution** | Task availability, priority, projections | `/src/execution` |
| **Agents** | AI worker runtime with retry & lifecycle | `/src/agents` |
| **Workflows** | Reusable multi-agent patterns | `/src/workflows` |
| **QA** | Quality checks (facts, alignment, safety) | `/src/qa` |
| **Crawler** | Insight extraction from interactions | `/src/crawler` |
| **Concierge** | Main AI orchestrator & chat interface | `/src/concierge` |
| **Integrations** | Email, calendar, artifact adapters | `/src/integrations` |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (recommend [Neon](https://neon.tech))
- OpenAI API key (optional for stub mode)

### Installation

```bash
# Clone and install
cd omnifucked
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and OPENAI_API_KEY

# Run database migrations
npx drizzle-kit push

# Start development server
npm run dev
```

Server runs at `http://localhost:3000`

### Try It Out

```bash
# Chat with the concierge
curl -X POST http://localhost:3000/api/concierge/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What should I focus on today?"}'

# Get morning briefing
curl http://localhost:3000/api/concierge/briefing

# See available tasks
curl http://localhost:3000/api/execution/available

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Research AI frameworks",
    "status": "inbox",
    "priority": "high"
  }'
```

## API Documentation

See [API Reference](docs/api/openapi.yaml) for complete endpoint documentation.

Key endpoints:
- `POST /api/concierge/chat` - Conversational interface
- `GET /api/concierge/briefing` - Morning briefing generation
- `GET /api/execution/available` - Get actionable tasks
- `GET /api/execution/forecast` - Multi-day projection
- `GET|POST /api/tasks` - Task management
- `GET|POST /api/projects` - Project management
- `GET /api/insights` - Knowledge graph insights

## Development

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

### Database Migrations

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit push

# Open Drizzle Studio (DB GUI)
npx drizzle-kit studio
```

### Project Structure

```
omnifucked/
├── src/
│   ├── app/              # Next.js App Router
│   │   └── api/          # REST API routes
│   ├── domain/           # Core types & validation
│   ├── graph/            # Database (schema, ops, audit)
│   ├── execution/        # Task engine
│   ├── agents/           # AI agent runtime
│   ├── workflows/        # Workflow patterns
│   ├── qa/              # Quality assurance
│   ├── crawler/         # Insight extraction
│   ├── concierge/       # Main orchestrator
│   ├── integrations/    # External adapters
│   └── lib/             # Utilities (db, etc)
├── docs/
│   ├── prd.md           # Product requirements
│   ├── adr/             # Architecture decisions
│   └── api/             # API specifications
└── drizzle/             # Database migrations
```

## Key Concepts

### Interaction Modes

The concierge adapts to how you're working:

- **Creative Director**: Vision → structured plan
- **Chief of Staff**: Operational execution
- **Think Aloud**: Messy input → organized structure
- **Symbiotic**: Collaborative co-creation

### Work Representation (5 Layers)

```
Outcome → Assertion → Task → Workflow → AgentAction
```

Higher layers automatically decompose into lower ones.

### DAG Enforcement

Tasks can have dependencies, but the system prevents cycles:
- Task A depends on Task B ✓
- Task B depends on Task A ✗ (blocked)

### QA Profiles

Different rigor levels for different work:
- **Fast Draft**: Light checking, quick turnaround
- **Balanced**: Standard verification
- **High Rigor**: Thorough fact-checking & review

### Workflow Patterns

Reusable processes built-in:
- Research & Synthesis
- Email Resolution
- Weekly Planning
- Meeting Prep
- Decision Brief
- Multi-Step Research

## Current Status

**✓ Complete:**
- Full backend infrastructure
- Database schema with migrations
- All API endpoints
- Agent runtime (stub mode)
- QA layer
- Workflow engine
- Crawler extractors
- Concierge orchestrator

**⚠️ Stub Mode:**
- Agents return placeholder responses (no actual AI calls)
- Integrations are mocked (no real email/calendar)

**🚧 To Do:**
See [ROADMAP.md](ROADMAP.md) for detailed next steps.

## Documentation

- [Product Requirements](docs/prd.md)
- [Development Plan](docs/DEVELOPMENT_PLAN.md)
- [Architecture Decisions](docs/adr/)
- [API Reference](docs/api/openapi.yaml)
- [Module Documentation](src/) - See README in each subdirectory

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License

Proprietary - All rights reserved.

## Support

For issues or questions, contact the development team.
