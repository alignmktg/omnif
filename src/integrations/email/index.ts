/**
 * Email Integration Adapter
 * Email thread read, draft write, metadata extraction
 */

import type { EmailThread, EmailMessage, EmailDraft, ExternalRef } from '@/domain';
import type { IntegrationAdapter, AdapterQuery, WriteResult } from '../adapter';
import { createExternalRef } from '../adapter';

// ============================================================================
// EMAIL ADAPTER IMPLEMENTATION
// ============================================================================

export class EmailAdapter implements IntegrationAdapter<EmailThread, EmailDraft> {
  type = 'email' as const;
  name = 'Email Adapter';

  private configured = false;
  private threads: Map<string, EmailThread> = new Map();
  private drafts: Map<string, EmailDraft> = new Map();

  /**
   * Configure the email adapter
   * In production, this would connect to Gmail, Outlook, etc.
   */
  configure(config: { provider?: string; apiKey?: string } = {}): void {
    // Mock configuration for now
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Read email threads
   */
  async read(query: AdapterQuery): Promise<EmailThread[]> {
    if (!this.configured) {
      throw new Error('Email adapter not configured');
    }

    // Mock implementation - in production would call email API
    const threads = Array.from(this.threads.values());

    // Apply filters
    let filtered = threads;
    if (query.filters?.threadId) {
      filtered = filtered.filter((t) => t.threadId === query.filters?.threadId);
    }
    if (query.filters?.subject) {
      const subject = String(query.filters.subject).toLowerCase();
      filtered = filtered.filter((t) =>
        t.subject.toLowerCase().includes(subject)
      );
    }
    if (query.filters?.participant) {
      const participant = String(query.filters.participant).toLowerCase();
      filtered = filtered.filter((t) =>
        t.participants.some((p) => p.toLowerCase().includes(participant))
      );
    }

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Write email draft (not sent automatically in v1)
   */
  async write(draft: EmailDraft): Promise<WriteResult> {
    if (!this.configured) {
      throw new Error('Email adapter not configured');
    }

    // Generate draft ID
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Store draft (in production, would save to email provider's drafts)
    this.drafts.set(draftId, draft);

    return {
      success: true,
      id: draftId,
      metadata: {
        threadId: draft.threadId,
        savedAt: new Date().toISOString(),
        status: 'draft', // Not sent - v1 requires manual approval
      },
    };
  }

  /**
   * Extract external reference from email thread
   */
  extractRef(thread: unknown): ExternalRef {
    const emailThread = thread as EmailThread;
    return createExternalRef('email', emailThread.threadId);
  }

  // ============================================================================
  // MOCK DATA HELPERS (for testing)
  // ============================================================================

  /**
   * Add a mock thread for testing
   */
  addMockThread(thread: EmailThread): void {
    this.threads.set(thread.threadId, thread);
  }

  /**
   * Get a draft by ID
   */
  getDraft(draftId: string): EmailDraft | undefined {
    return this.drafts.get(draftId);
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.threads.clear();
    this.drafts.clear();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create an email thread from messages
 */
export function createThread(
  threadId: string,
  messages: EmailMessage[]
): EmailThread {
  const participants = new Set<string>();
  for (const msg of messages) {
    participants.add(msg.from);
    msg.to.forEach((to) => participants.add(to));
    msg.cc.forEach((cc) => participants.add(cc));
  }

  return {
    threadId,
    subject: messages[0]?.subject ?? '',
    participants: Array.from(participants),
    messages,
    lastUpdated: messages[messages.length - 1]?.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Create an email message
 */
export function createMessage(
  messageId: string,
  from: string,
  to: string[],
  subject: string,
  body: string,
  cc: string[] = []
): EmailMessage {
  return {
    messageId,
    from,
    to,
    cc,
    subject,
    body,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an email draft
 */
export function createDraft(
  to: string[],
  subject: string,
  body: string,
  options: { threadId?: string; cc?: string[] } = {}
): EmailDraft {
  return {
    threadId: options.threadId ?? null,
    to,
    cc: options.cc ?? [],
    subject,
    body,
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const emailAdapter = new EmailAdapter();
