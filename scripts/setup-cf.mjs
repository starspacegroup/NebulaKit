#!/usr/bin/env node
/**
 * Create this project's own Cloudflare resources and write their ids into
 * wrangler.toml.
 *
 * Why this exists: the template ships `REPLACE_ME_*` placeholders because it
 * once shipped REAL ids, and six derived projects inherited them — one D1 and
 * one KV shared between all of them, including OAuth secrets and a GitHub PAT.
 * See docs/CLOUDFLARE_SETUP.md. The remaining risk after placeholders is the
 * human step: creating four resources and pasting four ids into the right four
 * lines. That is what this automates, so nobody hand-copies an id into the
 * wrong binding again.
 *
 * Safety properties, in order of importance:
 *   1. It never writes an id it is not sure of. If wrangler's output cannot be
 *      parsed into exactly one id of the right shape, wrangler.toml is left
 *      untouched and you get the raw output to paste by hand.
 *   2. It refuses to overwrite ids that are already real, unless --force.
 *   3. It verifies the result by running check-bindings.mjs before exiting.
 *
 * Usage:
 *   bun run setup:cf                # slug from wrangler.toml `name`
 *   bun run setup:cf my-project     # explicit slug -> my-project-db
 *   bun run setup:cf --dry-run      # show the commands, change nothing
 *   bun run setup:cf --force        # replace ids that are already real
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(root, 'wrangler.toml');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
const slugArg = argv.find((a) => !a.startsWith('-'));

// Shapes, not labels: wrangler v3 prints TOML and v4 prints JSON, but a D1 id
// is always a UUID and a KV id is always 32 hex chars. Matching on shape keeps
// this working across both without guessing at output wording.
const D1_ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const KV_ID = /\b[0-9a-f]{32}\b/gi;

const PLACEHOLDER = /REPLACE_ME/;

let toml;
try {
	toml = readFileSync(CONFIG, 'utf8');
} catch {
	console.error(`setup:cf: cannot read ${CONFIG}`);
	process.exit(1);
}

const slug = slugArg || readName(toml) || basename(root);
if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
	console.error(`setup:cf: "${slug}" is not a usable project slug (letters, digits, hyphens).`);
	process.exit(1);
}

// Don't clobber a working setup. Someone re-running this by reflex after the
// project is live should not silently get a second, empty database.
const existing = currentIds(toml);
const alreadyReal = Object.entries(existing).filter(([, v]) => v && !PLACEHOLDER.test(v));
if (alreadyReal.length && !FORCE && !DRY) {
	console.error('\n  ✗ wrangler.toml already has real ids:\n');
	for (const [k, v] of alreadyReal) console.error(`    ${k} = "${v}"`);
	console.error(`
  Nothing was changed. Creating new resources now would leave the old ones
  orphaned and point the app at an empty database.

  If you really want fresh resources: bun run setup:cf --force
`);
	process.exit(1);
}

console.log(`setup:cf: project slug "${slug}" -> ${slug}-db\n`);

const steps = [
	{ key: 'database_id', label: 'D1 database', argv: ['d1', 'create', `${slug}-db`], shape: D1_ID },
	{ key: 'id', label: 'KV namespace', argv: ['kv', 'namespace', 'create', 'KV'], shape: KV_ID },
	{
		key: 'preview_id',
		label: 'KV preview namespace',
		argv: ['kv', 'namespace', 'create', 'KV', '--preview'],
		shape: KV_ID
	}
];

const found = {};
for (const step of steps) {
	const printable = `wrangler ${step.argv.join(' ')}`;
	if (DRY) {
		console.log(`  would run: ${printable}`);
		continue;
	}
	process.stdout.write(`  ${step.label}: ${printable}\n`);
	const run = spawnSync('npx', ['wrangler', ...step.argv], {
		cwd: root,
		encoding: 'utf8',
		shell: process.platform === 'win32'
	});
	const output = `${run.stdout || ''}${run.stderr || ''}`;
	if (run.status !== 0) {
		console.error(`\n  ✗ ${printable} failed:\n`);
		console.error(output.trim() || '    (no output)');
		console.error('\n  wrangler.toml was NOT modified. Fix the above and re-run.');
		if (/not logged in|auth|login/i.test(output)) console.error('  Hint: npx wrangler login\n');
		process.exit(1);
	}
	const id = soleMatch(output, step.shape);
	if (!id) {
		console.error(`\n  ✗ created the ${step.label}, but could not read its id from wrangler:\n`);
		console.error(output.trim() || '    (no output)');
		console.error(`
  wrangler.toml was NOT modified — this script will not guess an id.
  Copy the id from the output above into the ${step.key} line by hand,
  then run: bun run check:bindings
`);
		process.exit(1);
	}
	found[step.key] = id;
	console.log(`    -> ${id}`);
}

if (DRY) {
	console.log(`\n  would then write those ids into wrangler.toml and set
  database_name = "${slug}-db", replacing the REPLACE_ME_* placeholders.`);
	process.exit(0);
}

// KV and its preview must never be the same namespace, or `wrangler dev`
// writes into production. check-bindings catches it too; catching it here
// means we don't write the bad state to disk in the first place.
if (found.id && found.id === found.preview_id) {
	console.error('\n  ✗ wrangler returned the same id for KV and its preview. Not writing.\n');
	process.exit(1);
}

let next = toml;
next = replaceValue(next, 'database_name', `${slug}-db`);
for (const [key, value] of Object.entries(found)) next = replaceValue(next, key, value);
writeFileSync(CONFIG, next);
console.log('\n  wrangler.toml updated.\n');

const check = spawnSync('node', [join(root, 'scripts', 'check-bindings.mjs')], {
	cwd: root,
	stdio: 'inherit'
});
if (check.status !== 0) process.exit(check.status ?? 1);

console.log(`
  Next:
    bun run db:migrate      # create the tables
    bun run dev             # http://localhost:4277

  R2 (only if you use it):  npx wrangler r2 bucket create ${slug}-files
`);

function readName(text) {
	const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
	return m && !PLACEHOLDER.test(m[1]) ? m[1] : null;
}

function currentIds(text) {
	const out = {};
	for (const key of ['database_id', 'id', 'preview_id']) {
		const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
		if (m) out[key] = m[1];
	}
	return out;
}

// Exactly one distinct id of the expected shape, or nothing. Wrangler echoes
// the id more than once in some versions, so duplicates of the SAME value are
// fine — two different values are not, and we refuse rather than pick.
function soleMatch(text, shape) {
	const all = [...new Set((text.match(shape) || []).map((s) => s.toLowerCase()))];
	return all.length === 1 ? all[0] : null;
}

// Only ever rewrites the first occurrence of a key, and only when it is still
// a placeholder (or --force). Keeps comments and layout intact.
function replaceValue(text, key, value) {
	const re = new RegExp(`^(\\s*${key}\\s*=\\s*")([^"]*)(")`, 'm');
	const m = text.match(re);
	if (!m) return text;
	if (!PLACEHOLDER.test(m[2]) && !FORCE) return text;
	return text.replace(re, `$1${value}$3`);
}
