import { error, json } from '@sveltejs/kit';
import {
	aiKeySpec,
	getEncryptionStatus,
	readRecordWithSecret,
	redactRecord,
	sealRecordSecret
} from '$lib/server/secret-store';
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
			// Decrypts (and migrates legacy plaintext) so the hint is right, then
			// strips the secret: the browser only learns "configured" and the last 4.
			const result = await readRecordWithSecret(platform, `ai_key:${keyId}`, aiKeySpec(keyId));
			if (result) {
				keys.push({
					...redactRecord(result.record, aiKeySpec(keyId)),
					apiKeyStatus: result.status
				});
			}
		}

		return json({ keys, encryption: await getEncryptionStatus(platform) });
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
			// Support both single model and models array for backwards compatibility
			models: data.models || (data.model ? [data.model] : []),
			apiKey: data.apiKey, // Sealed below; never written as plaintext
			enabled: data.enabled !== undefined ? data.enabled : true, // Default to enabled
			voiceEnabled: data.voiceEnabled ?? false, // Voice chat disabled by default
			// Support both single voiceModel and voiceModels array
			voiceModels: data.voiceModels || (data.voiceModel ? [data.voiceModel] : []),
			createdAt
		};

		// Store in KV
		const sealedKey = await sealRecordSecret(platform, newKey, aiKeySpec(id), data.apiKey);
		await platform.env.KV.put(`ai_key:${id}`, JSON.stringify(sealedKey));

		// Update the list of key IDs
		const keysList = await platform.env.KV.get('ai_keys_list');
		const keyIds = keysList ? JSON.parse(keysList) : [];
		keyIds.push(id);
		await platform.env.KV.put('ai_keys_list', JSON.stringify(keyIds));

		// Return key without the secret
		const responseKey = redactRecord(sealedKey, aiKeySpec(id));

		return json({ success: true, key: responseKey });
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to create AI key:', err);
		throw error(500, 'Failed to create AI provider key');
	}
};
