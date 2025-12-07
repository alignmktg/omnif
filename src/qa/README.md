# QA Module

Quality assurance layer with fact verification, alignment checking, and safety rails.

## Purpose

The QA module handles:
- **Correctness**: Verifying output matches the stated objective
- **Alignment**: Checking output meets constraints (style, length, format)
- **Safety**: Detecting harmful, inappropriate, or sensitive content
- **Profiles**: Three rigor levels for different use cases
- **Escalation**: Automatic retry with stricter checks on failure

## Architecture

```
┌──────────────────────────────────────────────┐
│           QA Layer                           │
│  (Profiles, Checks, Selection, Escalation)   │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   ┌────▼────┐   ┌────▼────────┐
   │Profile  │   │Escalation   │
   │Selection│   │Handler      │
   └────┬────┘   └─────────────┘
        │
   ┌────▼────────────────┐
   │Three Check Types    │
   │Correctness          │
   │Alignment            │
   │Safety               │
   └─────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `profiles.ts` | QA profile definitions and helpers |
| `checks.ts` | Check implementations (correctness, alignment, safety) |
| `selection.ts` | Automatic profile selection based on priority |
| `escalation.ts` | Failure handling and escalation logic |

## QA Profiles

Three profiles with different rigor levels:

### 1. Fast Draft (`fast_draft`)
**Use for:** Brainstorming, rapid iteration, internal drafts

- **Enabled Checks**: Safety only
- **Confidence Threshold**: 50%
- **Max Failures**: 3
- **Description**: Minimal checks for speed

### 2. Balanced (`balanced`)
**Use for:** Most standard work, internal content

- **Enabled Checks**: Correctness, Alignment, Safety
- **Confidence Threshold**: 70%
- **Max Failures**: 2
- **Description**: Standard checks for typical use cases

### 3. High Rigor (`high_rigor`)
**Use for:** External-facing content, high-stakes work, client deliverables

- **Enabled Checks**: Correctness, Alignment, Safety (all weighted equally)
- **Confidence Threshold**: 85%
- **Max Failures**: 2
- **Description**: Extensive validation for critical content

## Check Types

### Correctness Check

Verifies output matches the stated objective:

```typescript
// Checks performed:
- Output is not empty
- Minimum word count (10 words)
- Keyword coverage from objective (30% minimum)
- Agent's self-reported confidence

// Example issues:
- "Output is empty"
- "Output too short: 5 words (minimum: 10)"
- "Low relevance to objective: 20% keyword coverage"
```

**Weight in composite score:** 40% (balanced), 35% (high_rigor)

### Alignment Check

Verifies output meets constraints:

```typescript
// Checks performed:
- Word count within limits (20% tolerance)
- Expected artifacts present
- Agent's alignment confidence

// Example issues:
- "Output exceeds word limit: 1500 words (max: 1000)"
- "Missing expected artifacts: summary, action_items"
```

**Weight in composite score:** 35%

### Safety Check

Detects harmful, inappropriate, or sensitive content:

```typescript
// Patterns checked:
- Harmful content (hack, exploit, attack, malware)
- PII (SSN, credit cards, emails)
- Inappropriate language (profanity - warning only)

// Example issues:
- "Potentially harmful content detected"
- "Potential PII detected: SSN pattern"
- "Warning: Potentially inappropriate language detected"
```

**Weight in composite score:** 25% (balanced), 30% (high_rigor)

## Automatic Profile Selection

Profiles are auto-selected based on task priority (PRD Section 13):

```typescript
// Selection logic:
if (urgency + risk > 1.3) → high_rigor
if (contentType >= 0.9 && risk > 0.7) → high_rigor
if (isBrainstorming || composite < 0.3) → fast_draft
otherwise → balanced
```

**Context-based selection:**

```typescript
selectQAProfileFromContext({
  isExternal: true,           // → high_rigor
  isClientFacing: true,       // → high_rigor
  isHighStakes: true,         // → high_rigor
  isBrainstorming: true,      // → fast_draft
  urgencyLevel: 'critical',   // → high_rigor
  isInternal: true,           // → balanced (unless low urgency)
})
```

## Escalation Logic

When QA checks fail, automatic escalation occurs:

```
Attempt 1: Retry with same profile
Attempt 2: Escalate to stricter profile (if available)
Max failures: Require user input
```

**Escalation path:**
```
fast_draft → balanced → high_rigor → user_input
```

**Auto-approval rules:**

- Never auto-approve safety failures
- Fast draft: Auto-approve if score >= 40%
- Balanced: Auto-approve if score >= 60% and correctness/safety pass

## Usage

### Run All Checks

```typescript
import { runChecks } from '@/qa';

const result = runChecks(request, response, {
  correctness: true,
  alignment: true,
  safety: true,
});

console.log(result.overallScore);  // 0.0 - 1.0
console.log(result.passed);        // true/false
console.log(result.allIssues);     // ["[Correctness] ...", "[Safety] ..."]
```

### Use Profile-Based Checks

```typescript
import { getProfile, getEnabledChecks, runChecks } from '@/qa';

// Get profile
const profile = getProfile('balanced');

// Get enabled checks for profile
const checks = getEnabledChecks('balanced');
// Returns: [correctnessCheck, alignmentCheck, safetyCheck]

// Check if score passes threshold
const passes = passesThreshold('balanced', 0.75); // true
```

### Select Profile Automatically

```typescript
import { selectQAProfileForTask, selectQAProfile } from '@/qa';

// From task
const profile = selectQAProfileForTask(task, insights);

// From priority score
const profile = selectQAProfile(priorityScore, {
  type: 'brainstorming',
  tags: ['draft', 'internal'],
});
// Returns: 'fast_draft'
```

### Handle QA Failure

```typescript
import { handleQAFailure, createEscalationState } from '@/qa';

const escalationState = createEscalationState(runId);

const result = handleQAFailure({
  failureCount: 2,
  currentProfile: 'balanced',
  checkResult: qaCheckResult,
});

if (result.action === 'retry_stricter') {
  console.log(`Retrying with ${result.newProfileId} profile`);
} else if (result.action === 'require_user_input') {
  console.log(result.userPrompt);  // Formatted prompt for user
}
```

### Get Remediation Suggestions

```typescript
import { generateRemediations } from '@/qa';

const suggestions = generateRemediations(checkResult);

for (const suggestion of suggestions) {
  console.log(`[${suggestion.priority}] ${suggestion.issue}`);
  console.log(`  → ${suggestion.suggestion}`);
}

// Output:
// [high] Low relevance to objective: 20% keyword coverage
//   → Clarify the objective with more specific keywords
```

## Check Results

### Individual Check Result

```typescript
interface CheckResult {
  passed: boolean;
  score: number;        // 0-1
  issues: string[];
  details?: {
    wordCount?: number;
    keywordCoverage?: number;
    agentConfidence?: number;
  };
}
```

### Composite Check Result

```typescript
interface CompositeCheckResult {
  passed: boolean;
  overallScore: number;  // Weighted average of all checks
  checkResults: {
    correctness?: CheckResult;
    alignment?: CheckResult;
    safety?: CheckResult;
  };
  allIssues: string[];   // Prefixed with check type
}
```

## Integration with Execution

QA checks run automatically after agent execution:

```typescript
// In agent executor:
1. Execute agent → get response
2. Select QA profile based on task priority
3. Run QA checks with selected profile
4. If passed → mark complete
5. If failed → handle escalation:
   - Retry with same profile (first failure)
   - Retry with stricter profile (second failure)
   - Require user input (max failures reached)
```

## Profile Comparison

| Feature | Fast Draft | Balanced | High Rigor |
|---------|-----------|----------|------------|
| **Correctness** | ✗ | ✓ | ✓ |
| **Alignment** | ✗ | ✓ | ✓ |
| **Safety** | ✓ | ✓ | ✓ |
| **Threshold** | 50% | 70% | 85% |
| **Max Failures** | 3 | 2 | 2 |
| **Speed** | Fastest | Medium | Slowest |
| **Use Case** | Internal drafts | Standard work | External content |

## Current Status

**✓ Infrastructure Complete:**
- Three QA profiles defined
- All check types implemented
- Automatic profile selection
- Escalation logic with retry
- Remediation suggestions

**⚠️ Pattern Matching Mode:**
- Safety checks use regex patterns
- No LLM-based content analysis yet
- Correctness uses keyword matching

## Next Steps

1. Add LLM-based fact checking for correctness
2. Implement semantic similarity for alignment
3. Integrate external safety APIs (content moderation)
4. Add check result persistence/logging
5. Build QA metrics dashboard
