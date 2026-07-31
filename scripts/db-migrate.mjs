#!/usr/bin/env node
/**
 * Run D1 migrations against THIS project's database.
 *
 * Why this exists: these scripts used to be hardcoded to `nebulakit-db`, the
 * template's own database name. Every derived project inherited that, so
 * `db:migrate` either failed ("no database named nebulakit-db") or — for anyone
 * who still had the template's leaked id in place — applied the project's
 * migrations into the SHARED database. That is how one D1 ended up with 28
 * tables and four projects' migrations interleaved. See docs/CLOUDFLARE_SETUP.md.
 *
 * The database name now comes from wrangler.toml, which is the same file the
 * binding id comes from, so the two can no longer disagree.
 *
 * Usage (via package.json):
 *   bun run db:migrate          -> apply
 *   bun run db:migrate:local    -> apply --local
 *   bun run db:migrate:list     -> list
 * Extra args are passed through to wrangler.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(root, 'wrangler.toml');

const [action = 'apply', ...rest] = process.argv.slice(2);
if (!['apply', 'list'].includes(action)) {
	console.error(`db-migrate: unknown action "${action}" (expected apply or list)`);
	process.exit(1);
}

// The binding guard is the authority on whether these ids are safe to touch.
// Run it here rather than relying on npm's pre* hooks — bun does not run them,
// and this is the one command that WRITES to whatever it is pointed at.
const check = spawnSync('node', [join(root, 'scripts', 'check-bindings.mjs')], {
	cwd: root,
	stdio: 'inherit'
});
if (check.status !== 0) process.exit(check.status ?? 1);

let toml;
try {
	toml = readFileSync(CONFIG, 'utf8');
} catch {
	console.error(`db-migrate: cannot read ${CONFIG}`);
	process.exit(1);
}

// First [[d1_databases]] entry — the DB binding the app actually uses.
const match = toml.match(/^\s*database_name\s*=\s*"([^"]+)"/m);
const name = match?.[1];

if (!name || /REPLACE_ME/.test(name)) {
	console.error(`
  ✗ wrangler.toml has no real database_name yet${name ? ` (found "${name}")` : ''}.

  Create this project's own resources first:
    bun run setup:cf

  See docs/CLOUDFLARE_SETUP.md.
`);
	process.exit(1);
}

const args = ['wrangler', 'd1', 'migrations', action, name, ...rest];
console.log(`db-migrate: ${args.join(' ')}\n`);
const run = spawnSync('npx', args, {
	cwd: root,
	stdio: 'inherit',
	shell: process.platform === 'win32'
});
process.exit(run.status ?? 1);
