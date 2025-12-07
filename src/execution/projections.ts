/**
 * Projection Generators
 * Derived views of the execution graph (PRD Section 11)
 */

import { eq, and, sql, desc, asc, isNull, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, projects, outcomes } from '@/graph/schema';
import type { Task, Project, ProjectTree, ForecastDay, CalendarEvent } from '@/domain';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapTaskRow(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    parentTaskId: row.parentTaskId,
    title: row.title,
    notes: row.notes,
    status: row.status,
    type: row.type,
    orderIndex: row.orderIndex,
    deferDate: row.deferDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    estimatedMinutes: row.estimatedMinutes,
    priority: row.priority,
    tags: row.tags,
    dependencies: row.dependencies,
    assertionIds: row.assertionIds,
    agentRunId: row.agentRunId,
    externalRefs: row.externalRefs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProjectRow(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    type: row.type,
    status: row.status,
    reviewIntervalDays: row.reviewIntervalDays,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    outcomeId: row.outcomeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================================
// INBOX PROJECTION
// ============================================================================

/**
 * Get inbox tasks - tasks with no project assignment
 */
export async function getInboxProjection(): Promise<Task[]> {
  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.projectId),
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(desc(tasks.createdAt));

  return result.map(mapTaskRow);
}

// ============================================================================
// PROJECTS PROJECTION
// ============================================================================

/**
 * Get hierarchical project tree with tasks
 */
export async function getProjectsProjection(): Promise<ProjectTree[]> {
  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, 'active'))
    .orderBy(asc(projects.name));

  const allTasks = await db
    .select()
    .from(tasks)
    .where(sql`${tasks.status} NOT IN ('completed', 'dropped')`)
    .orderBy(asc(tasks.orderIndex));

  const tasksByProject = new Map<string, Task[]>();
  for (const task of allTasks) {
    if (task.projectId) {
      if (!tasksByProject.has(task.projectId)) {
        tasksByProject.set(task.projectId, []);
      }
      tasksByProject.get(task.projectId)!.push(mapTaskRow(task));
    }
  }

  return allProjects.map((project) => ({
    project: mapProjectRow(project),
    tasks: tasksByProject.get(project.id) || [],
    childProjects: [], // Flat structure for now, can extend later
  }));
}

/**
 * Get single project with its tasks
 */
export async function getProjectWithTasks(
  projectId: string
): Promise<{ project: Project; tasks: Task[] } | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return null;

  const projectTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.orderIndex));

  return {
    project: mapProjectRow(project),
    tasks: projectTasks.map(mapTaskRow),
  };
}

// ============================================================================
// TAGS PROJECTION
// ============================================================================

/**
 * Get tasks grouped by tag
 */
export async function getTagsProjection(): Promise<Map<string, Task[]>> {
  const allTasks = await db
    .select()
    .from(tasks)
    .where(sql`${tasks.status} NOT IN ('completed', 'dropped')`);

  const tasksByTag = new Map<string, Task[]>();

  for (const task of allTasks) {
    for (const tag of task.tags) {
      if (!tasksByTag.has(tag)) {
        tasksByTag.set(tag, []);
      }
      tasksByTag.get(tag)!.push(mapTaskRow(task));
    }
  }

  return tasksByTag;
}

/**
 * Get all unique tags with task counts
 */
export async function getTagSummary(): Promise<Array<{ tag: string; count: number }>> {
  const tagsMap = await getTagsProjection();
  return Array.from(tagsMap.entries())
    .map(([tag, tagTasks]) => ({ tag, count: tagTasks.length }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get tasks by specific tag
 */
export async function getTasksByTag(tag: string): Promise<Task[]> {
  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        sql`${tasks.tags} ? ${tag}`,
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(desc(tasks.priority), asc(tasks.dueDate));

  return result.map(mapTaskRow);
}

// ============================================================================
// FORECAST PROJECTION
// ============================================================================

/**
 * Get forecast - tasks organized by due date
 */
export async function getForecastProjection(
  days: number = 14,
  calendarEvents: CalendarEvent[] = []
): Promise<ForecastDay[]> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  // Get tasks with due dates in range
  const dueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} IS NOT NULL`,
        gte(tasks.dueDate, now),
        lte(tasks.dueDate, endDate),
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(asc(tasks.dueDate));

  // Get overdue tasks
  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} IS NOT NULL`,
        sql`${tasks.dueDate} < ${now}`,
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(asc(tasks.dueDate));

  // Group by date
  const forecast: ForecastDay[] = [];

  // Add overdue as first entry if any
  if (overdueTasks.length > 0) {
    forecast.push({
      date: 'overdue',
      tasks: overdueTasks.map(mapTaskRow),
      events: [],
    });
  }

  // Group tasks by date
  const tasksByDate = new Map<string, Task[]>();
  for (const task of dueTasks) {
    if (task.dueDate) {
      const dateKey = task.dueDate.toISOString().split('T')[0];
      if (!tasksByDate.has(dateKey)) {
        tasksByDate.set(dateKey, []);
      }
      tasksByDate.get(dateKey)!.push(mapTaskRow(task));
    }
  }

  // Group calendar events by date
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of calendarEvents) {
    const dateKey = event.start.split('T')[0];
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  // Build forecast days
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];

    const dayTasks = tasksByDate.get(dateKey) || [];
    const dayEvents = eventsByDate.get(dateKey) || [];

    if (dayTasks.length > 0 || dayEvents.length > 0) {
      forecast.push({
        date: dateKey,
        tasks: dayTasks,
        events: dayEvents,
      });
    }
  }

  return forecast;
}

/**
 * Get tasks due today
 */
export async function getDueToday(): Promise<Task[]> {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.dueDate, startOfDay),
        lte(tasks.dueDate, endOfDay),
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(asc(tasks.dueDate));

  return result.map(mapTaskRow);
}

/**
 * Get overdue tasks
 */
export async function getOverdue(): Promise<Task[]> {
  const now = new Date();

  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} < ${now}`,
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(asc(tasks.dueDate));

  return result.map(mapTaskRow);
}

// ============================================================================
// REVIEW PROJECTION
// ============================================================================

/**
 * Get projects due for review
 */
export async function getReviewProjection(): Promise<Project[]> {
  const now = new Date();

  const result = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.status, 'active'),
        sql`${projects.reviewIntervalDays} IS NOT NULL`,
        sql`(
          ${projects.lastReviewedAt} IS NULL OR
          ${projects.lastReviewedAt} + (${projects.reviewIntervalDays} || ' days')::interval < ${now}
        )`
      )
    )
    .orderBy(asc(projects.lastReviewedAt));

  return result.map(mapProjectRow);
}

/**
 * Get projects that have never been reviewed
 */
export async function getNeverReviewed(): Promise<Project[]> {
  const result = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.status, 'active'),
        isNull(projects.lastReviewedAt)
      )
    )
    .orderBy(asc(projects.createdAt));

  return result.map(mapProjectRow);
}

// ============================================================================
// SUMMARY PROJECTIONS
// ============================================================================

/**
 * Get summary counts for dashboard
 */
export async function getProjectionSummary(): Promise<{
  inbox: number;
  available: number;
  scheduled: number;
  blocked: number;
  dueToday: number;
  overdue: number;
  projectsForReview: number;
}> {
  const [inbox, available, scheduled, blocked, dueToday, overdue, projectsForReview] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            isNull(tasks.projectId),
            sql`${tasks.status} NOT IN ('completed', 'dropped')`
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.status, 'available')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.status, 'scheduled')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.status, 'blocked')),
      getDueToday(),
      getOverdue(),
      getReviewProjection(),
    ]);

  return {
    inbox: Number(inbox[0]?.count || 0),
    available: Number(available[0]?.count || 0),
    scheduled: Number(scheduled[0]?.count || 0),
    blocked: Number(blocked[0]?.count || 0),
    dueToday: dueToday.length,
    overdue: overdue.length,
    projectsForReview: projectsForReview.length,
  };
}
