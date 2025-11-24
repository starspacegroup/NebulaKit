import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Check if any enabled AI providers exist (public endpoint)
export const GET: RequestHandler = async ({ platform }) => {
	try {
		if (!platform?.env?.KV) {
			return json({ hasProviders: false });
		}

		// Get list of key IDs
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (!keysList) {
			return json({ hasProviders: false });
		}

		const keyIds = JSON.parse(keysList);

		// Check if at least one key is enabled
		for (const keyId of keyIds) {
			const keyData = await platform.env.KV.get(`ai_key:${keyId}`);
			if (keyData) {
				const key = JSON.parse(keyData);
				if (key.enabled !== false) {
					// If enabled is not explicitly false, consider it enabled
					return json({ hasProviders: true });
				}
			}
		}

		return json({ hasProviders: false });
	} catch (err) {
		console.error('Failed to check AI provider status:', err);
		// Default to false on error to be safe
		return json({ hasProviders: false });
	}
};
