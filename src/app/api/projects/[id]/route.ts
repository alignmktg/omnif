/**
 * Projects API Route - Single Project Operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectSchema } from '@/domain';
import { getProject, updateProject, deleteProject } from '@/graph/operations';

export const maxDuration = 10;

// ============================================================================
// GET /api/projects/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/projects/[id]
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getProject(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const merged = { ...existing, ...body, updatedAt: new Date().toISOString() };
    const validation = projectSchema.safeParse(merged);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const project = await updateProject(id, body, {
      actor: 'system',
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('PUT /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/projects/[id]
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getProject(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    await deleteProject(id, {
      actor: 'system',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete project' },
      { status: 500 }
    );
  }
}
