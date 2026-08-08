import { createSession } from '$lib/utils/db';
import { hashPassword, validatePassword } from '$lib/utils/passwords';
import { buildDatabaseSessionCookieHeader } from '$lib/utils/session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ExistingUser {
	id: string;
}

export const POST: RequestHandler = async ({ platform, request, url }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body.password === 'string' ? body.password : '';
	const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

	if (!name || !email || !password || !confirmPassword) {
		throw error(400, 'Name, email, password, and confirmation are required.');
	}

	if (password !== confirmPassword) {
		throw error(400, 'Passwords do not match.');
	}

	const passwordValidationError = validatePassword(password);
	if (passwordValidationError) {
		throw error(400, passwordValidationError);
	}

	const existingUser = await platform.env.DB.prepare(
		`SELECT u.id
		 FROM users u
		 LEFT JOIN user_login_aliases ula ON ula.user_id = u.id
		 WHERE lower(u.email) = lower(?) OR lower(ula.email) = lower(?)
		 LIMIT 1`
	)
		.bind(email, email)
		.first<ExistingUser>();

	if (existingUser) {
		throw error(409, 'An account with that email already exists.');
	}

	const userId = crypto.randomUUID();
	const passwordHash = await hashPassword(password);

	await platform.env.DB.prepare(
		`INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
		 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
	)
		.bind(userId, email, name, passwordHash)
		.run();

	const session = await createSession(platform.env.DB, userId, 7);

	return json(
		{ success: true, redirectTo: '/' },
		{
			status: 201,
			headers: {
				'Set-Cookie': await buildDatabaseSessionCookieHeader(
					session.token,
					url,
					platform.env.SESSION_SECRET
				)
			}
		}
	);
};
