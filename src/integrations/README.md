# Integrations Module

External system adapters for email, calendar, and artifacts with unified interface patterns.

## Purpose

The integrations module handles:
- **Adapters**: Unified interface for external systems
- **Email**: Read threads, write drafts (approval required)
- **Calendar**: Read events, propose new events (approval required)
- **Artifacts**: Store and retrieve generated content (planned)
- **External Refs**: Link tasks to external entities

## Architecture

```
┌──────────────────────────────────────────────┐
│         Adapter Registry                     │
│  (Type-safe registration & retrieval)        │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────┬──────────┬──────────┐
        │             │          │          │
   ┌────▼────┐   ┌────▼────┐   ┌▼────────┐ │
   │Email    │   │Calendar │   │Artifact │ │
   │Adapter  │   │Adapter  │   │(planned)│ │
   └─────────┘   └─────────┘   └─────────┘ │
        │             │                     │
   ┌────▼────┐   ┌────▼────┐               │
   │Gmail    │   │Google   │               │
   │Outlook  │   │Outlook  │               │
   │(future) │   │(future) │               │
   └─────────┘   └─────────┘               │
```

## Key Files

| File | Purpose |
|------|---------|
| `adapter.ts` | Base adapter interface and registry |
| `email/index.ts` | Email thread and draft adapter |
| `calendar/index.ts` | Calendar event and proposal adapter |
| `index.ts` | Public API and adapter registration |

## Adapter Pattern

All adapters implement a unified interface:

```typescript
interface IntegrationAdapter<TRead, TWrite> {
  type: AdapterType;              // 'email' | 'calendar' | 'artifact'
  name: string;                   // Human-readable name

  isConfigured(): boolean;        // Check if adapter is ready
  read(query: AdapterQuery): Promise<TRead[]>;
  write(data: TWrite): Promise<WriteResult>;
  extractRef(raw: unknown): ExternalRef;
}
```

### Type Parameters

- **TRead**: Data type returned by `read()` (e.g., `EmailThread`, `CalendarEvent`)
- **TWrite**: Data type accepted by `write()` (e.g., `EmailDraft`, `EventProposal`)

### Adapter Query

```typescript
interface AdapterQuery {
  type: string;                   // Query type (e.g., 'thread', 'day', 'range')
  filters?: Record<string, unknown>;
  limit?: number;                 // Pagination limit (default 50)
  offset?: number;                // Pagination offset (default 0)
}
```

### Write Result

```typescript
interface WriteResult {
  success: boolean;
  id?: string;                    // ID of created resource
  error?: string;                 // Error message if failed
  metadata?: Record<string, unknown>;
}
```

## Email Integration

Read email threads and write drafts (not sent automatically).

### Configuration

```typescript
import { emailAdapter } from '@/integrations';

// Configure adapter (currently mock)
emailAdapter.configure({
  provider: 'gmail',    // 'gmail' | 'outlook' (future)
  apiKey: 'xxx',        // API credentials
});
```

### Reading Threads

```typescript
// Get all threads
const threads = await emailAdapter.read({ type: 'all' });

// Filter by thread ID
const thread = await emailAdapter.read({
  type: 'thread',
  filters: { threadId: 'thread_123' },
});

// Filter by subject
const results = await emailAdapter.read({
  type: 'search',
  filters: { subject: 'quarterly review' },
  limit: 10,
});

// Filter by participant
const myThreads = await emailAdapter.read({
  type: 'search',
  filters: { participant: 'matt@example.com' },
});
```

### Writing Drafts

```typescript
import { createDraft } from '@/integrations';

// Create standalone draft
const draft = createDraft(
  ['recipient@example.com'],
  'Meeting Follow-up',
  'Thanks for the discussion...'
);

const result = await emailAdapter.write(draft);
// { success: true, id: 'draft_xxx', metadata: { status: 'draft' } }

// Reply to thread
const reply = createDraft(
  ['recipient@example.com'],
  'Re: Project Update',
  'Here are the details...',
  { threadId: 'thread_123', cc: ['cc@example.com'] }
);

await emailAdapter.write(reply);
```

### Email Data Structures

```typescript
interface EmailThread {
  threadId: string;
  subject: string;
  participants: string[];         // All email addresses involved
  messages: EmailMessage[];
  lastUpdated: string;            // ISO timestamp
}

interface EmailMessage {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  timestamp: string;              // ISO timestamp
}

interface EmailDraft {
  threadId: string | null;        // null for new thread
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}
```

### Helper Functions

```typescript
import { createThread, createMessage, createDraft } from '@/integrations';

// Create a thread from messages
const messages = [
  createMessage('msg_1', 'alice@example.com', ['bob@example.com'], 'Hello', 'Hi Bob'),
  createMessage('msg_2', 'bob@example.com', ['alice@example.com'], 'Re: Hello', 'Hi Alice'),
];
const thread = createThread('thread_123', messages);

// Create a draft
const draft = createDraft(
  ['recipient@example.com'],
  'Subject',
  'Body',
  { threadId: 'thread_123', cc: ['cc@example.com'] }
);
```

## Calendar Integration

Read calendar events and propose new events (requires approval).

### Configuration

```typescript
import { calendarAdapter } from '@/integrations';

// Configure adapter (currently mock)
calendarAdapter.configure({
  provider: 'google',   // 'google' | 'outlook' (future)
  apiKey: 'xxx',        // API credentials
});
```

### Reading Events

```typescript
// Get all events
const events = await calendarAdapter.read({ type: 'all' });

// Get events for a date range
const events = await calendarAdapter.read({
  type: 'range',
  filters: {
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-01-31T23:59:59Z',
  },
});

// Filter by title
const meetings = await calendarAdapter.read({
  type: 'search',
  filters: { title: 'standup' },
});
```

### Proposing Events

```typescript
import { createEventProposal } from '@/integrations';

// Propose a new event
const proposal = createEventProposal(
  'Team Standup',
  '2025-01-15T10:00:00Z',
  '2025-01-15T10:30:00Z',
  ['alice@example.com', 'bob@example.com'],
  'Conference Room A'
);

const result = await calendarAdapter.write(proposal);
// { success: true, id: 'proposal_xxx', metadata: { status: 'pending' } }

// User must approve before event is created
```

### Proposal Management

```typescript
// Get pending proposals
const pending = calendarAdapter.getPendingProposals();
// [{ id: 'proposal_xxx', proposal: { title: '...', ... } }]

// Approve a proposal (creates the event)
const event = calendarAdapter.approveProposal('proposal_xxx');
// CalendarEvent | null

// Reject a proposal
const rejected = calendarAdapter.rejectProposal('proposal_xxx');
// true | false
```

### Calendar Data Structures

```typescript
interface CalendarEvent {
  eventId: string;
  title: string;
  start: string;                  // ISO timestamp
  end: string;                    // ISO timestamp
  attendees: string[];
  location: string | null;
}

interface EventProposal {
  // Same as CalendarEvent but without eventId
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string | null;
}
```

### Helper Functions

```typescript
import { createEvent, createEventProposal, getEventsForDay, getEventsInRange } from '@/integrations';

// Create an event
const event = createEvent(
  'event_123',
  'Team Standup',
  new Date('2025-01-15T10:00:00Z'),
  new Date('2025-01-15T10:30:00Z'),
  ['alice@example.com', 'bob@example.com'],
  'Conference Room A'
);

// Get events for a specific day
const today = new Date();
const todayEvents = await getEventsForDay(calendarAdapter, today);

// Get events for a date range
const start = new Date('2025-01-01');
const end = new Date('2025-01-31');
const monthEvents = await getEventsInRange(calendarAdapter, start, end);
```

## Artifact Storage

**Status**: Planned for future release

Artifacts (generated documents, reports, etc.) will be stored using a similar adapter pattern:

```typescript
// Future API (not implemented)
interface ArtifactAdapter extends IntegrationAdapter<Artifact, ArtifactDraft> {
  type: 'artifact';
  read(query: AdapterQuery): Promise<Artifact[]>;
  write(draft: ArtifactDraft): Promise<WriteResult>;
}

interface Artifact {
  artifactId: string;
  type: string;                   // 'document' | 'report' | 'slide_deck'
  title: string;
  content: string;
  format: string;                 // 'markdown' | 'html' | 'pdf'
  createdAt: string;
  updatedAt: string;
}
```

## External References

Link tasks to external entities (email threads, calendar events, artifacts).

### Creating References

```typescript
import { createExternalRef, stringifyExternalRef } from '@/integrations';

// Create email reference
const emailRef = createExternalRef('email', 'thread_123');
// { kind: 'email', ref: 'thread_123' }

// Create calendar reference
const calRef = createExternalRef('calendar', 'event_456');
// { kind: 'calendar', ref: 'event_456' }

// Stringify for storage
const refString = stringifyExternalRef(emailRef);
// 'email:thread_123'
```

### Parsing References

```typescript
import { parseExternalRef } from '@/integrations';

const ref = parseExternalRef('email:thread_123');
// { kind: 'email', ref: 'thread_123' }

const invalid = parseExternalRef('invalid-format');
// null
```

### Extracting from Adapters

```typescript
// Extract reference from email thread
const thread = await emailAdapter.read({ type: 'thread', filters: { threadId: 'thread_123' } });
const ref = emailAdapter.extractRef(thread[0]);
// { kind: 'email', ref: 'thread_123' }

// Extract reference from calendar event
const events = await calendarAdapter.read({ type: 'all' });
const ref = calendarAdapter.extractRef(events[0]);
// { kind: 'calendar', ref: 'event_456' }
```

## Adapter Registry

Register and retrieve adapters globally.

### Registration

```typescript
import { registerAdapter } from '@/integrations';

// Adapters are auto-registered on import
import { emailAdapter, calendarAdapter } from '@/integrations';

// Or register manually
registerAdapter(emailAdapter);
registerAdapter(calendarAdapter);
```

### Retrieval

```typescript
import { getAdapter, hasAdapter, getAllAdapters } from '@/integrations';

// Get specific adapter
const email = getAdapter<EmailThread, EmailDraft>('email');
if (email) {
  const threads = await email.read({ type: 'all' });
}

// Check if adapter exists
if (hasAdapter('calendar')) {
  const cal = getAdapter<CalendarEvent, EventProposal>('calendar');
  // ...
}

// Get all adapters
const all = getAllAdapters();
all.forEach(adapter => {
  console.log(`${adapter.name}: ${adapter.isConfigured() ? 'ready' : 'not configured'}`);
});
```

## Implementing Real Adapters

Currently, all adapters use mock in-memory storage. To implement real integrations:

### 1. Gmail Integration

```typescript
export class GmailAdapter implements IntegrationAdapter<EmailThread, EmailDraft> {
  type = 'email' as const;
  name = 'Gmail Adapter';

  private gmail: gmail_v1.Gmail | null = null;

  configure(config: { apiKey: string; refreshToken: string }): void {
    const auth = new google.auth.OAuth2(
      config.apiKey,
      // ... OAuth2 setup
    );
    auth.setCredentials({ refresh_token: config.refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  isConfigured(): boolean {
    return this.gmail !== null;
  }

  async read(query: AdapterQuery): Promise<EmailThread[]> {
    if (!this.gmail) throw new Error('Gmail not configured');

    // Build Gmail API query
    const gmailQuery = this.buildGmailQuery(query);

    // Fetch threads
    const response = await this.gmail.users.threads.list({
      userId: 'me',
      q: gmailQuery,
      maxResults: query.limit ?? 50,
    });

    // Convert Gmail threads to EmailThread[]
    return this.convertThreads(response.data.threads ?? []);
  }

  async write(draft: EmailDraft): Promise<WriteResult> {
    if (!this.gmail) throw new Error('Gmail not configured');

    // Create MIME message
    const message = this.createMimeMessage(draft);

    // Save as draft
    const response = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw: message },
      },
    });

    return {
      success: true,
      id: response.data.id,
      metadata: { status: 'draft' },
    };
  }

  // ... helper methods
}
```

### 2. Google Calendar Integration

```typescript
export class GoogleCalendarAdapter implements IntegrationAdapter<CalendarEvent, EventProposal> {
  type = 'calendar' as const;
  name = 'Google Calendar Adapter';

  private calendar: calendar_v3.Calendar | null = null;

  configure(config: { apiKey: string; refreshToken: string }): void {
    const auth = new google.auth.OAuth2(
      config.apiKey,
      // ... OAuth2 setup
    );
    auth.setCredentials({ refresh_token: config.refreshToken });
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  isConfigured(): boolean {
    return this.calendar !== null;
  }

  async read(query: AdapterQuery): Promise<CalendarEvent[]> {
    if (!this.calendar) throw new Error('Calendar not configured');

    // Fetch events
    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: query.filters?.startDate as string,
      timeMax: query.filters?.endDate as string,
      maxResults: query.limit ?? 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Convert to CalendarEvent[]
    return this.convertEvents(response.data.items ?? []);
  }

  async write(proposal: EventProposal): Promise<WriteResult> {
    if (!this.calendar) throw new Error('Calendar not configured');

    // Create event with tentative status
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: proposal.title,
        location: proposal.location ?? undefined,
        start: { dateTime: proposal.start },
        end: { dateTime: proposal.end },
        attendees: proposal.attendees.map(email => ({ email })),
        status: 'tentative', // Requires approval
      },
    });

    return {
      success: true,
      id: response.data.id,
      metadata: { status: 'tentative' },
    };
  }

  // ... helper methods
}
```

### 3. Swap Adapters

```typescript
import { registerAdapter, emailAdapter as mockEmailAdapter } from '@/integrations';
import { GmailAdapter } from './gmail-adapter';

// Create and configure real adapter
const gmailAdapter = new GmailAdapter();
gmailAdapter.configure({
  apiKey: process.env.GMAIL_API_KEY,
  refreshToken: process.env.GMAIL_REFRESH_TOKEN,
});

// Register (replaces mock)
registerAdapter(gmailAdapter);

// Now all code using getAdapter('email') gets the real Gmail adapter
```

## Current Status

**✓ Infrastructure Complete:**
- Adapter interface and registry
- Email adapter with mock storage
- Calendar adapter with mock storage
- External reference management
- Pagination and filtering

**⚠️ Mock Mode:**
- All adapters use in-memory storage
- No actual API calls to Gmail, Google Calendar, etc.
- Proposal approval is manual (in-memory)

**📋 Planned:**
- Artifact storage adapter
- Real Gmail integration
- Real Google Calendar integration
- Real Outlook integration
- Artifact generators (Markdown, HTML, PDF)

## Next Steps

1. Implement Gmail adapter using Gmail API
2. Implement Google Calendar adapter using Calendar API
3. Add OAuth2 flow for user authentication
4. Build artifact storage adapter
5. Add webhook support for real-time updates
6. Implement rate limiting and retry logic
7. Add integration tests with real APIs (using test accounts)
