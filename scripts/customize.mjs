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
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSiteConfig } from './site-config-parse.mjs';
import { applySite } from './site-config-write.mjs';

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
	'bun.lock',
	// The badge names NebulaKit on purpose. Without these two entries the
	// rename would turn "Proudly built with NebulaKit" into "Proudly built with
	// Acme" pointing at acme.starspace.group — a badge for a thing that does not
	// exist. Turn the badge off in site.config instead; it is a courtesy, not a
	// condition.
	'src/lib/components/BuiltWithNebulaKit.svelte',
	'src/lib/components/BuiltWithNebulaKit.test.ts'
]);

/** Repo-relative directories never walked: kit-owned code a site tracks from
 *  upstream. `packages/` holds @nebulakit/commerce, builder and security; a
 *  rename there would break every import and make each later update a merge
 *  conflict on every client site. */
const SKIP_PATHS = new Set(['packages']);

/**
 * Text that names the kit rather than the product, masked before the rename
 * and restored after. Without this a site called "Acme" would import
 * `@acme/commerce`, which does not exist. Found 2026-10-18 by provisioning a
 * client site from Ammoura and reading its first commit.
 */
const PROTECTED = [
	/@nebulakit\//g,
	// A component identifier: a multi-word name ("Acme Prints") would make it invalid code.
	/BuiltWithNebulaKit/g,
	// The badge keeps naming NebulaKit (its component is skipped), so its test must too.
	/built with nebulakit/gi,
	/https:\/\/nebulakit\.starspace\.group/g,
	/\.nebulakit\.updateChannel\b/g,
	/name: 'nebulakit'/g
];

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
	return parseSiteConfig(readFileSync(join(ROOT, 'src/lib/site.config.ts'), 'utf8'));
}

function ask(label, current) {
	const answer = prompt(`${label} [${current}]:`, String(current ?? ''));
	const trimmed = (answer ?? '').trim();
	return trimmed === '' ? current : trimmed;
}

/** Same as {@link ask}, for a yes/no value. Anything but a leading "n" keeps
 *  the current setting's meaning, so a stray keystroke cannot silently flip it. */
function askYesNo(label, current) {
	const shown = current ? 'yes' : 'no';
	const answer = (prompt(`${label} [${shown}]:`, shown) ?? '').trim().toLowerCase();
	if (answer === '') return current;
	return !answer.startsWith('n');
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
	next.accent = ask(
		'Brand accent colour (#rrggbb, used on the share card and in emails)',
		current.accent
	);
	next.showBuiltWithBadge = askYesNo(
		'Keep the "Proudly built with NebulaKit" badge in the footer?',
		current.showBuiltWithBadge
	);
	next.publicSignIn = askYesNo(
		'Let visitors sign in and sign up? (No for a shop where only admins sign in — docs/PUBLIC_SIGN_IN.md)',
		current.publicSignIn
	);
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
	// A value the parser could not read comes through as undefined, and writing
	// it back would stamp the string "undefined" into the config. Fail instead.
	for (const key of ['shortName', 'tagline', 'description', 'url', 'author', 'authorUrl'])
		if (next[key] === undefined || next[key] === 'undefined')
			errors.push(`${key} could not be read from src/lib/site.config.ts`);
	if (!/^[a-z0-9][a-z0-9-]*$/.test(next.slug))
		errors.push(`slug "${next.slug}" must be lowercase alphanumeric + dashes`);
	if (!Number.isInteger(next.devPort) || next.devPort < 1 || next.devPort > 65535)
		errors.push(`devPort "${next.devPort}" must be a port number`);
	if (next.accent !== undefined && !/^#[0-9a-fA-F]{6}$/.test(next.accent))
		errors.push(`accent "${next.accent}" must be a #rrggbb colour`);
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
	const kept = [];
	let out = text;
	for (const pattern of PROTECTED) {
		out = out.replace(pattern, (match) => `\u0000${kept.push(match) - 1}\u0000`);
	}
	for (const [from, to, mode] of replacements) {
		const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = mode === 'word' ? `\\b${escaped}\\b` : escaped;
		out = out.replace(new RegExp(pattern, 'g'), to);
	}
	return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}

function walk(dir, files = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const rel = relative(ROOT, full);
		if (statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(entry) && !SKIP_PATHS.has(rel)) walk(full, files);
		} else if (TEXT_EXT.has(extname(entry)) && !SKIP_FILES.has(rel)) {
			files.push(full);
		}
	}
	return files;
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
// Only the `site` object is rewritten. The rest of the file (emailTheme, repoUrl, anything a site
// has added) is the site's own, and regenerating the whole file from a canned copy deleted it.
if (!DRY) {
	const configPath = join(ROOT, 'src/lib/site.config.ts');
	writeFileSync(configPath, applySite(readFileSync(configPath, 'utf8'), next));
}

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

// The default share image is made from the site's own name, tagline, address and accent, so a link
// to this site never shares as the template. Needs a Chromium; if there is none the rename still
// stands and the bullet below says what to run.
let shareImage = 'skipped';
if (!DRY) {
	try {
		execFileSync('bun', ['scripts/generate-og-image.mjs'], { cwd: ROOT, stdio: 'inherit' });
		shareImage = 'generated';
	} catch {
		shareImage = 'failed';
	}
}

console.log(`${DRY ? 'Would update' : 'Updated'} ${changed.length + 1} files:`);
console.log('  src/lib/site.config.ts (regenerated)');
for (const f of changed) console.log(`  ${f}`);

console.log(`\n${DRY ? '[dry run complete — nothing written]' : '✓ Mechanical rename done.'}`);
console.log(
	`  Auth and secret form fields are now "${next.slug}-*" — unique to this site, so a\n` +
		"  password manager will not offer another template site's credentials here."
);
console.log('\nStill needs a human/agent (see CUSTOMIZE.md → "Semantic steps"):');
console.log("  • wrangler.toml still has the TEMPLATE's Cloudflare resource IDs —");
console.log('    run `wrangler d1/kv/r2 create` and paste your own database_id / ids.');
console.log('  • Rewrite src/routes/documentation/+page.svelte to describe YOUR app.');
console.log('  • Make the home hero yours — words, motif, rules — per docs/HERO.md.');
console.log('  • Curate the command palette — run `bun run palette:scan` for suggestions.');
console.log(
	shareImage === 'generated'
		? '  • Share image: generated from your name, tagline and accent (static/og-image.*). Replace it only for real\n' +
				'    artwork. Favicons and the icon set are still yours to replace (CUSTOMIZE.md).'
		: '  • Share image: run `bun run og:generate` (needs Chromium: `bunx playwright install chromium`). Until you do,\n' +
				`    every link to ${next.name} is shared with the template's artwork, and tests/unit/share-images.test.ts fails.\n` +
				'    Favicons and the icon set are also yours to replace (CUSTOMIZE.md).'
);
console.log('  • Set INITIAL_CUSTOMIZATION_STATUS.md → status: complete when finished.');
