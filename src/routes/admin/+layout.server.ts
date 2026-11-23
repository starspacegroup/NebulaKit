import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import {
	canRevealPii as computeCanRevealPii,
	isPiiRevealed,
	PII_REVEAL_COOKIE
} from '$lib/server/pii-mask';
import {
	canManageStatsConnection,
	canViewStats as computeCanViewStats
} from '$lib/server/stats-guard';

import { readAdminTimeZoneSetting } from '$lib/server/site-settings';
import { describeZone, resolveTimeZone, timeZoneSource, TZ_COOKIE } from '$lib/utils/timezone';

export const load: LayoutServerLoad = async ({ locals, cookies, platform }) => {
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

	// Admin clock (docs/ADMIN_TIMEZONE.md): the site setting wins, else the
	// browser's zone from the `tz` cookie, else UTC. The cookie is user input; it
	// is validated inside resolveTimeZone and never trusted beyond that.
	const timeZoneSetting = await readAdminTimeZoneSetting(platform?.env?.DB);
	const tzCookie = cookies.get(TZ_COOKIE);
	const timeZone = resolveTimeZone(timeZoneSetting, tzCookie);

	return {
		user: locals.user,
		timeZone,
		timeZoneSetting,
		timeZoneSource: timeZoneSource(timeZoneSetting, tzCookie),
		timeZoneLabel: describeZone(timeZone),
		canRevealPii,
		piiRevealed,
		// Whether the Dashboard shows stats. The page load checks this itself too.
		canViewStats: computeCanViewStats(locals.user),
		// Drives the owner-only Google Analytics nav entry.
		canManageAnalytics: canManageStatsConnection(locals.user)
	};
};
