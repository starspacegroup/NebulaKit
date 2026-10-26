import {
	clearFailures,
	clientAddress,
	isThrottled,
	recordFailure
} from '$lib/server/login-throttle';
import { resolveOwnerStatus } from '$lib/utils/auth-identity';
import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import { verifyPassword } from '$lib/utils/passwords';
import { trackSignIn } from '$lib/server/sign-ins';
import { createAuthSession } from '$lib/utils/db';
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

	// A brake on guessing: counts failures per address and per email in KV, and
	// fails open when KV is missing (src/lib/server/login-throttle.ts).
	const kv = platform.env.KV;
	const ip = clientAddress(request);
	if (await isThrottled(kv, ip, email)) {
		await trackSignIn(platform, request, {
			method: 'password',
			success: false,
			reason: 'throttled'
		});
		throw error(429, 'Too many attempts. Try again in a few minutes.');
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
		await recordFailure(kv, ip, email);
		await trackSignIn(platform, request, {
			method: 'password',
			success: false,
			reason: 'unknown account'
		});
		throw error(401, 'Invalid email or password.');
	}

	const isValidPassword = await verifyPassword(password, user.password_hash);
	if (!isValidPassword) {
		await recordFailure(kv, ip, email);
		await trackSignIn(platform, request, {
			method: 'password',
			success: false,
			userId: user.id,
			reason: 'wrong password'
		});
		throw error(401, 'Invalid email or password.');
	}
	await clearFailures(kv, ip, email);

	const isOwner = await resolveOwnerStatus(platform, user);
	const sessionUser = createSessionUser({
		...user,
		isOwner,
		isAdmin: user.is_admin === 1 || isOwner
	});

	const redirectTo = sessionUser.isAdmin ? '/admin' : '/';
	const sessionId = await createAuthSession(platform.env.DB, sessionUser);
	await trackSignIn(platform, request, { method: 'password', success: true, userId: user.id });

	return json(
		{
			success: true,
			redirectTo,
			configuredProviders: await getConfiguredAuthProviders(platform)
		},
		{
			status: 200,
			headers: {
				'Set-Cookie': buildSessionCookieHeader(sessionId, url)
			}
		}
	);
};
