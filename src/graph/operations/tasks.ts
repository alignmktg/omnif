/**
 * Task CRUD Operations
 * With DAG validation and audit logging
 */

import { eq, inArray, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, projects } from '../schema';
import { validateDependencies, validateDateConstraints } from '../dag';
import { auditCreate, auditUpdate, auditDelete, type AuditContext, SYSTEM_CONTEXT } from '../audit';
import type { Task, TaskInput, TaskUpdate } from '@/domain';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE MAPPING
// ============================================================================

function mapToTask(row: typeof tasks.$inferSelect): Task {
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

// ============================================================================
// CREATE
// ============================================================================

export async function createTask(
  input: TaskInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Task> {
  const taskId = uuidv4();

  // Validate dependencies
  if (input.dependencies && input.dependencies.length > 0) {
    const dagResult = await validateDependencies(taskId, input.dependencies);
    if (!dagResult.valid) {
      throw new Error(dagResult.error);
    }
  }

  // Validate dates
  const dateResult = validateDateConstraints(
    input.deferDate ?? null,
    input.dueDate ?? null
  );
  if (!dateResult.valid) {
    throw new Error(dateResult.error);
  }

  // Get next order index for the project
  let orderIndex = 0;
  if (input.projectId) {
    const lastTask = await db
      .select({ orderIndex: tasks.orderIndex })
      .from(tasks)
      .where(eq(tasks.projectId, input.projectId))
      .orderBy(desc(tasks.orderIndex))
      .limit(1);
    orderIndex = lastTask.length > 0 ? lastTask[0].orderIndex + 1 : 0;
  }

  return auditCreate('task', context, async () => {
    const [created] = await db
      .insert(tasks)
      .values({
        id: taskId,
        projectId: input.projectId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        title: input.title,
        notes: input.notes ?? null,
        status: 'inbox',
        type: input.type ?? 'user_action',
        orderIndex,
        deferDate: input.deferDate ? new Date(input.deferDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        priority: input.priority ?? 'normal',
        tags: input.tags ?? [],
        dependencies: input.dependencies ?? [],
        assertionIds: input.assertionIds ?? [],
        externalRefs: input.externalRefs ?? [],
      })
      .returning();

    return mapToTask(created);
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getTask(id: string): Promise<Task | null> {
  const result = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  return result ? mapToTask(result) : null;
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.orderIndex));

  return result.map(mapToTask);
}

export async function getTasksByStatus(status: Task['status']): Promise<Task[]> {
  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, status))
    .orderBy(desc(tasks.priority), asc(tasks.dueDate));

  return result.map(mapToTask);
}

export async function getInboxTasks(): Promise<Task[]> {
  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, 'inbox'), isNull(tasks.projectId)))
    .orderBy(desc(tasks.createdAt));

  return result.map(mapToTask);
}

export async function getTasksByTags(tags: string[]): Promise<Task[]> {
  // Using JSON contains check
  const result = await db
    .select()
    .from(tasks)
    .where(
      sql`${tasks.tags} ?| array[${sql.join(
        tags.map((t) => sql`${t}`),
        sql`, `
      )}]`
    );

  return result.map(mapToTask);
}

export async function getOverdueTasks(): Promise<Task[]> {
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

  return result.map(mapToTask);
}

export async function getTasksDueToday(): Promise<Task[]> {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} >= ${startOfDay}`,
        sql`${tasks.dueDate} <= ${endOfDay}`,
        sql`${tasks.status} NOT IN ('completed', 'dropped')`
      )
    )
    .orderBy(asc(tasks.dueDate));

  return result.map(mapToTask);
}

export async function getAllTasks(limit = 100, offset = 0): Promise<Task[]> {
  const result = await db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .offset(offset);

  return result.map(mapToTask);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateTask(
  id: string,
  input: TaskUpdate,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Task> {
  // Validate dependencies if being updated
  if (input.dependencies !== undefined) {
    const dagResult = await validateDependencies(id, input.dependencies);
    if (!dagResult.valid) {
      throw new Error(dagResult.error);
    }
  }

  // Get current task for date validation
  const current = await getTask(id);
  if (!current) {
    throw new Error(`Task ${id} not found`);
  }

  // Validate dates
  const deferDate = input.deferDate !== undefined ? input.deferDate : current.deferDate;
  const dueDate = input.dueDate !== undefined ? input.dueDate : current.dueDate;
  const dateResult = validateDateConstraints(deferDate, dueDate);
  if (!dateResult.valid) {
    throw new Error(dateResult.error);
  }

  return auditUpdate(
    'task',
    id,
    context,
    async () => getTask(id),
    async () => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.projectId !== undefined) updateData.projectId = input.projectId;
      if (input.parentTaskId !== undefined) updateData.parentTaskId = input.parentTaskId;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.orderIndex !== undefined) updateData.orderIndex = input.orderIndex;
      if (input.deferDate !== undefined) {
        updateData.deferDate = input.deferDate ? new Date(input.deferDate) : null;
      }
      if (input.dueDate !== undefined) {
        updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      if (input.estimatedMinutes !== undefined)
        updateData.estimatedMinutes = input.estimatedMinutes;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.dependencies !== undefined) updateData.dependencies = input.dependencies;
      if (input.assertionIds !== undefined) updateData.assertionIds = input.assertionIds;
      if (input.agentRunId !== undefined) updateData.agentRunId = input.agentRunId;
      if (input.externalRefs !== undefined) updateData.externalRefs = input.externalRefs;

      const [updated] = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning();

      return mapToTask(updated);
    }
  );
}

export async function completeTask(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Task> {
  return updateTask(id, { status: 'completed' }, context);
}

export async function dropTask(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Task> {
  return updateTask(id, { status: 'dropped' }, context);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteTask(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  // Check for dependent tasks
  const allTasks = await db.select().from(tasks);
  const dependentTasks = allTasks.filter((t) => t.dependencies.includes(id));

  if (dependentTasks.length > 0) {
    throw new Error(
      `Cannot delete task: ${dependentTasks.length} other tasks depend on it`
    );
  }

  await auditDelete(
    'task',
    id,
    context,
    async () => getTask(id),
    async () => {
      await db.delete(tasks).where(eq(tasks.id, id));
    }
  );
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export async function createTasks(
  inputs: TaskInput[],
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Task[]> {
  const results: Task[] = [];
  for (const input of inputs) {
    results.push(await createTask(input, context));
  }
  return results;
}

export async function deleteTasks(
  ids: string[],
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  for (const id of ids) {
    await deleteTask(id, context);
  }
}

export async function reorderTasks(
  projectId: string,
  orderedIds: string[],
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await updateTask(orderedIds[i], { orderIndex: i }, context);
  }
}
