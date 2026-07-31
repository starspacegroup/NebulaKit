#!/usr/bin/env bun
/**
 * palette-scan.mjs — advisory helper for the "refill the command palette" step.
 *
 * The command palette (src/lib/components/CommandPalette.svelte) hardcodes its
 * navigation entries. When you reshape the app, those entries drift from the
 * actual routes. This script scans src/routes, prints the routes the palette
 * currently references vs. the ones it's missing, and emits ready-to-paste
 * command objects for the gaps — so YOU decide what belongs, not a blind codegen.
 *
 * It never edits the component (the entries live inside a reactive block with
 * auth/feature gating that only a human/agent should wire up). Copy what fits.
 *
 * Usage:  bun run palette:scan
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROUTES = join(ROOT, 'src/routes');
const PALETTE = join(ROOT, 'src/lib/components/CommandPalette.svelte');

/** Routes that exist but aren't meaningful palette destinations. */
const IGNORE = new Set(['api', 'auth', '(', '[', 'admin']);

/** Top-level user-facing routes = directories under src/routes with a +page. */
function topLevelRoutes() {
	if (!existsSync(ROUTES)) return [];
	return readdirSync(ROUTES)
		.filter((entry) => {
			const full = join(ROUTES, entry);
			if (!statSync(full).isDirectory()) return false;
			if ([...IGNORE].some((p) => entry.startsWith(p))) return false;
			return existsSync(join(full, '+page.svelte'));
		})
		.sort();
}

function titleize(slug) {
	return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ICONS = {
	chat: '💬',
	documentation: '📚',
	profile: '👤',
	contact: '✉️',
	media: '🖼️',
	privacy: '🔒',
	terms: '📄',
	reset: '🔄',
	setup: '⚙️'
};

const routes = topLevelRoutes();
const palette = existsSync(PALETTE) ? readFileSync(PALETTE, 'utf8') : '';

const referenced = routes.filter((r) => palette.includes(`goto('/${r}')`));
const missing = routes.filter((r) => !palette.includes(`goto('/${r}')`));

console.log('Command palette route audit\n');
console.log(`Routes with a page:  ${routes.map((r) => '/' + r).join(', ') || '(none)'}`);
console.log(`Already in palette:  ${referenced.map((r) => '/' + r).join(', ') || '(none)'}`);
console.log(`Not yet in palette:  ${missing.map((r) => '/' + r).join(', ') || '(none)'}\n`);

if (missing.length) {
	console.log('Suggested entries (paste into the $: commands array, then gate/reorder):\n');
	for (const r of missing) {
		console.log(`\t{`);
		console.log(`\t\tid: '${r}',`);
		console.log(`\t\tlabel: '${titleize(r)}',`);
		console.log(`\t\tdescription: 'Go to ${titleize(r).toLowerCase()}',`);
		console.log(`\t\taction: () => goto('/${r}'),`);
		console.log(`\t\ticon: '${ICONS[r] ?? '➡️'}'`);
		console.log(`\t},`);
	}
	console.log('');
}

console.log('Reminder: some entries should stay auth-gated (isAuthenticated / canAccessAdmin)');
console.log('or feature-gated (hasAIProviders). Review before pasting.');
