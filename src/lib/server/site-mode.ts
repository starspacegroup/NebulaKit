/**
 * Coming-soon mode, gate half (issue #11). One KV setting, `site_mode`, turns
 * the whole site into a holding page for signed-out visitors. Admins pass
 * through on their session, and a short allowlist of routes stays reachable so
 * the person who flips the switch can still sign in and flip it back.
 *
 * This file is the gate only. The admin interface, preview token, CMS-backed
 * copy and discovery-surface changes are later slices.
 */
import type { KVNamespace } from '@cloudflare/workers-types';
import { site } from '$lib/site.config';

export const SITE_MODE_KEY = 'site_mode';

export type SiteMode = 'off' | 'coming-soon';

/**
 * Paths that stay reachable while the gate is on. This list is the tested
 * contract. A prefix matches a whole path segment: `/auth` covers `/auth/login`
 * and never `/authors`.
 *
 * - sign-in and setup, so an owner cannot lock themselves out;
 * - webhooks and cron, which are machine callers that must never see a page;
 * - health, robots, favicons and the build assets the sign-in page needs.
 */
export const GATE_ALLOWLIST: readonly string[] = [
	'/setup',
	'/auth',
	'/api/auth',
	'/api/setup',
	'/api/v1/webhooks',
	'/api/cron',
	'/api/health',
	'/_app',
	'/robots.txt',
	'/favicon.svg',
	'/favicon-light.svg',
	'/favicon-dark.svg',
	'/site.webmanifest'
];

export function isReachableWhileGated(pathname: string): boolean {
	return GATE_ALLOWLIST.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** How long one isolate trusts what it read. The off state is cached too: a
 *  launched site is off forever and must not pay a KV read per request. */
export const SITE_MODE_TTL_MS = 30_000;

let cache: { mode: SiteMode; expires: number } | null = null;

export function resetSiteModeCache(): void {
	cache = null;
}

/** Parse the stored value. Anything unrecognised is `off`: a bad row must never
 *  take a site down. */
export function parseSiteMode(raw: string | null): SiteMode {
	if (!raw) return 'off';
	try {
		const parsed = JSON.parse(raw) as { mode?: unknown } | null;
		return parsed?.mode === 'coming-soon' ? 'coming-soon' : 'off';
	} catch {
		return 'off';
	}
}

/** Fails open (`off`) on a missing binding or a KV error. */
export async function readSiteMode(
	kv: KVNamespace | undefined | null,
	now: number = Date.now()
): Promise<SiteMode> {
	if (!kv) return 'off';
	if (cache && cache.expires > now) return cache.mode;
	let mode: SiteMode;
	try {
		mode = parseSiteMode(await kv.get(SITE_MODE_KEY));
	} catch (err) {
		console.error('Failed to read site mode from KV:', err);
		return 'off';
	}
	cache = { mode, expires: now + SITE_MODE_TTL_MS };
	return mode;
}

export async function writeSiteMode(kv: KVNamespace, mode: SiteMode): Promise<void> {
	await kv.put(SITE_MODE_KEY, JSON.stringify({ mode, updatedAt: new Date().toISOString() }));
	resetSiteModeCache();
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** The holding page. Plain HTML from `site.name` and `site.tagline`, so the
 *  mode works the moment it is on. CMS-backed copy is a later slice. */
export function holdingPageHtml(): string {
	const name = escapeHtml(site.name);
	const tagline = escapeHtml(site.tagline);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — coming soon</title>
<meta name="description" content="${tagline}">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0b0d12;color:#f2f4f8;text-align:center}
main{padding:2rem;max-width:36rem}
h1{font-size:2.5rem;margin:0 0 .75rem}
p{font-size:1.125rem;line-height:1.5;margin:.5rem 0;color:#c4c9d4}
</style>
</head>
<body>
<main>
<h1>${name}</h1>
<p>${tagline}</p>
<p>Coming soon.</p>
</main>
</body>
</html>`;
}

/**
 * The gated response. A page request gets the holding page as a 200: before
 * launch it is the site, for now. Anything that is not a page read gets a 503
 * with `Retry-After`, so a client does not treat a refused write as done.
 */
export function gatedResponse(method: string): Response {
	const headers = { 'cache-control': 'no-store' };
	if (method === 'GET' || method === 'HEAD') {
		return new Response(method === 'HEAD' ? null : holdingPageHtml(), {
			status: 200,
			headers: { ...headers, 'content-type': 'text/html; charset=utf-8' }
		});
	}
	return new Response('Coming soon.', {
		status: 503,
		headers: { ...headers, 'content-type': 'text/plain; charset=utf-8', 'retry-after': '3600' }
	});
}
