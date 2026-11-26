import { recordStatus } from '$lib/server/status';
import type { WebsiteProbe } from '$lib/status/logic';
import type { ScheduledJob } from '../types';

/**
 * What the cron Worker saw when it fetched `/api/status/ping` from outside, as query
 * parameters on its call: `?web=ok|fail&ms=120&http=200`. Absent (a manual run, another
 * scheduler) means no outside view this round, and the website counts as up because the
 * check itself just ran inside it.
 */
export function websiteProbeFrom(params: URLSearchParams): WebsiteProbe | null {
	const web = params.get('web');
	if (web !== 'ok' && web !== 'fail') return null;
	const number = (raw: string | null) => {
		if (!raw || !/^\d{1,7}$/.test(raw)) return null;
		return Number(raw);
	};
	return { ok: web === 'ok', ms: number(params.get('ms')), httpStatus: number(params.get('http')) };
}

/**
 * One round of the public status page's checks, every minute. Its absence is itself a signal:
 * the page says "Status checks are delayed" when the newest round is more than five minutes
 * old, so a stopped scheduler never reads as an all-clear.
 */
export const STATUS_CHECK_JOB: ScheduledJob = {
	id: 'status-check',
	cron: '* * * * *',
	path: '/api/cron/status-check',
	description: 'Check the website and database for the public status page.',
	timeoutMs: 20_000,
	async run({ db, params, now }) {
		const result = await recordStatus(
			db,
			{ website: websiteProbeFrom(params) },
			new Date(now * 1000)
		);
		return {
			components: Object.fromEntries(
				Object.entries(result.components).map(([id, c]) => [id, c.status])
			)
		};
	}
};
