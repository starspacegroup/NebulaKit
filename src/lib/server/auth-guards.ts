import { error } from '@sveltejs/kit';

export type AuthenticatedUser = NonNullable<App.Locals['user']>;

export function requireUser(locals: App.Locals): AuthenticatedUser {
	if (!locals.user) throw error(401, 'Authentication required');
	return locals.user;
}

/**
 * `isSuperAdmin` is honoured here for the same reason `stats-guard.ts` honours
 * it: downstream apps that add a superadmin tier sit ABOVE owner/admin, and
 * would otherwise pass the stats checks while being refused by every admin API.
 * These two files must agree. NebulaKit itself never sets the flag.
 */
export function requireAdmin(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (!user.isOwner && !user.isAdmin && !user.isSuperAdmin)
		throw error(403, 'Administrator access required');
	return user;
}

export function requireOwner(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (!user.isOwner && !user.isSuperAdmin) throw error(403, 'Owner access required');
	return user;
}
