import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import { verifyPassword } from '$lib/utils/passwords';
import { buildSessionCookieHeader, createSessionUser } from '$lib/utils/session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface LoginUserRecord {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	github_avatar_url: string | null;
	is_admin: number;
	password_hash: string | null;
}

async function resolveOwnerStatus(
	platform: App.Platform | undefined,
	user: LoginUserRecord
): Promise<boolean> {
	let ownerId = platform?.env?.GITHUB_OWNER_ID;
	let ownerUsername: string | null = null;

	if (ownerId && Number.isNaN(Number.parseInt(ownerId, 10))) {
		ownerUsername = ownerId;
		ownerId = undefined;
	}

	if (platform?.env?.KV) {
		try {
			if (!ownerId) {
				ownerId = (await platform.env.KV.get('github_owner_id')) || undefined;
			}
			if (!ownerUsername) {
				ownerUsername = await platform.env.KV.get('github_owner_username');
			}
		} catch {
			// Ignore owner lookup failures.
		}
	}

	if (ownerUsername && user.github_login?.toLowerCase() === ownerUsername.toLowerCase()) {
		return true;
	}

	if (!ownerId || !platform?.env?.DB) {
		return false;
	}

	if (user.id === ownerId) {
		return true;
	}

	try {
		const githubLink = await platform.env.DB.prepare(
			'SELECT provider_account_id FROM oauth_accounts WHERE user_id = ? AND provider = ?'
		)
			.bind(user.id, 'github')
			.first<{ provider_account_id: string }>();

		return githubLink?.provider_account_id === ownerId;
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async ({ platform, request, url }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body.password === 'string' ? body.password : '';

	if (!email || !password) {
		throw error(400, 'Email and password are required.');
	}

	const user = await platform.env.DB.prepare(
		`SELECT u.id, u.email, u.name, u.github_login, u.github_avatar_url, u.is_admin, u.password_hash
		 FROM users u
		 LEFT JOIN user_login_aliases ula ON ula.user_id = u.id
		 WHERE lower(u.email) = lower(?) OR lower(ula.email) = lower(?)
		 LIMIT 1`
	)
		.bind(email, email)
		.first<LoginUserRecord>();

	if (!user?.password_hash) {
		throw error(401, 'Invalid email or password.');
	}

	const isValidPassword = await verifyPassword(password, user.password_hash);
	if (!isValidPassword) {
		throw error(401, 'Invalid email or password.');
	}

	const isOwner = await resolveOwnerStatus(platform, user);
	const sessionUser = createSessionUser({
		...user,
		isOwner,
		isAdmin: user.is_admin === 1 || isOwner
	});

	const redirectTo = sessionUser.isAdmin ? '/admin' : '/';

	return json(
		{
			success: true,
			redirectTo,
			configuredProviders: await getConfiguredAuthProviders(platform)
		},
		{
			status: 200,
			headers: {
				'Set-Cookie': buildSessionCookieHeader(sessionUser, url)
			}
		}
	);
};
