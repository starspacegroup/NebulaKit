import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import {
	canRevealPii as computeCanRevealPii,
	isPiiRevealed,
	PII_REVEAL_COOKIE
} from '$lib/server/pii-mask';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/auth/login?error=unauthorized');
	}

	// Check if user is the OAuth app owner or an admin
	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw redirect(302, '/?error=forbidden');
	}

	// PII masking state for admin views (reveal is owner-only; masked by default).
	const canRevealPii = computeCanRevealPii(locals.user);
	const piiRevealed = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));

	return {
		user: locals.user,
		canRevealPii,
		piiRevealed
	};
};
