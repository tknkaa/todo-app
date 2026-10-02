import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

type SqlValue = string | number | null

class Statement {
  private params: SqlValue[] = []

  constructor(
    private readonly db: DatabaseSync,
    private readonly query: string,
  ) {}

  bind(...params: SqlValue[]) {
    this.params = params
    return this
  }

  async all() {
    const results = this.db.prepare(this.query).all(...this.params)
    return { results, success: true, meta: {} }
  }

  async run() {
    this.db.prepare(this.query).run(...this.params)
    return { results: [], success: true, meta: {} }
  }

  async raw() {
    const stmt = this.db.prepare(this.query)
    stmt.setReturnArrays(true)
    return stmt.all(...this.params)
  }
}

/** In-memory SQLite exposing the subset of D1Database that drizzle's d1 driver uses. */
export function createTestDatabase() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')

  const dir = join(import.meta.dirname, '../../migrations')
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    db.exec(readFileSync(join(dir, file), 'utf8').replaceAll('--> statement-breakpoint', ''))
  }

  return {
    prepare: (query: string) => new Statement(db, query),
    batch: async (statements: Statement[]) => Promise.all(statements.map((s) => s.run())),
  } as unknown as D1Database & { prepare: (q: string) => Statement }
}

export function insertUser(database: D1Database, id: string) {
  return (database as unknown as ReturnType<typeof createTestDatabase>)
    .prepare('insert into users (id, email) values (?, ?)')
    .bind(id, `${id}@example.com`)
    .run()
}
