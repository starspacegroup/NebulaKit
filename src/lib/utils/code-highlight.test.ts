import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeLanguage, tokenize, tokenizeLines, type Token } from './code-highlight';

const LANGS = ['svelte', 'html', 'ts', 'js', 'css', 'json', 'yaml', 'sql', 'sh', 'text', 'nope'];

const join = (tokens: Token[]) => tokens.map((t) => t.text).join('');
const kinds = (code: string, lang: string) =>
	tokenize(code, lang)
		.filter((t) => t.kind !== 'plain')
		.map((t) => `${t.kind}:${t.text}`);

describe('normalizeLanguage', () => {
	it('maps labels and aliases, and falls back to text', () => {
		expect(normalizeLanguage('TypeScript')).toBe('js');
		expect(normalizeLanguage(' Bash ')).toBe('shell');
		expect(normalizeLanguage('svelte')).toBe('svelte');
		expect(normalizeLanguage('yml')).toBe('yaml');
		expect(normalizeLanguage('klingon')).toBe('text');
		expect(normalizeLanguage(undefined)).toBe('text');
		expect(normalizeLanguage(null)).toBe('text');
	});
});

describe('tokenize', () => {
	it('returns nothing for empty input and one plain token for unknown languages', () => {
		expect(tokenize('', 'ts')).toEqual([]);
		expect(tokenize('a < b', 'cobol')).toEqual([{ kind: 'plain', text: 'a < b' }]);
		expect(tokenize('a < b')).toHaveLength(1);
	});

	it('colours TypeScript', () => {
		const out = kinds("const n = 42; // hi\nlet s = 'x' + `y${n}`; run(s);", 'ts');
		expect(out).toContain('keyword:const');
		expect(out).toContain('number:42');
		expect(out).toContain('comment:// hi');
		expect(out).toContain("string:'x'");
		expect(out).toContain('string:`y${n}`');
		expect(out).toContain('function:run');
		expect(kinds('/* a\nb */ x', 'js')).toEqual(['comment:/* a\nb */']);
		expect(kinds('@Input() a = 0x1F;', 'ts')).toContain('attr:@Input');
	});

	it('runs an unterminated string or comment to its end instead of failing', () => {
		expect(kinds('x = "abc\ny = 1', 'js')).toEqual([
			'punct:=',
			'string:"abc',
			'punct:=',
			'number:1'
		]);
		expect(kinds('x = `abc\ny', 'js')).toContain('string:`abc\ny');
		expect(kinds('/* abc', 'js')).toEqual(['comment:/* abc']);
		expect(kinds("'a\\", 'js')).toHaveLength(1);
	});

	it('colours markup: tags, attributes, strings and expressions', () => {
		const out = kinds(
			'<Button variant="primary" disabled on:click={() => go(1)}>Hi {name}</Button>',
			'svelte'
		);
		expect(out).toContain('tag:Button');
		expect(out).toContain('attr:variant');
		expect(out).toContain('string:"primary"');
		expect(out).toContain('attr:disabled');
		expect(out).toContain('attr:on:click');
		expect(out).toContain('function:go');
		expect(out).toContain('number:1');
		expect(out.filter((k) => k === 'tag:Button')).toHaveLength(2);
	});

	it('colours Svelte block tags, comments and doctype, and treats a stray < as text', () => {
		const out = kinds(
			'<!doctype html><!-- c -->{#if a < b}x{:else}y{/if}{@html z} 1 < 2',
			'svelte'
		);
		expect(out).toContain('comment:<!doctype html>');
		expect(out).toContain('comment:<!-- c -->');
		expect(out).toContain('keyword:if');
		expect(out).toContain('keyword:else');
		expect(out).toContain('keyword:html');
		expect(kinds('<!-- open', 'svelte')).toEqual(['comment:<!-- open']);
	});

	it('reads a leading import as script, then markup', () => {
		const out = kinds("import { A } from '$lib/ui';\n\n<A x={1} />", 'svelte');
		expect(out).toContain('keyword:import');
		expect(out).toContain("string:'$lib/ui'");
		expect(out).toContain('tag:A');
		expect(out).toContain('attr:x');
		expect(kinds('const a = 1', 'svelte')).toContain('keyword:const');
	});

	it('highlights script and style blocks inside markup', () => {
		const out = kinds(
			'<script lang="ts">let a = 1;</script><style>p { color: red; }</style><SCRIPT>x</SCRIPT',
			'svelte'
		);
		expect(out).toContain('keyword:let');
		expect(out).toContain('attr:color');
		expect(out).toContain('tag:p');
		expect(kinds('<script>let a', 'svelte')).toContain('keyword:let');
	});

	it('survives broken tags', () => {
		for (const bad of [
			'<a',
			'<a b=',
			'<a b="c',
			'<a {x',
			'<a <b>',
			'<a b=c d>',
			'< a>',
			'{#if',
			'{'
		]) {
			expect(join(tokenize(bad, 'svelte'))).toBe(bad);
		}
	});

	it('colours CSS: selectors, properties, values, at-rules', () => {
		const out = kinds(
			'@media (min-width: 40rem) { .a:hover { --x: #fff; margin: -1px 0; color: var(--c); } } /* c */',
			'css'
		);
		expect(out).toContain('keyword:@media');
		expect(out).toContain('tag:.a:hover');
		expect(out).toContain('attr:--x');
		expect(out).toContain('number:#fff');
		expect(out).toContain('attr:margin');
		expect(out).toContain('number:-1px');
		expect(out).toContain('function:var');
		expect(out).toContain('comment:/* c */');
		expect(kinds('a::before { content: "x" }', 'css')).toContain('string:"x"');
	});

	it('colours JSON keys apart from string values', () => {
		const out = kinds('{ "a": [1, 2.5e3, true, null, "s"] }', 'json');
		expect(out).toContain('attr:"a"');
		expect(out).toContain('string:"s"');
		expect(out).toContain('number:2.5e3');
		expect(out).toContain('keyword:true');
		expect(out).toContain('keyword:null');
	});

	it('colours YAML', () => {
		const out = kinds(
			'# top\nname: "x"\nlist:\n  - &a 1\n  - *a # note\nok: yes\nurl: a#b',
			'yaml'
		);
		expect(out).toContain('comment:# top');
		expect(out).toContain('attr:name');
		expect(out).toContain('string:"x"');
		expect(out).toContain('variable:&a');
		expect(out).toContain('variable:*a');
		expect(out).toContain('comment:# note');
		expect(out).toContain('keyword:yes');
		expect(out.some((k) => k.startsWith('comment:#') && k.includes('b'))).toBe(false);
	});

	it('colours SQL', () => {
		const out = kinds("UPDATE users SET n = 1 WHERE e = 'it''s' -- c\nAND count(*) > 2;", 'sql');
		expect(out).toContain('keyword:UPDATE');
		expect(out).toContain('keyword:WHERE');
		expect(out).toContain("string:'it''s'");
		expect(out).toContain('comment:-- c');
		expect(out).toContain('function:count');
		expect(out).toContain('number:2');
	});

	it('colours shell: prompt, command, flags, variables, comments', () => {
		const out = kinds(
			'$ bun run test --watch -v | grep "x" # note\nFOO=1 curl -H "A: $B" \\\n  "$C" && echo ${D}',
			'sh'
		);
		expect(out).toContain('function:bun');
		expect(out).toContain('attr:--watch');
		expect(out).toContain('attr:-v');
		expect(out).toContain('function:grep');
		expect(out).toContain('string:"x"');
		expect(out).toContain('comment:# note');
		expect(out).toContain('variable:FOO');
		expect(out).toContain('function:curl');
		expect(out).toContain('function:echo');
		expect(out).toContain('variable:${D}');
		expect(out).not.toContain('function:run');
		// the continuation line does not start a new command
		expect(out).not.toContain('function:"$C"');
		expect(kinds('a#b', 'sh')).not.toContain('comment:#b');
		expect(kinds("echo 'a $b", 'sh')).toContain("string:'a $b");
	});
});

describe('tokenizeLines', () => {
	it('splits multi-line tokens and drops one trailing newline', () => {
		const lines = tokenizeLines('/* a\nb */\nx\n', 'js');
		expect(lines).toHaveLength(3);
		expect(lines[0]).toEqual([{ kind: 'comment', text: '/* a' }]);
		expect(lines[1]).toEqual([{ kind: 'comment', text: 'b */' }]);
		expect(tokenizeLines('', 'js')).toEqual([[]]);
		expect(tokenizeLines('a\r\nb', 'text').map((l) => l[0].text)).toEqual(['a', 'b']);
	});
});

const anyText = fc.oneof(
	fc.string({ maxLength: 400 }),
	fc.string({ unit: 'binary', maxLength: 300 }),
	fc.stringMatching(/^[<>{}"'`\\/*#$@&:;=()\n \t-]{0,200}$/),
	fc.constantFrom('‮سلام', '🙂'.repeat(50), '\u0000\u0007\u001b[31m')
);

describe('properties', () => {
	it('token text always joins back to the input, for every language', () => {
		fc.assert(
			fc.property(anyText, fc.constantFrom(...LANGS), (code, lang) => {
				const tokens = tokenize(code, lang);
				expect(join(tokens)).toBe(code);
				for (const t of tokens) expect(t.text.length).toBeGreaterThan(0);
			}),
			{ numRuns: 600 }
		);
	});

	it('lines join back to the normalised input', () => {
		fc.assert(
			fc.property(anyText, fc.constantFrom(...LANGS), (code, lang) => {
				const lines = tokenizeLines(code, lang);
				const text = code.replace(/\r\n?/g, '\n').replace(/\n$/, '');
				expect(lines.map((l) => join(l)).join('\n')).toBe(text);
			}),
			{ numRuns: 300 }
		);
	});

	it('never has more tokens than characters', () => {
		fc.assert(
			fc.property(anyText, fc.constantFrom(...LANGS), (code, lang) => {
				expect(tokenize(code, lang).length).toBeLessThanOrEqual(Math.max(1, code.length));
			})
		);
	});

	it('stays fast on large adversarial input (no quadratic or ReDoS blowup)', () => {
		const N = 200_000;
		const inputs = [
			'"'.repeat(N),
			'"\\'.repeat(N / 2),
			'`'.repeat(N),
			"'a".repeat(N / 2),
			'/*'.repeat(N / 2),
			'<a '.repeat(N / 3),
			'<a b="'.repeat(N / 6),
			'{'.repeat(N),
			'{#if '.repeat(N / 5),
			'a'.repeat(N) + '(',
			' '.repeat(N) + 'a',
			'a '.repeat(N / 2) + '(',
			'a: '.repeat(N / 3),
			'$ a | '.repeat(N / 6),
			'-'.repeat(N),
			'<script>' + 'x'.repeat(N),
			'\n'.repeat(N)
		];
		const start = performance.now();
		for (const input of inputs) {
			for (const lang of LANGS) expect(join(tokenize(input, lang))).toBe(input);
		}
		// 17 inputs x 11 languages; a quadratic scanner would take minutes.
		expect(performance.now() - start).toBeLessThan(30_000);
	}, 60_000);

	it('is linear: ten times the input takes far less than a hundred times the time', () => {
		const sample = 'const a = "x"; // c\n<p class="a">{b}</p>\n';
		const time = (n: number) => {
			const s = sample.repeat(n);
			const t0 = performance.now();
			for (const lang of ['js', 'svelte', 'css', 'sh']) tokenize(s, lang);
			return performance.now() - t0;
		};
		time(500); // warm up
		const small = time(2_000);
		const large = time(20_000);
		expect(large).toBeLessThan(Math.max(small, 5) * 40);
	});
});
