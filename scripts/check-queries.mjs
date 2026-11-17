#!/usr/bin/env node
/**
 * Free-tier cost guard (docs/FREE_TIER_GUARD_RAILS.md).
 *
 * Static scan of src/ for the three patterns that burned PinFool's D1 and KV quotas:
 *   offset   SQL with OFFSET. D1 bills every skipped row as a row read.
 *   like     LIKE '%...' with a leading wildcard: cannot use an index, scans the table.
 *            (A prefix match, LIKE 'x%' or LIKE ? || '%', can use an index and is fine.)
 *   kv-put   kv.put / KV.put in application code: KV allows 1,000 writes a day on the free plan.
 *
 * It cannot prove a query is cheap. It makes the dangerous shapes visible so someone decides:
 *   - fine for a small, bounded table?  Add a comment containing `cost-guard: ok <reason>` on the same
 *     line or the line above.
 *   - existing finding you are not fixing now?  `--update` rewrites the baseline.
 * Anything not in the baseline or marked is an error. Run EXPLAIN QUERY PLAN for the real answer.
 *
 *   node scripts/check-queries.mjs            check (exit 1 on new findings)
 *   node scripts/check-queries.mjs --update   rewrite scripts/check-queries.baseline.json
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'check-queries.baseline.json');
export const MARK = /cost-guard:\s*ok/i;

export const RULES = [
	{ id: 'offset', re: /\bOFFSET\b/, why: 'OFFSET reads every skipped row; use keyset pagination or cap the depth' },
	{ id: 'like', re: /\bLIKE\s+'%/i, why: "leading-wildcard LIKE scans the whole table" },
	{ id: 'kv-put', re: /\b(?:kv|KV)\??\.put\(/, why: 'KV allows 1,000 writes a day on the free plan; do not write KV on a request path' }
];

/**
 * Findings in one file's text.
 * @param {string} file relative path, used in the finding
 * @param {string} text file contents
 * @returns {{file:string,line:number,rule:string,why:string,text:string}[]}
 */
export function scanText(file, text) {
	const lines = text.split('\n');
	/** @type {{file:string,line:number,rule:string,why:string,text:string}[]} */
	const out = [];
	lines.forEach((line, i) => {
		// SQL-looking lines only for the SQL rules, so prose in comments is not flagged.
		const trimmed = line.trim();
		if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
		for (const rule of RULES) {
			if (!rule.re.test(line)) continue;
			if (MARK.test(line) || (i > 0 && MARK.test(lines[i - 1]))) continue;
			out.push({ file, line: i + 1, rule: rule.id, why: rule.why, text: trimmed.slice(0, 120) });
		}
	});
	return out;
}

/**
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
function walk(dir, acc = []) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === 'generated' || name.startsWith('.')) continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, acc);
		else if (/\.(ts|js|svelte|mjs)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(p);
	}
	return acc;
}

/**
 * A finding's identity ignores its line number, so unrelated edits above it do not break the baseline.
 * @param {{file:string,rule:string,text:string}} f
 */
export const keyOf = (f) => `${f.file}|${f.rule}|${f.text}`;

/** @param {string} [root] */
export function scanRepo(root = ROOT) {
	return walk(join(root, 'src')).flatMap((p) => scanText(relative(root, p), readFileSync(p, 'utf8')));
}

/**
 * @template {{file:string,rule:string,text:string}} F
 * @param {F[]} found
 * @param {{file:string,rule:string,text:string}[]} baseline
 * @returns {F[]}
 */
export function newFindings(found, baseline) {
	const known = new Set(baseline.map(keyOf));
	return found.filter((f) => !known.has(keyOf(f)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const found = scanRepo();
	if (process.argv.includes('--update')) {
		writeFileSync(BASELINE, JSON.stringify(found.map(({ file, rule, text }) => ({ file, rule, text })), null, '\t') + '\n');
		console.log(`check-queries: baseline written, ${found.length} finding(s)`);
		process.exit(0);
	}
	const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : [];
	const fresh = newFindings(found, baseline);
	if (fresh.length === 0) {
		console.log(`check-queries: ok (${found.length} known finding(s) in the baseline)`);
		process.exit(0);
	}
	for (const f of fresh) console.error(`${f.file}:${f.line}  [${f.rule}] ${f.why}\n    ${f.text}`);
	console.error(
		`\ncheck-queries: ${fresh.length} new finding(s). Fix them, or add "cost-guard: ok <reason>" beside the line, or run with --update. See docs/FREE_TIER_GUARD_RAILS.md.`
	);
	process.exit(1);
}
