/**
 * Agent Run CRUD Operations
 */

import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agentRuns } from '../schema';
import { auditCreate, auditUpdate, type AuditContext, SYSTEM_CONTEXT } from '../audit';
import type { AgentRun, AgentType, AgentStatus, AgentRunRequest, AgentRunResponse } from '@/domain';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE MAPPING
// ============================================================================

function mapToAgentRun(row: typeof agentRuns.$inferSelect): AgentRun {
  return {
    id: row.id,
    agentType: row.agentType as AgentType,
    status: row.status as AgentStatus,
    objective: row.objective,
    workflowPatternId: row.workflowPatternId,
    linkedTaskIds: row.linkedTaskIds,
    linkedProjectId: row.linkedProjectId,
    retryCount: row.retryCount,
    request: row.request as AgentRunRequest | null,
    response: row.response as AgentRunResponse | null,
    error: row.error,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================================
// CREATE
// ============================================================================

export interface CreateAgentRunInput {
  agentType: AgentType;
  objective: string;
  workflowPatternId?: string;
  linkedTaskIds?: string[];
  linkedProjectId?: string;
  request?: AgentRunRequest;
}

export async function createAgentRun(
  input: CreateAgentRunInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  return auditCreate('agent_run', context, async () => {
    const [created] = await db
      .insert(agentRuns)
      .values({
        id: uuidv4(),
        agentType: input.agentType,
        status: 'pending',
        objective: input.objective,
        workflowPatternId: input.workflowPatternId ?? null,
        linkedTaskIds: input.linkedTaskIds ?? [],
        linkedProjectId: input.linkedProjectId ?? null,
        request: input.request ?? null,
      })
      .returning();

    return mapToAgentRun(created);
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getAgentRun(id: string): Promise<AgentRun | null> {
  const result = await db.query.agentRuns.findFirst({
    where: eq(agentRuns.id, id),
  });

  return result ? mapToAgentRun(result) : null;
}

export async function getAgentRunsByStatus(status: AgentStatus): Promise<AgentRun[]> {
  const result = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.status, status))
    .orderBy(desc(agentRuns.createdAt));

  return result.map(mapToAgentRun);
}

export async function getActiveAgentRuns(): Promise<AgentRun[]> {
  const result = await db
    .select()
    .from(agentRuns)
    .where(inArray(agentRuns.status, ['pending', 'running']))
    .orderBy(desc(agentRuns.createdAt));

  return result.map(mapToAgentRun);
}

export async function getAgentRunsByProject(projectId: string): Promise<AgentRun[]> {
  const result = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.linkedProjectId, projectId))
    .orderBy(desc(agentRuns.createdAt));

  return result.map(mapToAgentRun);
}

export async function getAgentRunsByType(agentType: AgentType): Promise<AgentRun[]> {
  const result = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.agentType, agentType))
    .orderBy(desc(agentRuns.createdAt));

  return result.map(mapToAgentRun);
}

export async function getAllAgentRuns(limit = 100, offset = 0): Promise<AgentRun[]> {
  const result = await db
    .select()
    .from(agentRuns)
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit)
    .offset(offset);

  return result.map(mapToAgentRun);
}

// ============================================================================
// UPDATE
// ============================================================================

export interface UpdateAgentRunInput {
  status?: AgentStatus;
  retryCount?: number;
  request?: AgentRunRequest;
  response?: AgentRunResponse;
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
}

export async function updateAgentRun(
  id: string,
  input: UpdateAgentRunInput,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  const current = await getAgentRun(id);
  if (!current) {
    throw new Error(`AgentRun ${id} not found`);
  }

  return auditUpdate(
    'agent_run',
    id,
    context,
    async () => getAgentRun(id),
    async () => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.retryCount !== undefined) updateData.retryCount = input.retryCount;
      if (input.request !== undefined) updateData.request = input.request;
      if (input.response !== undefined) updateData.response = input.response;
      if (input.error !== undefined) updateData.error = input.error;
      if (input.startedAt !== undefined) {
        updateData.startedAt = new Date(input.startedAt);
      }
      if (input.completedAt !== undefined) {
        updateData.completedAt = new Date(input.completedAt);
      }

      const [updated] = await db
        .update(agentRuns)
        .set(updateData)
        .where(eq(agentRuns.id, id))
        .returning();

      return mapToAgentRun(updated);
    }
  );
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

export async function startAgentRun(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  return updateAgentRun(
    id,
    {
      status: 'running',
      startedAt: new Date().toISOString(),
    },
    context
  );
}

export async function completeAgentRun(
  id: string,
  response: AgentRunResponse,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  return updateAgentRun(
    id,
    {
      status: 'completed',
      response,
      completedAt: new Date().toISOString(),
    },
    context
  );
}

export async function failAgentRun(
  id: string,
  error: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  const current = await getAgentRun(id);
  if (!current) {
    throw new Error(`AgentRun ${id} not found`);
  }

  return updateAgentRun(
    id,
    {
      status: 'failed',
      error,
      retryCount: current.retryCount + 1,
      completedAt: new Date().toISOString(),
    },
    context
  );
}

export async function blockAgentRun(
  id: string,
  reason: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  return updateAgentRun(
    id,
    {
      status: 'blocked',
      error: reason,
    },
    context
  );
}

export async function retryAgentRun(
  id: string,
  context: AuditContext = SYSTEM_CONTEXT
): Promise<AgentRun> {
  const current = await getAgentRun(id);
  if (!current) {
    throw new Error(`AgentRun ${id} not found`);
  }

  if (current.retryCount >= 1) {
    throw new Error('AgentRun has already been retried once (max retries reached)');
  }

  return updateAgentRun(
    id,
    {
      status: 'pending',
      error: null,
      retryCount: current.retryCount + 1,
    },
    context
  );
}
