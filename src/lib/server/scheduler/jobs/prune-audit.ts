import { AUDIT_RETENTION_DAYS, pruneAudit } from '$lib/server/audit';
import { pruneSignIns } from '$lib/server/sign-ins';
import type { ScheduledJob } from '../types';

/**
 * Drop admin audit rows past their retention window (365 days) and sign-in
 * events past theirs (90 days). Sign-in events are also pruned as new ones are
 * written; this covers a site that turned tracking off and so writes no more.
 */
export const PRUNE_AUDIT_JOB: ScheduledJob = {
	id: 'prune-audit',
	cron: '29 5 * * *',
	path: '/api/cron/prune-audit',
	description: 'Delete audit rows older than 365 days and sign-in events older than 90 days.',
	timeoutMs: 30_000,
	async run({ db }) {
		const pruned = await pruneAudit(db, AUDIT_RETENTION_DAYS);
		const prunedSignIns = await pruneSignIns(db);
		return { retentionDays: AUDIT_RETENTION_DAYS, pruned, prunedSignIns };
	}
};
