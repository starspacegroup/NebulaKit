/**
 * Scheduled publishing.
 *
 * There is no `scheduled` status. A scheduled item is `published` with a
 * `published_at` that is still in the future, and every public surface hides
 * items whose date has not arrived. Nothing has to run at the moment of
 * publication: the item simply starts passing the date check, so there is no
 * cron job to fall behind or fire twice. (Pages that cache, such as the
 * sitemap, show it when their cache expires.)
 */

/**
 * SQL for "is live now" over a `published_at` column. `datetime()` normalises
 * both `2026-11-03T10:08:12Z` and `2026-11-03T10:08:12.345Z` and the SQLite
 * `YYYY-MM-DD HH:MM:SS` form, which a plain string comparison would not.
 * A published row with no date (older data) counts as live.
 */
export function liveSql(column: string): string {
	return `(${column} IS NULL OR datetime(${column}) <= datetime('now'))`;
}

/** Thrown for a publish-at value that is not a date. Maps to HTTP 400. */
export class InvalidPublishAtError extends Error {
	constructor(value: unknown) {
		super(`publishedAt must be an ISO date, got ${JSON.stringify(value)}`);
		this.name = 'CmsFieldValidationError';
	}
}

/**
 * Normalise a requested publish time.
 * `undefined` means the caller said nothing, `null` means "publish now", and
 * a string must be a valid date (returned as a UTC ISO string).
 */
export function parsePublishAt(value: unknown): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null || value === '') return null;
	if (typeof value !== 'string') throw new InvalidPublishAtError(value);
	const time = Date.parse(value);
	if (Number.isNaN(time)) throw new InvalidPublishAtError(value);
	return new Date(time).toISOString();
}

function isFuture(publishedAt: string | null, now: Date): boolean {
	if (!publishedAt) return false;
	const time = Date.parse(publishedAt);
	return !Number.isNaN(time) && time > now.getTime();
}

/** True once a date has arrived (or there is no date). */
export function dateHasArrived(publishedAt: string | null, now: Date = new Date()): boolean {
	return !isFuture(publishedAt, now);
}

/** Visible on public pages: published, and its date has arrived. */
export function isLiveItem(
	item: { status: string; publishedAt: string | null },
	now: Date = new Date()
): boolean {
	return item.status === 'published' && dateHasArrived(item.publishedAt, now);
}

/** Published but waiting for its date. */
export function isScheduledItem(
	item: { status: string; publishedAt: string | null },
	now: Date = new Date()
): boolean {
	return item.status === 'published' && isFuture(item.publishedAt, now);
}

/**
 * The `published_at` to store on an update.
 *
 * - An item that has gone live keeps its first-publish date for good: the
 *   field locks and the timestamp proof key off it, so it cannot be moved.
 * - Otherwise, publishing takes the requested date, or now when none was given.
 * - A scheduled item that is told to publish now (`requested === null`) comes
 *   forward to now.
 * - Saving as anything but `published` leaves the stored date alone.
 */
export function resolvePublishedAt(opts: {
	status: string;
	existing: string | null;
	requested: string | null | undefined;
	now?: Date;
}): string | null {
	const now = opts.now ?? new Date();
	const { status, existing, requested } = opts;
	if (status !== 'published') return existing;
	if (existing !== null && !isFuture(existing, now)) return existing;
	if (typeof requested === 'string') return requested;
	if (existing === null || requested === null) return now.toISOString();
	return existing;
}

/** `datetime-local` input value (local time, minute precision) for a stored date. */
export function toLocalInputValue(iso: string | null | undefined): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

/** UTC ISO string for a `datetime-local` value, or null when empty or invalid. */
export function fromLocalInputValue(value: string | null | undefined): string | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
