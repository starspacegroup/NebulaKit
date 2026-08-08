/**
 * Wayback Machine integration — a second, independent, credential-less
 * witness layer alongside the RFC 3161 timestamp proof.
 *
 * Uses the free, unauthenticated endpoints only (no archive.org account /
 * S3 keys, unlike the more reliable authenticated Save Page Now v2 API):
 * a fire-and-forget capture trigger, and a separate read-only lookup to
 * find the resulting snapshot later (there's no cron in this deployment,
 * so the lookup is invoked manually — same shape as GitHub sync's "Sync now").
 */

const SAVE_URL_PREFIX = 'https://web.archive.org/save/';
const AVAILABLE_URL = 'https://archive.org/wayback/available';

/**
 * Best-effort, fire-and-forget capture request. Swallows all errors —
 * this is a bonus witness layer, never allowed to fail the caller's flow.
 */
export async function triggerWaybackCapture(url: string): Promise<void> {
	try {
		await fetch(`${SAVE_URL_PREFIX}${encodeURIComponent(url)}`, { method: 'GET' });
	} catch {
		// Best-effort only — nothing to do if this fails.
	}
}

export interface WaybackCheckResult {
	ok: boolean;
	snapshotUrl?: string;
}

/** Look up whether a snapshot exists, optionally close to a given YYYYMMDD timestamp. */
export async function checkWaybackSnapshot(
	url: string,
	timestampYYYYMMDD?: string
): Promise<WaybackCheckResult> {
	try {
		const params = new URLSearchParams({ url });
		if (timestampYYYYMMDD) params.set('timestamp', timestampYYYYMMDD);

		const res = await fetch(`${AVAILABLE_URL}?${params.toString()}`);
		if (!res.ok) return { ok: false };

		const body = (await res.json()) as {
			archived_snapshots?: { closest?: { available?: boolean; url?: string } };
		};
		const closest = body.archived_snapshots?.closest;
		if (closest?.available && closest.url) {
			return { ok: true, snapshotUrl: closest.url };
		}
		return { ok: false };
	} catch {
		return { ok: false };
	}
}
