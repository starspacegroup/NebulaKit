import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listContactFormSubmissions, countContactFormSubmissions } from '$lib/services/contact';
import { isPiiRevealed, maskName, maskEmail, PII_REVEAL_COOKIE } from '$lib/server/pii-mask';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, platform, url, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const unresolvedOnly = url.searchParams.get('unresolved') === '1';
	const offset = (page - 1) * PAGE_SIZE;

	const [rows, total] = await Promise.all([
		listContactFormSubmissions(db, { limit: PAGE_SIZE, offset, unresolvedOnly }),
		countContactFormSubmissions(db, { unresolvedOnly })
	]);

	// Server-side masking: real name/email never reach the browser unless the
	// owner has PII reveal on.
	const revealed = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));
	const submissions = rows.map((s) => ({
		...s,
		name: revealed ? s.name : maskName(s.name),
		email: revealed ? s.email : maskEmail(s.email)
	}));

	return {
		submissions,
		total,
		page,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		unresolvedOnly
	};
};
