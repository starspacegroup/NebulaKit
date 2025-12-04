import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// PUT - Update AI key
export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!locals.user?.isOwner) {
		throw error(403, 'Admin access required');
	}

	try {
		const { id } = params;
		const data = await request.json();

		// Validate required fields
		if (!data.name) {
			throw error(400, 'Missing required fields');
		}

		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}

		// Get existing key
		const existingData = await platform.env.KV.get(`ai_key:${id}`);
		if (!existingData) {
			throw error(404, 'Key not found');
		}

		const existing = JSON.parse(existingData);

		// Update key data
		const updatedKey = {
			...existing,
			name: data.name,
			provider: data.provider,
			model: data.model,
			enabled: data.enabled !== undefined ? data.enabled : existing.enabled,
			voiceEnabled:
				data.voiceEnabled !== undefined ? data.voiceEnabled : (existing.voiceEnabled ?? false),
			voiceModel: data.voiceModel || existing.voiceModel || 'gpt-4o-realtime-preview-2024-12-17',
			updatedAt: new Date().toISOString()
		};

		// Update API key if provided
		if (data.apiKey) {
			updatedKey.apiKey = data.apiKey;
		}

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
		console.error('Failed to update AI key:', err);
		throw error(500, 'Failed to update AI provider key');
	}
};

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

// DELETE - Delete AI key
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!locals.user?.isOwner) {
		throw error(403, 'Admin access required');
	}

	try {
		const { id } = params;

		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}

		// Delete the key
		await platform.env.KV.delete(`ai_key:${id}`);

		// Update the list of key IDs
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (keysList) {
			const keyIds = JSON.parse(keysList);
			const updatedKeyIds = keyIds.filter((keyId: string) => keyId !== id);
			await platform.env.KV.put('ai_keys_list', JSON.stringify(updatedKeyIds));
		}

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete AI key:', err);
		throw error(500, 'Failed to delete AI provider key');
	}
};
