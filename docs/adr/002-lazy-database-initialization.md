# ADR 002: Lazy Database Initialization

## Status
Accepted

## Context
Next.js build process evaluates all code at build time, including imports. The database connection was being initialized at module load time, which caused build failures when `DATABASE_URL` wasn't set (common in CI/CD or fresh checkouts).

## Problem
```typescript
// This fails at build time if DATABASE_URL is missing
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

Error during `next build`:
```
Error: No database connection string was provided to `neon()`
```

## Decision
Implement lazy initialization using a Proxy that only creates the database connection when first accessed.

## Implementation
File: `/src/lib/db.ts`

```typescript
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
```

## Consequences

**Positive:**
- Builds succeed without database access
- Clear error message at runtime if DATABASE_URL is missing
- No change to consumer code (same `db` export)
- Connection only created when actually needed

**Negative:**
- Slightly more complex initialization logic
- First database call has small overhead (one-time proxy setup)
- Error happens at first query instead of startup (could be surprising)

## Alternatives Considered

1. **Require DATABASE_URL at build time**: Rejected because it breaks CI/CD and local dev workflows
2. **Mock the database for builds**: Rejected because it's fragile and hides real issues
3. **Conditional initialization**: Rejected because it complicates the API

## Related
- Database operations: `/src/graph/operations/`
- Schema definitions: `/src/graph/schema/`
