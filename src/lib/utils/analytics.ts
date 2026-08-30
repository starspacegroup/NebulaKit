/**
 * Google Analytics 4 connection (docs/ADMIN_STATS.md §7).
 *
 * The kit's own stats are first-party, aggregate, and cookie-free; GA is an
 * OPTIONAL tag the owner switches on from `/admin/analytics`. Nothing here runs
 * unless a measurement ID has been saved, so the default posture is unchanged.
 *
 * This module is deliberately free of `$app` and Cloudflare imports: the KV
 * layer (`$lib/server/analytics-config.ts`), the admin API, and the browser
 * loader all share the same validation and the same exclusion list, so the tag
 * can never be accepted in one place and rejected in another.
 */

export interface AnalyticsConfig {
	provider: 'ga4';
	/** Always upper-cased `G-XXXXXXXX`. Not a secret — it ships in the page. */
	measurementId: string;
	enabled: boolean;
	/** ISO-8601, for the "last changed" line in the admin UI. */
	updatedAt: string;
}

/** A saved measurement ID: `G-` plus the alphanumeric data-stream id. */
export const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

/** A field holding nothing but the ID. Case-insensitive, because someone
 *  retyping it by hand may not shift. */
const GA4_ALONE = /^G-[A-Za-z0-9]{4,20}$/i;

/** The same shape found inside a pasted snippet. Case-SENSITIVE on purpose:
 *  Google emits the ID upper-cased, and a case-insensitive search over
 *  free-form pasted markup happily reads `config-12345` as a measurement ID. */
const GA4_IN_SNIPPET = /G-[A-Z0-9]{4,20}/;

const GTM_CONTAINER = /GTM-[A-Za-z0-9]{4,20}/i;
const UNIVERSAL_ANALYTICS = /UA-\d{4,}-\d+/i;

export type MeasurementIdParse =
	{ ok: true; measurementId: string } | { ok: false; reason: string };

/**
 * Accept either a bare measurement ID or a whole pasted tag snippet.
 *
 * The admin field takes one input on purpose. Google hands people the ID in
 * some places and the full `<script>` block in others, and asking which one
 * they have is a question the parser can answer itself: the ID is the only
 * thing the loader needs, and it is present in both forms.
 */
export function parseMeasurementId(input: string): MeasurementIdParse {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: false, reason: 'Enter a GA4 Measurement ID, or paste the whole tag snippet.' };
	}

	if (GA4_ALONE.test(trimmed)) {
		return { ok: true, measurementId: trimmed.toUpperCase() };
	}

	const found = trimmed.match(GA4_IN_SNIPPET);
	if (found) {
		return { ok: true, measurementId: found[0] };
	}

	if (GTM_CONTAINER.test(trimmed)) {
		return {
			ok: false,
			reason:
				'That is a Google Tag Manager container ID. Open GA4 → Admin → Data streams and use the Measurement ID, which starts with "G-".'
		};
	}

	if (UNIVERSAL_ANALYTICS.test(trimmed)) {
		return {
			ok: false,
			reason:
				'That is a Universal Analytics ID. UA properties stopped collecting in 2023 — use the GA4 Measurement ID, which starts with "G-".'
		};
	}

	return {
		ok: false,
		reason: 'No Measurement ID found. It looks like "G-ABCD123456".'
	};
}

/** Route prefixes the tag never loads on, matching the first-party page-view
 *  hook's exclusions in `src/hooks.server.ts`. Admin traffic is the owner's own
 *  and would skew the numbers; `/api` and `/setup` are not pages. */
export const ANALYTICS_EXCLUDED_PREFIXES = ['/admin', '/api', '/setup'] as const;

export function isAnalyticsExcludedPath(pathname: string): boolean {
	return ANALYTICS_EXCLUDED_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

export function gtagScriptUrl(measurementId: string): string {
	return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
}

/** Marks the injected tag so a second call is a no-op rather than a second
 *  copy of gtag.js. */
export const GTAG_SCRIPT_ID = 'nk-gtag';

interface GtagWindow {
	dataLayer?: unknown[];
	gtag?: (...args: unknown[]) => void;
}

export interface PageViewFields {
	path: string;
	title?: string;
	location?: string;
}

/**
 * Install gtag.js once, with automatic page views turned OFF.
 *
 * SvelteKit routes on the client, so gtag's own `page_view` would fire for the
 * first document only and every later navigation would go uncounted. The
 * component sends views explicitly instead — see {@link sendPageView}.
 *
 * Returns whether this call did the installing.
 */
export function installGtag(win: GtagWindow, doc: Document, measurementId: string): boolean {
	if (!GA4_MEASUREMENT_ID.test(measurementId)) return false;
	if (doc.getElementById(GTAG_SCRIPT_ID)) return false;

	const dataLayer = win.dataLayer ?? (win.dataLayer = []);

	// Faithful to Google's own snippet: gtag pushes the `arguments` object, not
	// a real Array. gtag.js reads dataLayer entries by shape, and an Array is a
	// different one — commands pushed as arrays are silently ignored.
	function gtag() {
		// eslint-disable-next-line prefer-rest-params
		dataLayer.push(arguments);
	}
	win.gtag = gtag as unknown as (...args: unknown[]) => void;

	win.gtag('js', new Date());
	win.gtag('config', measurementId, { send_page_view: false });

	const script = doc.createElement('script');
	script.id = GTAG_SCRIPT_ID;
	script.async = true;
	script.src = gtagScriptUrl(measurementId);
	(doc.head ?? doc.body).appendChild(script);

	return true;
}

/** Report one page view. No-ops until {@link installGtag} has defined `gtag`. */
export function sendPageView(
	win: GtagWindow,
	measurementId: string,
	fields: PageViewFields
): boolean {
	if (typeof win.gtag !== 'function') return false;

	win.gtag('event', 'page_view', {
		send_to: measurementId,
		page_path: fields.path,
		page_title: fields.title,
		page_location: fields.location
	});
	return true;
}
