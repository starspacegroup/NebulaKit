import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createContactFormSubmission,
	listContactFormSubmissions,
	countContactFormSubmissions
} from '$lib/services/contact';
import { validateContactInput } from '$lib/utils/contact-validation';
import { verifyTurnstile, turnstileEnabled } from '$lib/server/turnstile';
import { isPiiRevealed, maskName, maskEmail, PII_REVEAL_COOKIE } from '$lib/server/pii-mask';

/**
 * Admin: list contact submissions as JSON (paginated). Guarded to owner/admin;
 * names + emails are masked unless the owner has PII reveal on.
 */
export const GET: RequestHandler = async ({ locals, platform, url, cookies }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.user.isOwner && !locals.user.isAdmin) throw error(403, 'Forbidden');

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
	const unresolvedOnly = url.searchParams.get('unresolved') === '1';
	const offset = (page - 1) * limit;

	const [submissions, total] = await Promise.all([
		listContactFormSubmissions(db, { limit, offset, unresolvedOnly }),
		countContactFormSubmissions(db, { unresolvedOnly })
	]);

	const revealed = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));
	const values = submissions.map((s) => ({
		...s,
		name: revealed ? s.name : maskName(s.name),
		email: revealed ? s.email : maskEmail(s.email)
	}));

	return json({ values, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
};

/**
 * Public: create a contact submission. Runs the same validation as the page
 * action and enforces Turnstile when it's configured (optional otherwise).
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const result = validateContactInput(body);
	if (!result.ok) throw error(400, result.error);

	const secretKey = platform?.env?.TURNSTILE_SECRET_KEY;
	if (turnstileEnabled(secretKey)) {
		const token =
			typeof body['cf-turnstile-response'] === 'string'
				? (body['cf-turnstile-response'] as string)
				: null;
		const ok = await verifyTurnstile({
			secretKey: secretKey as string,
			token,
			remoteIp: request.headers.get('CF-Connecting-IP')
		});
		if (!ok) throw error(400, 'Verification failed. Please try again.');
	}

	const submission = await createContactFormSubmission(db, result.value);
	return json({ submission }, { status: 201 });
};
