import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * A real SQL engine behind the D1 API surface the site uses, for tests.
 *
 * D1 is SQLite, and Node ships SQLite (`node:sqlite`), so the commerce,
 * builder and API-key suites run against the actual migrations instead of a
 * hand-written mock that agrees with whatever the code under test expects.
 * Only the calls this codebase makes are covered: prepare/bind/first/all/run,
 * batch and exec.
 */

type Value = string | number | bigint | null | Uint8Array;

function normalize(args: unknown[]): Value[] {
	return args.map((value) => {
		if (value === undefined) return null;
		if (typeof value === 'boolean') return value ? 1 : 0;
		return value as Value;
	});
}

class Statement {
	constructor(
		private readonly db: DatabaseSync,
		private readonly sql: string,
		private readonly args: Value[] = []
	) {}

	bind(...args: unknown[]) {
		return new Statement(this.db, this.sql, normalize(args));
	}

	async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
		const row = this.db.prepare(this.sql).get(...this.args) as Record<string, unknown> | undefined;
		if (!row) return null;
		return (column ? row[column] : { ...row }) as T;
	}

	async all<T = Record<string, unknown>>() {
		const rows = this.db.prepare(this.sql).all(...this.args) as Record<string, unknown>[];
		return { results: rows.map((row) => ({ ...row })) as T[], success: true, meta: {} };
	}

	async run() {
		const info = this.db.prepare(this.sql).run(...this.args);
		return {
			success: true,
			results: [],
			meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) }
		};
	}
}

export function createSqliteD1(migrationFiles?: string[]): D1Database {
	const db = new DatabaseSync(':memory:');
	db.exec('PRAGMA foreign_keys = ON');
	const dir = join(process.cwd(), 'migrations');
	const files =
		migrationFiles ??
		readdirSync(dir)
			.filter((file) => /^\d{4}_.*\.sql$/.test(file))
			.sort();
	for (const file of files) db.exec(readFileSync(join(dir, file), 'utf8'));

	const d1 = {
		prepare: (sql: string) => new Statement(db, sql),
		batch: async (statements: Statement[]) => {
			db.exec('BEGIN');
			try {
				const out = [];
				for (const statement of statements) out.push(await statement.run());
				db.exec('COMMIT');
				return out;
			} catch (err) {
				db.exec('ROLLBACK');
				throw err;
			}
		},
		exec: async (sql: string) => {
			db.exec(sql);
			return { count: 0, duration: 0 };
		}
	};
	return d1 as unknown as D1Database;
}
