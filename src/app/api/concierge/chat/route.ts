/**
 * Concierge Chat API Route
 * Main conversational interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { concierge } from '@/concierge';

export const maxDuration = 10;

// ============================================================================
// POST /api/concierge/chat - Process user message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or generate session ID
    const sessionId = body.sessionId || `session_${Date.now()}`;

    // Process the message
    const response = await concierge.processInput(sessionId, body.message);

    return NextResponse.json({
      sessionId,
      message: response.message,
      mode: response.mode,
      intent: {
        category: response.intent.category,
        action: response.intent.action,
        confidence: response.intent.confidence,
      },
      suggestions: response.suggestions,
      needsClarification: response.needsClarification,
      dispatch: response.dispatch
        ? {
            shouldDispatch: response.dispatch.shouldDispatch,
            agentType: response.dispatch.agentType,
            reason: response.dispatch.reason,
          }
        : null,
    });
  } catch (error) {
    console.error('POST /api/concierge/chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process message' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/concierge/chat - Clear conversation
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    concierge.clearConversation(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/concierge/chat error:', error);
    return NextResponse.json(
      { error: 'Failed to clear conversation' },
      { status: 500 }
    );
  }
}
