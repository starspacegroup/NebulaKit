import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/admin/auth-keys');
		if (response.ok) {
			const data = await response.json();
			return {
				keys: data.keys || []
			};
		}
		throw error(response.status || 500, 'Failed to load authentication keys');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Failed to load auth keys:', err);
		throw error(500, 'Failed to load authentication keys');
	}
};
