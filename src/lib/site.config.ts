/**
 * Single source of truth for app identity, branding, and local-dev config.
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
	tagline: "A cosmic-grade SvelteKit starter powered by Cloudflare's full stack.",
	/** Longer description for the meta description and OG/Twitter cards. */
	description:
		'NebulaKit is a production-ready SvelteKit starter template for Cloudflare. Content management, authentication, AI chat, first-party analytics, and agent-ready publishing are wired up and tested from day one.',
	/**
	 * URL-safe slug. Drives the Cloudflare resource names in wrangler.toml
	 * (`<slug>-db`, `<slug>-files`, `<slug>-queue`).
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
	authorUrl: 'https://starspace.group',
	/**
	 * Show the "Proudly built with NebulaKit" badge in the footer.
	 *
	 * On by default, and a courtesy rather than a condition — NebulaKit is
	 * MIT-licensed and nothing here checks this value but the footer. Set it to
	 * `false` and the badge goes, with no hard feelings. Other wordings and every
	 * other form of the badge live at https://nebulakit.starspace.group/badge.
	 */
	showBuiltWithBadge: true
} as const;

/**
 * Colours for transactional email (`src/lib/emails/templates.ts`).
 *
 * The one place literal colours are allowed outside `app.css`: email clients
 * ignore CSS custom properties and often strip `<style>`, so a template can
 * only use inlined literals. Keep them here, not in the templates, and set
 * them to the brand in `bun run customize`. Templates also accept a theme
 * argument, so a caller can override per message.
 */
export const emailTheme = {
	/** Page background behind the card. */
	background: '#f4f4f7',
	/** The card the message sits on. */
	surface: '#ffffff',
	/** Header bar behind the site name, and the button. */
	accent: '#3b3f8f',
	/** Text on the accent colour. */
	onAccent: '#ffffff',
	/** Body copy. */
	text: '#1f2230',
	/** Footer and secondary copy. */
	muted: '#6b7080',
	/** Rules between table rows. */
	border: '#e2e4ec'
} as const;

/** Full GitHub URL, derived from {@link site.repo}. */
export const repoUrl = `https://github.com/${site.repo}`;
