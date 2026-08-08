/**
 * The background job fired via platform.context.waitUntil() the moment an
 * opted-in item is first published. Requests an RFC 3161 timestamp proof
 * and triggers a Wayback Machine capture — never throws, since it runs
 * detached from the response that already went back to the client.
 */

import { recordTimestampProofAttempt } from '$lib/services/cms';
import { computeCanonicalHash } from './hash';
import { requestTimestamp } from '$lib/timestamp/rfc3161';
import { triggerWaybackCapture } from '$lib/timestamp/wayback';
import type { D1Database } from '@cloudflare/workers-types';
import type { ContentItemParsed } from '$lib/cms/types';

export interface ProofJobFields {
	body?: string;
	date_window_start?: string | null;
	date_window_end?: string | null;
}

/** Runs the whole proof pipeline for one item. Always resolves, never rejects. */
export async function runTimestampProofJob(
	db: D1Database,
	item: ContentItemParsed,
	publicUrl: string
): Promise<void> {
	const requestedAt = new Date().toISOString();

	try {
		const fields = item.fields as ProofJobFields;
		const hash = await computeCanonicalHash({
			title: item.title,
			slug: item.slug,
			body: fields.body ?? '',
			dateWindowStart: fields.date_window_start ?? null,
			dateWindowEnd: fields.date_window_end ?? null
		});

		const result = await requestTimestamp(hash);

		await recordTimestampProofAttempt(db, item.id, {
			hash,
			tsr: result.ok ? (result.tsrBase64 ?? null) : null,
			requestedAt,
			tsaUrl: result.tsaUrl,
			error: result.ok ? null : (result.error ?? 'Unknown timestamp request error')
		});
	} catch (err) {
		// The hash computation itself failed (shouldn't happen, but this job
		// must never throw) — record what we can so "pending" is visible.
		await recordTimestampProofAttempt(db, item.id, {
			hash: '',
			tsr: null,
			requestedAt,
			tsaUrl: null,
			error: err instanceof Error ? err.message : 'Unknown error computing timestamp proof'
		}).catch(() => {});
	}

	// Best-effort, independent of the timestamp proof outcome.
	await triggerWaybackCapture(publicUrl);
}
