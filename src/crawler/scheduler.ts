/**
 * Crawler Scheduler
 * Manages autonomous insight extraction scheduling
 */

import type { Insight, InsightType } from '@/domain';
import type { ExtractionSource, ExtractionResult, ExtractedInsight } from './extractors';
import { getExtractorsForSource, getAllExtractors } from './extractors';
import { calculateSimpleConfidence, getStaleInsights } from './confidence';

// ============================================================================
// SCHEDULER TYPES
// ============================================================================

export interface CrawlerConfig {
  /** Whether the crawler is enabled */
  enabled: boolean;

  /** Minimum interval between crawls in ms */
  minIntervalMs: number;

  /** Maximum sources to process per crawl */
  batchSize: number;

  /** Confidence threshold for storing insights */
  minConfidence: number;

  /** Source types to crawl */
  enabledSources: ExtractionSource['type'][];
}

export interface CrawlerState {
  /** Whether a crawl is currently running */
  isRunning: boolean;

  /** Timestamp of last crawl start */
  lastCrawlStart: string | null;

  /** Timestamp of last successful crawl */
  lastCrawlComplete: string | null;

  /** Number of sources processed in last crawl */
  lastSourcesProcessed: number;

  /** Number of insights extracted in last crawl */
  lastInsightsExtracted: number;

  /** Total sources processed */
  totalSourcesProcessed: number;

  /** Total insights extracted */
  totalInsightsExtracted: number;
}

export interface CrawlResult {
  success: boolean;
  sourcesProcessed: number;
  insightsExtracted: number;
  insights: ExtractedInsight[];
  errors: string[];
  durationMs: number;
}

type SourceProvider = () => Promise<ExtractionSource[]>;
type InsightConsumer = (insights: ExtractedInsight[]) => Promise<void>;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: CrawlerConfig = {
  enabled: true,
  minIntervalMs: 5 * 60 * 1000, // 5 minutes
  batchSize: 50,
  minConfidence: 0.5,
  enabledSources: ['user_interaction', 'agent_output', 'email', 'task_pattern'],
};

// ============================================================================
// CRAWLER SCHEDULER CLASS
// ============================================================================

export class CrawlerScheduler {
  private config: CrawlerConfig;
  private state: CrawlerState;
  private sourceProviders: Map<ExtractionSource['type'], SourceProvider>;
  private insightConsumer: InsightConsumer | null;
  private intervalHandle: NodeJS.Timeout | null;

  constructor(config: Partial<CrawlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isRunning: false,
      lastCrawlStart: null,
      lastCrawlComplete: null,
      lastSourcesProcessed: 0,
      lastInsightsExtracted: 0,
      totalSourcesProcessed: 0,
      totalInsightsExtracted: 0,
    };
    this.sourceProviders = new Map();
    this.insightConsumer = null;
    this.intervalHandle = null;
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Update crawler configuration
   */
  configure(config: Partial<CrawlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Register a source provider for a source type
   */
  registerSourceProvider(
    type: ExtractionSource['type'],
    provider: SourceProvider
  ): void {
    this.sourceProviders.set(type, provider);
  }

  /**
   * Set the insight consumer callback
   */
  setInsightConsumer(consumer: InsightConsumer): void {
    this.insightConsumer = consumer;
  }

  /**
   * Get current configuration
   */
  getConfig(): CrawlerConfig {
    return { ...this.config };
  }

  /**
   * Get current state
   */
  getState(): CrawlerState {
    return { ...this.state };
  }

  // ============================================================================
  // SCHEDULING
  // ============================================================================

  /**
   * Start the scheduled crawler
   */
  start(): void {
    if (this.intervalHandle) {
      return; // Already running
    }

    if (!this.config.enabled) {
      return;
    }

    // Run initial crawl
    this.runCrawl();

    // Schedule periodic crawls
    this.intervalHandle = setInterval(
      () => this.runCrawl(),
      this.config.minIntervalMs
    );
  }

  /**
   * Stop the scheduled crawler
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Check if crawler is scheduled
   */
  isScheduled(): boolean {
    return this.intervalHandle !== null;
  }

  // ============================================================================
  // CRAWLING
  // ============================================================================

  /**
   * Run a single crawl cycle
   */
  async runCrawl(): Promise<CrawlResult> {
    if (this.state.isRunning) {
      return {
        success: false,
        sourcesProcessed: 0,
        insightsExtracted: 0,
        insights: [],
        errors: ['Crawl already in progress'],
        durationMs: 0,
      };
    }

    const startTime = Date.now();
    this.state.isRunning = true;
    this.state.lastCrawlStart = new Date().toISOString();

    const errors: string[] = [];
    const allInsights: ExtractedInsight[] = [];
    let sourcesProcessed = 0;

    try {
      // Gather sources from all providers
      const sources = await this.gatherSources();

      // Process sources in batches
      const batches = this.createBatches(sources, this.config.batchSize);

      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map((source) => this.processSource(source))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            sourcesProcessed++;
            allInsights.push(...result.value);
          } else {
            errors.push(result.reason?.message || 'Unknown extraction error');
          }
        }
      }

      // Filter by confidence threshold
      const filteredInsights = allInsights.filter(
        (i) => i.confidence >= this.config.minConfidence
      );

      // Send to consumer if configured
      if (this.insightConsumer && filteredInsights.length > 0) {
        await this.insightConsumer(filteredInsights);
      }

      // Update state
      this.state.lastCrawlComplete = new Date().toISOString();
      this.state.lastSourcesProcessed = sourcesProcessed;
      this.state.lastInsightsExtracted = filteredInsights.length;
      this.state.totalSourcesProcessed += sourcesProcessed;
      this.state.totalInsightsExtracted += filteredInsights.length;

      return {
        success: true,
        sourcesProcessed,
        insightsExtracted: filteredInsights.length,
        insights: filteredInsights,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Crawl failed'
      );

      return {
        success: false,
        sourcesProcessed,
        insightsExtracted: 0,
        insights: [],
        errors,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.state.isRunning = false;
    }
  }

  /**
   * Process a single source
   */
  private async processSource(
    source: ExtractionSource
  ): Promise<ExtractedInsight[]> {
    const extractors = getExtractorsForSource(source);
    const insights: ExtractedInsight[] = [];

    for (const extractor of extractors) {
      try {
        const extracted = await extractor.extract(source);
        insights.push(...extracted);
      } catch (error) {
        // Log but continue with other extractors
        console.error(
          `Extractor ${extractor.name} failed:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    return insights;
  }

  /**
   * Gather sources from all registered providers
   */
  private async gatherSources(): Promise<ExtractionSource[]> {
    const sources: ExtractionSource[] = [];

    for (const sourceType of this.config.enabledSources) {
      const provider = this.sourceProviders.get(sourceType);
      if (!provider) continue;

      try {
        const typeSources = await provider();
        sources.push(...typeSources);
      } catch (error) {
        console.error(
          `Source provider ${sourceType} failed:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    return sources;
  }

  /**
   * Split array into batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a source from user interaction
 */
export function createUserInteractionSource(
  content: string,
  metadata?: Record<string, unknown>
): ExtractionSource {
  return {
    type: 'user_interaction',
    content,
    metadata,
    timestamp: new Date().toISOString(),
    sourceRef: `interaction:${Date.now()}`,
  };
}

/**
 * Create a source from agent output
 */
export function createAgentOutputSource(
  content: string,
  agentRunId: string,
  metadata?: Record<string, unknown>
): ExtractionSource {
  return {
    type: 'agent_output',
    content,
    metadata: { ...metadata, agentRunId },
    timestamp: new Date().toISOString(),
    sourceRef: `agent:${agentRunId}`,
  };
}

/**
 * Create a source from email
 */
export function createEmailSource(
  content: string,
  threadId: string,
  metadata?: Record<string, unknown>
): ExtractionSource {
  return {
    type: 'email',
    content,
    metadata: { ...metadata, threadId },
    timestamp: new Date().toISOString(),
    sourceRef: `email:${threadId}`,
  };
}

/**
 * Create a source from task patterns
 */
export function createTaskPatternSource(
  content: string,
  metadata?: Record<string, unknown>
): ExtractionSource {
  return {
    type: 'task_pattern',
    content,
    metadata,
    timestamp: new Date().toISOString(),
    sourceRef: `pattern:${Date.now()}`,
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const crawlerScheduler = new CrawlerScheduler();
