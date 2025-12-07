/**
 * Insight Extractors - Public API
 */

export * from './base';
export * from './preference';
export * from './theme';
export * from './commitment';
export * from './stable-fact';
export * from './recurring-constraint';

// Register all extractors
import { registerExtractor } from './base';
import { preferenceExtractor } from './preference';
import { themeExtractor } from './theme';
import { commitmentExtractor } from './commitment';
import { stableFactExtractor } from './stable-fact';
import { recurringConstraintExtractor } from './recurring-constraint';

registerExtractor(preferenceExtractor);
registerExtractor(themeExtractor);
registerExtractor(commitmentExtractor);
registerExtractor(stableFactExtractor);
registerExtractor(recurringConstraintExtractor);
