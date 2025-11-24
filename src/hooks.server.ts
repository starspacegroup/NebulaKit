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
			event.locals.user = sessionData;
			console.log(
				`[Auth] User authenticated: ${sessionData.login}, isOwner: ${sessionData.isOwner}`
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
