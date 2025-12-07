# POF Roadmap

Sequenced work to get from current state (backend infrastructure complete, stub mode) to production.

---

## Phase 1: Functional Demo (1-2 weeks)

**Goal:** Working system with real AI, no auth, local database

### 1.1 Database Setup
- [ ] Create Neon Postgres database
- [ ] Configure `DATABASE_URL` in `.env.local`
- [ ] Run migrations: `npx drizzle-kit push`
- [ ] Seed sample data (tasks, projects, insights)
- [ ] Verify Drizzle Studio access: `npx drizzle-kit studio`

**Dependencies:** None
**Blocker Risk:** Low
**Deliverable:** Working database with sample data

### 1.2 OpenAI Integration
- [ ] Add OpenAI SDK: `npm install openai`
- [ ] Configure `OPENAI_API_KEY` in `.env.local`
- [ ] Implement `researchAgentImpl` in `/src/agents/executor.ts`
  - Use OpenAI Responses API: `/v1/responses`
  - Model: `gpt-4o` (or `gpt-5-nano` if available)
  - Reasoning effort: `minimal`
  - Verbosity: `low`
- [ ] Implement `writerAgentImpl` (same pattern)
- [ ] Implement `plannerAgentImpl` (same pattern)
- [ ] Implement `integrationsAgentImpl` (same pattern)
- [ ] Add error handling and rate limiting
- [ ] Track token usage per agent run

**Dependencies:** None
**Blocker Risk:** Medium (API rate limits, cost management)
**Deliverable:** Agents return real AI responses

### 1.3 Testing & Validation
- [ ] Test chat endpoint: `POST /api/concierge/chat`
- [ ] Verify mode classification works
- [ ] Test briefing generation
- [ ] Verify task CRUD operations
- [ ] Test dependency DAG enforcement
- [ ] Validate priority scoring
- [ ] Check forecast projections

**Dependencies:** 1.1, 1.2
**Blocker Risk:** Low
**Deliverable:** All API endpoints functional with real AI

---

## Phase 2: Core Integrations (1-2 weeks)

**Goal:** Connect to real email and calendar

### 2.1 Gmail Integration
- [ ] Set up Google Cloud project
- [ ] Enable Gmail API
- [ ] Implement OAuth flow for Gmail
- [ ] Replace mock in `/src/integrations/email/adapters.ts`
- [ ] Implement email fetching
- [ ] Implement email sending
- [ ] Add email parsing for crawler
- [ ] Test email-resolution workflow

**Dependencies:** 1.2 (needs working agents)
**Blocker Risk:** Medium (OAuth complexity)
**Deliverable:** Real email reading/sending

### 2.2 Google Calendar Integration
- [ ] Enable Google Calendar API
- [ ] Implement OAuth flow for Calendar
- [ ] Replace mock in `/src/integrations/calendar/adapters.ts`
- [ ] Implement event fetching
- [ ] Implement event creation
- [ ] Sync calendar to task availability
- [ ] Test scheduling conflicts

**Dependencies:** None (can run parallel with 2.1)
**Blocker Risk:** Medium (OAuth, sync conflicts)
**Deliverable:** Real calendar sync

### 2.3 Artifact Storage
- [ ] Choose storage (S3, Vercel Blob, or local filesystem)
- [ ] Implement adapter in `/src/integrations/artifacts/`
- [ ] Support artifact upload/download
- [ ] Link artifacts to agent runs
- [ ] Test artifact persistence

**Dependencies:** None
**Blocker Risk:** Low
**Deliverable:** Persistent artifact storage

---

## Phase 3: Frontend (2-3 weeks)

**Goal:** User-facing web application

### 3.1 Chat Interface
- [ ] Create chat UI component (shadcn/ui)
- [ ] Implement message history
- [ ] Add streaming response support
- [ ] Show mode indicator
- [ ] Display suggested actions
- [ ] Handle file uploads (for artifacts)

**Dependencies:** 1.2 (needs working chat API)
**Blocker Risk:** Low
**Deliverable:** Functional chat interface

### 3.2 Task & Project Views
- [ ] Create task list component
  - Filter by status, priority, project
  - Sort by due date, priority score
  - Show dependency relationships
- [ ] Create project detail view
  - Task list within project
  - Sequential vs parallel indicator
- [ ] Create forecast view (calendar-like)
- [ ] Add task creation form
- [ ] Add project creation form
- [ ] Implement drag-to-reorder for sequential projects

**Dependencies:** 1.1 (needs database)
**Blocker Risk:** Low
**Deliverable:** Full task/project management UI

### 3.3 Insights Dashboard
- [ ] Create insights view
  - Group by type (preferences, facts, constraints, themes)
  - Show confidence scores
  - Display source references
- [ ] Add insight detail view
- [ ] Allow manual insight editing
- [ ] Show insight timeline
- [ ] Implement insight search

**Dependencies:** 1.1
**Blocker Risk:** Low
**Deliverable:** Knowledge graph visualization

### 3.4 Briefing View
- [ ] Create morning briefing component
- [ ] Show top priorities (interactive)
- [ ] Display upcoming deadlines
- [ ] Show blocked tasks with action buttons
- [ ] Add "Start my day" workflow trigger

**Dependencies:** 1.2
**Blocker Risk:** Low
**Deliverable:** Morning briefing interface

---

## Phase 4: Production Readiness (1-2 weeks)

**Goal:** Secure, monitored, production-ready system

### 4.1 Authentication
- [ ] Choose auth provider (Clerk or Auth.js recommended)
- [ ] Implement user signup/login
- [ ] Add user session management
- [ ] Protect all API routes
- [ ] Associate data with user IDs
- [ ] Implement user profile management

**Dependencies:** 3.x (needs frontend)
**Blocker Risk:** Medium (migration of test data)
**Deliverable:** Secured application

### 4.2 Rate Limiting & Cost Control
- [ ] Implement API rate limiting (Vercel KV or Upstash)
- [ ] Track OpenAI token usage per user
- [ ] Add cost warnings/limits
- [ ] Implement usage dashboard
- [ ] Add retry backoff for rate limits
- [ ] Create admin cost monitoring view

**Dependencies:** 1.2, 4.1
**Blocker Risk:** High (cost overruns)
**Deliverable:** Cost-controlled system

### 4.3 Monitoring & Logging
- [ ] Set up error tracking (Sentry)
- [ ] Add structured logging (Pino or Winston)
- [ ] Create health check endpoint
- [ ] Implement performance monitoring
- [ ] Add user activity analytics
- [ ] Create ops dashboard (Vercel Analytics + custom)

**Dependencies:** None
**Blocker Risk:** Low
**Deliverable:** Observable system

### 4.4 Deployment
- [ ] Deploy to Vercel
- [ ] Configure production environment variables
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Configure Neon production database
- [ ] Run production migrations
- [ ] Set up database backups
- [ ] Configure custom domain
- [ ] Add SSL/TLS

**Dependencies:** 4.1, 4.2, 4.3
**Blocker Risk:** Medium (deployment issues)
**Deliverable:** Live production system

---

## Phase 5: Polish & Enhancement (Ongoing)

**Goal:** Improved UX and advanced features

### 5.1 Performance Optimization
- [ ] Add response caching (Redis or Vercel KV)
- [ ] Optimize database queries (add indexes)
- [ ] Implement pagination for large lists
- [ ] Add optimistic UI updates
- [ ] Reduce bundle size
- [ ] Add service worker for offline support

### 5.2 Advanced Features
- [ ] Add recurring tasks
- [ ] Implement task templates
- [ ] Add team collaboration (shared projects)
- [ ] Create workflow builder (custom patterns)
- [ ] Add voice input/output
- [ ] Implement mobile app (React Native or PWA)

### 5.3 AI Enhancements
- [ ] Add conversation memory (vector embeddings)
- [ ] Implement semantic search over tasks
- [ ] Add proactive suggestions
- [ ] Implement agent fine-tuning
- [ ] Add multi-modal support (images, docs)
- [ ] Create custom agent types

---

## Quick Win Priorities

If time is limited, focus on these high-impact items first:

1. **Database + OpenAI** (Phase 1.1-1.2) - Gets AI working
2. **Basic Chat UI** (Phase 3.1) - User can interact
3. **Task List View** (Phase 3.2 partial) - User can see their work
4. **Auth** (Phase 4.1) - Required for multi-user

This minimal set delivers a working AI assistant that can chat and manage tasks.

---

## Risk Mitigation

### High-Risk Items
1. **OpenAI costs** → Implement strict rate limits and user quotas early
2. **OAuth complexity** → Use tested libraries (Passport.js, next-auth)
3. **Database migrations in prod** → Always backup before migration

### Dependencies to Watch
- OpenAI API availability and pricing changes
- Vercel deployment limits (bandwidth, function duration)
- Google API quota limits

---

## Success Metrics

**Phase 1 Complete When:**
- [ ] Can chat with concierge and get real AI responses
- [ ] Can create/manage tasks via API
- [ ] Morning briefing works with real data

**Phase 2 Complete When:**
- [ ] Emails are read and processed automatically
- [ ] Calendar syncs with task availability
- [ ] Artifacts persist across sessions

**Phase 3 Complete When:**
- [ ] User can chat, manage tasks, and view insights in browser
- [ ] No need to use curl or Postman

**Phase 4 Complete When:**
- [ ] System is live at custom domain
- [ ] Multiple users can sign up and use independently
- [ ] Monitoring shows system health
- [ ] Costs are tracked and controlled

---

## Next Immediate Steps

1. Create Neon database and run migrations
2. Add OpenAI key and implement first agent
3. Test chat endpoint with real AI
4. Build minimal chat UI
5. Deploy to Vercel staging

Start with Phase 1.1 → 1.2 → minimal Phase 3.1 for fastest value delivery.
