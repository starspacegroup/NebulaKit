import { hashPassword, validatePassword } from '$lib/utils/passwords';
import { getUserAuthState } from '$lib/utils/user-auth-state';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const password = typeof body.password === 'string' ? body.password : '';
	const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

	if (!password || !confirmPassword) {
		throw error(400, 'Password and confirmation are required.');
	}

	if (password !== confirmPassword) {
		throw error(400, 'Passwords do not match.');
	}

	const passwordValidationError = validatePassword(password);
	if (passwordValidationError) {
		throw error(400, passwordValidationError);
	}

	const passwordHash = await hashPassword(password);

	await platform.env.DB.prepare(
		'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	)
		.bind(passwordHash, locals.user.id)
		.run();

	const authState = await getUserAuthState(
		platform.env.DB as any,
		locals.user.id,
		locals.user.email
	);

	return json({ success: true, message: 'Password updated.', ...authState });
};
