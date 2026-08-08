import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getContactFormSubmission, resolveContactFormSubmission } from '$lib/services/contact';
import { requireAdmin } from '$lib/server/auth-guards';
import { isPiiRevealed, maskName, maskEmail, PII_REVEAL_COOKIE } from '$lib/server/pii-mask';

export const load: PageServerLoad = async ({ locals, platform, params, cookies }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const submission = await getContactFormSubmission(db, params.id);
	if (!submission) throw error(404, 'Submission not found');

	// Mask name/email (not the message body) unless PII reveal is on.
	const revealed = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));
	return {
		submission: {
			...submission,
			name: revealed ? submission.name : maskName(submission.name),
			email: revealed ? submission.email : maskEmail(submission.email)
		}
	};
};

export const actions: Actions = {
	resolve: async ({ platform, params, locals }) => {
		requireAdmin(locals);
		const db = platform?.env?.DB;
		if (!db) throw error(500, 'Database not available');
		await resolveContactFormSubmission(db, params.id);
		throw redirect(302, '/admin/contact-form-submissions');
	}
};
