import { requireAdmin } from '$lib/server/auth-guards';
import { error } from '@sveltejs/kit';
import { AUDIT_RETENTION_DAYS, listAudit, listAuditActions, toAuditEvent } from '$lib/server/audit';
import type { PageServerLoad } from './$types';

/**
 * /admin/audit — who changed what (docs/AUDIT_LOG.md). Any admin may read it;
 * nobody can edit it from here. Filters are applied in SQL (`?actor=`,
 * `?action=`); the AuditLog module adds search and paging over what is loaded.
 */
export const load: PageServerLoad = async ({ locals, platform, url }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');

	const actor = url.searchParams.get('actor')?.trim().slice(0, 100) || undefined;
	const action = url.searchParams.get('action')?.trim().slice(0, 100) || undefined;
	const rows = await listAudit(db, { actor, action, limit: 500 });
	return {
		events: rows.map(toAuditEvent),
		actions: await listAuditActions(db),
		actor: actor ?? '',
		action: action ?? '',
		retentionDays: AUDIT_RETENTION_DAYS
	};
};
