/**
 * QA Check Implementations
 * Correctness, alignment, and safety checks
 */

import type { AgentRunRequest, AgentRunResponse } from '@/domain';

// ============================================================================
// CHECK RESULT
// ============================================================================

export interface CheckResult {
  passed: boolean;
  score: number; // 0-1
  issues: string[];
  details?: Record<string, unknown>;
}

// ============================================================================
// CORRECTNESS CHECK
// ============================================================================

/**
 * Check if output matches the stated objective
 */
export function checkCorrectness(
  request: AgentRunRequest,
  response: AgentRunResponse
): CheckResult {
  const issues: string[] = [];
  let score = 1.0;

  // Check for empty output
  if (!response.artifacts.primaryOutput || response.artifacts.primaryOutput.trim() === '') {
    issues.push('Output is empty');
    score = 0;
  }

  // Check minimum length
  const minWords = 10;
  const wordCount = response.artifacts.primaryOutput.split(/\s+/).length;
  if (wordCount < minWords) {
    issues.push(`Output too short: ${wordCount} words (minimum: ${minWords})`);
    score = Math.min(score, 0.5);
  }

  // Check for objective keywords in output
  const objectiveKeywords = extractKeywords(request.objective);
  const outputText = response.artifacts.primaryOutput.toLowerCase();
  const matchedKeywords = objectiveKeywords.filter((kw) =>
    outputText.includes(kw.toLowerCase())
  );
  const keywordCoverage = matchedKeywords.length / Math.max(1, objectiveKeywords.length);

  if (keywordCoverage < 0.3) {
    issues.push(
      `Low relevance to objective: ${(keywordCoverage * 100).toFixed(0)}% keyword coverage`
    );
    score = Math.min(score, 0.6);
  }

  // Use agent's self-reported confidence
  const agentConfidence = response.confidenceScores.overall;
  score = Math.min(score, agentConfidence);

  return {
    passed: issues.length === 0,
    score,
    issues,
    details: {
      wordCount,
      keywordCoverage,
      agentConfidence,
    },
  };
}

// ============================================================================
// ALIGNMENT CHECK
// ============================================================================

/**
 * Check if output matches constraints (style, length, format)
 */
export function checkAlignment(
  request: AgentRunRequest,
  response: AgentRunResponse
): CheckResult {
  const issues: string[] = [];
  let score = 1.0;
  const constraints = request.contextCapsule.constraints;

  // Check word limit
  const wordCount = response.artifacts.primaryOutput.split(/\s+/).length;
  const maxWords = constraints.lengthLimits.maxWords;

  if (wordCount > maxWords * 1.2) {
    // 20% tolerance
    issues.push(`Output exceeds word limit: ${wordCount} words (max: ${maxWords})`);
    score = Math.min(score, 0.7);
  }

  // Check expected artifacts
  const expectedArtifacts = request.contextCapsule.expectedArtifacts;
  if (expectedArtifacts.length > 0) {
    const attachmentTypes = response.artifacts.attachments.map((a) => a.type);
    const missingArtifacts = expectedArtifacts.filter(
      (ea) => !attachmentTypes.includes(ea) && !response.artifacts.primaryOutput.includes(ea)
    );

    if (missingArtifacts.length > 0) {
      issues.push(`Missing expected artifacts: ${missingArtifacts.join(', ')}`);
      score = Math.min(score, 0.8);
    }
  }

  // Use agent's alignment confidence
  const alignmentConfidence = response.confidenceScores.alignmentWithConstraints;
  score = Math.min(score, alignmentConfidence);

  return {
    passed: issues.length === 0,
    score,
    issues,
    details: {
      wordCount,
      maxWords,
      alignmentConfidence,
    },
  };
}

// ============================================================================
// SAFETY CHECK
// ============================================================================

// Patterns that indicate potentially harmful content
const SAFETY_PATTERNS = {
  harmful: [
    /\b(hack|exploit|attack|malware|virus)\b/i,
    /\b(password|credential|secret|api[_-]?key)\s*[:=]/i,
    /\b(kill|harm|hurt|destroy)\s+(people|person|human)/i,
  ],
  pii: [
    /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
    /\b\d{16}\b/, // Credit card
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email (warn only)
  ],
  inappropriate: [
    /\b(fuck|shit|damn|ass)\b/i, // Profanity (context-dependent)
  ],
};

/**
 * Check for harmful, inappropriate, or sensitive content
 */
export function checkSafety(response: AgentRunResponse): CheckResult {
  const issues: string[] = [];
  let score = 1.0;
  const text = response.artifacts.primaryOutput;
  const allText = text + response.artifacts.attachments.map((a) => a.content).join(' ');

  // Check for harmful patterns
  for (const pattern of SAFETY_PATTERNS.harmful) {
    if (pattern.test(allText)) {
      issues.push(`Potentially harmful content detected: ${pattern.toString()}`);
      score = Math.min(score, 0.3);
    }
  }

  // Check for PII
  for (const pattern of SAFETY_PATTERNS.pii) {
    if (pattern.test(allText)) {
      issues.push(`Potential PII detected: ${pattern.toString()}`);
      score = Math.min(score, 0.5);
    }
  }

  // Check for inappropriate content (warning only)
  for (const pattern of SAFETY_PATTERNS.inappropriate) {
    if (pattern.test(allText)) {
      // Just a warning, doesn't fail
      issues.push(`Warning: Potentially inappropriate language detected`);
      score = Math.min(score, 0.9);
    }
  }

  return {
    passed: score >= 0.5, // Threshold for safety
    score,
    issues,
  };
}

// ============================================================================
// COMPOSITE CHECK
// ============================================================================

export interface CompositeCheckResult {
  passed: boolean;
  overallScore: number;
  checkResults: {
    correctness?: CheckResult;
    alignment?: CheckResult;
    safety?: CheckResult;
  };
  allIssues: string[];
}

/**
 * Run all enabled checks and combine results
 */
export function runChecks(
  request: AgentRunRequest,
  response: AgentRunResponse,
  enabledChecks: { correctness?: boolean; alignment?: boolean; safety?: boolean } = {
    correctness: true,
    alignment: true,
    safety: true,
  }
): CompositeCheckResult {
  const checkResults: CompositeCheckResult['checkResults'] = {};
  const allIssues: string[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  if (enabledChecks.correctness) {
    const result = checkCorrectness(request, response);
    checkResults.correctness = result;
    allIssues.push(...result.issues.map((i) => `[Correctness] ${i}`));
    weightedScore += result.score * 0.4;
    totalWeight += 0.4;
  }

  if (enabledChecks.alignment) {
    const result = checkAlignment(request, response);
    checkResults.alignment = result;
    allIssues.push(...result.issues.map((i) => `[Alignment] ${i}`));
    weightedScore += result.score * 0.35;
    totalWeight += 0.35;
  }

  if (enabledChecks.safety) {
    const result = checkSafety(response);
    checkResults.safety = result;
    allIssues.push(...result.issues.map((i) => `[Safety] ${i}`));
    weightedScore += result.score * 0.25;
    totalWeight += 0.25;
  }

  const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const passed = Object.values(checkResults).every((r) => r?.passed !== false);

  return {
    passed: passed && overallScore >= 0.7,
    overallScore,
    checkResults,
    allIssues,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
    'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}
