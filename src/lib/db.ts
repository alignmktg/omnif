/**
 * Database Connection
 * Drizzle ORM with Neon Postgres
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '@/graph/schema';

// Lazy-load database connection to handle build time when DATABASE_URL may not be set
let _sql: NeonQueryFunction<false, false> | null = null;
let _db: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(databaseUrl);
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

// Export a proxy that lazily initializes the db on first access
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    const realDb = getDb();
    const value = (realDb as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    return value;
  },
});

export type DB = NeonHttpDatabase<typeof schema>;
