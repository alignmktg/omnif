/**
 * Intent Parser
 * Parses user input into structured intents
 */

import type { TaskType, Priority } from '@/domain';

// ============================================================================
// INTENT TYPES
// ============================================================================

export type IntentCategory =
  | 'task_management'    // Create, update, complete tasks
  | 'project_management' // Create, update projects
  | 'information'        // Query info, status, search
  | 'scheduling'         // Calendar, meetings, reminders
  | 'communication'      // Email, messages
  | 'planning'           // Goals, roadmaps, strategy
  | 'reflection'         // Review, retrospective
  | 'general';           // Conversation, unclear

export type IntentAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'complete'
  | 'list'
  | 'search'
  | 'schedule'
  | 'remind'
  | 'send'
  | 'draft'
  | 'review'
  | 'plan'
  | 'summarize'
  | 'clarify';

export interface ParsedIntent {
  category: IntentCategory;
  action: IntentAction;
  confidence: number;
  entities: ExtractedEntities;
  originalInput: string;
  needsClarification: boolean;
  clarificationPrompts: string[];
}

export interface ExtractedEntities {
  tasks?: TaskEntity[];
  projects?: ProjectEntity[];
  people?: PersonEntity[];
  dates?: DateEntity[];
  priorities?: Priority[];
  tags?: string[];
  locations?: string[];
  amounts?: AmountEntity[];
  custom?: Record<string, unknown>;
}

export interface TaskEntity {
  title: string;
  type?: TaskType;
  priority?: Priority;
  dueDate?: string;
  deferDate?: string;
  tags?: string[];
  assignee?: string;
}

export interface ProjectEntity {
  name: string;
  type?: 'sequential' | 'parallel' | 'single_action';
}

export interface PersonEntity {
  name: string;
  role?: string;
  email?: string;
}

export interface DateEntity {
  text: string;
  parsed: string | null;
  isRange: boolean;
  start?: string;
  end?: string;
}

export interface AmountEntity {
  value: number;
  unit?: string;
  context?: string;
}

// ============================================================================
// INTENT PATTERNS
// ============================================================================

const CATEGORY_PATTERNS: Record<IntentCategory, RegExp[]> = {
  task_management: [
    /\b(task|todo|action|item|thing to do)\b/i,
    /\b(create|add|make|complete|finish|done|check off)\b/i,
    /\b(remind|reminder)\b/i,
  ],
  project_management: [
    /\b(project|initiative|program|workstream)\b/i,
    /\b(milestone|phase|stage)\b/i,
  ],
  information: [
    /\b(what|where|when|who|how|why|which)\b/i,
    /\b(show|list|find|search|look up|status|tell me)\b/i,
  ],
  scheduling: [
    /\b(schedule|calendar|meeting|appointment|event)\b/i,
    /\b(book|reserve|block|invite)\b/i,
  ],
  communication: [
    /\b(email|message|text|call|send|reply|respond)\b/i,
    /\b(draft|write|compose)\b/i,
  ],
  planning: [
    /\b(plan|goal|objective|strategy|vision)\b/i,
    /\b(outcome|target|milestone|roadmap)\b/i,
  ],
  reflection: [
    /\b(review|reflect|retrospective|assess)\b/i,
    /\b(how did|what worked|lessons learned)\b/i,
  ],
  general: [],
};

const ACTION_PATTERNS: Record<IntentAction, RegExp[]> = {
  create: [/\b(create|add|make|new|start)\b/i],
  update: [/\b(update|change|modify|edit|revise)\b/i],
  delete: [/\b(delete|remove|cancel|drop)\b/i],
  complete: [/\b(complete|finish|done|mark as done|check off)\b/i],
  list: [/\b(list|show|display|what are|give me)\b/i],
  search: [/\b(search|find|look for|locate)\b/i],
  schedule: [/\b(schedule|book|set up|arrange)\b/i],
  remind: [/\b(remind|reminder|alert|notify)\b/i],
  send: [/\b(send|deliver|forward)\b/i],
  draft: [/\b(draft|write|compose|prepare)\b/i],
  review: [/\b(review|check|assess|evaluate)\b/i],
  plan: [/\b(plan|outline|design|map out)\b/i],
  summarize: [/\b(summarize|summary|overview|brief)\b/i],
  clarify: [/\b(clarify|explain|what do you mean|help me understand)\b/i],
};

// ============================================================================
// INTENT PARSER
// ============================================================================

/**
 * Parse user input into structured intent
 */
export function parseIntent(input: string): ParsedIntent {
  const category = classifyCategory(input);
  const action = classifyAction(input);
  const entities = extractEntities(input);

  const needsClarification =
    category === 'general' ||
    action === 'clarify' ||
    !hasRequiredEntities(category, action, entities);

  const clarificationPrompts = needsClarification
    ? generateClarificationPrompts(category, action, entities)
    : [];

  // Calculate confidence
  let confidence = 0.5;
  if (category !== 'general') confidence += 0.2;
  if (action !== 'clarify') confidence += 0.1;
  if (!needsClarification) confidence += 0.2;

  return {
    category,
    action,
    confidence: Math.min(0.95, confidence),
    entities,
    originalInput: input,
    needsClarification,
    clarificationPrompts,
  };
}

/**
 * Classify input into a category
 */
function classifyCategory(input: string): IntentCategory {
  let bestCategory: IntentCategory = 'general';
  let bestScore = 0;

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS) as [IntentCategory, RegExp[]][]) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * Classify input into an action
 */
function classifyAction(input: string): IntentAction {
  let bestAction: IntentAction = 'clarify';
  let bestScore = 0;

  for (const [action, patterns] of Object.entries(ACTION_PATTERNS) as [IntentAction, RegExp[]][]) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

/**
 * Extract entities from input
 */
function extractEntities(input: string): ExtractedEntities {
  const entities: ExtractedEntities = {};

  // Extract tasks
  const taskMatches = extractTaskEntities(input);
  if (taskMatches.length > 0) {
    entities.tasks = taskMatches;
  }

  // Extract people
  const peopleMatches = extractPeopleEntities(input);
  if (peopleMatches.length > 0) {
    entities.people = peopleMatches;
  }

  // Extract dates
  const dateMatches = extractDateEntities(input);
  if (dateMatches.length > 0) {
    entities.dates = dateMatches;
  }

  // Extract priorities
  const priorityMatches = extractPriorities(input);
  if (priorityMatches.length > 0) {
    entities.priorities = priorityMatches;
  }

  // Extract tags
  const tagMatches = extractTags(input);
  if (tagMatches.length > 0) {
    entities.tags = tagMatches;
  }

  return entities;
}

function extractTaskEntities(input: string): TaskEntity[] {
  const tasks: TaskEntity[] = [];

  // Pattern: "task to [verb] [object]"
  const taskPattern = /(?:task|todo|action)(?: item)? (?:to |for )?(.+?)(?:\.|$|,)/gi;
  let match: RegExpExecArray | null;
  while ((match = taskPattern.exec(input)) !== null) {
    tasks.push({ title: match[1].trim() });
  }

  // Pattern: quoted task names
  const quotedPattern = /"([^"]+)"/g;
  let quotedMatch: RegExpExecArray | null;
  while ((quotedMatch = quotedPattern.exec(input)) !== null) {
    if (!tasks.some((t) => t.title === quotedMatch![1])) {
      tasks.push({ title: quotedMatch[1].trim() });
    }
  }

  return tasks;
}

function extractPeopleEntities(input: string): PersonEntity[] {
  const people: PersonEntity[] = [];

  // Pattern: email addresses with optional names
  const emailPattern = /(?:([A-Za-z\s]+)\s+)?<?([\w.-]+@[\w.-]+\.[a-z]{2,})>?/gi;
  let match: RegExpExecArray | null;
  while ((match = emailPattern.exec(input)) !== null) {
    people.push({
      name: match[1]?.trim() || match[2].split('@')[0],
      email: match[2],
    });
  }

  // Pattern: "with [Name]" or "to [Name]"
  const namePattern = /(?:with|to|from|for|cc|bcc)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  while ((match = namePattern.exec(input)) !== null) {
    const name = match[1].trim();
    if (!people.some((p) => p.name === name)) {
      people.push({ name });
    }
  }

  return people;
}

function extractDateEntities(input: string): DateEntity[] {
  const dates: DateEntity[] = [];

  // Relative dates
  const relativePatterns = [
    { pattern: /\btoday\b/i, offset: 0 },
    { pattern: /\btomorrow\b/i, offset: 1 },
    { pattern: /\bnext week\b/i, offset: 7 },
    { pattern: /\bnext month\b/i, offset: 30 },
  ];

  for (const { pattern, offset } of relativePatterns) {
    if (pattern.test(input)) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      dates.push({
        text: input.match(pattern)![0],
        parsed: date.toISOString().split('T')[0],
        isRange: false,
      });
    }
  }

  // Specific dates
  const datePattern = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
  let match;
  while ((match = datePattern.exec(input)) !== null) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

    const fullYear = year < 100 ? 2000 + year : year;
    const date = new Date(fullYear, month - 1, day);

    dates.push({
      text: match[0],
      parsed: date.toISOString().split('T')[0],
      isRange: false,
    });
  }

  return dates;
}

function extractPriorities(input: string): Priority[] {
  const priorities: Priority[] = [];

  if (/\b(urgent|critical|asap|immediately)\b/i.test(input)) {
    priorities.push('critical');
  }
  if (/\b(high priority|important|priority)\b/i.test(input)) {
    priorities.push('high');
  }
  if (/\b(low priority|when possible|nice to have)\b/i.test(input)) {
    priorities.push('low');
  }
  if (/\b(medium|normal|standard)\b/i.test(input)) {
    priorities.push('normal');
  }

  return [...new Set(priorities)];
}

function extractTags(input: string): string[] {
  const tags: string[] = [];

  // Hashtag pattern
  const hashtagPattern = /#(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = hashtagPattern.exec(input)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  // "tag: X" pattern
  const tagLabelPattern = /tag(?:s)?[:\s]+([^,.]+)/gi;
  while ((match = tagLabelPattern.exec(input)) !== null) {
    const tagText = match[1].trim().toLowerCase();
    if (!tags.includes(tagText)) {
      tags.push(tagText);
    }
  }

  return tags;
}

// ============================================================================
// CLARIFICATION
// ============================================================================

function hasRequiredEntities(
  category: IntentCategory,
  action: IntentAction,
  entities: ExtractedEntities
): boolean {
  switch (category) {
    case 'task_management':
      if (action === 'create') {
        return (entities.tasks?.length ?? 0) > 0;
      }
      return true;

    case 'scheduling':
      return (entities.dates?.length ?? 0) > 0;

    case 'communication':
      return (entities.people?.length ?? 0) > 0;

    default:
      return true;
  }
}

function generateClarificationPrompts(
  category: IntentCategory,
  action: IntentAction,
  entities: ExtractedEntities
): string[] {
  const prompts: string[] = [];

  if (category === 'task_management' && action === 'create' && !entities.tasks?.length) {
    prompts.push('What task would you like to create?');
  }

  if (category === 'scheduling' && !entities.dates?.length) {
    prompts.push('When would you like to schedule this?');
  }

  if (category === 'communication' && !entities.people?.length) {
    prompts.push('Who should this be sent to?');
  }

  if (category === 'general') {
    prompts.push('Could you tell me more about what you\'d like to accomplish?');
  }

  return prompts;
}
