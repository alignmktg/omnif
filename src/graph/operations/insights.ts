/**
 * Insight CRUD Operations
 */

import { eq, desc, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { insights } from '../schema';
import { auditCreate, auditUpdate, auditDelete, type AuditContext, SYSTEM_CONTEXT } from '../audit';
import type { Insight, InsightInput, InsightType } from '@/domain';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE MAPPING
// ============================================================================

function mapToInsight(row: typeof insights.$inferSelect): Insight {
  return {
    id: row.id,
    type: row.type as InsightType,
    content: row.content,
    confidence: row.confidence / 100, // Convert from 0-100 to 0-1
    sourceRefs: row.sourceRefs,
    extractedAt: row.extractedAt.toISOString(),
    lastReinforcedAt: row.lastReinforcedAt.toISOString(),
    reinforcementCount: row.reinforcementCount,
  };
}

// ============================================================================
// CREATE
// ============================================================================

export async function createInsight(
  input: InsightInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Insight> {
  return auditCreate('insight', context, async () => {
    const [created] = await db
      .insert(insights)
      .values({
        id: uuidv4(),
        type: input.type,
        content: input.content,
        confidence: Math.round(input.confidence * 100), // Convert to 0-100
        sourceRefs: input.sourceRefs ?? [],
      })
      .returning();

    return mapToInsight(created);
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getInsight(id: string): Promise<Insight | null> {
  const result = await db.query.insights.findFirst({
    where: eq(insights.id, id),
  });

  return result ? mapToInsight(result) : null;
}

export async function getInsightsByType(type: InsightType): Promise<Insight[]> {
  const result = await db
    .select()
    .from(insights)
    .where(eq(insights.type, type))
    .orderBy(desc(insights.confidence));

  return result.map(mapToInsight);
}

export async function getHighConfidenceInsights(minConfidence = 0.7): Promise<Insight[]> {
  const minConfidenceInt = Math.round(minConfidence * 100);
  const result = await db
    .select()
    .from(insights)
    .where(gte(insights.confidence, minConfidenceInt))
    .orderBy(desc(insights.confidence));

  return result.map(mapToInsight);
}

export async function getRecentInsights(limit = 50): Promise<Insight[]> {
  const result = await db
    .select()
    .from(insights)
    .orderBy(desc(insights.extractedAt))
    .limit(limit);

  return result.map(mapToInsight);
}

export async function getAllInsights(limit = 100, offset = 0): Promise<Insight[]> {
  const result = await db
    .select()
    .from(insights)
    .orderBy(desc(insights.lastReinforcedAt))
    .limit(limit)
    .offset(offset);

  return result.map(mapToInsight);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function reinforceInsight(
  id: string,
  additionalSourceRefs: string[] = [],
  confidenceBoost = 0.05,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Insight> {
  const current = await getInsight(id);
  if (!current) {
    throw new Error(`Insight ${id} not found`);
  }

  const newConfidence = Math.min(1, current.confidence + confidenceBoost);
  const newSourceRefs = [...new Set([...current.sourceRefs, ...additionalSourceRefs])];

  return auditUpdate(
    'insight',
    id,
    context,
    async () => getInsight(id),
    async () => {
      const [updated] = await db
        .update(insights)
        .set({
          confidence: Math.round(newConfidence * 100),
          sourceRefs: newSourceRefs,
          lastReinforcedAt: new Date(),
          reinforcementCount: current.reinforcementCount + 1,
        })
        .where(eq(insights.id, id))
        .returning();

      return mapToInsight(updated);
    }
  );
}

export async function updateInsightConfidence(
  id: string,
  confidence: number,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<Insight> {
  const current = await getInsight(id);
  if (!current) {
    throw new Error(`Insight ${id} not found`);
  }

  return auditUpdate(
    'insight',
    id,
    context,
    async () => getInsight(id),
    async () => {
      const [updated] = await db
        .update(insights)
        .set({
          confidence: Math.round(confidence * 100),
        })
        .where(eq(insights.id, id))
        .returning();

      return mapToInsight(updated);
    }
  );
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteInsight(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<void> {
  await auditDelete(
    'insight',
    id,
    context,
    async () => getInsight(id),
    async () => {
      await db.delete(insights).where(eq(insights.id, id));
    }
  );
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Find similar insights by content (basic text matching)
 */
export async function findSimilarInsights(
  content: string,
  type?: InsightType
): Promise<Insight[]> {
  // Simple keyword-based search for MVP
  const searchTerms = content.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  const allInsights = type
    ? await getInsightsByType(type)
    : await getAllInsights(500, 0);

  return allInsights.filter((insight) => {
    const insightTerms = insight.content.toLowerCase();
    return searchTerms.some((term) => insightTerms.includes(term));
  });
}
