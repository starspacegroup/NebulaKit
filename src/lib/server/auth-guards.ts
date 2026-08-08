import { error } from '@sveltejs/kit';

export type AuthenticatedUser = NonNullable<App.Locals['user']>;

export function requireUser(locals: App.Locals): AuthenticatedUser {
	if (!locals.user) throw error(401, 'Authentication required');
	return locals.user;
}

export function requireAdmin(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (!user.isOwner && !user.isAdmin) throw error(403, 'Administrator access required');
	return user;
}

export function requireOwner(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (!user.isOwner) throw error(403, 'Owner access required');
	return user;
}
