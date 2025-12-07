# Contributing to POF (Productivity Orchestration Framework)

Thank you for your interest in contributing to POF! This document provides guidelines and instructions for developers working on the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Adding New Agents](#adding-new-agents)
- [Adding New Workflow Patterns](#adding-new-workflow-patterns)
- [Database Migrations](#database-migrations)
- [Pull Request Process](#pull-request-process)
- [Documentation Requirements](#documentation-requirements)

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm or pnpm
- PostgreSQL database (we recommend [Neon](https://neon.tech) for development)
- OpenAI API key

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd omnifucked
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   DATABASE_URL=postgresql://user:password@host/database
   OPENAI_API_KEY=sk-...
   ```

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **AI**: OpenAI API
- **Styling**: Tailwind CSS 4
- **Linting**: ESLint 9
- **Package Manager**: npm

---

## Project Structure

```
src/
├── agents/           # Specialized AI agents (research, writer, planner)
├── app/              # Next.js app router pages and API routes
├── concierge/        # Concierge orchestrator logic
├── crawler/          # Autonomous insight extraction
├── domain/           # Core business entities and types
├── execution/        # Execution engine (tasks, workflows, DAG)
├── graph/            # Database schema, DAG operations, audit
│   ├── schema.ts     # Drizzle schema definitions
│   ├── dag.ts        # DAG validation and operations
│   ├── audit.ts      # Audit trail utilities
│   └── operations/   # CRUD operations for entities
├── integrations/     # External system adapters (email, calendar)
├── lib/              # Shared utilities and helpers
├── qa/               # QA layer (safety, correctness checks)
└── workflows/        # Workflow pattern library
```

---

## Code Style Guidelines

### TypeScript

- **Strict mode**: Always enabled (`tsconfig.json` has `"strict": true`)
- **Type annotations**: Required for function parameters and return types
- **Interfaces vs Types**: Prefer `interface` for object shapes, `type` for unions/intersections
- **Null safety**: Use optional chaining (`?.`) and nullish coalescing (`??`)

**Example:**
```typescript
interface TaskInput {
  title: string;
  description?: string;
  dependencies?: string[];
}

export async function createTask(input: TaskInput): Promise<Task> {
  const task = await db.insert(tasks).values({
    title: input.title,
    description: input.description ?? "",
    status: "pending",
  });
  return task;
}
```

### ESLint

The project uses `eslint-config-next` with TypeScript support. Run the linter:

```bash
npm run lint
```

Key rules:
- No `any` types (use `unknown` if truly needed)
- No unused variables or imports
- Consistent naming: camelCase for variables/functions, PascalCase for components/types
- Use arrow functions for React components

### File Organization

- **One component per file** for React components
- **Colocate tests** with source files (e.g., `task.ts` and `task.test.ts`)
- **Index exports**: Use `index.ts` to aggregate exports from a directory

---

## Git Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions/updates

Examples:
```bash
feature/add-research-agent
fix/dag-validation-infinite-loop
refactor/concierge-routing-logic
```

### Semantic Commits

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only changes
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**
```bash
feat(agents): add research agent with web search capability
fix(dag): prevent cyclic dependencies in task graph
refactor(concierge): simplify routing logic for workflow selection
docs(contributing): add database migration workflow
```

### Merge Strategy

- **Never commit directly to `main`**
- Use `--no-ff` for merges to preserve branch history
- Squash commits only for very small PRs (use judgment)

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat(scope): description"

# Merge to main (maintainers only)
git checkout main
git merge --no-ff feature/my-feature
```

---

## Testing Guidelines

### Test Organization

- Place test files next to source files: `task.ts` → `task.test.ts`
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert

**Example:**
```typescript
describe("createTask", () => {
  it("should create a task with default status pending", async () => {
    // Arrange
    const input = { title: "Test Task" };

    // Act
    const task = await createTask(input);

    // Assert
    expect(task.status).toBe("pending");
    expect(task.title).toBe("Test Task");
  });

  it("should throw error when title is empty", async () => {
    // Arrange
    const input = { title: "" };

    // Act & Assert
    await expect(createTask(input)).rejects.toThrow("Title required");
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

---

## Adding New Agents

Agents are specialized AI workers that execute specific types of work (research, writing, planning, etc.).

### Agent Structure

Create a new file in `src/agents/`:

```typescript
// src/agents/myAgent.ts
import { Agent, AgentInput, AgentOutput } from "@/domain/agent";
import { OpenAI } from "openai";

interface MyAgentInput extends AgentInput {
  query: string;
  context?: string;
}

interface MyAgentOutput extends AgentOutput {
  result: string;
  metadata?: Record<string, unknown>;
}

export class MyAgent implements Agent<MyAgentInput, MyAgentOutput> {
  constructor(private openai: OpenAI) {}

  async execute(input: MyAgentInput): Promise<MyAgentOutput> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: input.query },
      ],
    });

    return {
      status: "completed",
      result: response.choices[0].message.content ?? "",
      metadata: {
        tokensUsed: response.usage?.total_tokens,
      },
    };
  }
}
```

### Register the Agent

Add your agent to `src/agents/index.ts`:

```typescript
export { MyAgent } from "./myAgent";
```

### Add Tests

Create `src/agents/myAgent.test.ts`:

```typescript
import { MyAgent } from "./myAgent";

describe("MyAgent", () => {
  it("should execute successfully", async () => {
    const agent = new MyAgent(mockOpenAI);
    const result = await agent.execute({ query: "Test" });
    expect(result.status).toBe("completed");
  });
});
```

---

## Adding New Workflow Patterns

Workflow patterns are reusable templates for common processes (e.g., "Research & Synthesis", "Article Creation").

### Workflow Structure

Create a new file in `src/workflows/`:

```typescript
// src/workflows/myWorkflow.ts
import { Workflow, WorkflowStep } from "@/domain/workflow";

export const myWorkflow: Workflow = {
  name: "My Workflow",
  description: "A reusable workflow pattern",
  steps: [
    {
      id: "step-1",
      type: "agent",
      agent: "research",
      input: { query: "{{userQuery}}" },
      output: "researchResults",
    },
    {
      id: "step-2",
      type: "agent",
      agent: "writer",
      input: {
        prompt: "Write based on: {{researchResults}}",
      },
      output: "finalDocument",
      dependsOn: ["step-1"],
    },
  ],
};
```

### Register the Workflow

Add to `src/workflows/index.ts`:

```typescript
export { myWorkflow } from "./myWorkflow";
```

### Document the Workflow

Add a section to `docs/workflows.md` explaining:
- When to use this workflow
- Required inputs
- Expected outputs
- Example usage

---

## Database Migrations

POF uses Drizzle ORM for database management.

### Schema Changes

1. **Edit the schema**: Modify `src/graph/schema.ts`

```typescript
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  newField: text("new_field"), // Add new field
  createdAt: timestamp("created_at").defaultNow(),
});
```

2. **Generate migration**

```bash
npm run db:generate
```

This creates a new migration file in `drizzle/` directory.

3. **Review the migration**

Check the generated SQL in `drizzle/<timestamp>_<name>.sql` to ensure it's correct.

4. **Apply migration to local database**

```bash
npm run db:push
```

5. **Commit migration files**

```bash
git add drizzle/ src/graph/schema.ts
git commit -m "feat(db): add new_field to tasks table"
```

### Migration Best Practices

- **Never edit generated migration files** - regenerate if needed
- **Test migrations on a copy of production data** before deploying
- **Add indexes** for frequently queried fields
- **Use transactions** for multi-step migrations
- **Backward compatible** when possible (add nullable fields, avoid renames)

### Common Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema changes to database (dev only)
npm run db:push

# Drop entire database (DANGER)
npm run db:drop

# Open Drizzle Studio (database GUI)
npm run db:studio
```

---

## Pull Request Process

### Before Submitting

1. **Run linter**: `npm run lint`
2. **Run tests**: `npm test`
3. **Build successfully**: `npm run build`
4. **Update documentation** if needed
5. **Rebase on latest main**: `git rebase main`

### PR Template

When creating a PR, include:

**Title**: Follow semantic commit format
```
feat(agents): add email summarization agent
```

**Description**:
```markdown
## Summary
Brief description of what this PR does.

## Changes
- Added new EmailAgent class
- Updated concierge to route email tasks
- Added tests for email agent

## Testing
- Unit tests added for EmailAgent
- Manually tested with sample emails
- Integration test with concierge

## Related Issues
Closes #123
Related to #456

## Screenshots (if UI changes)
[Add screenshots here]

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No breaking changes (or documented if unavoidable)
```

### Review Process

1. **Self-review**: Review your own PR first
2. **CI checks**: Ensure all automated checks pass
3. **Request review**: Tag relevant reviewers
4. **Address feedback**: Make requested changes
5. **Approval**: Wait for at least one approval
6. **Merge**: Maintainer will merge using `--no-ff`

---

## Documentation Requirements

### Code Comments

- Use JSDoc for exported functions and classes
- Explain "why" not "what" in comments
- Document complex algorithms or business logic

**Example:**
```typescript
/**
 * Creates a new task in the execution graph.
 *
 * Automatically validates DAG invariants to prevent cycles.
 * Tasks start in "pending" status and become "available" once
 * all dependencies are satisfied.
 *
 * @param input - Task creation parameters
 * @returns The created task with generated ID
 * @throws {CyclicDependencyError} if task would create a cycle
 */
export async function createTask(input: TaskInput): Promise<Task> {
  // Implementation...
}
```

### README Updates

Update `README.md` if you:
- Add new features visible to users
- Change setup/installation process
- Add new environment variables
- Change API endpoints

### API Documentation

Document API routes in `docs/api.md`:
- Endpoint path and method
- Request/response schemas
- Example requests
- Error codes

### Architecture Decisions

For significant architectural changes, create an ADR (Architecture Decision Record) in `docs/adr/`:

```markdown
# ADR-001: Use Drizzle ORM for Database Layer

## Status
Accepted

## Context
We needed an ORM that supports PostgreSQL, has good TypeScript support...

## Decision
We will use Drizzle ORM...

## Consequences
Positive: Type-safe queries, lightweight...
Negative: Smaller community than Prisma...
```

---

## Questions?

- Check existing [GitHub Issues](../../issues)
- Read the [PRD](docs/prd.md) for architectural context
- Ask in PR comments or discussions

Thank you for contributing to POF!
