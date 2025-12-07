/**
 * Insights API Route
 * CRUD operations for insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { insightSchema, type InsightType } from '@/domain';
import { createInsight, getAllInsights, getInsightsByType, getHighConfidenceInsights } from '@/graph/operations';

export const maxDuration = 10;

// ============================================================================
// GET /api/insights - List insights with filters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const type = searchParams.get('type') as InsightType | null;
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let results;

    if (type) {
      results = await getInsightsByType(type);
    } else if (minConfidence > 0) {
      results = await getHighConfidenceInsights(minConfidence);
    } else {
      results = await getAllInsights(limit, offset);
    }

    // Apply additional filtering if needed
    if (type && minConfidence > 0) {
      results = results.filter((i) => i.confidence >= minConfidence);
    }

    // Apply pagination if we got all insights
    if (!type && minConfidence === 0) {
      // Already paginated from getAllInsights
    } else {
      results = results.slice(offset, offset + limit);
    }

    return NextResponse.json({
      insights: results,
      pagination: {
        limit,
        offset,
        total: results.length,
      },
    });
  } catch (error) {
    console.error('GET /api/insights error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/insights - Create an insight
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = insightSchema.safeParse({
      ...body,
      id: body.id || `insight_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const insight = await createInsight(validation.data, {
      actor: 'system',
    });

    return NextResponse.json({ insight }, { status: 201 });
  } catch (error) {
    console.error('POST /api/insights error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create insight' },
      { status: 500 }
    );
  }
}
