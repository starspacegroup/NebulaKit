/**
 * What has to happen when a scheduled item's time arrives.
 *
 * Nothing runs at that moment, so two things need a way to notice:
 *
 *  1. The timestamp proof. For an item published now, the save request starts
 *     it. A scheduled item is saved days earlier, so the proof starts the first
 *     time anything sees the item live: a visitor opening the page, or the
 *     catch-up cron. Either way {@link startGoLiveProof} claims the item with
 *     one conditional UPDATE first, so the proof runs once however many things
 *     race for it.
 *  2. Caches. A response cached for an hour would hide a post that went live in
 *     the first minute. {@link boundedMaxAge} shortens a cache lifetime so it
 *     expires when the next scheduled item goes live.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { ContentItem, ContentItemParsed, ContentTypeSettings } from './types';
import { isLiveItem, liveSql } from './schedule';
import { parseContentItem } from './utils';

/**
 * An item that went live more than this long ago and never had a proof is left
 * alone: it predates the type opting in, and a proof dated years later would
 * claim something untrue about when the content existed.
 */
export const PROOF_CATCHUP_DAYS = 7;

/** True for a live item whose timestamp proof has never been started. */
export function awaitingGoLiveProof(item: ContentItemParsed, now: Date = new Date()): boolean {
	if (!isLiveItem(item, now)) return false;
	if (item.timestampProofRequestedAt || item.timestampProofHash) return false;
	if (!item.publishedAt) return false;
	const age = now.getTime() - Date.parse(item.publishedAt);
	return !Number.isNaN(age) && age <= PROOF_CATCHUP_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Take the item's proof slot. Only one caller can win: the UPDATE matches while
 * `timestamp_proof_requested_at` is still empty and sets it, so the loser sees
 * zero changed rows. (The job overwrites the stamp with its own when it ends.)
 */
export async function claimTimestampProof(
	db: D1Database,
	id: string,
	now: Date = new Date()
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE content_items SET timestamp_proof_requested_at = ?
			 WHERE id = ? AND timestamp_proof_requested_at IS NULL AND timestamp_proof_hash IS NULL`
		)
		.bind(now.toISOString(), id)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

type ProofRunner = (db: D1Database, item: ContentItemParsed, publicUrl: string) => Promise<void>;

/** Claim the proof and run it. False when it is not due or another caller has it. */
export async function startGoLiveProof(
	db: D1Database,
	item: ContentItemParsed,
	publicUrl: string,
	run: ProofRunner,
	now: Date = new Date()
): Promise<boolean> {
	if (!awaitingGoLiveProof(item, now)) return false;
	if (!(await claimTimestampProof(db, item.id, now))) return false;
	await run(db, item, publicUrl);
	return true;
}

interface DueRow extends ContentItem {
	type_slug: string;
	type_settings: string;
}

/**
 * The cron entry point: start the proof for every live item of an opted-in type
 * that has not had one. Returns how many it started.
 */
export async function runDueProofs(
	db: D1Database,
	origin: string,
	run: ProofRunner,
	limit = 20,
	now: Date = new Date()
): Promise<number> {
	const result = await db
		.prepare(
			`SELECT ci.*, ct.slug AS type_slug, ct.settings AS type_settings
			 FROM content_items ci JOIN content_types ct ON ct.id = ci.content_type_id
			 WHERE ci.status = 'published'
			   AND ci.published_at IS NOT NULL
			   AND ${liveSql('ci.published_at')}
			   AND datetime(ci.published_at) >= datetime('now', '-${PROOF_CATCHUP_DAYS} days')
			   AND ci.timestamp_proof_requested_at IS NULL
			   AND ci.timestamp_proof_hash IS NULL
			   AND json_extract(ct.settings, '$.enableTimestampProof') = 1
			 ORDER BY ci.published_at
			 LIMIT ?`
		)
		.bind(limit)
		.all<DueRow>();

	let started = 0;
	for (const row of result.results ?? []) {
		const settings = JSON.parse(row.type_settings) as ContentTypeSettings;
		const prefix = settings.routePrefix || `/${row.type_slug}`;
		const item = parseContentItem(row);
		if (await startGoLiveProof(db, item, `${origin}${prefix}/${item.slug}`, run, now)) started++;
	}
	return started;
}

/** Seconds until the next scheduled item goes live, or null when none is waiting. */
export async function secondsUntilNextGoLive(db: D1Database): Promise<number | null> {
	const row = await db
		.prepare(
			`SELECT CAST((julianday(MIN(published_at)) - julianday('now')) * 86400 AS INTEGER) AS seconds
			 FROM content_items
			 WHERE status = 'published' AND datetime(published_at) > datetime('now')`
		)
		.first<{ seconds: number | null }>();
	return row?.seconds ?? null;
}

/**
 * A cache lifetime that ends no later than the next scheduled item going live.
 * `untilNext` is null when nothing is scheduled. Never below one second, and
 * one past the go-live so the refetch lands after the item is already live.
 */
export function boundedMaxAge(baseSeconds: number, untilNext: number | null): number {
	if (untilNext === null) return baseSeconds;
	return Math.max(1, Math.min(baseSeconds, untilNext + 1));
}

/** `boundedMaxAge` for a handler: asks the database, and falls back to the base on error. */
export async function maxAgeFor(db: D1Database | undefined, baseSeconds: number): Promise<number> {
	if (!db) return baseSeconds;
	try {
		return boundedMaxAge(baseSeconds, await secondsUntilNextGoLive(db));
	} catch {
		return baseSeconds;
	}
}
