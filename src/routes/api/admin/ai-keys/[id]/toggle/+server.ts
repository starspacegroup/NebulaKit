import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// PATCH - Toggle enabled status
export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!locals.user?.isOwner) {
		throw error(403, 'Admin access required');
	}

	try {
		const { id } = params;
		const data = await request.json();

		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}

		// Get existing key
		const existingData = await platform.env.KV.get(`ai_key:${id}`);
		if (!existingData) {
			throw error(404, 'Key not found');
		}

		const existing = JSON.parse(existingData);

		// Update enabled status
		const updatedKey = {
			...existing,
			enabled: data.enabled,
			updatedAt: new Date().toISOString()
		};

		// Store updated key
		await platform.env.KV.put(`ai_key:${id}`, JSON.stringify(updatedKey));

		// Return key without apiKey field
		const responseKey = { ...updatedKey };
		delete responseKey.apiKey;

		return json({ success: true, key: responseKey });
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to toggle AI key:', err);
		throw error(500, 'Failed to toggle AI provider key');
	}
};
