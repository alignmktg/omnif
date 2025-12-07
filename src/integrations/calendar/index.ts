/**
 * Calendar Integration Adapter
 * Calendar read, event proposal
 */

import type { CalendarEvent, EventProposal, ExternalRef } from '@/domain';
import type { IntegrationAdapter, AdapterQuery, WriteResult } from '../adapter';
import { createExternalRef } from '../adapter';

// ============================================================================
// CALENDAR ADAPTER IMPLEMENTATION
// ============================================================================

export class CalendarAdapter implements IntegrationAdapter<CalendarEvent, EventProposal> {
  type = 'calendar' as const;
  name = 'Calendar Adapter';

  private configured = false;
  private events: Map<string, CalendarEvent> = new Map();
  private proposals: Map<string, { proposal: EventProposal; status: 'pending' | 'approved' | 'rejected' }> = new Map();

  /**
   * Configure the calendar adapter
   * In production, this would connect to Google Calendar, Outlook, etc.
   */
  configure(config: { provider?: string; apiKey?: string } = {}): void {
    // Mock configuration for now
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Read calendar events
   */
  async read(query: AdapterQuery): Promise<CalendarEvent[]> {
    if (!this.configured) {
      throw new Error('Calendar adapter not configured');
    }

    // Mock implementation - in production would call calendar API
    let events = Array.from(this.events.values());

    // Apply date range filter
    if (query.filters?.startDate || query.filters?.endDate) {
      const startDate = query.filters.startDate
        ? new Date(query.filters.startDate as string)
        : new Date(0);
      const endDate = query.filters.endDate
        ? new Date(query.filters.endDate as string)
        : new Date('2100-01-01');

      events = events.filter((e) => {
        const eventStart = new Date(e.start);
        const eventEnd = new Date(e.end);
        return eventStart >= startDate && eventEnd <= endDate;
      });
    }

    // Apply title filter
    if (query.filters?.title) {
      const title = String(query.filters.title).toLowerCase();
      events = events.filter((e) => e.title.toLowerCase().includes(title));
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return events.slice(offset, offset + limit);
  }

  /**
   * Propose a calendar event (requires approval in v1)
   */
  async write(proposal: EventProposal): Promise<WriteResult> {
    if (!this.configured) {
      throw new Error('Calendar adapter not configured');
    }

    // Generate proposal ID
    const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Store proposal (in production, would save to calendar as tentative)
    this.proposals.set(proposalId, { proposal, status: 'pending' });

    return {
      success: true,
      id: proposalId,
      metadata: {
        status: 'pending', // Requires approval in v1
        proposedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract external reference from calendar event
   */
  extractRef(event: unknown): ExternalRef {
    const calendarEvent = event as CalendarEvent;
    return createExternalRef('calendar', calendarEvent.eventId);
  }

  // ============================================================================
  // PROPOSAL MANAGEMENT
  // ============================================================================

  /**
   * Approve a pending proposal and create the event
   */
  approveProposal(proposalId: string): CalendarEvent | null {
    const entry = this.proposals.get(proposalId);
    if (!entry || entry.status !== 'pending') return null;

    entry.status = 'approved';

    // Create the actual event
    const eventId = `event_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const event: CalendarEvent = {
      eventId,
      ...entry.proposal,
    };

    this.events.set(eventId, event);
    return event;
  }

  /**
   * Reject a pending proposal
   */
  rejectProposal(proposalId: string): boolean {
    const entry = this.proposals.get(proposalId);
    if (!entry || entry.status !== 'pending') return false;

    entry.status = 'rejected';
    return true;
  }

  /**
   * Get pending proposals
   */
  getPendingProposals(): Array<{ id: string; proposal: EventProposal }> {
    return Array.from(this.proposals.entries())
      .filter(([_, entry]) => entry.status === 'pending')
      .map(([id, entry]) => ({ id, proposal: entry.proposal }));
  }

  // ============================================================================
  // MOCK DATA HELPERS (for testing)
  // ============================================================================

  /**
   * Add a mock event for testing
   */
  addMockEvent(event: CalendarEvent): void {
    this.events.set(event.eventId, event);
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.events.clear();
    this.proposals.clear();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a calendar event
 */
export function createEvent(
  eventId: string,
  title: string,
  start: Date | string,
  end: Date | string,
  attendees: string[] = [],
  location: string | null = null
): CalendarEvent {
  return {
    eventId,
    title,
    start: typeof start === 'string' ? start : start.toISOString(),
    end: typeof end === 'string' ? end : end.toISOString(),
    attendees,
    location,
  };
}

/**
 * Create an event proposal
 */
export function createEventProposal(
  title: string,
  start: Date | string,
  end: Date | string,
  attendees: string[] = [],
  location: string | null = null
): EventProposal {
  return {
    title,
    start: typeof start === 'string' ? start : start.toISOString(),
    end: typeof end === 'string' ? end : end.toISOString(),
    attendees,
    location,
  };
}

/**
 * Get events for a specific day
 */
export async function getEventsForDay(
  adapter: CalendarAdapter,
  date: Date
): Promise<CalendarEvent[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return adapter.read({
    type: 'day',
    filters: {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    },
  });
}

/**
 * Get events for a date range
 */
export async function getEventsInRange(
  adapter: CalendarAdapter,
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  return adapter.read({
    type: 'range',
    filters: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  });
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const calendarAdapter = new CalendarAdapter();
