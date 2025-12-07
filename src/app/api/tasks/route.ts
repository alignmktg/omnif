/**
 * Tasks API Route
 * CRUD operations for tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskSchema, type Task } from '@/domain';
import { createTask } from '@/graph/operations';
import { db } from '@/lib/db';
import { tasks } from '@/graph/schema';
import { eq, and, or, isNull, gte, lte, inArray } from 'drizzle-orm';

export const maxDuration = 10;

// ============================================================================
// GET /api/tasks - List tasks with filters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = searchParams.get('status');
    const projectId = searchParams.get('projectId');
    const priority = searchParams.get('priority');
    const tags = searchParams.getAll('tag');
    const dueBefore = searchParams.get('dueBefore');
    const dueAfter = searchParams.get('dueAfter');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(tasks.status, status as Task['status']));
    }

    if (projectId) {
      if (projectId === 'null') {
        conditions.push(isNull(tasks.projectId));
      } else {
        conditions.push(eq(tasks.projectId, projectId));
      }
    }

    if (priority) {
      conditions.push(eq(tasks.priority, priority as Task['priority']));
    }

    if (dueBefore) {
      conditions.push(lte(tasks.dueDate, new Date(dueBefore)));
    }

    if (dueAfter) {
      conditions.push(gte(tasks.dueDate, new Date(dueAfter)));
    }

    // Execute query
    const query = db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(tasks.createdAt);

    const results = await query;

    // Filter by tags if specified (done in memory since tags is JSON)
    let filteredResults = results;
    if (tags.length > 0) {
      filteredResults = results.filter((task) =>
        tags.some((tag) => (task.tags as string[])?.includes(tag))
      );
    }

    return NextResponse.json({
      tasks: filteredResults,
      pagination: {
        limit,
        offset,
        total: filteredResults.length,
      },
    });
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/tasks - Create a task
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = taskSchema.safeParse({
      ...body,
      id: body.id || `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: body.status || 'pending',
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const task = await createTask(validation.data, {
      actor: 'system',
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    );
  }
}
