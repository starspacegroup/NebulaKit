import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, fetch }) => {
	// Check if AI providers are enabled
	let hasAIProviders = false;
	try {
		const response = await fetch('/api/admin/ai-keys/status');
		if (response.ok) {
			const data = await response.json();
			hasAIProviders = data.hasProviders || false;
		}
	} catch (error) {
		console.error('Failed to check AI provider status:', error);
	}

	return {
		user: locals.user || null,
		hasAIProviders
	};
};
