/**
 * Tasks API Route - Single Task Operations
 * GET, PUT, DELETE for individual tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskSchema } from '@/domain';
import { getTask, updateTask, deleteTask } from '@/graph/operations';

export const maxDuration = 10;

// ============================================================================
// GET /api/tasks/[id] - Get a single task
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await getTask(id);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/tasks/[id] - Update a task
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if task exists
    const existing = await getTask(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Validate update
    const merged = { ...existing, ...body, updatedAt: new Date().toISOString() };
    const validation = taskSchema.safeParse(merged);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const task = await updateTask(id, body, {
      actor: 'system',
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('PUT /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/tasks/[id] - Delete a task
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if task exists
    const existing = await getTask(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    await deleteTask(id, {
      actor: 'system',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete task' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/tasks/[id] - Partial update (e.g., complete task)
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if task exists
    const existing = await getTask(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Handle special operations
    if (body.action === 'complete') {
      const task = await updateTask(
        id,
        { status: 'completed' },
        { actor: 'system' }
      );
      return NextResponse.json({ task });
    }

    if (body.action === 'block') {
      const task = await updateTask(
        id,
        { status: 'blocked' },
        {
          actor: 'system',
        }
      );
      return NextResponse.json({ task });
    }

    // Regular partial update
    const task = await updateTask(id, body, {
      actor: 'system',
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}
