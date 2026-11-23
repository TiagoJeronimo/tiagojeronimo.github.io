// For the tests: node's own SQLite with the real migrations in it, and the same dressed as the little of D1 that
// `sql.ts` uses.
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { Db, Statement } from '../src/sql.ts'

export function fresh() {
  const sqlite = new DatabaseSync(':memory:')
  // Every migration, in order, as wrangler applies them.
  const folder = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, folder), 'utf8'))
  return sqlite
}

export function d1(db: DatabaseSync): Db {
  const statement = (query: string, values: unknown[]): Statement => ({
    bind: (...more) => statement(query, more),
    all: async <T,>() => ({ results: db.prepare(query).all(...(values as never[])) as T[] }),
    first: async <T,>() => (db.prepare(query).get(...(values as never[])) ?? null) as T | null,
    run: async () => ({ meta: { changes: Number(db.prepare(query).run(...(values as never[])).changes) } }),
  })
  return { prepare: (query) => statement(query, []) }
}
