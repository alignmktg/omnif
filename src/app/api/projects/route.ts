/**
 * Projects API Route
 * CRUD operations for projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectSchema, type Project } from '@/domain';
import { createProject } from '@/graph/operations';
import { db } from '@/lib/db';
import { projects } from '@/graph/schema';
import { eq, and } from 'drizzle-orm';

export const maxDuration = 10;

// ============================================================================
// GET /api/projects - List projects with filters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(projects.status, status as Project['status']));
    }

    if (type) {
      conditions.push(eq(projects.type, type as Project['type']));
    }

    // Execute query
    const query = db
      .select()
      .from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(projects.createdAt);

    const results = await query;

    return NextResponse.json({
      projects: results,
      pagination: {
        limit,
        offset,
        total: results.length,
      },
    });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/projects - Create a project
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = projectSchema.safeParse({
      ...body,
      id: body.id || `project_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: body.status || 'active',
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const project = await createProject(validation.data, {
      actor: 'system',
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
