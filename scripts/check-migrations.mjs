#!/usr/bin/env node
/**
 * Migration integrity check (migrations/README.md, CLAUDE.md "Migrations").
 *
 * 1. Names are `NNNN_snake_case.sql`, and each number is used once. Two files
 *    with one number apply in filename order, not the order anyone intended.
 * 2. A migration already on the base branch is never edited, renamed or
 *    deleted. A database that applied it will not apply it again, so a changed
 *    file only changes new environments.
 *
 * Rule 1 runs anywhere. Rule 2 needs a base: `--base <ref>` (or CI's
 * GITHUB_BASE_REF as `origin/<ref>`). Without one it is skipped, and says so.
 *
 *   node scripts/check-migrations.mjs
 *   node scripts/check-migrations.mjs --base origin/main
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATION_NAME = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;

/**
 * Problems with the names in one directory listing.
 * @param {string[]} filenames
 * @returns {string[]}
 */
export function namingProblems(filenames) {
	const problems = [];
	const byNumber = new Map();
	for (const name of [...filenames].sort()) {
		const match = MIGRATION_NAME.exec(name);
		if (!match) {
			problems.push(`${name}: not named NNNN_snake_case.sql`);
			continue;
		}
		byNumber.set(match[1], [...(byNumber.get(match[1]) ?? []), name]);
	}
	for (const [number, files] of byNumber) {
		if (files.length > 1) problems.push(`number ${number} is used by ${files.join(' and ')}`);
	}
	return problems;
}

/**
 * Files that exist on the base but changed or vanished here.
 * @param {string[]} baseFiles
 * @param {string[]} currentFiles
 * @param {(name: string) => boolean} differs whether the file's content here differs from the base
 * @returns {string[]}
 */
export function immutabilityProblems(baseFiles, currentFiles, differs) {
	const problems = [];
	for (const name of baseFiles) {
		if (!currentFiles.includes(name))
			problems.push(`${name}: exists on the base branch but is gone here`);
		else if (differs(name))
			problems.push(`${name}: already on the base branch, so it must not be edited`);
	}
	return problems;
}

/**
 * @param {string} root
 * @param {...string} args
 */
function git(root, ...args) {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

/**
 * @param {string} root
 * @param {string | undefined} base
 */
export function run(root, base) {
	const dir = resolve(root, 'migrations');
	const current = readdirSync(dir).filter((/** @type {string} */ name) => name.endsWith('.sql'));
	const problems = namingProblems(current);
	let note = 'immutability check skipped (no --base)';
	if (base) {
		const baseFiles = git(root, 'ls-tree', '--name-only', base, 'migrations/')
			.split('\n')
			.map((line) => line.replace(/^migrations\//, ''))
			.filter((/** @type {string} */ name) => name.endsWith('.sql'));
		problems.push(
			...immutabilityProblems(baseFiles, current, (name) => {
				try {
					git(root, 'diff', '--quiet', base, '--', `migrations/${name}`);
					return false;
				} catch {
					return true;
				}
			})
		);
		note = `compared with ${base}`;
	}
	return { problems, note, count: current.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
	const flag = process.argv.indexOf('--base');
	const base =
		flag > -1
			? process.argv[flag + 1]
			: process.env.GITHUB_BASE_REF
				? `origin/${process.env.GITHUB_BASE_REF}`
				: undefined;
	const { problems, note, count } = run(root, base);
	if (problems.length) {
		console.error(`Migration problems:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
		process.exit(1);
	}
	console.log(`${count} migrations OK (${note}).`);
}
