import { getActiveMeasurementId } from '$lib/server/analytics-config';
import { getCommandPaletteContentItems, syncContentTypes } from '$lib/services/cms';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, fetch, platform }) => {
	// Check if AI providers are enabled
	let hasAIProviders = false;
	let cmsPaletteItems: Awaited<ReturnType<typeof getCommandPaletteContentItems>> = [];
	try {
		const response = await fetch('/api/admin/ai-keys/status');
		if (response.ok) {
			const data = await response.json();
			hasAIProviders = data.hasProviders || false;
		}
	} catch (error) {
		console.error('Failed to check AI provider status:', error);
	}

	const db = platform?.env?.DB;
	if (db) {
		try {
			await syncContentTypes(db);
			cmsPaletteItems = await getCommandPaletteContentItems(db);
		} catch (error) {
			console.error('Failed to load CMS command palette items:', error);
		}
	}

	return {
		user: locals.user || null,
		hasAIProviders,
		cmsPaletteItems,
		// Optional Google Analytics tag (docs/ADMIN_STATS.md §7). Null unless an
		// owner connected one at /admin/analytics and left it enabled, so the
		// default build makes no third-party request. Sent for every path — the
		// per-page exclusion happens client-side, because this load does not
		// re-run on client-side navigation.
		gaMeasurementId: await getActiveMeasurementId(platform?.env?.KV)
	};
};
