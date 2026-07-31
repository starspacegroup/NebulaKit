import { error } from '@sveltejs/kit';

type StatsUser =
	| {
			isOwner?: boolean;
			isAdmin?: boolean;
			/** Downstream apps that add a superadmin tier are honoured automatically. */
			isSuperAdmin?: boolean;
			canViewStats?: boolean;
	  }
	| null
	| undefined;

/**
 * Stats-access policy (docs/ADMIN_STATS.md). The owner always sees the admin
 * Stats section; a plain admin needs the per-admin `can_view_stats` grant.
 *
 * This NARROWS access among admins — a non-admin can't reach /admin at all
 * (layout guard), so it never widens access beyond the admin surface.
 */
export function canViewStats(user: StatsUser): boolean {
	if (!user) return false;
	return Boolean(user.isOwner || user.isSuperAdmin || user.canViewStats);
}

/** Only the owner may grant the stats permission to others, or manage a
 *  connected third-party analytics account. Admins with `can_view_stats` read
 *  only. */
export function canManageStatsConnection(user: StatsUser): boolean {
	if (!user) return false;
	return Boolean(user.isOwner || user.isSuperAdmin);
}

/** Throw 403 unless the user may view stats. Defence in depth on stats routes:
 *  the admin layout guard runs first, this stops an admin without the grant. */
export function assertCanViewStats(user: StatsUser): void {
	if (!canViewStats(user)) {
		throw error(403, 'Stats access required');
	}
}
