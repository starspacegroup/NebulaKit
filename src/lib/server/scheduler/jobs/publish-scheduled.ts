import { runDueProofs } from '$lib/cms/go-live';
import { runTimestampProofJob } from '$lib/content-proof/proof-job';
import type { ScheduledJob } from '../types';

/**
 * Catch-up after scheduled publishing: start the timestamp proof for items that
 * went live since the last run and have not had one. Scheduled items need no job
 * to appear (their date is checked on every read); this only covers the proof
 * for an item nobody has opened yet. See docs/CMS_SCHEDULING.md.
 */
export const PUBLISH_SCHEDULED_JOB: ScheduledJob = {
	id: 'publish-scheduled',
	cron: '37 * * * *',
	path: '/api/cron/publish-scheduled',
	description:
		'Start timestamp proofs for scheduled items that went live and nobody has opened yet.',
	timeoutMs: 60_000,
	async run({ db, origin }) {
		if (!origin) throw new Error('publish-scheduled needs the request origin to build item URLs');
		const started = await runDueProofs(db, origin, runTimestampProofJob);
		return { started };
	}
};
