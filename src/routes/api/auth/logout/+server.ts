import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Logout user
export const POST: RequestHandler = async ({ cookies }) => {
	// Clear session cookie
	cookies.delete('session', { path: '/' });

	throw redirect(302, '/auth/login');
};

// GET - Logout user (for convenience)
export const GET: RequestHandler = async ({ cookies }) => {
	// Clear session cookie
	cookies.delete('session', { path: '/' });

	throw redirect(302, '/auth/login');
};
