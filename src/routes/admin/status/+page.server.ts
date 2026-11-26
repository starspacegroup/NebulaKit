import { error, fail } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/auth-guards';
import { addIncidentUpdate, createIncident, getStatusSnapshot } from '$lib/server/status';
import { COMPONENTS, IMPACTS, INCIDENT_STATUSES } from '$lib/status/logic';
import type { Actions, PageServerLoad } from './$types';

function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

/**
 * /admin/status: post and update incidents on the public status page. The checks open and
 * close their own; this is for what they cannot see (a provider outage, planned maintenance).
 * Owner and superadmin only: what is posted here is public the moment it is saved.
 */
export const load: PageServerLoad = async ({ locals, platform }) => {
	requireOwner(locals);
	const snapshot = await getStatusSnapshot(database(platform));
	return {
		snapshot,
		components: COMPONENTS.map((c) => ({ id: c.id, name: c.name })),
		impacts: IMPACTS,
		statuses: INCIDENT_STATUSES
	};
};

export const actions: Actions = {
	create: async ({ locals, platform, request }) => {
		const user = requireOwner(locals);
		const db = database(platform);
		const form = await request.formData();
		const result = await createIncident(db, {
			title: String(form.get('title') ?? ''),
			impact: String(form.get('impact') ?? ''),
			status: String(form.get('status') ?? ''),
			components: form.getAll('components').map(String),
			message: String(form.get('message') ?? ''),
			by: user.id
		});
		return result.ok
			? { action: 'create', message: 'Posted. It is on the public status page now.' }
			: fail(400, { action: 'create', problems: [result.error] });
	},

	update: async ({ locals, platform, request }) => {
		const user = requireOwner(locals);
		const db = database(platform);
		const form = await request.formData();
		const incidentId = Number(form.get('incident_id'));
		const result = await addIncidentUpdate(db, {
			incidentId,
			status: String(form.get('status') ?? ''),
			message: String(form.get('message') ?? ''),
			by: user.id
		});
		return result.ok
			? { action: 'update', incident: incidentId, message: 'Update posted.' }
			: fail(400, { action: 'update', incident: incidentId, problems: [result.error] });
	}
};
