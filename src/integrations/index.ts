/**
 * Integrations Module - Public API
 */

export * from './adapter';
export * from './email';
export * from './calendar';

// Register adapters
import { registerAdapter } from './adapter';
import { emailAdapter } from './email';
import { calendarAdapter } from './calendar';

registerAdapter(emailAdapter);
registerAdapter(calendarAdapter);
