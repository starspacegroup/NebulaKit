import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import {
	canRevealPii as computeCanRevealPii,
	isPiiRevealed,
	PII_REVEAL_COOKIE
} from '$lib/server/pii-mask';
import { canViewStats as computeCanViewStats } from '$lib/server/stats-guard';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/auth/login?error=unauthorized');
	}

	// Check if user is the OAuth app owner or an admin. The predicate must match
	// `requireAdmin` — including `isSuperAdmin`, the downstream tier above owner —
	// or a superadmin would pass every admin API and still be bounced from the UI.
	// This route redirects rather than throwing, so the check is spelled out here
	// instead of calling the guard.
	if (!locals.user.isOwner && !locals.user.isAdmin && !locals.user.isSuperAdmin) {
		throw redirect(302, '/?error=forbidden');
	}

	// PII masking state for admin views (reveal is owner-only; masked by default).
	const canRevealPii = computeCanRevealPii(locals.user);
	const piiRevealed = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));

	return {
		user: locals.user,
		canRevealPii,
		piiRevealed,
		// Drives the Stats nav entry. The route enforces this itself too — this
		// only keeps a link the admin can't open out of the sidebar.
		canViewStats: computeCanViewStats(locals.user)
	};
};
