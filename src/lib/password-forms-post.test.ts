// Regression (2026-11-09): the login form had no method, so a submit before
// hydration fell back to GET and put the email and password in the URL
// (browser history, proxy and tunnel logs). Every form with a password field
// must declare method="POST".
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n);
		return statSync(p).isDirectory() ? svelteFiles(p) : p.endsWith('.svelte') ? [p] : [];
	});
}

describe('forms with a password field', () => {
	const files = svelteFiles('src').filter((f) => readFileSync(f, 'utf8').includes('type="password"'));
	for (const f of files) {
		it(`${f}: every <form> is method="POST"`, () => {
			const src = readFileSync(f, 'utf8');
			for (const tag of src.match(/<form\b[^>]*>/g) ?? []) {
				expect(tag, tag).toMatch(/method="POST"/i);
			}
		});
	}
});
