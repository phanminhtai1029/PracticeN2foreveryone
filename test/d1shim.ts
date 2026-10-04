// Minimal D1Database over node:sqlite, enough for the queries in worker/.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Bound = { sql: string; params: unknown[] };

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = join(import.meta.dirname, '..', 'db', 'migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(dir, f), 'utf8'));
  }

  const exec = ({ sql, params }: Bound) => {
    const stmt = db.prepare(sql);
    const p = params as never[];
    if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) {
      const rows = stmt.all(...p) as Record<string, unknown>[];
      return { results: rows, success: true, meta: { changes: 0, last_row_id: 0 } };
    }
    const r = stmt.run(...p);
    return {
      results: [],
      success: true,
      meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  };

  const statement = (b: Bound): D1PreparedStatement => {
    const s = {
      __bound: b,
      bind: (...params: unknown[]) => statement({ sql: b.sql, params }),
      first: async (col?: string) => {
        const row = exec(b).results[0] ?? null;
        return col && row ? row[col] : row;
      },
      all: async () => exec(b),
      run: async () => exec(b),
      raw: async () => exec(b).results.map((r) => Object.values(r)),
    };
    return s as unknown as D1PreparedStatement;
  };

  return {
    prepare: (sql: string) => statement({ sql, params: [] }),
    batch: async (stmts: D1PreparedStatement[]) => {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => exec((s as unknown as { __bound: Bound }).__bound));
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}
