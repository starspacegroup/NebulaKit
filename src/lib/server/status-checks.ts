/**
 * What is actually measured, one function per component in `COMPONENTS`
 * (`$lib/status/logic.ts`). A check returns a `Reading`: operational, degraded or down, how
 * long it took, and one plain sentence for the public page.
 *
 * To measure something else: add its component to `COMPONENTS`, add its check here (the test
 * `status-checks.test.ts` fails if a listed component has none), and write the sentence a
 * visitor should read when it is down. Never put an address, a key or an error message in
 * `detail`: it is shown to everyone.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { readDatabase, readWebsite, type Reading, type WebsiteProbe } from '$lib/status/logic';

export interface CheckContext {
	db: D1Database;
	/** What the outside probe saw of the website this round, when it supplied one. */
	website: WebsiteProbe | null;
}

export type StatusCheck = (ctx: CheckContext) => Promise<Reading>;

/** `SELECT 1`, timed. A throw is a down database, never an error for the caller. */
export async function probeDatabase(db: D1Database): Promise<{ ok: boolean; ms: number | null }> {
	const started = Date.now();
	try {
		await db.prepare('SELECT 1 AS ok').first();
		return { ok: true, ms: Date.now() - started };
	} catch {
		return { ok: false, ms: null };
	}
}

export const STATUS_CHECKS: Record<string, StatusCheck> = {
	website: async ({ website }) => readWebsite(website),
	database: async ({ db }) => readDatabase(await probeDatabase(db))
};
