# Crawler Module

Autonomous insight extraction from user interactions, agent outputs, emails, and task patterns.

## Purpose

The crawler module handles:
- **Extraction**: Identify insights from various sources
- **Classification**: Categorize insights into 5 types
- **Confidence Scoring**: Calculate reliability with decay
- **Reinforcement**: Strengthen insights through corroboration
- **Scheduling**: Automated periodic crawling

## Architecture

```
┌──────────────────────────────────────────────┐
│        Crawler Scheduler                     │
│  (Batch Processing, Source Providers)        │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────────────┐
        │                     │
   ┌────▼────┐           ┌────▼────────┐
   │5 Types  │           │Confidence   │
   │Extract. │           │Scoring      │
   └─────────┘           └─────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `extractors/base.ts` | Extractor interface and registry |
| `extractors/preference.ts` | User style and behavior preferences |
| `extractors/stable-fact.ts` | Biographical and persistent info |
| `extractors/commitment.ts` | Promises, deadlines, action items |
| `extractors/recurring-constraint.ts` | Availability and time constraints |
| `extractors/theme.ts` | Recurring topics and patterns |
| `confidence.ts` | Confidence scoring and decay |
| `scheduler.ts` | Autonomous crawling scheduler |

## Extractor Types

Five specialized extractors automatically identify insights:

### 1. Preference Extractor

Captures user style and behavior preferences.

**Examples Detected:**
- "I always prefer brief responses"
- "I never schedule meetings before 10am"
- "Keep it concise"
- "I work best in the morning"

**Categories:**
- `communication` - Email, messaging, meeting style
- `timing` - Time preferences
- `style` - Tone, formality, brevity
- `tool` - Software and app preferences
- `process` - Workflow preferences
- `general` - Other preferences

**Confidence Factors:**
- Explicit statements ("always", "never") → 0.85
- Preferences ("prefer", "like") → 0.7
- General statements → 0.6
- Negative preferences flagged in metadata

### 2. Stable Fact Extractor

Extracts biographical and persistent information.

**Examples Detected:**
- "I work as Chief Product Officer at ThinkingWith.ai"
- "Our office is in San Francisco"
- "Email me at matt@example.com"
- "We use Slack for communication"
- "Sarah is my assistant"

**Fact Types:**
- `job_title` - Role and position
- `organization` - Company and team
- `location` - Office and headquarters
- `contact` - Email, phone
- `team` - Team structure
- `reporting` - Manager and reports
- `relationship` - Clients, partners, vendors
- `tool` - Tools and systems

**Confidence:**
- Base: 0.7-0.9 depending on explicitness
- Contact info (email patterns): 0.9
- Relationships: 0.75
- Tools: 0.7

### 3. Commitment Extractor

Identifies promises, deadlines, and action items.

**Examples Detected:**
- "I will send the report by Friday"
- "We need to complete this by end of month"
- "Action item: Review the proposal"
- "Follow up with Sarah tomorrow"
- "Meeting scheduled for 3pm Tuesday"

**Commitment Types:**
- `promise` - Will do statements
- `deadline` - Due dates
- `meeting` - Scheduled events
- `action_item` - Tasks and todos
- `follow_up` - Pending follow-ups

**Deadline Parsing:**
- Relative: "today", "tomorrow", "next week", "in 3 days"
- Absolute: "Jan 15", "12/7/2025", "Friday"
- Time: "by 3pm", "before noon"
- Context-aware: Searches surrounding text

**Owner Detection:**
- `self` - "I will", "I need"
- `shared` - "We will", "we need"
- `other` - "They will", "waiting for"

### 4. Recurring Constraint Extractor

Captures availability patterns and time constraints.

**Examples Detected:**
- "I'm busy every Monday morning"
- "Don't schedule meetings on Fridays"
- "I'm available between 2-4pm"
- "Weekly standup every Tuesday at 10am"
- "I'm in Pacific Time"
- "Working hours are 9am-5pm"

**Constraint Types:**
- `availability` - Free/available times
- `blocked` - Busy/unavailable times
- `recurring_meeting` - Standing meetings
- `working_hours` - Office hours
- `timezone` - Time zone

**Recurrence Patterns:**
- Frequency: daily, weekly, biweekly, monthly
- Days: Monday, Tuesday, etc.
- Intervals: "every 2 weeks", "every 3 days"

**Time Ranges:**
- Explicit: "9am-5pm", "2:00-4:00"
- Periods: morning (9-12), afternoon (12-5), evening (5-9)

### 5. Theme Extractor

Identifies recurring topics and patterns.

**Examples Detected:**
- Domain themes: productivity, communication, planning
- Emergent themes: frequent keywords
- Named entities: "Project Atlas", "Acme Corp"

**Theme Categories:**
- `domain_theme` - Pre-defined topic areas
  - productivity, communication, planning, learning
  - health, finance, relationships, technology
- `emergent_theme` - High-frequency keywords (appears 2+ times)
- `named_entity` - Capitalized multi-word phrases
  - Projects, organizations, products, concepts

**Confidence:**
- Domain themes: 0.5 + 0.1 per match (max 0.9)
- Emergent themes: 0.4 + 0.15 per occurrence (max 0.8)
- Named entities: 0.5-0.7 based on type

## Confidence Scoring

Insights receive confidence scores (0-1) based on multiple factors:

### Base Factors

```typescript
{
  extractionConfidence: 0.7,    // Initial confidence
  corroborationCount: 2,        // Times reinforced
  ageInDays: 10,                // Age of insight
  sourceCount: 3,               // Distinct sources
  userConfirmed: false,         // User feedback
  userDenied: false
}
```

### Confidence Decay

Insights decay over time using exponential half-life:

| Insight Type | Half-Life |
|--------------|-----------|
| `stable_fact` | 365 days |
| `preference` | 180 days |
| `theme` | 90 days |
| `recurring_constraint` | 60 days |
| `commitment` | 7 days |

Formula: `score = baseScore × 2^(-age/halfLife)`

### Corroboration Boost

Multiple sources increase confidence with diminishing returns:

- First corroboration: +0.15
- Second: +0.10
- Third: +0.05
- Subsequent: +0.02 each (max +0.35 total)

### User Feedback

- Confirmation: +0.30
- Denial: -0.80 (effectively marks unreliable)

### Source Variety

Multiple distinct sources increase confidence:
- +0.05 per additional source (max +0.20)

### Reliability Threshold

Insights with score ≥ 0.6 are considered reliable.

### Confidence Levels

- `very_high`: ≥ 0.85
- `high`: 0.70-0.84
- `medium`: 0.50-0.69
- `low`: 0.30-0.49
- `very_low`: < 0.30

## Insight Reinforcement

Insights can be strengthened through multiple mechanisms:

### Corroboration

When the same insight appears in multiple sources:

```typescript
const reinforced = corroborateInsight(insight, newSourceRef);
// Adds source, recalculates confidence, updates timestamp
```

### User Feedback

User confirmation or denial directly impacts confidence:

```typescript
const updated = applyUserFeedback(insight, 'confirm');
// Applies +0.30 boost, marks as user-confirmed
```

### Merging Duplicates

Similar insights are merged to combine evidence:

```typescript
const merged = mergeInsights(existing, duplicate);
// Combines sources, takes higher confidence, adds corroboration
```

### Staleness Detection

Identifies insights needing revalidation:

```typescript
const stale = getStaleInsights(insights, 30);
// Returns insights > 30 days old or decayed > 30%
```

## Crawler Scheduler

Manages autonomous periodic insight extraction.

### Configuration

```typescript
const DEFAULT_CONFIG = {
  enabled: true,                    // Enable crawler
  minIntervalMs: 5 * 60 * 1000,    // 5 minutes
  batchSize: 50,                    // Sources per batch
  minConfidence: 0.5,               // Filter threshold
  enabledSources: [                 // Active source types
    'user_interaction',
    'agent_output',
    'email',
    'task_pattern'
  ]
};
```

### Source Providers

Register providers for each source type:

```typescript
crawler.registerSourceProvider('user_interaction', async () => {
  return await fetchRecentInteractions();
});

crawler.registerSourceProvider('email', async () => {
  return await fetchUnprocessedEmails();
});
```

### Insight Consumer

Process extracted insights:

```typescript
crawler.setInsightConsumer(async (insights) => {
  await saveToKnowledgeGraph(insights);
  await notifyUser(insights.filter(i => i.confidence > 0.8));
});
```

### Lifecycle

```typescript
// Start scheduled crawling
crawler.start();

// Manual crawl
const result = await crawler.runCrawl();
console.log(`Processed ${result.sourcesProcessed} sources`);
console.log(`Extracted ${result.insightsExtracted} insights`);

// Stop scheduler
crawler.stop();
```

## Usage Examples

### Basic Extraction

```typescript
import { getExtractorsForSource } from '@/crawler';

const source = {
  type: 'user_interaction',
  content: 'I always prefer brief responses and never schedule meetings before 10am',
  timestamp: new Date().toISOString(),
  sourceRef: 'interaction:123'
};

const extractors = getExtractorsForSource(source);
for (const extractor of extractors) {
  const insights = await extractor.extract(source);
  console.log(`${extractor.name} found ${insights.length} insights`);
}
```

### Create Source Helpers

```typescript
import {
  createUserInteractionSource,
  createAgentOutputSource,
  createEmailSource
} from '@/crawler';

// From user input
const userSource = createUserInteractionSource(
  "I need to finish the report by Friday",
  { userId: 'user123' }
);

// From agent output
const agentSource = createAgentOutputSource(
  "Based on your preferences, scheduling at 2pm",
  'run-456',
  { agentType: 'planner' }
);

// From email
const emailSource = createEmailSource(
  "Our weekly sync is every Tuesday at 10am",
  'thread-789',
  { from: 'sarah@example.com' }
);
```

### Full Crawl Cycle

```typescript
import { crawlerScheduler } from '@/crawler';

// Configure
crawlerScheduler.configure({
  minIntervalMs: 10 * 60 * 1000,  // 10 minutes
  batchSize: 100,
  minConfidence: 0.6
});

// Register providers
crawlerScheduler.registerSourceProvider('user_interaction', async () => {
  const recent = await db.interactions
    .where('processedForInsights', '=', false)
    .limit(50)
    .toArray();

  return recent.map(i => ({
    type: 'user_interaction',
    content: i.content,
    timestamp: i.createdAt,
    sourceRef: `interaction:${i.id}`
  }));
});

// Set consumer
crawlerScheduler.setInsightConsumer(async (insights) => {
  for (const insight of insights) {
    await knowledgeGraph.addInsight({
      type: insight.type,
      content: insight.content,
      confidence: insight.confidence,
      sourceRefs: insight.sourceRefs,
      extractedAt: new Date().toISOString(),
      metadata: insight.metadata
    });
  }
});

// Start
crawlerScheduler.start();

// Check state
const state = crawlerScheduler.getState();
console.log(`Total processed: ${state.totalSourcesProcessed}`);
console.log(`Total insights: ${state.totalInsightsExtracted}`);
```

### Confidence Management

```typescript
import {
  calculateConfidenceScore,
  corroborateInsight,
  applyUserFeedback,
  getStaleInsights
} from '@/crawler';

// Calculate detailed score
const score = calculateConfidenceScore('preference', {
  extractionConfidence: 0.7,
  corroborationCount: 2,
  ageInDays: 30,
  sourceCount: 3,
  userConfirmed: false,
  userDenied: false
});

console.log(`Score: ${score.score.toFixed(2)} (${score.level})`);
console.log(`Reliable: ${score.isReliable}`);
console.log('Factors:', score.factors);

// Reinforce insight
let insight = { /* ... */ };
insight = corroborateInsight(insight, 'email:new-thread');

// Apply feedback
insight = applyUserFeedback(insight, 'confirm');

// Find stale insights
const stale = getStaleInsights(allInsights, 45);
console.log(`${stale.length} insights need revalidation`);
```

### Custom Extractor

```typescript
import { registerExtractor, type InsightExtractor } from '@/crawler';

const customExtractor: InsightExtractor = {
  type: 'preference',
  name: 'Custom Preference Extractor',

  canHandle(source) {
    return source.type === 'user_interaction';
  },

  async extract(source) {
    const insights = [];

    // Custom pattern matching
    if (source.content.includes('my favorite tool is')) {
      const match = source.content.match(/my favorite tool is (\w+)/i);
      if (match) {
        insights.push({
          type: 'preference',
          content: match[1],
          confidence: 0.8,
          sourceRefs: [source.sourceRef || 'unknown'],
          metadata: { category: 'tool', custom: true }
        });
      }
    }

    return insights;
  }
};

registerExtractor(customExtractor);
```

## Integration Points

The crawler integrates with:

1. **Knowledge Graph**: Store extracted insights
2. **Concierge**: Use insights for context
3. **Agents**: Extract from agent outputs
4. **Email Integration**: Process email content
5. **Task Patterns**: Learn from recurring tasks

## Current Status

**✓ Complete:**
- All 5 extractor types implemented
- Pattern matching with regex
- Confidence scoring and decay
- Corroboration and reinforcement
- Scheduler with batch processing
- Source provider abstraction

**⚠️ Pattern-Based:**
- Uses regex patterns (not LLM-based)
- May miss subtle or complex insights
- Limited semantic understanding

## Next Steps

1. Consider LLM-based extraction for complex insights
2. Add insight merging logic to knowledge graph
3. Implement user feedback UI
4. Add A/B testing for pattern improvements
5. Build insight quality metrics
