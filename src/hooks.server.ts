import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// Auth handling hook
const authHandler: Handle = async ({ event, resolve }) => {
	// Get session cookie
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		// In production, fetch session from D1 or KV
		// For now, decode the session from the cookie
		try {
			const sessionData = JSON.parse(atob(sessionId));

			// Check if user is admin from database
			if (event.platform?.env?.DB) {
				const userRecord = await event.platform.env.DB.prepare(
					'SELECT is_admin FROM users WHERE id = ?'
				)
					.bind(sessionData.id)
					.first<{ is_admin: number }>();

				if (userRecord) {
					sessionData.isAdmin = userRecord.is_admin === 1;
				}
			}

			event.locals.user = sessionData;
			console.log(
				`[Auth] User authenticated: ${sessionData.login}, isOwner: ${sessionData.isOwner}, isAdmin: ${sessionData.isAdmin}`
			);
		} catch (err) {
			// Invalid session, clear cookie
			console.log('[Auth] Invalid session cookie, clearing');
			event.cookies.delete('session', { path: '/' });
		}
	} else {
		console.log(`[Auth] No session cookie for ${event.url.pathname}`);
	}

	return resolve(event);
};

// Combine all hooks
export const handle = sequence(authHandler);
