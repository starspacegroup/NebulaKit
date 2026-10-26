import { error, fail } from '@sveltejs/kit';
import {
	API_SCOPES,
	createApiKey,
	isApiScope,
	listApiKeys,
	recentApiCalls,
	revokeApiKey
} from '@nebulakit/security';
import { requirePermission } from '$lib/server/auth-guards';
import type { Actions, PageServerLoad } from './$types';

/**
 * /admin/api-keys — the owner's screen for API access: create a key with
 * scopes and an expiry, see when each was last used, revoke in one click,
 * read the call log. Owner-only: a key can carry `site:admin`, so an
 * ordinary admin issuing one would be a privilege escalation.
 */
function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

export const load: PageServerLoad = async ({ locals, platform }) => {
	requirePermission(locals, 'api-keys');
	const db = database(platform);
	return {
		keys: await listApiKeys(db),
		calls: await recentApiCalls(db, { limit: 25 }),
		scopes: API_SCOPES,
		orchestratorConnected: Boolean(platform?.env?.ORCHESTRATOR_KEY_SHA256)
	};
};

const EXPIRY_DAYS = new Set(['7', '30', '90', '365', 'never']);

export const actions: Actions = {
	create: async ({ locals, platform, request }) => {
		const user = requirePermission(locals, 'api-keys');
		const db = database(platform);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const scopes = form.getAll('scopes').map(String);
		const expiry = String(form.get('expiry') ?? '90');
		if (!name || name.length > 100)
			return fail(400, { error: 'Give the key a name (100 characters at most).' });
		if (scopes.length === 0 || !scopes.every(isApiScope))
			return fail(400, { error: 'Pick at least one scope.' });
		if (!EXPIRY_DAYS.has(expiry)) return fail(400, { error: 'Pick an expiry.' });
		const expiresAt =
			expiry === 'never' ? null : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
		const { key, record } = await createApiKey(db, {
			name,
			scopes: scopes as never,
			expiresAt,
			createdBy: user.id
		});
		// Shown once, here, and never again.
		return { created: { key, name: record.name } };
	},
	revoke: async ({ locals, platform, request }) => {
		requirePermission(locals, 'api-keys');
		const db = database(platform);
		const id = String((await request.formData()).get('id') ?? '');
		if (!(await revokeApiKey(db, id)))
			return fail(404, { error: 'That key is already revoked or does not exist.' });
		return { revoked: id };
	}
};
