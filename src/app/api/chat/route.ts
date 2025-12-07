import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { concierge } from '@/concierge';

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response('Messages required', { status: 400 });
    }

    const userMessage = messages[messages.length - 1].content;
    const sid = sessionId || `session_${Date.now()}`;

    const conciergeResponse = await concierge.processInput(sid, userMessage);

    const result = streamText({
      model: openai('gpt-4-turbo'),
      messages: [{
        role: 'assistant',
        content: conciergeResponse.message
      }],
    });

    return result.toTextStreamResponse({
      headers: {
        'X-Session-Id': sid,
        'X-Mode': conciergeResponse.mode,
        'X-Intent': conciergeResponse.intent.category,
      },
    });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process message' }),
      { status: 500 }
    );
  }
}
