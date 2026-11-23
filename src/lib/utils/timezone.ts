/**
 * Time zone helpers for admin views (docs/ADMIN_TIMEZONE.md).
 *
 * Pure and dependency-free so the same code runs on the server (SSR) and in the
 * browser: both format with the SAME resolved zone and a FIXED locale, which is
 * what keeps hydration from mismatching. Never call a bare `toLocale*String()`
 * in admin code: it silently uses the machine's zone and locale.
 */

/** The site setting that means "use the viewer's browser zone". */
export const TZ_AUTO = 'auto';
/** The fallback zone when nothing valid is known. */
export const TZ_FALLBACK = 'UTC';
/** Name of the cookie the admin layout writes the browser's zone into. */
export const TZ_COOKIE = 'tz';
/** Fixed locale: a machine-dependent default would differ between SSR and client. */
const LOCALE = 'en-US';

// IANA names: letters, digits, underscore, plus, minus, slash. This rejects
// offset forms ('+05:00') that some engines accept, and anything with spaces,
// quotes or control characters, before Intl ever sees it.
const ZONE_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;

const canonicalCache = new Map<string, string | null>();

/**
 * A valid zone with its case normalised ('europe/paris' -> 'Europe/Paris'), or
 * null. Aliases keep the spelling they came in with: V8 would "canonicalise"
 * Asia/Kolkata to the legacy Asia/Calcutta, which is not what an admin picked.
 */
export function canonicalTimeZone(value: unknown): string | null {
	if (typeof value !== 'string' || value.length === 0 || value.length > 64) return null;
	if (!ZONE_SHAPE.test(value)) return null;
	if (canonicalCache.has(value)) return canonicalCache.get(value) ?? null;
	let result: string | null = null;
	try {
		const resolved = new Intl.DateTimeFormat(LOCALE, { timeZone: value }).resolvedOptions()
			.timeZone;
		result = resolved.toLowerCase() === value.toLowerCase() ? resolved : value;
	} catch {
		result = null;
	}
	if (canonicalCache.size > 500) canonicalCache.clear();
	canonicalCache.set(value, result);
	return result;
}

export function isValidTimeZone(value: unknown): value is string {
	return canonicalTimeZone(value) !== null;
}

/**
 * Which zone to use. Precedence: an explicit site setting, else a valid browser
 * cookie, else UTC. The cookie is untrusted user input and is validated; the
 * result is always a zone `Intl.DateTimeFormat` accepts.
 */
export function resolveTimeZone(setting?: unknown, cookie?: unknown): string {
	if (typeof setting === 'string' && setting !== TZ_AUTO) {
		const explicit = canonicalTimeZone(setting);
		if (explicit) return explicit;
	}
	return canonicalTimeZone(cookie) ?? TZ_FALLBACK;
}

/** Where the resolved zone came from, for the "why this clock" hint. */
export type TimeZoneSource = 'setting' | 'browser' | 'default';

export function timeZoneSource(setting?: unknown, cookie?: unknown): TimeZoneSource {
	if (typeof setting === 'string' && setting !== TZ_AUTO && canonicalTimeZone(setting)) {
		return 'setting';
	}
	return canonicalTimeZone(cookie) ? 'browser' : 'default';
}

/** Every zone the runtime knows, for the settings picker. Empty if unsupported. */
export function supportedTimeZones(): string[] {
	try {
		const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
			.supportedValuesOf;
		const list = fn ? fn('timeZone') : [];
		return list.includes('UTC') ? list : ['UTC', ...list];
	} catch {
		return ['UTC'];
	}
}

/** The browser's own zone, or null. Client-side only; reads no permission. */
export function detectBrowserTimeZone(): string | null {
	try {
		return canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export type DateInput = Date | string | number | null | undefined;

/**
 * A moment from a Date, epoch milliseconds, ISO string, or an SQLite
 * `YYYY-MM-DD HH:MM:SS` string (which D1 stores in UTC with no marker). Null
 * when it is not a finite instant.
 */
export function toDate(value: DateInput): Date | null {
	if (value === null || value === undefined || value === '') return null;
	let date: Date;
	if (value instanceof Date) date = value;
	else if (typeof value === 'number') date = new Date(value);
	else {
		const sql = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(value.trim());
		date = new Date(sql ? `${sql[1]}T${sql[2]}${sql[2].length === 5 ? ':00' : ''}Z` : value);
	}
	return Number.isFinite(date.getTime()) ? date : null;
}

/** What formatters print for a value that is not a moment. */
export const NO_DATE = '—';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string, key: string, options: Intl.DateTimeFormatOptions) {
	const id = `${zone}|${key}`;
	let f = formatterCache.get(id);
	if (!f) {
		if (formatterCache.size > 500) formatterCache.clear();
		f = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: zone });
		formatterCache.set(id, f);
	}
	return f;
}

function safeZone(zone: string): string {
	return canonicalTimeZone(zone) ?? TZ_FALLBACK;
}

/** 'Jul 16, 2026' in the zone. */
export function formatDate(value: DateInput, zone: string): string {
	const d = toDate(value);
	if (!d) return NO_DATE;
	return formatter(safeZone(zone), 'date', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(d);
}

/** '14:05' (24-hour) in the zone. */
export function formatTime(value: DateInput, zone: string): string {
	const d = toDate(value);
	if (!d) return NO_DATE;
	return formatter(safeZone(zone), 'time', {
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(d);
}

/** 'Jul 16, 2026, 14:05' in the zone. */
export function formatDateTime(value: DateInput, zone: string): string {
	const d = toDate(value);
	if (!d) return NO_DATE;
	return formatter(safeZone(zone), 'datetime', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(d);
}

// ---------------------------------------------------------------------------
// Wall-clock parts and bucketing keys
// ---------------------------------------------------------------------------

export interface ZoneParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

/** The wall-clock fields of a moment in a zone. */
export function zoneParts(date: Date, zone: string): ZoneParts {
	const parts = formatter(safeZone(zone), 'parts', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return {
		year: get('year'),
		month: get('month'),
		day: get('day'),
		// Some engines still render midnight as 24 under h23-less locales; fold it.
		hour: get('hour') % 24,
		minute: get('minute'),
		second: get('second')
	};
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** 'YYYY-MM-DD' of the moment in the zone. Sortable. */
export function dayKey(date: Date, zone: string): string {
	const p = zoneParts(date, zone);
	return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** 'YYYY-MM-DDTHH' of the moment in the zone. Sortable. */
export function hourKey(date: Date, zone: string): string {
	const p = zoneParts(date, zone);
	return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}`;
}

/** 'YYYY-MM' of the moment in the zone. Sortable. */
export function monthKey(date: Date, zone: string): string {
	const p = zoneParts(date, zone);
	return `${pad(p.year, 4)}-${pad(p.month)}`;
}

/** Calendar arithmetic on a 'YYYY-MM-DD' key. No zone involved: days are days. */
export function addDays(day: string, days: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** The zone's offset from UTC at that moment, in minutes (+330 for Kolkata). */
export function zoneOffsetMinutes(date: Date, zone: string): number {
	const p = zoneParts(date, zone);
	const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	const whole = date.getTime() - (((date.getTime() % 1000) + 1000) % 1000);
	return Math.round((asUtc - whole) / 60000);
}

/** '+05:45', '-04:00', or 'Z' style 'UTC+00:00' parts. */
export function formatOffset(minutes: number): string {
	const sign = minutes < 0 ? '-' : '+';
	const abs = Math.abs(minutes);
	return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** 'EST', 'IST'... when the engine has a real abbreviation, else null (it gives 'GMT+5:30'). */
export function zoneAbbreviation(date: Date, zone: string): string | null {
	const part = formatter(safeZone(zone), 'abbr', { timeZoneName: 'short' })
		.formatToParts(date)
		.find((p) => p.type === 'timeZoneName')?.value;
	return part && !/^(GMT|UTC)([+-]|$)/.test(part) ? part : null;
}

/** 'Asia/Kolkata · IST (UTC+05:30)': the small label shown on admin pages. */
export function describeZone(zone: string, at: Date = new Date()): string {
	const z = safeZone(zone);
	const offset = `UTC${formatOffset(zoneOffsetMinutes(at, z))}`;
	const abbr = zoneAbbreviation(at, z);
	return abbr ? `${z} · ${abbr} (${offset})` : `${z} (${offset})`;
}
