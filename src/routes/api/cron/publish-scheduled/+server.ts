import { error, json } from '@sveltejs/kit';
import { runDueProofs } from '$lib/cms/go-live';
import { runTimestampProofJob } from '$lib/content-proof/proof-job';
import type { RequestHandler } from './$types';

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Catch up after scheduled publishing: start the timestamp proof for items that
 * went live since the last run and have not had one. Scheduled items need no
 * job to appear (their date is simply checked on every read); this is only for
 * the proof, and a visitor opening the page starts it too, so this is a
 * backstop for an item nobody has looked at yet.
 *
 * Same auth as the other cron routes: `CRON_SECRET` as a bearer token.
 */
export const POST: RequestHandler = async ({ request, platform, url }) => {
	const secret = platform?.env?.CRON_SECRET;
	if (!secret) {
		throw error(503, 'CRON_SECRET not configured');
	}

	const authHeader = request.headers.get('authorization') ?? '';
	if (!timingSafeEqual(authHeader, `Bearer ${secret}`)) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(503, 'Database not available');
	}

	const started = await runDueProofs(db, url.origin, runTimestampProofJob);
	return json({ started });
};
