/**
 * Project CRUD Operations
 */

import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, tasks } from '../schema';
import { auditCreate, auditUpdate, auditDelete, type AuditContext, SYSTEM_CONTEXT } from '../audit';
import type { Project, ProjectInput, ProjectUpdate, Task } from '@/domain';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE MAPPING
// ============================================================================

function mapToProject(row: typeof projects.$inferSelect): Project {
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
// CREATE
// ============================================================================

export async function createProject(
  input: ProjectInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Project> {
  return auditCreate('project', context, async () => {
    const [created] = await db
      .insert(projects)
      .values({
        id: uuidv4(),
        name: input.name,
        notes: input.notes ?? null,
        type: input.type ?? 'parallel',
        status: 'active',
        reviewIntervalDays: input.reviewIntervalDays ?? null,
        outcomeId: input.outcomeId ?? null,
      })
      .returning();

    return mapToProject(created);
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getProject(id: string): Promise<Project | null> {
  const result = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  return result ? mapToProject(result) : null;
}

export async function getProjectsByStatus(status: Project['status']): Promise<Project[]> {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.status, status))
    .orderBy(asc(projects.name));

  return result.map(mapToProject);
}

export async function getActiveProjects(): Promise<Project[]> {
  return getProjectsByStatus('active');
}

export async function getAllProjects(limit = 100, offset = 0): Promise<Project[]> {
  const result = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(limit)
    .offset(offset);

  return result.map(mapToProject);
}

export async function getProjectsByOutcome(outcomeId: string): Promise<Project[]> {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.outcomeId, outcomeId))
    .orderBy(asc(projects.name));

  return result.map(mapToProject);
}

export async function getProjectsForReview(): Promise<Project[]> {
  const now = new Date();

  const result = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.status, 'active'),
        sql`(
          ${projects.lastReviewedAt} IS NULL OR
          ${projects.lastReviewedAt} + (${projects.reviewIntervalDays} || ' days')::interval < ${now}
        )`
      )
    )
    .orderBy(asc(projects.lastReviewedAt));

  return result.map(mapToProject);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateProject(
  id: string,
  input: ProjectUpdate,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Project> {
  const current = await getProject(id);
  if (!current) {
    throw new Error(`Project ${id} not found`);
  }

  return auditUpdate(
    'project',
    id,
    context,
    async () => getProject(id),
    async () => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.reviewIntervalDays !== undefined)
        updateData.reviewIntervalDays = input.reviewIntervalDays;
      if (input.lastReviewedAt !== undefined) {
        updateData.lastReviewedAt = input.lastReviewedAt
          ? new Date(input.lastReviewedAt)
          : null;
      }
      if (input.outcomeId !== undefined) updateData.outcomeId = input.outcomeId;

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      return mapToProject(updated);
    }
  );
}

export async function markProjectReviewed(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Project> {
  return updateProject(id, { lastReviewedAt: new Date().toISOString() }, context);
}

export async function completeProject(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Project> {
  return updateProject(id, { status: 'completed' }, context);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteProject(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  // Check for tasks
  const projectTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, id));

  if (projectTasks.length > 0) {
    throw new Error(
      `Cannot delete project: ${projectTasks.length} tasks are associated with it`
    );
  }

  await auditDelete(
    'project',
    id,
    context,
    async () => getProject(id),
    async () => {
      await db.delete(projects).where(eq(projects.id, id));
    }
  );
}

// ============================================================================
// SEQUENTIAL PROJECT HELPERS
// ============================================================================

/**
 * Get the first available task in a sequential project
 */
export async function getFirstAvailableTask(projectId: string): Promise<Task | null> {
  const project = await getProject(projectId);
  if (!project || project.type !== 'sequential') {
    return null;
  }

  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(asc(tasks.orderIndex))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];
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

/**
 * Check if a task is available in its project context
 */
export async function isTaskAvailableInProject(
  taskId: string,
  projectId: string
): Promise<boolean> {
  const project = await getProject(projectId);
  if (!project) return false;

  // In parallel projects, all tasks are available
  if (project.type === 'parallel') return true;

  // In sequential projects, only first incomplete task is available
  const firstTask = await getFirstAvailableTask(projectId);
  return firstTask?.id === taskId;
}
