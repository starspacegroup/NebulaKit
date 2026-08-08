import { requireOwner } from '$lib/server/auth-guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Reset setup configuration
export const POST: RequestHandler = async ({ platform, cookies, locals }) => {
	// This wipes the owner identity and the setup lock, which together are the
	// only things standing between an anonymous caller and re-owning the site
	// via /api/setup. It was previously guarded solely by the KV flag below —
	// a data value, not an authorization check.
	requireOwner(locals);

	try {
		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}
		if (!platform.env.DB) {
			throw error(500, 'Database not available');
		}

		// Kept as defence in depth: the owner can still bolt this shut entirely.
		const resetDisabled = await platform.env.KV.get('reset_route_disabled');
		if (resetDisabled === 'true') {
			throw error(403, 'Reset route has been disabled by the administrator');
		}

		// Delete setup-related KV keys
		const keysToDelete = [
			'auth_config:github',
			'auth_config:discord',
			'github_owner_id',
			'github_owner_username',
			'admin_first_login_completed'
		];

		await Promise.all(keysToDelete.map((key) => platform.env.KV.delete(key)));
		await platform.env.DB.prepare('DELETE FROM sessions').run();

		// Clear the session cookie to force re-login
		cookies.delete('session', { path: '/' });

		return json({
			success: true,
			message: 'Configuration reset successfully. You will be redirected to the setup page.'
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to reset configuration:', err);
		throw error(500, 'Failed to reset configuration');
	}
};
