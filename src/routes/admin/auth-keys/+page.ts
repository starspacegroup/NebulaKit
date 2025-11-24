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
	} catch (error) {
		console.error('Failed to load auth keys:', error);
	}

	return {
		keys: []
	};
};
