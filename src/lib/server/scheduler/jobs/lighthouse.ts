import { isStrategy, runLighthouseSweep } from '$lib/server/lighthouse';
import type { ScheduledJob } from '../types';

/**
 * Re-audit every public page through PageSpeed Insights and store the results.
 * `?strategy=desktop` audits the desktop form factor instead of mobile.
 *
 * Daily is plenty: PSI's keyless rate limit will not tolerate much more, and
 * the scores do not move hourly. The sweep is sequential, so it is slow on
 * purpose and the timeout is generous.
 */
export const LIGHTHOUSE_JOB: ScheduledJob = {
	id: 'lighthouse',
	cron: '43 4 * * *',
	path: '/api/cron/lighthouse',
	description: 'Re-audit every public page with PageSpeed Insights (Lighthouse).',
	timeoutMs: 300_000,
	async run({ db, env, params }) {
		const requested = params.get('strategy');
		const strategy = isStrategy(requested) ? requested : 'mobile';
		const result = await runLighthouseSweep(db, {
			strategy,
			// Optional. Without it PSI still answers, at a much lower rate limit.
			apiKey: env.PAGESPEED_API_KEY
		});
		return { strategy, ...result };
	}
};
