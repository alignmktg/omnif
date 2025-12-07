/**
 * Assertion CRUD Operations
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assertions } from '../schema';
import { auditCreate, auditDelete, type AuditContext, SYSTEM_CONTEXT } from '../audit';
import type { Assertion, AssertionInput } from '@/domain';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE MAPPING
// ============================================================================

function mapToAssertion(row: typeof assertions.$inferSelect): Assertion {
  return {
    id: row.id,
    content: row.content,
    type: row.type,
    outcomeId: row.outcomeId,
    createdAt: row.createdAt.toISOString(),
  };
}

// ============================================================================
// CREATE
// ============================================================================

export async function createAssertion(
  input: AssertionInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Assertion> {
  return auditCreate('assertion', context, async () => {
    const [created] = await db
      .insert(assertions)
      .values({
        id: uuidv4(),
        content: input.content,
        type: input.type,
        outcomeId: input.outcomeId ?? null,
      })
      .returning();

    return mapToAssertion(created);
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getAssertion(id: string): Promise<Assertion | null> {
  const result = await db.query.assertions.findFirst({
    where: eq(assertions.id, id),
  });

  return result ? mapToAssertion(result) : null;
}

export async function getAssertionsByType(type: Assertion['type']): Promise<Assertion[]> {
  const result = await db
    .select()
    .from(assertions)
    .where(eq(assertions.type, type))
    .orderBy(desc(assertions.createdAt));

  return result.map(mapToAssertion);
}

export async function getAssertionsByOutcome(outcomeId: string): Promise<Assertion[]> {
  const result = await db
    .select()
    .from(assertions)
    .where(eq(assertions.outcomeId, outcomeId))
    .orderBy(desc(assertions.createdAt));

  return result.map(mapToAssertion);
}

export async function getAllAssertions(limit = 100, offset = 0): Promise<Assertion[]> {
  const result = await db
    .select()
    .from(assertions)
    .orderBy(desc(assertions.createdAt))
    .limit(limit)
    .offset(offset);

  return result.map(mapToAssertion);
}

export async function getAssertionsByIds(ids: string[]): Promise<Assertion[]> {
  if (ids.length === 0) return [];

  const result = await db.query.assertions.findMany({
    where: (assertions, { inArray }) => inArray(assertions.id, ids),
  });

  return result.map(mapToAssertion);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteAssertion(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  await auditDelete(
    'assertion',
    id,
    context,
    async () => getAssertion(id),
    async () => {
      await db.delete(assertions).where(eq(assertions.id, id));
    }
  );
}
