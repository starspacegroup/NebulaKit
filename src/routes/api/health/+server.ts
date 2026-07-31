/**
 * GET /api/health — liveness/readiness probe.
 *
 * Published as the `status` link in /.well-known/api-catalog, so it has to be
 * reachable without a session; robots.txt re-allows it above the blanket
 * `Disallow: /api/`.
 *
 * Deliberately truthful rather than reassuring: the app cannot serve content
 * without D1, so a missing or failing database returns 503, not a green 200.
 * On a fresh clone (placeholder binding IDs in wrangler.toml) that 503 is the
 * correct answer and a useful nudge to finish `docs/CLOUDFLARE_SETUP.md`.
 *
 * Leaks nothing: no binding IDs, no error strings, no version/build metadata —
 * just per-service reachability.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type ServiceState = 'ok' | 'unavailable';

export const GET: RequestHandler = async ({ platform }) => {
	let database: ServiceState = 'unavailable';

	const db = platform?.env?.DB;
	if (db) {
		try {
			// Cheapest possible round-trip that proves the binding actually resolves
			// to a reachable database, rather than merely being defined.
			await db.prepare('SELECT 1').first();
			database = 'ok';
		} catch {
			database = 'unavailable';
		}
	}

	const healthy = database === 'ok';

	return json(
		{
			status: healthy ? 'ok' : 'degraded',
			services: { database },
			time: new Date().toISOString()
		},
		{
			status: healthy ? 200 : 503,
			headers: { 'Cache-Control': 'no-store' }
		}
	);
};
