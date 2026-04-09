import { decodeSessionCookie } from '$lib/utils/session';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// Auth handling hook
const authHandler: Handle = async ({ event, resolve }) => {
	// Get session cookie
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const sessionData = decodeSessionCookie(sessionId);

		if (sessionData) {
			// Check if user is admin from database (optional - don't fail auth if DB unavailable)
			if (event.platform?.env?.DB) {
				try {
					const userRecord = await event.platform.env.DB.prepare(
						'SELECT is_admin FROM users WHERE id = ?'
					)
						.bind(sessionData.id)
						.first<{ is_admin: number }>();

					if (userRecord) {
						sessionData.isAdmin = userRecord.is_admin === 1;
					}
				} catch {
					// Database error - continue with session data from cookie
				}
			}

			event.locals.user = sessionData;
		} else {
			// Invalid session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};

// Combine all hooks
export const handle = sequence(authHandler);
