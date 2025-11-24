import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all AI keys
export const GET: RequestHandler = async ({ platform }) => {
	try {
		// For now, return mock data
		// In production, this would fetch from KV storage
		const keys: any[] = [
			// Mock data structure
		];

		return json({ keys });
	} catch (err) {
		console.error('Failed to fetch AI keys:', err);
		throw error(500, 'Failed to fetch AI provider keys');
	}
};

// POST - Create new AI key
export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		// Validate required fields
		if (!data.name || !data.apiKey) {
			throw error(400, 'Missing required fields');
		}

		// Generate unique ID
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();

		const newKey = {
			id,
			name: data.name,
			provider: data.provider,
			model: data.model,
			createdAt
		};

		// In production, store in KV:
		// await platform.env.KV.put(`ai_key:${id}`, JSON.stringify({
		//   ...newKey,
		//   apiKey: data.apiKey // Store encrypted
		// }));

		return json({ success: true, key: newKey });
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to create AI key:', err);
		throw error(500, 'Failed to create AI provider key');
	}
};
