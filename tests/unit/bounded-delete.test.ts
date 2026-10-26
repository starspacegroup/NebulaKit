import { describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { deleteInBatches } from '../../src/lib/server/bounded-delete';

async function seeded(rows: number) {
	const db = createSqliteD1();
	await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)');
	for (let i = 0; i < rows; i++) {
		await db
			.prepare('INSERT INTO t (id, n) VALUES (?, ?)')
			.bind(`id${String(i).padStart(4, '0')}`, i)
			.run();
	}
	return db;
}

const left = async (db: any) => (await db.prepare('SELECT COUNT(*) n FROM t').first()).n;

describe('deleteInBatches', () => {
	it('drains a table in batches when the budget allows', async () => {
		const db = await seeded(25);
		const result = await deleteInBatches(db, {
			table: 't',
			where: 'n < ?',
			binds: [20],
			batchSize: 7,
			budget: 100
		});
		expect(result).toEqual({ deleted: 20, budgetExhausted: false });
		expect(await left(db)).toBe(5);
	});

	it('stops at the budget and reports it, leaving the rest for next time', async () => {
		const db = await seeded(25);
		const result = await deleteInBatches(db, {
			table: 't',
			where: '1 = 1',
			batchSize: 4,
			budget: 10,
			keyColumn: 'id'
		});
		expect(result).toEqual({ deleted: 10, budgetExhausted: true });
		expect(await left(db)).toBe(15);
		// Oldest keys go first.
		const first = await (await db.prepare('SELECT MIN(id) m FROM t').first<any>()).m;
		expect(first).toBe('id0010');
	});

	it('never deletes more than a batch per statement', async () => {
		const db = await seeded(10);
		const sizes: number[] = [];
		const spy = {
			prepare: (sql: string) => {
				const stmt = db.prepare(sql);
				return {
					bind: (...args: unknown[]) => {
						sizes.push(args[args.length - 1] as number);
						return stmt.bind(...args);
					}
				};
			}
		} as any;
		await deleteInBatches(spy, { table: 't', where: '1 = 1', batchSize: 3, budget: 8 });
		expect(sizes).toEqual([3, 3, 2]);
	});

	it('does nothing for a zero or unusable budget, and falls back for NaN', async () => {
		const db = await seeded(5);
		expect(await deleteInBatches(db, { table: 't', where: '1 = 1', budget: 0 })).toEqual({
			deleted: 0,
			budgetExhausted: true
		});
		expect(await left(db)).toBe(5);
		const nan = await deleteInBatches(db, {
			table: 't',
			where: '1 = 1',
			budget: Number.NaN,
			batchSize: Number.NaN
		});
		expect(nan).toEqual({ deleted: 5, budgetExhausted: false });
	});

	it('clamps an absurd batch size', async () => {
		const db = await seeded(3);
		const result = await deleteInBatches(db, { table: 't', where: '1 = 1', batchSize: -5 });
		expect(result.deleted).toBe(3);
	});
});
