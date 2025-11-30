import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Toggle reset route enabled/disabled
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	// Only allow owner to change this setting
	if (!locals.user?.isOwner) {
		throw error(403, 'Only the owner can change this setting');
	}

	try {
		const data = await request.json();
		const disabled = !!data.disabled;

		if (!platform?.env?.KV) {
			throw error(500, 'KV storage not available');
		}

		if (disabled) {
			await platform.env.KV.put('reset_route_disabled', 'true');
			console.log('✓ Reset route disabled');
		} else {
			await platform.env.KV.delete('reset_route_disabled');
			console.log('✓ Reset route enabled');
		}

		return json({
			success: true,
			disabled
		});
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to update reset route setting:', err);
		throw error(500, 'Failed to update setting');
	}
};
