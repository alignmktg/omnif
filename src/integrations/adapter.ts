/**
 * Integration Adapter Interface
 * Base interface for external system integrations (PRD Section 14)
 */

import type { ExternalRef } from '@/domain';

// ============================================================================
// ADAPTER TYPES
// ============================================================================

export type AdapterType = 'email' | 'calendar' | 'artifact';

export interface AdapterQuery {
  type: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface WriteResult {
  success: boolean;
  id?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// BASE ADAPTER INTERFACE
// ============================================================================

export interface IntegrationAdapter<TRead, TWrite> {
  type: AdapterType;
  name: string;

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean;

  /**
   * Read data from external system
   */
  read(query: AdapterQuery): Promise<TRead[]>;

  /**
   * Write data to external system
   */
  write(data: TWrite): Promise<WriteResult>;

  /**
   * Extract external reference metadata
   */
  extractRef(raw: unknown): ExternalRef;
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

const adapters = new Map<AdapterType, IntegrationAdapter<unknown, unknown>>();

/**
 * Register an adapter
 */
export function registerAdapter<TRead, TWrite>(
  adapter: IntegrationAdapter<TRead, TWrite>
): void {
  adapters.set(adapter.type, adapter as IntegrationAdapter<unknown, unknown>);
}

/**
 * Get an adapter by type
 */
export function getAdapter<TRead, TWrite>(
  type: AdapterType
): IntegrationAdapter<TRead, TWrite> | undefined {
  return adapters.get(type) as IntegrationAdapter<TRead, TWrite> | undefined;
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): IntegrationAdapter<unknown, unknown>[] {
  return Array.from(adapters.values());
}

/**
 * Check if an adapter is registered
 */
export function hasAdapter(type: AdapterType): boolean {
  return adapters.has(type);
}

// ============================================================================
// EXTERNAL REF MANAGEMENT
// ============================================================================

/**
 * Create an external reference
 */
export function createExternalRef(kind: string, ref: string): ExternalRef {
  return { kind, ref };
}

/**
 * Parse an external reference string
 */
export function parseExternalRef(refString: string): ExternalRef | null {
  const match = refString.match(/^(\w+):(.+)$/);
  if (!match) return null;
  return { kind: match[1], ref: match[2] };
}

/**
 * Stringify an external reference
 */
export function stringifyExternalRef(ref: ExternalRef): string {
  return `${ref.kind}:${ref.ref}`;
}
