import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { D1Database } from '@cloudflare/workers-types'

// In-memory stand-in for D1, backed by Node's built-in SQLite (node:sqlite,
// Node >= 22.5). Covers the slice of the D1 API our db/ modules use:
// prepare().bind().first()/run()/all() and batch(). Applies the REAL
// migration files so tests exercise the actual DDL — a column the SQL
// forgot to add fails here, not in production.
//
// Deliberately not @cloudflare/vitest-pool-workers: that needs a wrangler
// config + the workerd runtime per test run, and everything under test here
// is plain SQL over a D1Database interface.

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../migrations/', import.meta.url),
)

type Row = Record<string, unknown>

class FakeStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new FakeStatement(this.db, this.sql, params)
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const row = (this.db.prepare(this.sql).get(...bindable(this.params)) ??
      null) as Row | null
    if (row === null) return null
    if (column !== undefined) return row[column] as T
    return row as T
  }

  async run<T = Row>() {
    const statement = this.db.prepare(this.sql)
    if (/^\s*(SELECT|WITH)\b/i.test(this.sql)) {
      const results = statement.all(...bindable(this.params)) as T[]
      return { success: true, results, meta: { changes: 0 } }
    }
    const info = statement.run(...bindable(this.params))
    return {
      success: true,
      results: [] as T[],
      meta: { changes: Number(info.changes) },
    }
  }

  async all<T = Row>() {
    const results = this.db
      .prepare(this.sql)
      .all(...bindable(this.params)) as T[]
    return { success: true, results, meta: {} }
  }
}

class FakeD1 {
  constructor(readonly db: DatabaseSync) {}

  prepare(sql: string) {
    return new FakeStatement(this.db, sql)
  }

  // D1 batches are transactional — all statements succeed or none apply.
  async batch(statements: FakeStatement[]) {
    this.db.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      this.db.exec('COMMIT')
      return results
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }
}

// node:sqlite accepts null/number/string/bigint/Uint8Array; undefined throws.
function bindable(params: unknown[]) {
  return params.map((p) => (p === undefined ? null : p)) as (
    | null
    | number
    | string
    | bigint
    | Uint8Array
  )[]
}

export type TestDb = { d1: D1Database; raw: DatabaseSync }

export function createTestDb(): TestDb {
  const raw = new DatabaseSync(':memory:')
  // D1 enforces foreign keys; a test that passes without this could hide an
  // FK-ordering bug in the writes.
  raw.exec('PRAGMA foreign_keys = ON')
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith('.sql')) continue
    raw.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'))
  }
  return { d1: new FakeD1(raw) as unknown as D1Database, raw }
}
