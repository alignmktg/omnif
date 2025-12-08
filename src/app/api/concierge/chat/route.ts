/**
 * Concierge Chat API Route
 * Simple LLM chat interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/concierge/simple';
import { getPrompt } from '@/lib/config/loader';

export const maxDuration = 60;

// Default auto-greet prompt (fallback if not in config)
const DEFAULT_AUTO_GREET = `Suggest 5 ways you can help me today based on my current tasks and projects.
Number them 1-5. Be specific and personalized based on what you see in my context.
If I have no tasks yet, suggest ways to get started.`;

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

    // Get conversation history (array of {role, content} objects)
    const history = Array.isArray(body.history) ? body.history : [];

    // Handle auto-greet magic message
    const autoGreetPrompt = getPrompt('concierge.prompts.auto_greet') || DEFAULT_AUTO_GREET;
    const actualMessage = body.message === '[AUTO_GREET]'
      ? autoGreetPrompt
      : body.message;

    // Process the message with simple chat, passing conversation history
    const result = await chat(actualMessage, sessionId, history);

    return NextResponse.json({
      sessionId,
      message: result.message,
      toolsUsed: result.toolsUsed || [],
    });
  } catch (error) {
    console.error('POST /api/concierge/chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process message' },
      { status: 500 }
    );
  }
}
