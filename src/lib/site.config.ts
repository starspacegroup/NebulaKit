/**
 * Single source of truth for app identity, branding, and local-dev config.
 *
 * When you spin up a new app from this template, DO NOT hand-edit the scattered
 * references. Run `bun run customize` (see CUSTOMIZE.md at the repo root), which
 * rewrites this file and syncs the surfaces that cannot import it — wrangler.toml
 * (Cloudflare resource names), tests, and docs.
 *
 * Everything that runs (Vite, Playwright, and every Svelte component) imports its
 * name/port/URL from here, so these values live in exactly one place.
 *
 * This module must stay dependency-free (no `$app`, no Node APIs) so that
 * vite.config.ts and playwright.config.ts can import it directly.
 */
export const site = {
	/** Product name shown in the UI, page titles, and social meta. */
	name: 'NebulaKit',
	/** Short name for tight spaces (browser tab, PWA `short_name`). */
	shortName: 'NebulaKit',
	/** One-line tagline for the footer and hero. */
	tagline: 'A cosmic-grade SvelteKit starter powered by Cloudflare Workers.',
	/** Longer description for the meta description and OG/Twitter cards. */
	description: 'A cosmic-grade SvelteKit starter powered by Cloudflare. Built with SvelteKit, Cloudflare Workers, D1 database, Auth.js authentication, and AI chat capabilities.',
	/**
	 * URL-safe slug. Drives the Cloudflare resource names in wrangler.toml
	 * (`<slug>-db`, `<slug>-files`, `<slug>-queue`). Those files can't import this
	 * module, so `bun run customize` keeps them in sync — don't edit them by hand.
	 */
	slug: 'nebulakit',
	/** Local dev + preview port. Owned here; Vite and Playwright both read it. */
	devPort: 4277,
	/** Production URL, no trailing slash. Used for canonical + OG URLs. */
	url: 'https://nebulakit.pages.dev',
	/** GitHub repository in `owner/name` form. */
	repo: 'starspacegroup/NebulaKit',
	/** Attribution shown in the footer. */
	author: '*Space',
	/** URL for the footer attribution link. */
	authorUrl: 'https://starspace.group'
} as const;

/** Full GitHub URL, derived from {@link site.repo}. */
export const repoUrl = `https://github.com/${site.repo}`;
