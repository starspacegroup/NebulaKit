import type { D1Database } from '@cloudflare/workers-types';

/**
 * Batched, budgeted deletes for retention jobs.
 *
 * A retention `DELETE` is the most dangerous statement an app owns. It runs
 * against the tables that grow fastest, it is written when they are small, and
 * nobody re-reads it once it works. On D1 the binding constraint is **writes**:
 * the free tier allows about 100k rows written a day, and a delete costs one
 * write per row plus one per index. One unbounded `DELETE` over months of
 * backlog can spend the whole day's allowance in a single statement, taking
 * live writes down with it.
 *
 * So retention deletes go through here: a bounded subselect on a key column,
 * repeated until a row budget is spent. A big backlog drains over successive
 * runs instead of in one destructive pass.
 *
 * SECURITY: `table`, `where` and `keyColumn` are interpolated into SQL. They
 * must be internal constants, never user input.
 */

export interface BoundedDeleteResult {
	deleted: number;
	/** True when the budget ran out while rows may remain. The next run continues. */
	budgetExhausted: boolean;
}

export interface BoundedDeleteOptions {
	table: string;
	/** Predicate without the `WHERE` keyword. */
	where: string;
	binds?: unknown[];
	/** Rows per statement. Clamped to 1..10000. */
	batchSize?: number;
	/** Rows to delete in total across batches. */
	budget?: number;
	/** Key used to bound each batch. `rowid` works for any ordinary table. */
	keyColumn?: string;
}

const DEFAULT_BATCH = 1000;
const DEFAULT_BUDGET = 5000;

export async function deleteInBatches(
	db: D1Database,
	options: BoundedDeleteOptions
): Promise<BoundedDeleteResult> {
	const { table, where, binds = [], keyColumn = 'rowid' } = options;
	const result: BoundedDeleteResult = { deleted: 0, budgetExhausted: false };

	// Number() gives NaN rather than nullish for garbage, and NaN would reach the
	// query as `LIMIT NaN`.
	const budget = Number(options.budget ?? DEFAULT_BUDGET);
	const maxRows = Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : DEFAULT_BUDGET;
	const batch = Number(options.batchSize ?? DEFAULT_BATCH);
	const size = Number.isFinite(batch)
		? Math.max(1, Math.min(10000, Math.floor(batch)))
		: DEFAULT_BATCH;

	const sql = `DELETE FROM ${table} WHERE ${keyColumn} IN (
		SELECT ${keyColumn} FROM ${table} WHERE ${where} ORDER BY ${keyColumn} LIMIT ?
	)`;

	for (;;) {
		const remaining = maxRows - result.deleted;
		if (remaining <= 0) {
			// Spent exactly. Rows may or may not remain; say so rather than guess.
			result.budgetExhausted = true;
			break;
		}
		const take = Math.min(size, remaining);
		const run = await db
			.prepare(sql)
			.bind(...binds, take)
			.run();
		const removed = Number(run.meta?.changes ?? 0);
		result.deleted += removed;
		// A short batch means the table is drained.
		if (removed < take) break;
	}

	return result;
}
