import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The browser cookie is an opaque token and every identity comes from a server
 * side lookup (src/lib/utils/db.ts getAuthSession). The older design put the
 * user, including isOwner and isAdmin, in a base64 cookie the hooks trusted, so
 * anyone could make themselves owner by hand. These names must stay deleted.
 */
const FORBIDDEN = [/decodeSessionCookie/, /encodeSession\b/, /JSON\.parse\(\s*atob\(/];

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
		return /\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

describe('session cookie scheme', () => {
	it('has no code that trusts a self-describing cookie', () => {
		const hits = ['src', 'packages'].flatMap((dir) =>
			sourceFiles(dir).flatMap((file) => {
				// Comments may name the old functions (to say they are gone).
				const text = readFileSync(file, 'utf8')
					.replace(/\/\*[\s\S]*?\*\//g, '')
					.replace(/(^|[^:])\/\/.*$/gm, '$1');
				return FORBIDDEN.filter((pattern) => pattern.test(text)).map((p) => `${file}: ${p}`);
			})
		);
		expect(hits).toEqual([]);
	});
});
