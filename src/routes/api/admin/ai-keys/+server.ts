import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all AI keys
export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.user?.isOwner) {
		throw error(403, 'Admin access required');
	}

	try {
		if (!platform?.env?.KV) {
			return json({ keys: [] });
		}

		// Get list of key IDs
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (!keysList) {
			return json({ keys: [] });
		}

		const keyIds = JSON.parse(keysList);
		const keys = [];

		// Fetch each key
		for (const keyId of keyIds) {
			const keyData = await platform.env.KV.get(`ai_key:${keyId}`);
			if (keyData) {
				const key = JSON.parse(keyData);
				// Don't send the actual API key to the frontend
				delete key.apiKey;
				keys.push(key);
			}
		}

		return json({ keys });
	} catch (err) {
		console.error('Failed to fetch AI keys:', err);
		throw error(500, 'Failed to fetch AI provider keys');
	}
};

// POST - Create new AI key
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user?.isOwner) {
		throw error(403, 'Admin access required');
	}

	try {
		const data = await request.json();

		// Validate required fields
		if (!data.name || !data.apiKey) {
			throw error(400, 'Missing required fields');
		}

		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}

		// Generate unique ID
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();

		const newKey = {
			id,
			name: data.name,
			provider: data.provider,
			model: data.model,
			apiKey: data.apiKey, // Store the API key
			enabled: data.enabled !== undefined ? data.enabled : true, // Default to enabled
			voiceEnabled: data.voiceEnabled ?? false, // Voice chat disabled by default
			voiceModel: data.voiceModel || 'gpt-4o-realtime-preview-2024-12-17',
			createdAt
		};

		// Store in KV
		await platform.env.KV.put(`ai_key:${id}`, JSON.stringify(newKey));

		// Update the list of key IDs
		const keysList = await platform.env.KV.get('ai_keys_list');
		const keyIds = keysList ? JSON.parse(keysList) : [];
		keyIds.push(id);
		await platform.env.KV.put('ai_keys_list', JSON.stringify(keyIds));

		// Return key without apiKey field
		const responseKey = { ...newKey };
		delete responseKey.apiKey;

		return json({ success: true, key: responseKey });
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to create AI key:', err);
		throw error(500, 'Failed to create AI provider key');
	}
};
