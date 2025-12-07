/**
 * Audit Log System
 * Event sourcing for all graph mutations
 */

import { db } from '@/lib/db';
import { mutationEvents } from './schema';
import type { MutationType, MutationActor, MutationEvent } from '@/domain/types';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

/**
 * Audit context for tracking who/what made mutations
 */
export interface AuditContext {
  actor: MutationActor;
  actorId?: string;
}

/**
 * Default audit context for system operations
 */
export const SYSTEM_CONTEXT: AuditContext = {
  actor: 'system',
};

/**
 * Record a mutation event in the audit log
 */
export async function recordMutation(
  entityType: string,
  entityId: string,
  mutationType: MutationType,
  beforeState: unknown | null,
  afterState: unknown,
  context: AuditContext
): Promise<string> {
  const [event] = await db
    .insert(mutationEvents)
    .values({
      entityType,
      entityId,
      mutationType,
      beforeState: beforeState ?? null,
      afterState,
      actor: context.actor,
      actorId: context.actorId ?? null,
    })
    .returning({ id: mutationEvents.id });

  return event.id;
}

/**
 * Get mutation history for an entity
 */
export async function getEntityHistory(
  entityType: string,
  entityId: string,
  limit = 100
): Promise<MutationEvent[]> {
  const events = await db
    .select()
    .from(mutationEvents)
    .where(
      and(
        eq(mutationEvents.entityType, entityType),
        eq(mutationEvents.entityId, entityId)
      )
    )
    .orderBy(desc(mutationEvents.timestamp))
    .limit(limit);

  return events.map(mapToMutationEvent);
}

/**
 * Get all mutations by actor
 */
export async function getMutationsByActor(
  actor: MutationActor,
  actorId?: string,
  limit = 100
): Promise<MutationEvent[]> {
  const conditions = [eq(mutationEvents.actor, actor)];
  if (actorId) {
    conditions.push(eq(mutationEvents.actorId, actorId));
  }

  const events = await db
    .select()
    .from(mutationEvents)
    .where(and(...conditions))
    .orderBy(desc(mutationEvents.timestamp))
    .limit(limit);

  return events.map(mapToMutationEvent);
}

/**
 * Get mutations in a time range
 */
export async function getMutationsInRange(
  startTime: Date,
  endTime: Date,
  entityType?: string,
  limit = 1000
): Promise<MutationEvent[]> {
  const conditions = [
    gte(mutationEvents.timestamp, startTime),
    lte(mutationEvents.timestamp, endTime),
  ];

  if (entityType) {
    conditions.push(eq(mutationEvents.entityType, entityType));
  }

  const events = await db
    .select()
    .from(mutationEvents)
    .where(and(...conditions))
    .orderBy(desc(mutationEvents.timestamp))
    .limit(limit);

  return events.map(mapToMutationEvent);
}

/**
 * Get recent mutations across all entities
 */
export async function getRecentMutations(limit = 50): Promise<MutationEvent[]> {
  const events = await db
    .select()
    .from(mutationEvents)
    .orderBy(desc(mutationEvents.timestamp))
    .limit(limit);

  return events.map(mapToMutationEvent);
}

/**
 * Count mutations for an entity
 */
export async function countEntityMutations(
  entityType: string,
  entityId: string
): Promise<number> {
  const events = await db
    .select({ id: mutationEvents.id })
    .from(mutationEvents)
    .where(
      and(
        eq(mutationEvents.entityType, entityType),
        eq(mutationEvents.entityId, entityId)
      )
    );

  return events.length;
}

/**
 * Helper to map DB row to domain type
 */
function mapToMutationEvent(row: typeof mutationEvents.$inferSelect): MutationEvent {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    mutationType: row.mutationType as MutationType,
    beforeState: row.beforeState,
    afterState: row.afterState,
    actor: row.actor as MutationActor,
    actorId: row.actorId,
    timestamp: row.timestamp.toISOString(),
  };
}

/**
 * Wrapper to execute operation with audit logging
 */
export async function withAudit<T>(
  entityType: string,
  entityId: string,
  mutationType: MutationType,
  context: AuditContext,
  getBeforeState: () => Promise<unknown | null>,
  operation: () => Promise<T>
): Promise<T> {
  const beforeState = await getBeforeState();
  const result = await operation();

  await recordMutation(
    entityType,
    entityId,
    mutationType,
    beforeState,
    result,
    context
  );

  return result;
}

/**
 * Audit decorator for create operations
 */
export async function auditCreate<T extends { id: string }>(
  entityType: string,
  context: AuditContext,
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation();

  await recordMutation(entityType, result.id, 'create', null, result, context);

  return result;
}

/**
 * Audit decorator for update operations
 */
export async function auditUpdate<T extends { id: string }>(
  entityType: string,
  entityId: string,
  context: AuditContext,
  getBeforeState: () => Promise<T | null>,
  operation: () => Promise<T>
): Promise<T> {
  const beforeState = await getBeforeState();
  const result = await operation();

  await recordMutation(entityType, entityId, 'update', beforeState, result, context);

  return result;
}

/**
 * Audit decorator for delete operations
 */
export async function auditDelete(
  entityType: string,
  entityId: string,
  context: AuditContext,
  getBeforeState: () => Promise<unknown>,
  operation: () => Promise<void>
): Promise<void> {
  const beforeState = await getBeforeState();
  await operation();

  await recordMutation(
    entityType,
    entityId,
    'delete',
    beforeState,
    { deleted: true },
    context
  );
}
