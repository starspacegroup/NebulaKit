import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/admin/users');
		if (response.ok) {
			const data = await response.json();
			return {
				users: data.users || []
			};
		}
	} catch (error) {
		console.error('Failed to load users:', error);
	}

	return {
		users: []
	};
};
