/**
 * Simple Concierge - Single LLM with Tools
 * Replaces the over-engineered orchestrator/modes/intent/dispatch system
 */

import { createOpenAIClient, buildChatCompletionParams } from '@/lib/openai';
import { db } from '@/lib/db';
import { tasks, projects } from '@/graph/schema';
import { eq, ne, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  message: string;
  toolsUsed?: string[];
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are POF, a helpful productivity assistant.

CURRENT CONTEXT:
{context}

You can help with anything, but you have special abilities to manage tasks:
- Create new tasks
- Update existing tasks
- Mark tasks as complete
- List and search tasks

Be concise, friendly, and action-oriented. When the user mentions something that sounds like a task, offer to create it. When they want to do something, check if there's a relevant task.

If the user asks you to suggest ways to help, look at their current tasks and projects and make personalized suggestions based on what you see.`;

// ============================================================================
// TOOLS
// ============================================================================

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task. Use this when the user wants to add something to their todo list.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The task title' },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'normal', 'low'],
            description: 'Task priority (default: normal)'
          },
          notes: { type: 'string', description: 'Optional notes or details' },
          projectId: { type: 'string', description: 'Optional project ID to assign to' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task by ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The task ID' },
          title: { type: 'string', description: 'New title' },
          priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
          notes: { type: 'string', description: 'New notes' },
          status: { type: 'string', enum: ['inbox', 'available', 'scheduled', 'blocked', 'completed', 'dropped'] }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed. Use when the user says they finished something.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The task ID to complete' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List tasks, optionally filtered by status',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['inbox', 'available', 'scheduled', 'blocked', 'completed', 'all'],
            description: 'Filter by status (default: all non-completed)'
          }
        }
      }
    }
  }
];

// ============================================================================
// TOOL EXECUTION
// ============================================================================

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'create_task': {
      const id = uuidv4();
      await db.insert(tasks).values({
        id,
        title: args.title as string,
        priority: (args.priority as 'critical' | 'high' | 'normal' | 'low') || 'normal',
        notes: args.notes as string | undefined,
        projectId: args.projectId as string | undefined,
        status: 'inbox',
      });
      return `Created task "${args.title}" (ID: ${id})`;
    }

    case 'update_task': {
      const updates: Record<string, unknown> = {};
      if (args.title) updates.title = args.title;
      if (args.priority) updates.priority = args.priority;
      if (args.notes) updates.notes = args.notes;
      if (args.status) updates.status = args.status;
      updates.updatedAt = new Date();

      await db.update(tasks)
        .set(updates)
        .where(eq(tasks.id, args.id as string));
      return `Updated task ${args.id}`;
    }

    case 'complete_task': {
      await db.update(tasks)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(tasks.id, args.id as string));
      return `Marked task ${args.id} as completed`;
    }

    case 'list_tasks': {
      const status = args.status as string | undefined;
      let taskList;

      if (status === 'all') {
        taskList = await db.select().from(tasks);
      } else if (status) {
        taskList = await db.select().from(tasks).where(eq(tasks.status, status as typeof tasks.status.enumValues[number]));
      } else {
        // Default: non-completed tasks
        taskList = await db.select().from(tasks).where(ne(tasks.status, 'completed'));
      }

      return JSON.stringify(taskList.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectId: t.projectId
      })));
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

async function buildContext(): Promise<string> {
  const [taskList, projectList] = await Promise.all([
    db.select().from(tasks).where(ne(tasks.status, 'completed')),
    db.select().from(projects).where(eq(projects.status, 'active'))
  ]);

  const inboxCount = taskList.filter(t => t.status === 'inbox').length;
  const availableCount = taskList.filter(t => t.status === 'available').length;
  const blockedCount = taskList.filter(t => t.status === 'blocked').length;
  const criticalTasks = taskList.filter(t => t.priority === 'critical');
  const highPriorityTasks = taskList.filter(t => t.priority === 'high');

  let context = `Tasks: ${taskList.length} active (${inboxCount} inbox, ${availableCount} available, ${blockedCount} blocked)\n`;
  context += `Projects: ${projectList.map(p => p.name).join(', ') || 'None'}\n`;

  if (criticalTasks.length > 0) {
    context += `\nCRITICAL TASKS:\n${criticalTasks.map(t => `- ${t.title}`).join('\n')}\n`;
  }

  if (highPriorityTasks.length > 0) {
    context += `\nHigh Priority:\n${highPriorityTasks.map(t => `- ${t.title}`).join('\n')}\n`;
  }

  if (taskList.length > 0) {
    context += `\nRecent tasks:\n${taskList.slice(0, 10).map(t => `- [${t.status}] ${t.title}`).join('\n')}`;
  }

  return context;
}

// ============================================================================
// MAIN CHAT FUNCTION
// ============================================================================

export async function chat(
  message: string,
  sessionId: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResult> {
  const context = await buildContext();
  const systemPrompt = SYSTEM_PROMPT.replace('{context}', context);

  const client = createOpenAIClient();
  const allParams = buildChatCompletionParams();
  // Extract only standard OpenAI params (exclude GPT-5 specific params)
  const { model, temperature, max_tokens, top_p } = allParams;
  const modelParams = { model, ...(temperature && { temperature }), ...(max_tokens && { max_tokens }), ...(top_p && { top_p }) };

  // Build messages array with conversation history
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    // Include prior conversation history
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    // Add current message
    { role: 'user', content: message }
  ];

  // First call - may include tool calls
  const response = await client.chat.completions.create({
    ...modelParams,
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
  });

  const assistantMessage = response.choices[0].message;
  const toolCalls = assistantMessage.tool_calls;
  const toolsUsed: string[] = [];

  // If there are tool calls, execute them and get final response
  if (toolCalls && toolCalls.length > 0) {
    messages.push(assistantMessage);

    // Execute all tool calls (filter for function type)
    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue;
      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeToolCall(toolCall.function.name, args);
      toolsUsed.push(toolCall.function.name);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      });
    }

    // Get final response after tool execution
    const finalResponse = await client.chat.completions.create({
      ...modelParams,
      messages,
    });

    return {
      message: finalResponse.choices[0].message.content || 'Done.',
      toolsUsed
    };
  }

  // No tool calls - return direct response
  return {
    message: assistantMessage.content || 'I\'m here to help! What would you like to do?'
  };
}
