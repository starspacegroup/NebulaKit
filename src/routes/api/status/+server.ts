/**
 * GET /api/status — the public status feed. The same data as the /status page: each component,
 * 90 days of uptime, open incidents and the last 30 days of resolved ones. No sign-in.
 * Nothing in it is private: statuses, plain-language reasons and incident text.
 *
 * Answers 503 when the data cannot be read, never an empty "all clear": a monitor polling this
 * must be able to tell "fine" from "unknown".
 */
import { json } from '@sveltejs/kit';
import { getStatusSnapshot } from '$lib/server/status';
import type { RequestHandler } from './$types';

const headers = {
	'access-control-allow-origin': '*',
	'cache-control': 'public, max-age=30'
};
const unavailable = () =>
	json(
		{ error: 'Status is not available right now.' },
		{ status: 503, headers: { ...headers, 'cache-control': 'no-store' } }
	);

export const GET: RequestHandler = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) return unavailable();
	try {
		const snapshot = await getStatusSnapshot(db);
		return json(
			{ ...snapshot, components: snapshot.components.map(({ latencyMs: _latency, ...c }) => c) },
			{ headers }
		);
	} catch (thrown) {
		console.error('Status: could not read the snapshot:', thrown);
		return unavailable();
	}
};
