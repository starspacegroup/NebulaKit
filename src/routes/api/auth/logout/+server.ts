import { deleteSession } from '$lib/utils/db';
import { decodeDatabaseSessionCookie } from '$lib/utils/session';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function revokeCurrentSession(
	cookies: Parameters<RequestHandler>[0]['cookies'],
	platform: App.Platform | undefined
): Promise<void> {
	const token = await decodeDatabaseSessionCookie(
		cookies.get('session'),
		platform?.env?.SESSION_SECRET
	);
	if (token && platform?.env?.DB) {
		try {
			await deleteSession(platform.env.DB, token);
		} catch (error) {
			console.error('Failed to revoke session during logout:', error);
		}
	}
	cookies.delete('session', { path: '/' });
}

// POST - Logout user
export const POST: RequestHandler = async ({ cookies, platform }) => {
	await revokeCurrentSession(cookies, platform);

	throw redirect(302, '/auth/login');
};

// GET - Logout user (for convenience)
export const GET: RequestHandler = async ({ cookies, platform }) => {
	await revokeCurrentSession(cookies, platform);

	throw redirect(302, '/auth/login');
};
