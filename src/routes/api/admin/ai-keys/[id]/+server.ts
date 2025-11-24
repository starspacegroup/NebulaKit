import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// PUT - Update AI key
export const PUT: RequestHandler = async ({ params, request, platform }) => {
	try {
		const { id } = params;
		const data = await request.json();

		// Validate required fields
		if (!data.name) {
			throw error(400, 'Missing required fields');
		}

		const updatedKey = {
			id,
			name: data.name,
			provider: data.provider,
			model: data.model,
			updatedAt: new Date().toISOString()
		};

		// In production, update in KV:
		// const existing = await platform.env.KV.get(`ai_key:${id}`);
		// if (!existing) throw error(404, 'Key not found');
		// await platform.env.KV.put(`ai_key:${id}`, JSON.stringify({
		//   ...JSON.parse(existing),
		//   ...updatedKey,
		//   ...(data.apiKey && { apiKey: data.apiKey })
		// }));

		return json({ success: true, key: updatedKey });
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to update AI key:', err);
		throw error(500, 'Failed to update AI provider key');
	}
};

// DELETE - Delete AI key
export const DELETE: RequestHandler = async ({ params, platform }) => {
	try {
		const { id } = params;

		// In production, delete from KV:
		// await platform.env.KV.delete(`ai_key:${id}`);

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete AI key:', err);
		throw error(500, 'Failed to delete AI provider key');
	}
};
