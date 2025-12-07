/**
 * Outcome CRUD Operations
 */

import { eq, desc, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { outcomes, projects, assertions } from '../schema';
import { auditCreate, auditUpdate, auditDelete, type AuditContext, SYSTEM_CONTEXT } from '../audit';
import type { Outcome, OutcomeInput, OutcomeUpdate } from '@/domain';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE MAPPING
// ============================================================================

function mapToOutcome(row: typeof outcomes.$inferSelect): Outcome {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================================
// CREATE
// ============================================================================

export async function createOutcome(
  input: OutcomeInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Outcome> {
  return auditCreate('outcome', context, async () => {
    const [created] = await db
      .insert(outcomes)
      .values({
        id: uuidv4(),
        title: input.title,
        description: input.description ?? null,
        status: 'active',
      })
      .returning();

    return mapToOutcome(created);
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getOutcome(id: string): Promise<Outcome | null> {
  const result = await db.query.outcomes.findFirst({
    where: eq(outcomes.id, id),
  });

  return result ? mapToOutcome(result) : null;
}

export async function getOutcomesByStatus(status: Outcome['status']): Promise<Outcome[]> {
  const result = await db
    .select()
    .from(outcomes)
    .where(eq(outcomes.status, status))
    .orderBy(desc(outcomes.updatedAt));

  return result.map(mapToOutcome);
}

export async function getActiveOutcomes(): Promise<Outcome[]> {
  return getOutcomesByStatus('active');
}

export async function getAllOutcomes(limit = 100, offset = 0): Promise<Outcome[]> {
  const result = await db
    .select()
    .from(outcomes)
    .orderBy(desc(outcomes.updatedAt))
    .limit(limit)
    .offset(offset);

  return result.map(mapToOutcome);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateOutcome(
  id: string,
  input: OutcomeUpdate,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Outcome> {
  const current = await getOutcome(id);
  if (!current) {
    throw new Error(`Outcome ${id} not found`);
  }

  return auditUpdate(
    'outcome',
    id,
    context,
    async () => getOutcome(id),
    async () => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;

      const [updated] = await db
        .update(outcomes)
        .set(updateData)
        .where(eq(outcomes.id, id))
        .returning();

      return mapToOutcome(updated);
    }
  );
}

export async function achieveOutcome(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Outcome> {
  return updateOutcome(id, { status: 'achieved' }, context);
}

export async function abandonOutcome(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Outcome> {
  return updateOutcome(id, { status: 'abandoned' }, context);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteOutcome(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  // Check for linked projects
  const linkedProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.outcomeId, id));

  if (linkedProjects.length > 0) {
    throw new Error(
      `Cannot delete outcome: ${linkedProjects.length} projects are linked to it`
    );
  }

  // Check for linked assertions
  const linkedAssertions = await db
    .select({ id: assertions.id })
    .from(assertions)
    .where(eq(assertions.outcomeId, id));

  if (linkedAssertions.length > 0) {
    throw new Error(
      `Cannot delete outcome: ${linkedAssertions.length} assertions are linked to it`
    );
  }

  await auditDelete(
    'outcome',
    id,
    context,
    async () => getOutcome(id),
    async () => {
      await db.delete(outcomes).where(eq(outcomes.id, id));
    }
  );
}
