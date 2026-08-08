import { buildSessionCookieHeader, decodeSessionCookie } from '$lib/utils/session';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type SupportedProvider = 'github' | 'discord';
type SimulatedRole = 'user' | 'admin' | 'superadmin';
type SimulatedMode = 'login' | 'link';

function parseProvider(value: string | null): SupportedProvider | null {
	if (value === 'github' || value === 'discord') {
		return value;
	}

	return null;
}

function parseRole(value: string | null): SimulatedRole {
	if (value === 'admin' || value === 'superadmin') {
		return value;
	}

	return 'user';
}

function parseMode(value: string | null): SimulatedMode {
	if (value === 'link') {
		return 'link';
	}

	return 'login';
}

function buildDevUser(provider: SupportedProvider, role: SimulatedRole) {
	const suffix = crypto.randomUUID().slice(0, 8);
	const loginPrefix = provider === 'github' ? 'dev-github' : 'dev-discord';
	const login = `${loginPrefix}-${suffix}`;
	const isSuperadmin = role === 'superadmin';
	const isAdmin = role === 'admin' || isSuperadmin;
	const namePrefix = role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'User';

	return {
		id: `dev-${provider}-${suffix}`,
		login,
		email: `${login}@example.dev`,
		name: provider === 'github' ? `GitHub Dev ${namePrefix}` : `Discord Dev ${namePrefix}`,
		avatarUrl: undefined,
		isOwner: isSuperadmin,
		isAdmin,
		isPretend: true,
		simulatedConnections: [provider],
		githubLogin: provider === 'github' ? login : undefined
	};
}

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	if (!isDevAuthSimulationEnabled(url, platform)) {
		throw redirect(302, '/auth/login?error=not_configured');
	}

	const provider = parseProvider(url.searchParams.get('provider'));
	if (!provider) {
		throw redirect(302, '/auth/login?error=oauth_failed');
	}

	const mode = parseMode(url.searchParams.get('mode'));
	if (mode === 'link') {
		const existingUser = await decodeSessionCookie(
			cookies.get('session'),
			platform?.env?.SESSION_SECRET
		);

		if (existingUser?.isPretend) {
			const simulatedConnections = Array.from(
				new Set([...(existingUser.simulatedConnections || []), provider])
			);

			return new Response(null, {
				status: 302,
				headers: {
					Location: new URL(`/profile?linked=${provider}`, url.origin).toString(),
					'Set-Cookie': await buildSessionCookieHeader(
						{
							...existingUser,
							simulatedConnections
						},
						url,
						platform?.env?.SESSION_SECRET
					)
				}
			});
		}
	}

	const role = parseRole(url.searchParams.get('role'));
	const sessionUser = buildDevUser(provider, role);
	const redirectTarget = role === 'admin' || role === 'superadmin' ? '/admin' : '/';

	return new Response(null, {
		status: 302,
		headers: {
			Location: new URL(redirectTarget, url.origin).toString(),
			'Set-Cookie': await buildSessionCookieHeader(sessionUser, url, platform?.env?.SESSION_SECRET)
		}
	});
};
