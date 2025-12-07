/**
 * Insight Extractor Base
 * Base interface and types for insight extraction
 */

import type { InsightType } from '@/domain';

// ============================================================================
// EXTRACTOR TYPES
// ============================================================================

export interface ExtractionSource {
  type: 'agent_output' | 'user_interaction' | 'email' | 'task_pattern';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  sourceRef?: string;
}

export interface ExtractedInsight {
  type: InsightType;
  content: string;
  confidence: number;
  sourceRefs: string[];
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  insights: ExtractedInsight[];
  sourcesProcessed: number;
  extractionTimeMs: number;
}

// ============================================================================
// BASE EXTRACTOR INTERFACE
// ============================================================================

export interface InsightExtractor {
  type: InsightType;
  name: string;

  /**
   * Extract insights from a source
   */
  extract(source: ExtractionSource): Promise<ExtractedInsight[]>;

  /**
   * Check if this extractor can handle the source type
   */
  canHandle(source: ExtractionSource): boolean;
}

// ============================================================================
// EXTRACTOR REGISTRY
// ============================================================================

const extractors = new Map<InsightType, InsightExtractor>();

/**
 * Register an extractor
 */
export function registerExtractor(extractor: InsightExtractor): void {
  extractors.set(extractor.type, extractor);
}

/**
 * Get an extractor by type
 */
export function getExtractor(type: InsightType): InsightExtractor | undefined {
  return extractors.get(type);
}

/**
 * Get all extractors
 */
export function getAllExtractors(): InsightExtractor[] {
  return Array.from(extractors.values());
}

/**
 * Get extractors that can handle a source
 */
export function getExtractorsForSource(source: ExtractionSource): InsightExtractor[] {
  return getAllExtractors().filter((e) => e.canHandle(source));
}

// ============================================================================
// EXTRACTION HELPERS
// ============================================================================

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string, minLength = 3): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
    'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= minLength && !stopWords.has(word));
}

/**
 * Calculate text similarity (simple Jaccard)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}
