import { deleteSession } from '$lib/utils/db';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Revoke the session row so a copied cookie cannot be replayed after logout,
// then clear the cookie. Best-effort on the DB — a delete failure must not stop
// the user logging out.
async function endSession(
	cookies: Parameters<RequestHandler>[0]['cookies'],
	platform: App.Platform | undefined
): Promise<void> {
	const sessionId = cookies.get('session');
	if (sessionId && platform?.env?.DB) {
		try {
			await deleteSession(platform.env.DB, sessionId);
		} catch (error) {
			// Clearing the cookie below still logs the user out, but a failed
			// server-side revocation leaves a replayable row — worth a log line.
			console.error('Failed to revoke session during logout:', error);
		}
	}
	cookies.delete('session', { path: '/' });
}

// POST - Logout user
export const POST: RequestHandler = async ({ cookies, platform }) => {
	await endSession(cookies, platform);
	throw redirect(302, '/auth/login');
};

// GET - Logout user (for convenience)
export const GET: RequestHandler = async ({ cookies, platform }) => {
	await endSession(cookies, platform);
	throw redirect(302, '/auth/login');
};
