/**
 * The decisions the settings modules make, apart from their markup: appearance
 * normalising, the notification matrix, API key scopes / masking / expiry,
 * webhook URL validation, cookie consent state, privacy request states,
 * Intl previews, integration ordering and the settings page sections.
 *
 * Everything here is pure. Time is always passed in (`now`), never read.
 */

// ── Appearance ──────────────────────────────────────────────────────────────

export const THEMES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEMES)[number];
export const APPEARANCE_DENSITIES = ['comfortable', 'compact'] as const;
export type AppearanceDensity = (typeof APPEARANCE_DENSITIES)[number];

export const TEXT_SIZE_MIN = 80;
export const TEXT_SIZE_MAX = 150;
export const TEXT_SIZE_STEP = 5;

export interface Appearance {
	theme: ThemeChoice;
	density: AppearanceDensity;
	/** Percent of the base size. */
	textSize: number;
	reduceMotion: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
	theme: 'system',
	density: 'comfortable',
	textSize: 100,
	reduceMotion: false
};

/** Clamp to the allowed range and snap to the step; junk becomes 100. */
export function clampTextSize(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return 100;
	const clamped = Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, n));
	return Math.round(clamped / TEXT_SIZE_STEP) * TEXT_SIZE_STEP;
}

/** Fill gaps and repair anything out of range, so stored junk never reaches the UI. */
export function normalizeAppearance(input: Partial<Appearance> | null | undefined): Appearance {
	const v = input ?? {};
	return {
		theme: THEMES.includes(v.theme as ThemeChoice) ? (v.theme as ThemeChoice) : 'system',
		density: APPEARANCE_DENSITIES.includes(v.density as AppearanceDensity)
			? (v.density as AppearanceDensity)
			: 'comfortable',
		textSize: v.textSize === undefined ? 100 : clampTextSize(v.textSize),
		reduceMotion: v.reduceMotion === true
	};
}

/** "system" resolves through the OS preference; the others are themselves. */
export function resolveTheme(theme: ThemeChoice, systemPrefersDark: boolean): 'light' | 'dark' {
	if (theme === 'system') return systemPrefersDark ? 'dark' : 'light';
	return theme;
}

/** Inline custom properties the live preview scopes to itself. */
export function previewStyle(a: Appearance): string {
	const gap = a.density === 'compact' ? '0.5rem' : '1rem';
	const pad = a.density === 'compact' ? '0.5rem' : '1rem';
	return `font-size:${a.textSize}%;--preview-gap:${gap};--preview-pad:${pad}`;
}

/** True when two appearances differ in any field. */
export function appearanceChanged(a: Appearance, b: Appearance): boolean {
	return (
		a.theme !== b.theme ||
		a.density !== b.density ||
		a.textSize !== b.textSize ||
		a.reduceMotion !== b.reduceMotion
	);
}

// ── Notification matrix ─────────────────────────────────────────────────────

export type NotificationMatrix = Record<string, Record<string, boolean>>;
export type MatrixCheckState = 'all' | 'none' | 'mixed';

/** A complete matrix: every event x channel present, `initial` honoured, the rest off. */
export function createMatrix(
	events: readonly string[],
	channels: readonly string[],
	initial: NotificationMatrix = {}
): NotificationMatrix {
	const out: NotificationMatrix = {};
	for (const e of events) {
		out[e] = {};
		for (const c of channels) out[e][c] = initial[e]?.[c] === true;
	}
	return out;
}

export function toggleCell(
	m: NotificationMatrix,
	event: string,
	channel: string
): NotificationMatrix {
	if (!m[event] || !(channel in m[event])) return m;
	return { ...m, [event]: { ...m[event], [channel]: !m[event][channel] } };
}

function stateOf(values: boolean[]): MatrixCheckState {
	if (values.length === 0) return 'none';
	const on = values.filter(Boolean).length;
	if (on === 0) return 'none';
	return on === values.length ? 'all' : 'mixed';
}

export function rowState(m: NotificationMatrix, event: string): MatrixCheckState {
	return stateOf(Object.values(m[event] ?? {}));
}

export function columnState(m: NotificationMatrix, channel: string): MatrixCheckState {
	return stateOf(
		Object.values(m)
			.filter((row) => channel in row)
			.map((row) => row[channel])
	);
}

export function matrixState(m: NotificationMatrix): MatrixCheckState {
	return stateOf(Object.values(m).flatMap((row) => Object.values(row)));
}

/** Select-all semantics: anything but "all" turns everything on; "all" turns it off. */
export function nextBulkValue(state: MatrixCheckState): boolean {
	return state !== 'all';
}

export function setRow(m: NotificationMatrix, event: string, value: boolean): NotificationMatrix {
	if (!m[event]) return m;
	const row: Record<string, boolean> = {};
	for (const c of Object.keys(m[event])) row[c] = value;
	return { ...m, [event]: row };
}

export function setColumn(
	m: NotificationMatrix,
	channel: string,
	value: boolean
): NotificationMatrix {
	const out: NotificationMatrix = {};
	for (const [e, row] of Object.entries(m)) {
		out[e] = channel in row ? { ...row, [channel]: value } : row;
	}
	return out;
}

export function setAll(m: NotificationMatrix, value: boolean): NotificationMatrix {
	const out: NotificationMatrix = {};
	for (const [e, row] of Object.entries(m)) {
		out[e] = {};
		for (const c of Object.keys(row)) out[e][c] = value;
	}
	return out;
}

export function countEnabled(m: NotificationMatrix): number {
	return Object.values(m).reduce((n, row) => n + Object.values(row).filter(Boolean).length, 0);
}

// ── Quiet hours ─────────────────────────────────────────────────────────────

export interface QuietHours {
	enabled: boolean;
	/** "HH:MM", 24-hour. */
	start: string;
	end: string;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
	return TIME_RE.test(value);
}

export function timeToMinutes(value: string): number {
	const match = TIME_RE.exec(value);
	if (!match) return NaN;
	return Number(match[1]) * 60 + Number(match[2]);
}

/** Empty string when valid; otherwise the message. A disabled schedule is never invalid. */
export function validateQuietHours(q: QuietHours, messages = QUIET_MESSAGES): string {
	if (!q.enabled) return '';
	if (!isValidTime(q.start) || !isValidTime(q.end)) return messages.invalid;
	if (q.start === q.end) return messages.same;
	return '';
}

export const QUIET_MESSAGES = {
	invalid: 'Enter both times as hours and minutes.',
	same: 'Start and end must be different times.'
};

/** Whether `time` ("HH:MM") falls inside the quiet window, including one that crosses midnight. */
export function isQuietAt(q: QuietHours, time: string): boolean {
	if (!q.enabled || validateQuietHours(q) || !isValidTime(time)) return false;
	const s = timeToMinutes(q.start);
	const e = timeToMinutes(q.end);
	const t = timeToMinutes(time);
	return s < e ? t >= s && t < e : t >= s || t < e;
}

export function quietDuration(q: QuietHours): number {
	if (validateQuietHours(q) || !q.enabled) return 0;
	const s = timeToMinutes(q.start);
	const e = timeToMinutes(q.end);
	return e > s ? e - s : 24 * 60 - s + e;
}

/** "9 h 30 min" style, in English; apps translate via props instead of this helper. */
export function describeDuration(minutes: number): string {
	if (minutes <= 0) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

// ── API keys ────────────────────────────────────────────────────────────────

export interface ScopeOption {
	/** "resource:read" or "resource:write". Write implies read. */
	value: string;
	label: string;
	hint?: string;
}

/** Dedupe, drop unknown scopes, and order like `available`. */
export function normalizeScopes(
	selected: readonly string[],
	available: readonly string[]
): string[] {
	const set = new Set(selected);
	return available.filter((s) => set.has(s));
}

function impliedRead(scope: string): string | null {
	return scope.endsWith(':write') ? scope.replace(/:write$/, ':read') : null;
}

/**
 * Turn one scope on or off. Turning `x:write` on also turns `x:read` on
 * (when it is available); turning `x:read` off also turns `x:write` off.
 */
export function toggleScope(
	selected: readonly string[],
	scope: string,
	available: readonly string[]
): string[] {
	const set = new Set(normalizeScopes(selected, available));
	if (!available.includes(scope)) return normalizeScopes([...set], available);
	if (set.has(scope)) {
		set.delete(scope);
		if (scope.endsWith(':read')) set.delete(scope.replace(/:read$/, ':write'));
	} else {
		set.add(scope);
		const read = impliedRead(scope);
		if (read && available.includes(read)) set.add(read);
	}
	return normalizeScopes([...set], available);
}

/** True when `granted` covers `required` (write grants read). */
export function scopesCover(granted: readonly string[], required: string): boolean {
	if (granted.includes(required)) return true;
	return required.endsWith(':read') && granted.includes(required.replace(/:read$/, ':write'));
}

/** "Full access" / "Read only" / "3 scopes" style summary, scopes grouped by resource. */
export function summarizeScopes(scopes: readonly string[], available: readonly string[]): string {
	const list = normalizeScopes(scopes, available);
	if (list.length === 0) return 'No access';
	if (list.length === available.length) return 'Full access';
	if (list.every((s) => s.endsWith(':read')))
		return list.length === 1 ? 'Read only: 1 scope' : `Read only: ${list.length} scopes`;
	return list.length === 1 ? '1 scope' : `${list.length} scopes`;
}

export const KEY_NAME_MAX = 60;

/** Empty string when valid. Names must be unique (case-insensitive) among `existing`. */
export function validateKeyName(
	name: string,
	existing: readonly string[],
	messages = KEY_MESSAGES
): string {
	const trimmed = name.trim();
	if (!trimmed) return messages.required;
	if (trimmed.length > KEY_NAME_MAX) return messages.tooLong;
	if (existing.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) return messages.taken;
	return '';
}

export const KEY_MESSAGES = {
	required: 'Give the key a name.',
	tooLong: `Use ${KEY_NAME_MAX} characters or fewer.`,
	taken: 'A key with this name already exists.',
	scopes: 'Choose at least one scope.'
};

/** Mask a secret or id: keep the start and end, bullets between. Short values are fully masked. */
export function maskKey(secret: string, visibleStart = 7, visibleEnd = 4): string {
	if (secret.length <= visibleStart + visibleEnd + 4) return '•'.repeat(Math.max(secret.length, 8));
	return `${secret.slice(0, visibleStart)}${'•'.repeat(8)}${secret.slice(-visibleEnd)}`;
}

/** A key's display form from its stored prefix and last four, never the whole secret. */
export function maskFromParts(prefix: string, last4: string): string {
	return `${prefix}${'•'.repeat(8)}${last4}`;
}

/** Build a secret from random bytes. The caller supplies the bytes (crypto.getRandomValues). */
export function formatApiKeySecret(bytes: Uint8Array, prefix = 'nk_live_'): string {
	let hex = '';
	for (const b of bytes) hex += b.toString(16).padStart(2, '0');
	return prefix + hex;
}

export const EXPIRY_OPTIONS = [
	{ value: 'never', label: 'No expiry', days: 0 },
	{ value: '30', label: '30 days', days: 30 },
	{ value: '90', label: '90 days', days: 90 },
	{ value: '365', label: '1 year', days: 365 }
] as const;
export type ExpiryChoice = (typeof EXPIRY_OPTIONS)[number]['value'];

const DAY_MS = 86_400_000;

/** ISO timestamp for the chosen expiry from `now`, or null for none/unknown. */
export function computeExpiry(choice: string, now: Date | string): string | null {
	const option = EXPIRY_OPTIONS.find((o) => o.value === choice);
	if (!option || option.days === 0) return null;
	return new Date(new Date(now).getTime() + option.days * DAY_MS).toISOString();
}

export type ExpiryStatus = 'never' | 'active' | 'expiring' | 'expired';

/** `expiring` means within `warnDays` days. */
export function expiryStatus(
	expiresAt: string | null | undefined,
	now: Date | string,
	warnDays = 7
): ExpiryStatus {
	if (!expiresAt) return 'never';
	const left = new Date(expiresAt).getTime() - new Date(now).getTime();
	if (Number.isNaN(left)) return 'never';
	if (left <= 0) return 'expired';
	return left <= warnDays * DAY_MS ? 'expiring' : 'active';
}

/** "Never used", "Today", "Yesterday", "3 days ago"... via Intl.RelativeTimeFormat. */
export function formatLastUsed(
	lastUsedAt: string | null | undefined,
	now: Date | string,
	locale = 'en',
	neverText = 'Never used'
): string {
	if (!lastUsedAt) return neverText;
	const diff = new Date(now).getTime() - new Date(lastUsedAt).getTime();
	if (Number.isNaN(diff)) return neverText;
	const rtf = new Intl.RelativeTimeFormat(resolveSettingsLocale(locale), { numeric: 'auto' });
	const days = Math.floor(diff / DAY_MS);
	if (days >= 1) return rtf.format(-days, 'day');
	const hours = Math.floor(diff / 3_600_000);
	if (hours >= 1) return rtf.format(-hours, 'hour');
	const minutes = Math.floor(diff / 60_000);
	return rtf.format(-Math.max(minutes, 0), 'minute');
}

/** A date in a fixed zone, for expiry text. */
export function formatSettingsDate(
	iso: string,
	locale = 'en',
	timeZone = 'UTC',
	dateStyle: 'short' | 'medium' | 'long' | 'full' = 'medium'
): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat(resolveSettingsLocale(locale), {
		dateStyle,
		timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC'
	}).format(d);
}

/** A date and time in a fixed zone, for delivery logs. */
export function formatSettingsDateTime(iso: string, locale = 'en', timeZone = 'UTC'): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat(resolveSettingsLocale(locale), {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC'
	}).format(d);
}

export interface ApiKey {
	id: string;
	name: string;
	/** The visible start of the secret, e.g. "nk_live_". */
	prefix: string;
	last4: string;
	scopes: string[];
	createdAt: string;
	lastUsedAt?: string | null;
	expiresAt?: string | null;
}

// ── Webhooks ────────────────────────────────────────────────────────────────

export const WEBHOOK_MESSAGES = {
	urlRequired: 'Enter the endpoint URL.',
	urlInvalid: 'Enter a full URL such as https://example.com/hooks.',
	urlHttps: 'Use https:// so deliveries are encrypted.',
	urlCredentials: 'Remove the username and password from the URL.',
	urlLong: 'The URL is too long (2048 characters at most).',
	eventsRequired: 'Choose at least one event.'
};

export interface UrlOptions {
	/** Allow plain http for localhost and 127.0.0.1 (development). */
	allowLocalHttp?: boolean;
}

/** Empty string when the URL is acceptable as a webhook target. */
export function validateWebhookUrl(
	url: string,
	options: UrlOptions = {},
	messages = WEBHOOK_MESSAGES
): string {
	const text = url.trim();
	if (!text) return messages.urlRequired;
	if (text.length > 2048) return messages.urlLong;
	let parsed: URL;
	try {
		parsed = new URL(text);
	} catch {
		return messages.urlInvalid;
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return messages.urlInvalid;
	if (!parsed.hostname) return messages.urlInvalid;
	if (parsed.username || parsed.password) return messages.urlCredentials;
	if (parsed.protocol === 'http:') {
		const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
		if (!(options.allowLocalHttp && local)) return messages.urlHttps;
	}
	return '';
}

export interface Webhook {
	id: string;
	url: string;
	events: string[];
	enabled: boolean;
	deliveries: Delivery[];
}

export interface WebhookDraft {
	url: string;
	events: string[];
}
export interface WebhookErrors {
	url?: string;
	events?: string;
}

export function validateWebhook(
	draft: WebhookDraft,
	options: UrlOptions = {},
	messages = WEBHOOK_MESSAGES
): WebhookErrors {
	const errors: WebhookErrors = {};
	const url = validateWebhookUrl(draft.url, options, messages);
	if (url) errors.url = url;
	if (draft.events.length === 0) errors.events = messages.eventsRequired;
	return errors;
}

export function toggleEvent(
	selected: readonly string[],
	event: string,
	available: readonly string[]
): string[] {
	const set = new Set(selected);
	if (set.has(event)) set.delete(event);
	else set.add(event);
	return available.filter((e) => set.has(e));
}

export type SettingsTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** A delivery's HTTP status as a tone and a word (never colour alone). */
export function deliveryStatus(code: number | null | undefined): {
	tone: SettingsTone;
	label: string;
} {
	if (code === null || code === undefined || code === 0)
		return { tone: 'neutral', label: 'Pending' };
	if (code >= 200 && code < 300) return { tone: 'success', label: 'Delivered' };
	if (code >= 300 && code < 400) return { tone: 'warning', label: 'Redirected' };
	return { tone: 'danger', label: 'Failed' };
}

export interface Delivery {
	id: string;
	event: string;
	/** HTTP status the endpoint answered with; null while pending. */
	status: number | null;
	at: string;
}

/** Most recent first. */
export function sortDeliveries<T extends Delivery>(deliveries: readonly T[]): T[] {
	return [...deliveries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export type EndpointHealth = 'no-data' | 'healthy' | 'degraded' | 'failing';

/** Judged from the last `window` finished deliveries. */
export function endpointHealth(deliveries: readonly Delivery[], window = 5): EndpointHealth {
	const done = sortDeliveries(deliveries.filter((d) => d.status)).slice(0, window);
	if (done.length === 0) return 'no-data';
	const failed = done.filter((d) => (d.status ?? 0) >= 400).length;
	if (failed === 0) return 'healthy';
	return failed === done.length ? 'failing' : 'degraded';
}

// ── Cookie consent ──────────────────────────────────────────────────────────

export interface ConsentCategory {
	id: string;
	label: string;
	description?: string;
	/** Strictly necessary: always on, cannot be changed. */
	necessary?: boolean;
}
export type ConsentState = Record<string, boolean>;

export const DEFAULT_CATEGORIES: ConsentCategory[] = [
	{
		id: 'necessary',
		label: 'Strictly necessary',
		description: 'Keeps you signed in and the site secure. Always on.',
		necessary: true
	},
	{
		id: 'analytics',
		label: 'Analytics',
		description: 'Anonymous usage statistics that help us improve.'
	},
	{ id: 'marketing', label: 'Marketing', description: 'Measures campaigns and personalises ads.' }
];

/** Necessary on, everything else off: the state before anyone has chosen. */
export function defaultConsent(categories: readonly ConsentCategory[]): ConsentState {
	const s: ConsentState = {};
	for (const c of categories) s[c.id] = c.necessary === true;
	return s;
}

export function acceptAll(categories: readonly ConsentCategory[]): ConsentState {
	const s: ConsentState = {};
	for (const c of categories) s[c.id] = true;
	return s;
}

/** Same as the default: rejecting leaves only the necessary categories on. */
export function rejectAll(categories: readonly ConsentCategory[]): ConsentState {
	return defaultConsent(categories);
}

/** Set one category. Necessary categories and unknown ids are left alone. */
export function setConsent(
	state: ConsentState,
	categories: readonly ConsentCategory[],
	id: string,
	value: boolean
): ConsentState {
	const cat = categories.find((c) => c.id === id);
	if (!cat || cat.necessary) return state;
	return { ...state, [id]: value };
}

/** Repair a state against the category list: unknown ids dropped, necessary forced on, gaps off. */
export function normalizeConsent(
	state: ConsentState | null | undefined,
	categories: readonly ConsentCategory[]
): ConsentState {
	const s: ConsentState = {};
	for (const c of categories) s[c.id] = c.necessary ? true : state?.[c.id] === true;
	return s;
}

export function consentSummary(
	state: ConsentState,
	categories: readonly ConsentCategory[]
): string {
	const optional = categories.filter((c) => !c.necessary);
	const on = optional.filter((c) => state[c.id]).length;
	if (optional.length === 0) return 'Only necessary cookies';
	if (on === 0) return 'Only necessary cookies';
	if (on === optional.length) return 'All cookies';
	return `${on} of ${optional.length} optional categories`;
}

export interface StoredConsent {
	version: number;
	decidedAt: string;
	choices: ConsentState;
}

export function serializeConsent(state: ConsentState, now: Date | string, version = 1): string {
	const stored: StoredConsent = {
		version,
		decidedAt: new Date(now).toISOString(),
		choices: state
	};
	return JSON.stringify(stored);
}

/** The stored choices, or null if absent, malformed or from another policy version. */
export function parseConsent(
	raw: string | null | undefined,
	categories: readonly ConsentCategory[],
	version = 1
): ConsentState | null {
	if (!raw) return null;
	try {
		const data = JSON.parse(raw) as Partial<StoredConsent> | null;
		if (!data || typeof data !== 'object' || data.version !== version) return null;
		if (!data.choices || typeof data.choices !== 'object') return null;
		return normalizeConsent(data.choices, categories);
	} catch {
		return null;
	}
}

/** The banner shows until a valid decision exists. */
export function needsConsent(
	raw: string | null | undefined,
	categories: readonly ConsentCategory[],
	version = 1
): boolean {
	return parseConsent(raw, categories, version) === null;
}

// ── Privacy requests ────────────────────────────────────────────────────────

export type RequestStatus = 'idle' | 'pending' | 'processing' | 'ready' | 'failed' | 'cancelled';

export interface PrivacyRequest {
	status: RequestStatus;
	requestedAt?: string;
	/** Export: when the download link stops working. Deletion: when the data will be erased. */
	expiresAt?: string;
	downloadUrl?: string;
}

/** A new request can start when none is in flight. */
export function canRequest(status: RequestStatus): boolean {
	return status === 'idle' || status === 'ready' || status === 'failed' || status === 'cancelled';
}

/** Only a request that has not started processing can be cancelled. */
export function canCancel(status: RequestStatus): boolean {
	return status === 'pending';
}

export function requestStatusInfo(status: RequestStatus): { tone: SettingsTone; label: string } {
	switch (status) {
		case 'pending':
			return { tone: 'info', label: 'Requested' };
		case 'processing':
			return { tone: 'info', label: 'In progress' };
		case 'ready':
			return { tone: 'success', label: 'Ready' };
		case 'failed':
			return { tone: 'danger', label: 'Failed' };
		case 'cancelled':
			return { tone: 'neutral', label: 'Cancelled' };
		default:
			return { tone: 'neutral', label: 'Not requested' };
	}
}

/** The typed phrase must match exactly (after trimming), ignoring case. */
export function isDeleteConfirmed(input: string, phrase: string): boolean {
	return phrase.length > 0 && input.trim().toLowerCase() === phrase.trim().toLowerCase();
}

/** Whole days left until `iso`, never negative; null when there is no date. */
export function settingsDaysUntil(
	iso: string | null | undefined,
	now: Date | string
): number | null {
	if (!iso) return null;
	const left = new Date(iso).getTime() - new Date(now).getTime();
	if (Number.isNaN(left)) return null;
	return Math.max(0, Math.ceil(left / DAY_MS));
}

// ── Language & region ───────────────────────────────────────────────────────

export interface LanguageOption {
	value: string;
	label: string;
}

export const LANGUAGES: LanguageOption[] = [
	{ value: 'en-US', label: 'English (United States)' },
	{ value: 'en-GB', label: 'English (United Kingdom)' },
	{ value: 'de-DE', label: 'Deutsch (Deutschland)' },
	{ value: 'fr-FR', label: 'Français (France)' },
	{ value: 'es-ES', label: 'Español (España)' },
	{ value: 'pt-BR', label: 'Português (Brasil)' },
	{ value: 'ja-JP', label: '日本語 (日本)' },
	{ value: 'ar-EG', label: 'العربية (مصر)' }
];

export const TIME_ZONES = [
	'UTC',
	'Pacific/Honolulu',
	'America/Anchorage',
	'America/Los_Angeles',
	'America/Denver',
	'America/Phoenix',
	'America/Chicago',
	'America/New_York',
	'America/Halifax',
	'America/Sao_Paulo',
	'America/Argentina/Buenos_Aires',
	'Atlantic/Reykjavik',
	'Europe/London',
	'Europe/Lisbon',
	'Europe/Paris',
	'Europe/Berlin',
	'Europe/Madrid',
	'Europe/Athens',
	'Europe/Istanbul',
	'Europe/Moscow',
	'Africa/Cairo',
	'Africa/Lagos',
	'Africa/Johannesburg',
	'Asia/Dubai',
	'Asia/Karachi',
	'Asia/Kolkata',
	'Asia/Dhaka',
	'Asia/Bangkok',
	'Asia/Singapore',
	'Asia/Shanghai',
	'Asia/Tokyo',
	'Asia/Seoul',
	'Australia/Perth',
	'Australia/Sydney',
	'Pacific/Auckland'
];

export function isValidTimeZone(zone: string): boolean {
	if (!zone) return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

/** A canonical, supported locale, or the fallback. */
export function resolveSettingsLocale(locale: string, fallback = 'en-US'): string {
	try {
		const [canonical] = Intl.getCanonicalLocales(locale);
		return canonical ?? fallback;
	} catch {
		return fallback;
	}
}

/** "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
export function zoneCity(zone: string): string {
	const last = zone.split('/').pop() ?? zone;
	return last.replace(/_/g, ' ');
}

/** "UTC+05:30" at `now` (offsets move with daylight saving, so `now` matters). */
export function zoneOffsetLabel(zone: string, now: Date | string): string {
	const date = new Date(now);
	if (!isValidTimeZone(zone) || Number.isNaN(date.getTime())) return 'UTC';
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: zone,
		timeZoneName: 'longOffset'
	}).formatToParts(date);
	const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
	if (raw === 'GMT') return 'UTC+00:00';
	return raw.replace('GMT', 'UTC').replace('−', '-');
}

export interface ZoneOption {
	value: string;
	label: string;
}

/** Combobox options: "(UTC-05:00) New York", ordered by offset then city. */
export function zoneOptions(zones: readonly string[], now: Date | string): ZoneOption[] {
	const rows = zones
		.filter(isValidTimeZone)
		.map((value) => {
			const offset = zoneOffsetLabel(value, now);
			return {
				value,
				offset,
				minutes: offsetMinutes(offset),
				city: value === 'UTC' ? 'UTC' : zoneCity(value)
			};
		})
		.sort((a, b) => a.minutes - b.minutes || a.city.localeCompare(b.city));
	return rows.map((r) => ({ value: r.value, label: `(${r.offset}) ${r.city}` }));
}

export function offsetMinutes(offset: string): number {
	const m = /([+-])(\d{2}):(\d{2})$/.exec(offset);
	if (!m) return 0;
	const n = Number(m[2]) * 60 + Number(m[3]);
	return m[1] === '-' ? -n : n;
}

export const DATE_STYLES = ['short', 'medium', 'long', 'full'] as const;
export type DateStyle = (typeof DATE_STYLES)[number];
export const HOUR_CYCLES = ['auto', '12', '24'] as const;
export type HourCycle = (typeof HOUR_CYCLES)[number];

export interface RegionPrefs {
	language: string;
	timeZone: string;
	dateStyle: DateStyle;
	hourCycle: HourCycle;
	/** Locale for numbers; empty follows the language. */
	numberLocale: string;
	currency: string;
}

export const DEFAULT_REGION: RegionPrefs = {
	language: 'en-US',
	timeZone: 'UTC',
	dateStyle: 'medium',
	hourCycle: 'auto',
	numberLocale: '',
	currency: 'USD'
};

export interface RegionPreview {
	date: string;
	time: string;
	number: string;
	currency: string;
	percent: string;
	locale: string;
	numberLocale: string;
	timeZone: string;
}

/** What the user's choices look like, formatted with Intl at the instant `now`. */
export function regionPreview(prefs: RegionPrefs, now: Date | string): RegionPreview {
	const date = new Date(now);
	const locale = resolveSettingsLocale(prefs.language);
	const numberLocale = prefs.numberLocale
		? resolveSettingsLocale(prefs.numberLocale, locale)
		: locale;
	const timeZone = isValidTimeZone(prefs.timeZone) ? prefs.timeZone : 'UTC';
	const ok = !Number.isNaN(date.getTime());
	const hour12 = prefs.hourCycle === 'auto' ? undefined : prefs.hourCycle === '12';
	const currency = /^[A-Za-z]{3}$/.test(prefs.currency) ? prefs.currency.toUpperCase() : 'USD';
	return {
		locale,
		numberLocale,
		timeZone,
		date: ok
			? new Intl.DateTimeFormat(locale, {
					dateStyle: DATE_STYLES.includes(prefs.dateStyle) ? prefs.dateStyle : 'medium',
					timeZone
				}).format(date)
			: '',
		time: ok
			? new Intl.DateTimeFormat(locale, { timeStyle: 'short', hour12, timeZone }).format(date)
			: '',
		number: new Intl.NumberFormat(numberLocale).format(1234567.891),
		currency: new Intl.NumberFormat(numberLocale, { style: 'currency', currency }).format(1234.5),
		percent: new Intl.NumberFormat(numberLocale, { style: 'percent' }).format(0.256)
	};
}

// ── Integrations ────────────────────────────────────────────────────────────

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface Integration {
	id: string;
	name: string;
	description: string;
	status: IntegrationStatus;
	permissions: string[];
	/** Shown when connected, e.g. the linked account. */
	account?: string;
}

export function integrationStatusInfo(status: IntegrationStatus): {
	tone: SettingsTone;
	label: string;
} {
	switch (status) {
		case 'connected':
			return { tone: 'success', label: 'Connected' };
		case 'error':
			return { tone: 'danger', label: 'Needs attention' };
		case 'pending':
			return { tone: 'info', label: 'Connecting' };
		default:
			return { tone: 'neutral', label: 'Not connected' };
	}
}

export type IntegrationAction = 'connect' | 'disconnect' | 'reconnect' | null;

/** What the card's button does in each state; a pending connection has none. */
export function integrationAction(status: IntegrationStatus): IntegrationAction {
	switch (status) {
		case 'connected':
			return 'disconnect';
		case 'error':
			return 'reconnect';
		case 'disconnected':
			return 'connect';
		default:
			return null;
	}
}

const STATUS_ORDER: Record<IntegrationStatus, number> = {
	error: 0,
	connected: 1,
	pending: 2,
	disconnected: 3
};

/** Needs-attention first, then connected, pending, the rest; by name within each. */
export function sortIntegrations<T extends Integration>(items: readonly T[]): T[] {
	return [...items].sort(
		(a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name)
	);
}

export function filterIntegrations<T extends Integration>(items: readonly T[], query: string): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...items];
	return items.filter((i) => `${i.name} ${i.description}`.toLowerCase().includes(q));
}

export function countConnected(items: readonly Integration[]): number {
	return items.filter((i) => i.status === 'connected').length;
}

// ── Settings layout ─────────────────────────────────────────────────────────

export interface SettingsSection {
	id: string;
	label: string;
	description?: string;
}

/** The requested section if it exists, else the first (or empty when there are none). */
export function resolveSection(
	id: string | null | undefined,
	sections: readonly SettingsSection[]
): string {
	if (id && sections.some((s) => s.id === id)) return id;
	return sections[0]?.id ?? '';
}

/** "#notifications" -> "notifications" when it names a section, else null. */
export function sectionFromHash(hash: string, sections: readonly SettingsSection[]): string | null {
	const id = hash.replace(/^#/, '');
	let decoded = id;
	try {
		decoded = decodeURIComponent(id);
	} catch {
		/* keep the raw text */
	}
	return sections.some((s) => s.id === decoded) ? decoded : null;
}

/** Arrow-key movement through the side nav, wrapping at both ends. */
export function moveSection(
	current: string,
	sections: readonly SettingsSection[],
	delta: 1 | -1 | 'first' | 'last'
): string {
	if (sections.length === 0) return '';
	if (delta === 'first') return sections[0].id;
	if (delta === 'last') return sections[sections.length - 1].id;
	const i = Math.max(
		0,
		sections.findIndex((s) => s.id === current)
	);
	return sections[(i + delta + sections.length) % sections.length].id;
}
