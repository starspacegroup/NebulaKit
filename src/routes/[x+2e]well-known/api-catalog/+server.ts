/**
 * GET /.well-known/api-catalog — RFC 9727 catalog of this deployment's APIs.
 *
 * WHY THE `[x+2e]well-known` DIRECTORY NAME: `[x+2e]` is SvelteKit's hex escape
 * for `.`, so this directory serves `/.well-known/...`. A literally-named
 * `.well-known/` directory routes correctly too, but TypeScript's wildcard
 * includes skip dot-directories — the files would silently drop out of
 * `svelte-check` and `$lib` aliases would stop resolving. The escape keeps the
 * URL identical while leaving the code type-checked. Don't "fix" the name.
 *
 * Returns `application/linkset+json` (RFC 9264): a `linkset` array where each
 * member anchors one API and carries typed link relations describing it.
 *
 * HONESTY RULE (AGENTS.md §8): every anchor below is a real, reachable endpoint
 * in this codebase, and every access note matches the auth actually enforced in
 * the handler. A catalog that advertises endpoints which 404, or that describes
 * an authenticated API as public, is worse than no catalog — agents follow it
 * and fail in ways that look like site outages. When you add, remove, or change
 * the auth on an API, update this file in the same change.
 *
 * Most of this app's API surface requires a session cookie and is intentionally
 * NOT presented as agent-callable; the agent-facing story is public content over
 * HTML/Markdown (see /auth.md and the skills index).
 */
import { absoluteUrl } from '$lib/agent-discovery';
import { site } from '$lib/site.config';
import type { RequestHandler } from './$types';

/** A typed link target inside a linkset member (RFC 9264 §4.2). */
interface LinkTarget {
	href: string;
	type?: string;
	title?: string;
}

/** One catalogued API (RFC 9727 §3). */
interface LinksetMember {
	anchor: string;
	'service-doc'?: LinkTarget[];
	'service-desc'?: LinkTarget[];
	status?: LinkTarget[];
	author?: LinkTarget[];
	describedby?: LinkTarget[];
}

export const GET: RequestHandler = ({ url }) => {
	const origin = url.origin;
	const abs = (path: string) => absoluteUrl(origin, path);

	const docs: LinkTarget = {
		href: abs('/documentation'),
		type: 'text/html',
		title: `${site.name} documentation`
	};
	const status: LinkTarget = {
		href: abs('/api/health'),
		type: 'application/json',
		title: 'Service health'
	};
	const auth: LinkTarget = {
		href: abs('/auth.md'),
		type: 'text/markdown',
		title: 'Authentication guide for agents'
	};

	const linkset: LinksetMember[] = [
		{
			// Public, unauthenticated. Turnstile-gated when a secret key is
			// configured — see src/routes/api/contact-form-submissions/+server.ts.
			anchor: abs('/api/contact-form-submissions'),
			'service-doc': [docs],
			describedby: [auth],
			status: [status]
		},
		{
			// Public health probe; also the `status` target for every other entry.
			anchor: abs('/api/health'),
			'service-doc': [docs],
			status: [status]
		},
		{
			// Session-authenticated. Listed so an agent learns it exists and learns
			// it needs a session, rather than probing blindly.
			anchor: abs('/api/cms'),
			'service-doc': [docs],
			describedby: [auth],
			status: [status]
		},
		{
			// Session-authenticated LLM chat surface.
			anchor: abs('/api/chat'),
			'service-doc': [docs],
			describedby: [auth],
			status: [status]
		}
	];

	return new Response(JSON.stringify({ linkset }, null, '\t'), {
		headers: {
			// RFC 9264 media type. Agents content-negotiate on this exact value.
			'Content-Type': 'application/linkset+json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
