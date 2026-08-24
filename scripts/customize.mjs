#!/usr/bin/env bun
/**
 * customize.mjs — the mechanical half of the "new app from this template" path.
 *
 * What it does (deterministic, safe to re-run):
 *   1. Reads the CURRENT identity from src/lib/site.config.ts.
 *   2. Gathers the NEW identity — from customize.config.json if present
 *      (non-interactive, good for agents/CI), otherwise by prompting.
 *   3. Rewrites src/lib/site.config.ts with the new values.
 *   4. Search-and-replaces the old tokens (name, slug, port, repo, url, author)
 *      across every text surface that can't import the config: tests, docs,
 *      wrangler.toml, package.json, app.html, etc.
 *   5. Updates INITIAL_CUSTOMIZATION_STATUS.md and prints the remaining
 *      *semantic* steps (docs rewrite, palette curation, brand assets, infra IDs)
 *      that need a human/agent — see CUSTOMIZE.md.
 *
 * Usage:
 *   bun run customize            # interactive
 *   bun run customize --dry      # show what would change, write nothing
 *   # non-interactive: create customize.config.json first (see the .example)
 *
 * This deliberately does NOT touch prose taglines/descriptions in docs, or
 * Cloudflare resource IDs — those need judgment. See the warnings it prints.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry');

/** Directories never walked. */
const SKIP_DIRS = new Set([
	'node_modules',
	'.svelte-kit',
	'.wrangler',
	'coverage',
	'.git',
	'build',
	'.llm-outputs',
	'test-results',
	'playwright-report'
]);

/** Files left untouched — they describe the template/process itself, are binary,
 *  or are regenerated/handled specially. Paths are relative to the repo root. */
const SKIP_FILES = new Set([
	'scripts/customize.mjs',
	'scripts/palette-scan.mjs',
	'customize.config.json',
	'customize.config.example.json',
	'CUSTOMIZE.md',
	'SETUP_COMPLETE.md',
	'docs/INITIAL_CUSTOMIZATION.md',
	'INITIAL_CUSTOMIZATION_STATUS.md',
	'src/lib/site.config.ts',
	'bun.lock'
]);

/** Only these extensions are treated as text and rewritten. */
const TEXT_EXT = new Set([
	'.ts',
	'.js',
	'.mjs',
	'.cjs',
	'.svelte',
	'.json',
	'.toml',
	'.md',
	'.html',
	'.css',
	'.yml',
	'.yaml',
	'.webmanifest',
	'.txt'
]);

/** Read the current config values without importing (avoids caching the module
 *  we're about to overwrite). We parse the small set of string/number fields. */
function readCurrentConfig() {
	const src = readFileSync(join(ROOT, 'src/lib/site.config.ts'), 'utf8');
	const str = (key) => src.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1];
	const num = (key) => Number(src.match(new RegExp(`${key}:\\s*(\\d+)`))?.[1]);
	return {
		name: str('name'),
		shortName: str('shortName'),
		tagline: str('tagline'),
		description: str('description'),
		slug: str('slug'),
		devPort: num('devPort'),
		url: str('url'),
		repo: str('repo'),
		author: str('author'),
		authorUrl: str('authorUrl')
	};
}

function ask(label, current) {
	const answer = prompt(`${label} [${current}]:`, String(current ?? ''));
	const trimmed = (answer ?? '').trim();
	return trimmed === '' ? current : trimmed;
}

function gatherNext(current) {
	const configPath = join(ROOT, 'customize.config.json');
	if (existsSync(configPath)) {
		console.log('Reading new values from customize.config.json (non-interactive).\n');
		const overrides = JSON.parse(readFileSync(configPath, 'utf8'));
		return { ...current, ...overrides };
	}
	console.log('Interactive customization — press Enter to keep the current value.\n');
	const next = { ...current };
	next.name = ask('App name', current.name);
	next.shortName = ask('Short name', next.name.length <= 12 ? next.name : current.shortName);
	next.slug = ask('Slug (url-safe, lowercase)', slugify(next.name));
	next.devPort = Number(ask('Dev port', current.devPort));
	next.tagline = ask('Tagline', current.tagline);
	next.description = ask('Description', current.description);
	next.url = ask('Production URL', `https://${next.slug}.pages.dev`);
	next.repo = ask('GitHub repo (owner/name)', current.repo);
	next.author = ask('Footer author', current.author);
	next.authorUrl = ask('Footer author URL', current.authorUrl);
	return next;
}

function slugify(name) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function validate(next) {
	const errors = [];
	if (!next.name) errors.push('name is required');
	if (!/^[a-z0-9][a-z0-9-]*$/.test(next.slug))
		errors.push(`slug "${next.slug}" must be lowercase alphanumeric + dashes`);
	if (!Number.isInteger(next.devPort) || next.devPort < 1 || next.devPort > 65535)
		errors.push(`devPort "${next.devPort}" must be a port number`);
	if (next.repo && !/^[^/]+\/[^/]+$/.test(next.repo))
		errors.push(`repo "${next.repo}" must be "owner/name"`);
	return errors;
}

/** old→new replacements, applied longest-old-string first so that a token
 *  contained inside another (slug inside a URL, name inside "<Name> Inc") is
 *  never half-rewritten by a shorter, more general replacement. */
function buildReplacements(old, next) {
	const pairs = [
		[`https://github.com/${old.repo}`, `https://github.com/${next.repo}`],
		[old.repo, next.repo],
		[old.url, next.url],
		[old.authorUrl, next.authorUrl],
		[old.name, next.name],
		[old.slug, next.slug],
		[old.author, next.author],
		[String(old.devPort), String(next.devPort), 'word']
	];
	return pairs
		.filter(([a, b]) => a && b && a !== b)
		.sort((x, y) => String(y[0]).length - String(x[0]).length);
}

function applyReplacements(text, replacements) {
	let out = text;
	for (const [from, to, mode] of replacements) {
		const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = mode === 'word' ? `\\b${escaped}\\b` : escaped;
		out = out.replace(new RegExp(pattern, 'g'), to);
	}
	return out;
}

function walk(dir, files = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const rel = relative(ROOT, full);
		if (statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(entry)) walk(full, files);
		} else if (TEXT_EXT.has(extname(entry)) && !SKIP_FILES.has(rel)) {
			files.push(full);
		}
	}
	return files;
}

/** Regenerate site.config.ts from the canonical template with the new values. */
function renderConfig(c) {
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
	/** GitHub repository in \`owner/name\` form. */
	repo: ${q(c.repo)},
	/** Attribution shown in the footer. */
	author: ${q(c.author)},
	/** URL for the footer attribution link. */
	authorUrl: ${q(c.authorUrl)}
} as const;

/** Full GitHub URL, derived from {@link site.repo}. */
export const repoUrl = \`https://github.com/\${site.repo}\`;
`;
}

function updateStatus(next) {
	const path = join(ROOT, 'INITIAL_CUSTOMIZATION_STATUS.md');
	if (!existsSync(path)) return;
	let text = readFileSync(path, 'utf8');
	text = text
		.replace(/^app_name:.*$/m, `app_name: ${next.name}`)
		.replace(/(^-\s*App name:).*$/m, `$1 ${next.name}`)
		// The slug now belongs to this product, so the credential field ids
		// derived from it no longer collide with other sites from the template.
		.replace(/^credential_fields_unique:.*$/m, 'credential_fields_unique: true')
		.replace(/(^-\s*Credential fields unique:).*$/m, '$1 yes');
	if (!DRY) writeFileSync(path, text);
}

// ── Run ─────────────────────────────────────────────────────────────────────
const current = readCurrentConfig();
const next = gatherNext(current);

const errors = validate(next);
if (errors.length) {
	console.error('\n✗ Invalid configuration:');
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

const replacements = buildReplacements(current, next);
if (!replacements.length) {
	console.log('Nothing to change — the new values match the current ones.');
	process.exit(0);
}

console.log(`\n${DRY ? '[dry run] ' : ''}Renaming ${current.name} → ${next.name}`);
console.log('Replacements:');
for (const [from, to] of replacements) console.log(`  ${from}  →  ${to}`);
console.log('');

// Rewrite the canonical config first.
if (!DRY) writeFileSync(join(ROOT, 'src/lib/site.config.ts'), renderConfig(next));

// Propagate old tokens through every other text surface.
const changed = [];
for (const file of walk(ROOT)) {
	const before = readFileSync(file, 'utf8');
	const after = applyReplacements(before, replacements);
	if (after !== before) {
		changed.push(relative(ROOT, file));
		if (!DRY) writeFileSync(file, after);
	}
}
updateStatus(next);

console.log(`${DRY ? 'Would update' : 'Updated'} ${changed.length + 1} files:`);
console.log('  src/lib/site.config.ts (regenerated)');
for (const f of changed) console.log(`  ${f}`);

console.log(`\n${DRY ? '[dry run complete — nothing written]' : '✓ Mechanical rename done.'}`);
console.log(
	`  Auth and secret form fields are now "${next.slug}-*" — unique to this site, so a\n` +
		'  password manager will not offer another template site\'s credentials here.'
);
console.log('\nStill needs a human/agent (see CUSTOMIZE.md → "Semantic steps"):');
console.log("  • wrangler.toml still has the TEMPLATE's Cloudflare resource IDs —");
console.log('    run `wrangler d1/kv/r2 create` and paste your own database_id / ids.');
console.log('  • Rewrite src/routes/documentation/+page.svelte to describe YOUR app.');
console.log('  • Curate the command palette — run `bun run palette:scan` for suggestions.');
console.log('  • Replace brand assets (og-image, favicons, icon set) per CUSTOMIZE.md.');
console.log('  • Set INITIAL_CUSTOMIZATION_STATUS.md → status: complete when finished.');
