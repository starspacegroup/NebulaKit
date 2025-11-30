import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Reset setup configuration
export const POST: RequestHandler = async ({ platform, cookies }) => {
	try {
		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}

		// Check if reset route is disabled via admin settings
		const resetDisabled = await platform.env.KV.get('reset_route_disabled');
		if (resetDisabled === 'true') {
			throw error(403, 'Reset route has been disabled by the administrator');
		}

		// Delete setup-related KV keys
		const keysToDelete = [
			'auth_config:github',
			'github_owner_id',
			'github_owner_username',
			'admin_first_login_completed'
		];

		for (const key of keysToDelete) {
			try {
				await platform.env.KV.delete(key);
				console.log(`✓ Deleted KV key: ${key}`);
			} catch (err) {
				console.warn(`Failed to delete KV key ${key}:`, err);
			}
		}

		// Clear the session cookie to force re-login
		cookies.delete('session', { path: '/' });

		console.log('✓ Setup configuration reset complete');

		return json({
			success: true,
			message: 'Configuration reset successfully. You will be redirected to the setup page.'
		});
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to reset configuration:', err);
		throw error(500, 'Failed to reset configuration');
	}
};
