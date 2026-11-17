/**
 * Writing the `site` object of src/lib/site.config.ts back after `bun run customize` changes it.
 *
 * Separate from customize.mjs, which runs its command line the moment it is imported, so the
 * rewrite can be tested directly (tests/unit/customize-config-write.test.ts).
 */

/** Regenerate site.config.ts from the canonical template with the new values. */
/** @param {Record<string, any>} c */
export function renderConfig(c) {
	/** @param {unknown} s */
	const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
	return `/**
 * Single source of truth for app identity, branding, and local-dev config.
 *
 * When you spin up a new app from this template, DO NOT hand-edit the scattered
 * references. Run \`bun run customize\` (see CUSTOMIZE.md at the repo root), which
 * rewrites this file and syncs the surfaces that cannot import it — wrangler.toml
 * (Cloudflare resource names), tests, and docs.
 *
 * Everything that runs (Vite, Playwright, and every Svelte component) imports its
 * name/port/URL from here, so these values live in exactly one place.
 *
 * This module must stay dependency-free (no \`$app\`, no Node APIs) so that
 * vite.config.ts and playwright.config.ts can import it directly.
 */
export const site = {
	/** Product name shown in the UI, page titles, and social meta. */
	name: ${q(c.name)},
	/** Short name for tight spaces (browser tab, PWA \`short_name\`). */
	shortName: ${q(c.shortName)},
	/** One-line tagline for the footer and hero. */
	tagline: ${q(c.tagline)},
	/** Longer description for the meta description and OG/Twitter cards. */
	description: ${q(c.description)},
	/**
	 * URL-safe slug. Drives the Cloudflare resource names in wrangler.toml
	 * (\`<slug>-db\`, \`<slug>-files\`, \`<slug>-queue\`). Those files can't import this
	 * module, so \`bun run customize\` keeps them in sync — don't edit them by hand.
	 */
	slug: ${q(c.slug)},
	/** Local dev + preview port. Owned here; Vite and Playwright both read it. */
	devPort: ${c.devPort},
	/** Production URL, no trailing slash. Used for canonical + OG URLs. */
	url: ${q(c.url)},
	/**
	 * Default share image for OG/Twitter cards: root-relative path, alt text, pixel size.
	 * \`static/og-image.png\` is generated from this file by \`bun run og:generate\` (and by
	 * \`bun run customize\`), so a link to any page without a picture of its own is shared with a
	 * card for THIS site. See docs/SHARE_IMAGES.md.
	 */
	ogImage: {
		src: '/og-image.png',
		alt: ${q(`${c.name} — ${c.tagline}`)},
		width: 1200,
		height: 630
	},
	/** GitHub repository in \`owner/name\` form. */
	repo: ${q(c.repo)},
	/** Attribution shown in the footer. */
	author: ${q(c.author)},
	/** URL for the footer attribution link. */
	authorUrl: ${q(c.authorUrl)},
	/**
	 * Show the "Proudly built with NebulaKit" badge in the footer.
	 *
	 * A courtesy rather than a condition — NebulaKit is MIT-licensed and nothing
	 * here checks this value but the footer. Set it to \`false\` and the badge
	 * goes, with no hard feelings. Other wordings and every other form of the
	 * badge live at https://nebulakit.starspace.group/badge.
	 */
	showBuiltWithBadge: ${c.showBuiltWithBadge === false ? 'false' : 'true'}
} as const;

/** Full GitHub URL, derived from {@link site.repo}. */
export const repoUrl = \`https://github.com/\${site.repo}\`;
`;
}

/** The `export const site = { ... } as const;` statement in `text`, as [start, end). */
/** @param {string} text */
function siteBlockRange(text) {
	const start = text.indexOf('export const site = {');
	const close = start < 0 ? -1 : text.indexOf('} as const;', start);
	if (close < 0)
		throw new Error('src/lib/site.config.ts has no `export const site = { ... } as const;`');
	return [start, close + '} as const;'.length];
}

/**
 * `existing` with its `site` object replaced by the one for `c`, and the brand accent updated.
 * Everything outside that object is left exactly as it was.
 */
/**
 * @param {string} existing
 * @param {Record<string, any>} c
 */
export function applySite(existing, c) {
	const [newStart, newEnd] = siteBlockRange(renderConfig(c));
	const block = renderConfig(c).slice(newStart, newEnd);
	const [start, end] = siteBlockRange(existing);
	let out = existing.slice(0, start) + block + existing.slice(end);
	if (c.accent) {
		out = out.replace(
			/(emailTheme\s*=\s*\{[\s\S]*?accent:\s*)(['"])#[0-9a-fA-F]{6}\2/,
			`$1'${c.accent}'`
		);
	}
	return out;
}
