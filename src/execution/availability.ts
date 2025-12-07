/**
 * Task Availability Calculator
 * Determines task status based on PRD Section 11 rules
 */

import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, projects } from '@/graph/schema';
import type { Task, TaskStatus, Project } from '@/domain';

/**
 * Calculate availability status for a single task
 * Rules from PRD Section 11:
 * 1. If defer_date > now → scheduled
 * 2. If any dependency incomplete → blocked
 * 3. If project.type = sequential AND task != first_incomplete → blocked
 * 4. Otherwise → available
 */
export async function calculateTaskAvailability(
  task: Task,
  project: Project | null,
  incompleteDependencyIds: string[],
  isFirstInSequentialProject: boolean
): Promise<TaskStatus> {
  // Already in terminal state
  if (task.status === 'completed' || task.status === 'dropped') {
    return task.status;
  }

  // Check defer date
  if (task.deferDate) {
    const deferDate = new Date(task.deferDate);
    if (deferDate > new Date()) {
      return 'scheduled';
    }
  }

  // Check dependencies
  if (incompleteDependencyIds.length > 0) {
    return 'blocked';
  }

  // Check sequential project constraint
  if (project && project.type === 'sequential' && !isFirstInSequentialProject) {
    return 'blocked';
  }

  // If in inbox (no project), stay in inbox
  if (!task.projectId && task.status === 'inbox') {
    return 'inbox';
  }

  return 'available';
}

/**
 * Get incomplete dependency IDs for a task
 */
export async function getIncompleteDependencies(taskId: string): Promise<string[]> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task || task.dependencies.length === 0) {
    return [];
  }

  const depTasks = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(inArray(tasks.id, task.dependencies));

  return depTasks
    .filter((t) => t.status !== 'completed')
    .map((t) => t.id);
}

/**
 * Check if task is first incomplete in its sequential project
 */
export async function isFirstIncompleteInProject(
  taskId: string,
  projectId: string
): Promise<boolean> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || project.type !== 'sequential') {
    return true; // Not relevant for parallel projects
  }

  const firstIncomplete = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(tasks.orderIndex)
    .limit(1);

  return firstIncomplete.length > 0 && firstIncomplete[0].id === taskId;
}

/**
 * Recalculate and update availability for a single task
 */
export async function recalculateTaskStatus(taskId: string): Promise<TaskStatus> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  let project: Project | null = null;
  if (task.projectId) {
    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, task.projectId),
    });
    if (projectRow) {
      project = {
        id: projectRow.id,
        name: projectRow.name,
        notes: projectRow.notes,
        type: projectRow.type,
        status: projectRow.status,
        reviewIntervalDays: projectRow.reviewIntervalDays,
        lastReviewedAt: projectRow.lastReviewedAt?.toISOString() ?? null,
        outcomeId: projectRow.outcomeId,
        createdAt: projectRow.createdAt.toISOString(),
        updatedAt: projectRow.updatedAt.toISOString(),
      };
    }
  }

  const incompleteDeps = await getIncompleteDependencies(taskId);
  const isFirst = task.projectId
    ? await isFirstIncompleteInProject(taskId, task.projectId)
    : true;

  const taskDomain: Task = {
    id: task.id,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    title: task.title,
    notes: task.notes,
    status: task.status,
    type: task.type,
    orderIndex: task.orderIndex,
    deferDate: task.deferDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    tags: task.tags,
    dependencies: task.dependencies,
    assertionIds: task.assertionIds,
    agentRunId: task.agentRunId,
    externalRefs: task.externalRefs,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };

  const newStatus = await calculateTaskAvailability(
    taskDomain,
    project,
    incompleteDeps,
    isFirst
  );

  // Update if changed
  if (newStatus !== task.status) {
    await db
      .update(tasks)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
  }

  return newStatus;
}

/**
 * Recalculate availability for all tasks in a project
 */
export async function recalculateProjectTaskStatuses(projectId: string): Promise<void> {
  const projectTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  for (const task of projectTasks) {
    await recalculateTaskStatus(task.id);
  }
}

/**
 * Recalculate availability for all tasks dependent on a completed task
 */
export async function propagateCompletionEffects(completedTaskId: string): Promise<void> {
  // Find all tasks that depend on this task
  const allTasks = await db
    .select({ id: tasks.id, dependencies: tasks.dependencies })
    .from(tasks);

  const dependentTasks = allTasks.filter((t) =>
    t.dependencies.includes(completedTaskId)
  );

  for (const task of dependentTasks) {
    await recalculateTaskStatus(task.id);
  }
}

/**
 * Get all available tasks (ready to work on)
 */
export async function getAvailableTasks(): Promise<string[]> {
  // First, ensure all statuses are current
  const allIncompleteTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(sql`${tasks.status} NOT IN ('completed', 'dropped')`);

  const availableIds: string[] = [];

  for (const task of allIncompleteTasks) {
    const status = await recalculateTaskStatus(task.id);
    if (status === 'available') {
      availableIds.push(task.id);
    }
  }

  return availableIds;
}
