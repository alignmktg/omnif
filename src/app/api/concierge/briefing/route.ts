/**
 * Concierge Briefing API Route
 * Generate briefings on demand
 */

import { NextRequest, NextResponse } from 'next/server';
import { concierge } from '@/concierge';
import type { BriefingType } from '@/concierge';

export const maxDuration = 10;

// ============================================================================
// GET /api/concierge/briefing - Generate a briefing
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'contextual') as BriefingType;

    const validTypes: BriefingType[] = [
      'morning',
      'evening',
      'weekly',
      'on_demand',
      'contextual',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid briefing type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const briefing = await concierge.generateBriefing(type);

    return NextResponse.json({ briefing });
  } catch (error) {
    console.error('GET /api/concierge/briefing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
