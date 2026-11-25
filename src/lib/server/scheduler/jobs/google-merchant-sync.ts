import { listingContext } from '$lib/server/google-feed';
import { runMerchantSync } from '$lib/server/google-merchant';
import type { CommerceEnv } from '$lib/server/site-info';
import type { ScheduledJob } from '../types';

/**
 * Push product changes to Google Merchant Center through the Merchant API.
 * OFF unless the owner enables it in /admin/products/google and stores a
 * service-account key; while off, a tick is one settings read. Bounded: one
 * scan page and at most 100 writes per run, resuming from a cursor.
 */
export const GOOGLE_MERCHANT_SYNC_JOB: ScheduledJob = {
	id: 'google-merchant-sync',
	cron: '*/10 * * * *',
	path: '/api/cron/google-merchant-sync',
	description: 'Send changed products to Google Merchant Center (off unless enabled).',
	timeoutMs: 25_000,
	async run({ db, env, now, signal }) {
		const ctx = await listingContext(db, env as unknown as CommerceEnv, now * 1000);
		const outcome = await runMerchantSync({
			db,
			platform: { env } as App.Platform,
			fetch: (input, init) => fetch(input, init),
			ctx,
			nowMs: now * 1000,
			signal
		});
		return { ...outcome };
	}
};
