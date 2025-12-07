/**
 * Briefing Generator
 * Generates contextual briefings for user (PRD Section 15)
 */

import type { Task, Project, Insight, AgentRun, PriorityScore } from '@/domain';

// ============================================================================
// BRIEFING TYPES
// ============================================================================

export type BriefingType =
  | 'morning'      // Start of day briefing
  | 'evening'      // End of day summary
  | 'weekly'       // Weekly review
  | 'on_demand'    // User-requested
  | 'contextual';  // Based on current activity

export interface Briefing {
  type: BriefingType;
  generatedAt: string;
  sections: BriefingSection[];
  highlights: string[];
  actionItems: ActionItem[];
  insights: InsightSummary[];
}

export interface BriefingSection {
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  items?: BriefingItem[];
}

export interface BriefingItem {
  text: string;
  type: 'task' | 'event' | 'insight' | 'reminder';
  metadata?: Record<string, unknown>;
}

export interface ActionItem {
  title: string;
  context: string;
  suggestedAction: string;
  priority: 'high' | 'medium' | 'low';
  relatedTaskId?: string;
}

export interface InsightSummary {
  type: Insight['type'];
  content: string;
  confidence: number;
  isNew: boolean;
}

// ============================================================================
// BRIEFING CONTEXT
// ============================================================================

export interface BriefingContext {
  /** Current tasks */
  tasks: Task[];

  /** Active projects */
  projects: Project[];

  /** Recent insights */
  insights: Insight[];

  /** Recent agent runs */
  recentAgentRuns: AgentRun[];

  /** Priority scores for tasks */
  taskScores?: Map<string, PriorityScore>;

  /** User's calendar events for today */
  todayEvents?: Array<{
    title: string;
    start: string;
    end: string;
    attendees: string[];
  }>;

  /** Recent email highlights */
  emailHighlights?: Array<{
    subject: string;
    from: string;
    summary: string;
  }>;
}

// ============================================================================
// BRIEFING GENERATOR
// ============================================================================

/**
 * Generate a briefing based on type and context
 */
export function generateBriefing(
  type: BriefingType,
  context: BriefingContext
): Briefing {
  switch (type) {
    case 'morning':
      return generateMorningBriefing(context);
    case 'evening':
      return generateEveningBriefing(context);
    case 'weekly':
      return generateWeeklyBriefing(context);
    case 'on_demand':
    case 'contextual':
    default:
      return generateContextualBriefing(context);
  }
}

// ============================================================================
// BRIEFING GENERATORS
// ============================================================================

function generateMorningBriefing(context: BriefingContext): Briefing {
  const sections: BriefingSection[] = [];
  const highlights: string[] = [];
  const actionItems: ActionItem[] = [];

  // Priority tasks section
  const priorityTasks = getPriorityTasks(context.tasks, context.taskScores, 5);
  if (priorityTasks.length > 0) {
    sections.push({
      title: 'Priority Tasks for Today',
      content: `You have ${priorityTasks.length} high-priority items to focus on.`,
      priority: 'high',
      items: priorityTasks.map((task) => ({
        text: task.title,
        type: 'task' as const,
        metadata: { taskId: task.id, priority: task.priority },
      })),
    });

    highlights.push(`${priorityTasks.length} priority tasks need attention`);
  }

  // Calendar section
  if (context.todayEvents && context.todayEvents.length > 0) {
    sections.push({
      title: 'Today\'s Schedule',
      content: `You have ${context.todayEvents.length} events scheduled.`,
      priority: 'medium',
      items: context.todayEvents.map((event) => ({
        text: `${formatTime(event.start)} - ${event.title}`,
        type: 'event' as const,
        metadata: { attendees: event.attendees },
      })),
    });
  }

  // Blocked tasks section
  const blockedTasks = context.tasks.filter((t) => t.status === 'blocked');
  if (blockedTasks.length > 0) {
    sections.push({
      title: 'Blocked Items',
      content: `${blockedTasks.length} tasks are currently blocked.`,
      priority: 'medium',
      items: blockedTasks.map((task) => ({
        text: task.title,
        type: 'task' as const,
        metadata: { taskId: task.id },
      })),
    });

    actionItems.push({
      title: 'Unblock tasks',
      context: `${blockedTasks.length} tasks are waiting on dependencies or blockers`,
      suggestedAction: 'Review blocked items and resolve dependencies',
      priority: 'medium',
    });
  }

  // Due today section
  const dueToday = context.tasks.filter((t) => isDueToday(t.dueDate));
  if (dueToday.length > 0) {
    highlights.push(`${dueToday.length} items due today`);

    for (const task of dueToday.slice(0, 3)) {
      actionItems.push({
        title: task.title,
        context: 'Due today',
        suggestedAction: 'Complete or reschedule',
        priority: 'high',
        relatedTaskId: task.id,
      });
    }
  }

  // New insights
  const newInsights = context.insights.filter((i) => isRecent(i.extractedAt, 24));
  const insightSummaries = newInsights.slice(0, 5).map((i) => ({
    type: i.type,
    content: i.content,
    confidence: i.confidence,
    isNew: true,
  }));

  return {
    type: 'morning',
    generatedAt: new Date().toISOString(),
    sections,
    highlights,
    actionItems,
    insights: insightSummaries,
  };
}

function generateEveningBriefing(context: BriefingContext): Briefing {
  const sections: BriefingSection[] = [];
  const highlights: string[] = [];
  const actionItems: ActionItem[] = [];

  // Completed today (using updatedAt as proxy for completion time)
  const completedToday = context.tasks.filter(
    (t) => t.status === 'completed' && isRecent(t.updatedAt, 12)
  );

  if (completedToday.length > 0) {
    sections.push({
      title: 'Completed Today',
      content: `Great work! You completed ${completedToday.length} tasks.`,
      priority: 'low',
      items: completedToday.map((task) => ({
        text: task.title,
        type: 'task' as const,
        metadata: { taskId: task.id },
      })),
    });

    highlights.push(`${completedToday.length} tasks completed today`);
  }

  // Carry-over items
  const overdueItems = context.tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
  );

  if (overdueItems.length > 0) {
    sections.push({
      title: 'Carry-Over Items',
      content: `${overdueItems.length} items need to be rescheduled.`,
      priority: 'medium',
      items: overdueItems.map((task) => ({
        text: task.title,
        type: 'task' as const,
        metadata: { taskId: task.id, originalDue: task.dueDate },
      })),
    });

    actionItems.push({
      title: 'Reschedule overdue items',
      context: `${overdueItems.length} items are past their due date`,
      suggestedAction: 'Review and set new due dates or deprioritize',
      priority: 'medium',
    });
  }

  // Tomorrow's focus
  const tomorrowTasks = context.tasks.filter((t) => isDueTomorrow(t.dueDate));
  if (tomorrowTasks.length > 0) {
    sections.push({
      title: 'Tomorrow\'s Focus',
      content: `${tomorrowTasks.length} items are due tomorrow.`,
      priority: 'medium',
      items: tomorrowTasks.slice(0, 5).map((task) => ({
        text: task.title,
        type: 'task' as const,
        metadata: { taskId: task.id },
      })),
    });
  }

  // Agent activity summary
  const todayRuns = context.recentAgentRuns.filter((r) =>
    isRecent(r.startedAt, 12)
  );

  if (todayRuns.length > 0) {
    const successfulRuns = todayRuns.filter((r) => r.status === 'completed');
    highlights.push(`${successfulRuns.length}/${todayRuns.length} agent runs successful`);
  }

  return {
    type: 'evening',
    generatedAt: new Date().toISOString(),
    sections,
    highlights,
    actionItems,
    insights: [],
  };
}

function generateWeeklyBriefing(context: BriefingContext): Briefing {
  const sections: BriefingSection[] = [];
  const highlights: string[] = [];
  const actionItems: ActionItem[] = [];

  // Project progress
  const activeProjects = context.projects.filter((p) => p.status === 'active');
  if (activeProjects.length > 0) {
    sections.push({
      title: 'Project Status',
      content: `You have ${activeProjects.length} active projects.`,
      priority: 'medium',
      items: activeProjects.map((project) => {
        const projectTasks = context.tasks.filter((t) => t.projectId === project.id);
        const completed = projectTasks.filter((t) => t.status === 'completed').length;
        const total = projectTasks.length;
        return {
          text: `${project.name}: ${completed}/${total} tasks completed`,
          type: 'task' as const,
          metadata: { projectId: project.id, progress: total > 0 ? completed / total : 0 },
        };
      }),
    });
  }

  // Week's completions
  const weeklyCompletions = context.tasks.filter(
    (t) => t.status === 'completed' && isRecent(t.updatedAt, 168)
  );
  highlights.push(`${weeklyCompletions.length} tasks completed this week`);

  // Upcoming deadlines
  const upcomingDeadlines = context.tasks.filter(
    (t) => t.dueDate && isDueWithinDays(t.dueDate, 7) && t.status !== 'completed'
  );

  if (upcomingDeadlines.length > 0) {
    sections.push({
      title: 'Upcoming Deadlines',
      content: `${upcomingDeadlines.length} items due in the next 7 days.`,
      priority: 'high',
      items: upcomingDeadlines.map((task) => ({
        text: `${task.title} (due ${formatDate(task.dueDate!)})`,
        type: 'task' as const,
        metadata: { taskId: task.id, dueDate: task.dueDate },
      })),
    });
  }

  // Insight trends
  const weeklyInsights = context.insights.filter((i) => isRecent(i.extractedAt, 168));
  const insightsByType = groupBy(weeklyInsights, 'type');

  const insightSummaries: InsightSummary[] = [];
  for (const [type, insights] of Object.entries(insightsByType)) {
    if (insights.length >= 2) {
      insightSummaries.push({
        type: type as Insight['type'],
        content: `${insights.length} ${type} insights captured`,
        confidence: average(insights.map((i) => i.confidence)),
        isNew: false,
      });
    }
  }

  // Stalled projects
  const stalledProjects = context.projects.filter((p) => {
    const projectTasks = context.tasks.filter((t) => t.projectId === p.id);
    const availableTasks = projectTasks.filter(
      (t) => t.status === 'inbox' || t.status === 'scheduled'
    );
    return (
      p.status === 'active' &&
      availableTasks.length > 0 &&
      !projectTasks.some((t) => t.status === 'completed' && isRecent(t.updatedAt, 168))
    );
  });

  if (stalledProjects.length > 0) {
    actionItems.push({
      title: 'Review stalled projects',
      context: `${stalledProjects.length} projects have had no progress this week`,
      suggestedAction: 'Consider prioritizing or pausing these projects',
      priority: 'medium',
    });
  }

  return {
    type: 'weekly',
    generatedAt: new Date().toISOString(),
    sections,
    highlights,
    actionItems,
    insights: insightSummaries,
  };
}

function generateContextualBriefing(context: BriefingContext): Briefing {
  // Determine most relevant content based on context
  const hasUrgentItems = context.tasks.some(
    (t) => t.priority === 'high' && t.status === 'available'
  );

  if (hasUrgentItems) {
    return generateMorningBriefing(context);
  }

  // Default to a quick status overview
  const sections: BriefingSection[] = [];
  const highlights: string[] = [];

  const availableTasks = context.tasks.filter((t) => t.status === 'available');
  highlights.push(`${availableTasks.length} tasks available`);

  const activeProjects = context.projects.filter((p) => p.status === 'active');
  highlights.push(`${activeProjects.length} active projects`);

  return {
    type: 'contextual',
    generatedAt: new Date().toISOString(),
    sections,
    highlights,
    actionItems: [],
    insights: [],
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPriorityTasks(
  tasks: Task[],
  scores?: Map<string, PriorityScore>,
  limit: number = 5
): Task[] {
  const available = tasks.filter((t) => t.status === 'available');

  if (scores) {
    return available
      .sort((a, b) => {
        const scoreA = scores.get(a.id)?.composite ?? 0;
        const scoreB = scores.get(b.id)?.composite ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  // Fallback to simple priority sorting
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return available
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
    .slice(0, limit);
}

function isDueToday(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function isDueTomorrow(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    due.getFullYear() === tomorrow.getFullYear() &&
    due.getMonth() === tomorrow.getMonth() &&
    due.getDate() === tomorrow.getDate()
  );
}

function isDueWithinDays(dueDate: string, days: number): boolean {
  const due = new Date(dueDate);
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return due <= limit;
}

function isRecent(dateStr?: string | null, hoursAgo: number = 24): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAgo);
  return date >= cutoff;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
