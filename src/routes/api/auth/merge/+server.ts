import { mergeAccounts } from '$lib/services/account-merge';
import { verifyPassword } from '$lib/utils/passwords';
import { getUserAuthState } from '$lib/utils/user-auth-state';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface MergeUserRecord {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	github_avatar_url: string | null;
	is_admin: number;
	password_hash: string | null;
}

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body.password === 'string' ? body.password : '';

	if (!email || !password) {
		throw error(400, 'Email and password are required to merge an account.');
	}

	const sourceUser = await platform.env.DB.prepare(
		`SELECT u.id, u.email, u.name, u.github_login, u.github_avatar_url, u.is_admin, u.password_hash
		 FROM users u
		 LEFT JOIN user_login_aliases ula ON ula.user_id = u.id
		 WHERE lower(u.email) = lower(?) OR lower(ula.email) = lower(?)
		 LIMIT 1`
	)
		.bind(email, email)
		.first<MergeUserRecord>();

	if (!sourceUser?.password_hash) {
		throw error(401, 'Invalid email or password.');
	}

	if (sourceUser.id === locals.user.id) {
		throw error(400, 'You are already signed in to that account.');
	}

	const isValidPassword = await verifyPassword(password, sourceUser.password_hash);
	if (!isValidPassword) {
		throw error(401, 'Invalid email or password.');
	}

	await mergeAccounts(platform.env.DB as any, sourceUser.id, locals.user.id);

	const authState = await getUserAuthState(
		platform.env.DB as any,
		locals.user.id,
		locals.user.email
	);

	return json({ success: true, message: 'Account merged successfully.', ...authState });
};
