#!/usr/bin/env node
/**
 * Fail loudly when wrangler.toml binds Cloudflare resources it shouldn't.
 *
 * Why this exists: Cloudflare binds D1 and KV by **id**. `database_name` is a
 * label wrangler never checks against the account. So a copied id silently
 * attaches your app to another project's database and every query succeeds.
 * NebulaKit shipped real ids in its template; six derived projects inherited
 * them and shared one D1 + one KV, including OAuth secrets and a GitHub PAT.
 *
 * Three failure modes, all silent without this check:
 *   1. placeholder left in place        -> you'd deploy against a bogus id
 *   2. a KNOWN-SHARED id pasted back in -> you'd rejoin the shared database
 *   3. preview_id === id                -> `wrangler dev` writes into prod
 *
 * Run standalone, or via the pre* hooks in package.json.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Optional path arg so the same guard can vet any derived project's config:
//   node scripts/check-bindings.mjs ../../other-project/wrangler.toml
//
// --warn reports the same problems but exits 0. Use it for commands that cannot
// reach a remote resource (the dev server), where an unconfigured clone is a
// legitimate state: a fresh "Use this template" checkout must be able to run
// `bun run dev` and the e2e suite before anyone has a Cloudflare account. Any
// command that WRITES to, or reads from, a real remote resource keeps the hard
// failure — that is the whole point of the guard.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const WARN_ONLY = argv.includes('--warn');
const pathArg = argv.find((a) => !a.startsWith('--'));
const CONFIG = pathArg ? pathArg : join(root, 'wrangler.toml');

// Ids that leaked through the template. Never legitimate in a derived project.
const QUARANTINED = new Map([
	['bd776be3-9823-4763-abb1-c18b40931456', 'shared nebulakit-db (D1)'],
	['12a6576334dd4e16bf1e08d5cc1fac4a', 'shared KV namespace'],
	['e9b0a93432b1406786dc7b9b334da90d', 'shared KV preview namespace']
]);

const PLACEHOLDER = /REPLACE_ME/;

let toml;
try {
	toml = readFileSync(CONFIG, 'utf8');
} catch {
	console.error(`check-bindings: cannot read ${CONFIG}`);
	process.exit(1);
}

// Deliberately line-based rather than a TOML parse: this must run before deps
// are guaranteed installed, and the shapes we care about are single lines.
const lines = toml.split('\n');
const problems = [];
const seen = { id: null, preview_id: null };

lines.forEach((raw, i) => {
	const line = raw.trim();
	if (!line || line.startsWith('#')) return;
	const m = line.match(/^(database_id|preview_database_id|id|preview_id)\s*=\s*"([^"]*)"/);
	if (!m) return;
	const [, key, value] = m;
	const at = `wrangler.toml:${i + 1}`;

	if (PLACEHOLDER.test(value)) {
		problems.push(`${at}  ${key} is still a placeholder (${value}).`);
		return;
	}
	if (QUARANTINED.has(value)) {
		problems.push(
			`${at}  ${key} points at the ${QUARANTINED.get(value)}.\n` +
				`             That id belongs to no single project — it is the one this\n` +
				`             template leaked. Create your own resource instead.`
		);
		return;
	}
	if (key === 'id') seen.id = value;
	if (key === 'preview_id') seen.preview_id = value;
	if (key === 'database_id') seen.database_id = value;
	if (key === 'preview_database_id') seen.preview_database_id = value;
});

if (seen.id && seen.preview_id && seen.id === seen.preview_id) {
	problems.push(
		`KV preview_id is identical to id (${seen.id}).\n` +
			`             \`wrangler dev\` would write into the production namespace.`
	);
}
if (seen.database_id && seen.preview_database_id && seen.database_id === seen.preview_database_id) {
	problems.push(
		`preview_database_id is identical to database_id (${seen.database_id}).\n` +
			`             Preview/dev writes would land in the production database.`
	);
}

if (problems.length) {
	const heading = WARN_ONLY
		? '\n  ! Cloudflare bindings are not configured yet:\n'
		: '\n  ✗ Cloudflare bindings are not safe to use:\n';
	const report = WARN_ONLY ? console.warn : console.error;

	report(heading);
	for (const p of problems) report(`    - ${p}`);
	report(`
  Fix:
    wrangler d1 create <project>-db
    wrangler kv namespace create "KV"
    wrangler kv namespace create "KV" --preview

  Paste the returned ids into wrangler.toml. One set per project — never
  reuse another project's ids. See docs/CLOUDFLARE_SETUP.md.
`);

	if (!WARN_ONLY) process.exit(1);

	// Local-only command: nothing here can reach a real remote resource, so carry
	// on. Anything that can will fail hard on the same problems.
	report('  Continuing — this command only touches local state.\n');
} else {
	console.log('check-bindings: ok — no placeholder, shared, or aliased ids.');
}
