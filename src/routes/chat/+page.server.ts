import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const load: ServerLoad = async ({ platform, locals }) => {
	// Check if any AI providers are enabled
	const hasProviders = await checkEnabledProviders(platform);

	// If no providers are enabled, redirect based on user role
	if (!hasProviders) {
		// If user is admin, redirect to admin panel
		if (locals.user?.isAdmin || locals.user?.isOwner) {
			throw redirect(302, '/admin');
		}
		// Otherwise redirect to home
		throw redirect(302, '/');
	}

	// If providers exist, allow access to chat page
	return {};
};

/**
 * Check if at least one enabled AI provider exists
 */
async function checkEnabledProviders(platform: App.Platform | undefined): Promise<boolean> {
	try {
		if (!platform?.env?.KV) {
			return false;
		}

		// Get list of key IDs
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (!keysList) {
			return false;
		}

		const keyIds = JSON.parse(keysList);

		// Check if at least one key is enabled
		for (const keyId of keyIds) {
			const keyData = await platform.env.KV.get(`ai_key:${keyId}`);
			if (keyData) {
				const key = JSON.parse(keyData);
				// If enabled is not explicitly false, consider it enabled
				if (key.enabled !== false) {
					return true;
				}
			}
		}

		return false;
	} catch (err) {
		console.error('Failed to check AI provider status:', err);
		// Default to false on error to be safe
		return false;
	}
}
