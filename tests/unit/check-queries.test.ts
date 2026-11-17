import { describe, expect, it } from 'vitest';
import { keyOf, newFindings, scanText } from '../../scripts/check-queries.mjs';

describe('check-queries scanner', () => {
	it('flags OFFSET, leading-wildcard LIKE and kv.put', () => {
		const text = [
			'const a = `SELECT * FROM t ORDER BY id LIMIT ? OFFSET ?`;',
			"const b = `SELECT * FROM t WHERE name LIKE '%x%'`;",
			"const c = `SELECT * FROM t WHERE name LIKE ? || '%'`;",
			"const d = `SELECT * FROM t WHERE name LIKE '%' || ? || '%'`;",
			'await platform.env.KV.put(key, value);',
			'await kv.put(key, value);',
			'const e = `SELECT 1`;'
		].join('\n');
		const rules = scanText('src/x.ts', text).map((f) => `${f.line}:${f.rule}`);
		expect(rules).toEqual(['1:offset', '2:like', '4:like', '5:kv-put', '6:kv-put']);
	});

	it('a prefix LIKE (no leading wildcard) is allowed', () => {
		expect(scanText('src/x.ts', "const q = `WHERE slug LIKE 'blog-%'`;")).toEqual([]);
	});

	it('ignores comments and honours a cost-guard: ok marker on the line or above', () => {
		const text = [
			'// uses OFFSET in this comment',
			' * LIKE "%x%" in a doc block',
			'// cost-guard: ok admin list, under 200 rows',
			'const a = `SELECT * FROM t LIMIT ? OFFSET ?`;',
			'const b = `SELECT * FROM t LIMIT ? OFFSET ?`; // cost-guard: ok bounded'
		].join('\n');
		expect(scanText('src/x.ts', text)).toEqual([]);
	});

	it('keys findings without the line number, so edits above do not break the baseline', () => {
		const a = scanText('src/x.ts', 'await kv.put(k, v);')[0];
		const b = scanText('src/x.ts', '\n\n\nawait kv.put(k, v);')[0];
		expect(a.line).not.toBe(b.line);
		expect(keyOf(a)).toBe(keyOf(b));
		expect(newFindings([b], [{ file: a.file, rule: a.rule, text: a.text }])).toEqual([]);
		expect(newFindings([b], [])).toEqual([b]);
	});
});
