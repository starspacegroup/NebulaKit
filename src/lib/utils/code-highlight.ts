/**
 * A small syntax tokenizer for the code samples the kit shows: Svelte and HTML, TypeScript and
 * JavaScript, CSS, JSON, YAML, SQL and shell. It has no dependencies and returns tokens, never
 * HTML: the caller renders each token's text as a text node, so nothing in a sample can inject
 * markup.
 *
 * Two promises, both covered by property tests:
 *   1. The token texts joined together are exactly the input. Highlighting never loses, adds or
 *      reorders a character, so copying from a highlighted block copies the real code.
 *   2. It never throws and runs in linear time. Every rule consumes at least one character, and
 *      every pattern accepts an unterminated string or comment by running to the end of the line
 *      (or input), so a failed match never rescans what a later position scans again.
 */

export type TokenKind =
	| 'plain'
	| 'keyword'
	| 'string'
	| 'comment'
	| 'number'
	| 'punct'
	| 'tag'
	| 'attr'
	| 'function'
	| 'variable';

export interface Token {
	kind: TokenKind;
	text: string;
}

export type Language = 'svelte' | 'js' | 'css' | 'json' | 'yaml' | 'sql' | 'shell' | 'text';

const ALIASES: Record<string, Language> = {
	svelte: 'svelte',
	html: 'svelte',
	htm: 'svelte',
	vue: 'svelte',
	xml: 'svelte',
	svg: 'svelte',
	js: 'js',
	jsx: 'js',
	mjs: 'js',
	cjs: 'js',
	javascript: 'js',
	ts: 'js',
	tsx: 'js',
	typescript: 'js',
	css: 'css',
	scss: 'css',
	json: 'json',
	jsonc: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	sql: 'sql',
	sh: 'shell',
	bash: 'shell',
	zsh: 'shell',
	shell: 'shell',
	console: 'shell'
};

/** The tokenizer's name for a language label ("ts", "Bash", ...), or `text` when unknown. */
export function normalizeLanguage(language: string | undefined | null): Language {
	return ALIASES[(language ?? '').trim().toLowerCase()] ?? 'text';
}

const JS_KEYWORDS = new Set(
	(
		'as async await break case catch class const continue debugger declare default delete do else ' +
		'enum export extends false finally for from function get if implements import in instanceof ' +
		'interface keyof let new null of private protected public readonly return satisfies set static ' +
		'super switch this throw true try type typeof undefined var void while with yield'
	).split(' ')
);

const SQL_KEYWORDS = new Set(
	(
		'add all alter and as asc begin between by case check column commit constraint create cross ' +
		'default delete desc distinct drop else end exists foreign from full group having if in index ' +
		'inner insert into is join key left like limit not null offset on or order outer primary ' +
		'references right rollback select set table then transaction union unique update values view ' +
		'when where with'
	).split(' ')
);

const YAML_WORDS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off']);
const JSON_WORDS = new Set(['true', 'false', 'null']);

interface Rule {
	re: RegExp;
	kind: TokenKind | ((m: string) => TokenKind);
}

/** Compile rules as sticky patterns, so a rule only ever matches at the scan position. */
function rules(list: Array<[RegExp, Rule['kind']]>): Rule[] {
	return list.map(([re, kind]) => ({ re: new RegExp(re.source, 'y' + re.flags), kind }));
}

class Sink {
	tokens: Token[] = [];

	push(kind: TokenKind, text: string): void {
		if (text === '') return;
		const last = this.tokens[this.tokens.length - 1];
		// Neighbouring runs of one kind are one token; this also keeps the count small.
		if (last && last.kind === kind && (kind === 'plain' || kind === 'punct')) last.text += text;
		else this.tokens.push({ kind, text });
	}
}

const SPACE = /[^\S\n]+|\n+/y;

/** Match the first rule at `pos`; falls back to one plain character, so progress is certain. */
function step(rs: Rule[], src: string, pos: number): { kind: TokenKind; text: string } {
	SPACE.lastIndex = pos;
	const space = SPACE.exec(src);
	if (space) return { kind: 'plain', text: space[0] };
	for (const rule of rs) {
		rule.re.lastIndex = pos;
		const m = rule.re.exec(src);
		if (m && m[0] !== '') {
			return { kind: typeof rule.kind === 'function' ? rule.kind(m[0]) : rule.kind, text: m[0] };
		}
	}
	return { kind: 'plain', text: src[pos] };
}

/* ---------------------------------------------------------------- JS / TS */

const JS_RULES = rules([
	[/\/\/[^\n]*/, 'comment'],
	[/\/\*[\s\S]*?(?:\*\/|$(?![\s\S]))/, 'comment'],
	[/`(?:[^`\\]|\\[\s\S]?)*(?:`|$(?![\s\S]))/, 'string'],
	[/"(?:[^"\\\n]|\\[^\n]?)*(?:"|(?=\n)|$(?![\s\S]))/, 'string'],
	[/'(?:[^'\\\n]|\\[^\n]?)*(?:'|(?=\n)|$(?![\s\S]))/, 'string'],
	[/0[xX][\da-fA-F_]+n?|0[bB][01_]+n?|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?/, 'number'],
	[/@[A-Za-z_$][\w$]*/, 'attr'],
	[/[A-Za-z_$][\w$]*(?=\s*\()/, (m) => (JS_KEYWORDS.has(m) ? 'keyword' : 'function')],
	[/[A-Za-z_$][\w$]*/, (m) => (JS_KEYWORDS.has(m) ? 'keyword' : 'plain')],
	[/=>|[{}()[\];,.<>:=+\-*/%&|^!?~]/, 'punct']
]);

/**
 * Scan JS from `pos`. With `untilBrace` it stops at the `}` that closes the `{` the caller already
 * consumed (a Svelte expression) and returns the index of that `}`; otherwise it runs to `end`.
 */
function scanJs(src: string, pos: number, end: number, sink: Sink, untilBrace: boolean): number {
	let depth = 0;
	const text = end < src.length ? src.slice(0, end) : src;
	while (pos < end) {
		const t = step(JS_RULES, text, pos);
		if (t.kind === 'punct') {
			if (t.text === '{') depth++;
			else if (t.text === '}') {
				if (untilBrace && depth === 0) return pos;
				depth = Math.max(0, depth - 1);
			}
		}
		sink.push(t.kind, t.text);
		pos += t.text.length;
	}
	return pos;
}

/* ------------------------------------------------------------------- CSS */

const CSS_RULES = rules([
	[/\/\*[\s\S]*?(?:\*\/|$(?![\s\S]))/, 'comment'],
	[/"(?:[^"\\\n]|\\[^\n]?)*(?:"|(?=\n)|$(?![\s\S]))/, 'string'],
	[/'(?:[^'\\\n]|\\[^\n]?)*(?:'|(?=\n)|$(?![\s\S]))/, 'string'],
	[/@[\w-]+/, 'keyword'],
	[/#[\da-fA-F]{3,8}\b/, 'number'],
	[/-?(?:\d+\.?\d*|\.\d+)(?:[a-zA-Z]+|%)?/, 'number'],
	[/[\w-]+(?=\()/, 'function'],
	[/[{}();,:>+~*[\]=]/, 'punct']
]);

const AT_WITH_RULES =
	/^@(?:media|supports|layer|container|document|scope|starting-style|keyframes)\b/;

function scanCss(src: string, sink: Sink): void {
	const ident = /[A-Za-z_-][\w-]*(?:[.#:]+[\w-]+)*/y;
	const colon = /\s*:/y;
	const symbol = /[.#:&]+[\w-]*(?:[.#:]+[\w-]+)*/y;
	// One entry per open block: true when it holds rules (selectors), false when declarations.
	const blocks: boolean[] = [];
	const inRules = () => blocks.length === 0 || blocks[blocks.length - 1];
	let pos = 0;
	let declaring = false; // at the start of a statement in a declaration block
	let atRule = false; // the statement so far began with an at-rule that holds rules
	while (pos < src.length) {
		const ch = src[pos];
		let text = '';
		let kind: TokenKind = 'plain';
		ident.lastIndex = pos;
		symbol.lastIndex = pos;
		const id = /^(?:[A-Za-z_]|-[A-Za-z_-])/.test(src.slice(pos, pos + 2)) ? ident.exec(src) : null;
		if (id) {
			text = id[0];
			colon.lastIndex = pos + text.length;
			if (inRules()) kind = 'tag';
			else if (declaring && colon.test(src)) kind = 'attr';
			else if (src[pos + text.length] === '(') kind = 'function';
			declaring = false;
		} else if (inRules() && /[.#:&]/.test(ch)) {
			text = (symbol.exec(src) as RegExpExecArray)[0];
			kind = 'tag';
		} else {
			const t = step(CSS_RULES, src, pos);
			text = t.text;
			kind = t.kind;
			if (kind === 'keyword') atRule = AT_WITH_RULES.test(text);
			if (text === '{') {
				blocks.push(atRule);
				atRule = false;
				declaring = !blocks[blocks.length - 1];
			} else if (text === '}') {
				blocks.pop();
				declaring = !inRules();
			} else if (text === ';') {
				atRule = false;
				declaring = !inRules();
			} else if (kind !== 'comment' && /\S/.test(text) && kind !== 'keyword') declaring = false;
		}
		sink.push(kind, text);
		pos += text.length;
	}
}

/* --------------------------------------------------------- JSON / YAML / SQL */

const JSON_RULES = rules([
	[/"(?:[^"\\\n]|\\[^\n]?)*(?:"|(?=\n)|$(?![\s\S]))(?=\s*:)/, 'attr'],
	[/"(?:[^"\\\n]|\\[^\n]?)*(?:"|(?=\n)|$(?![\s\S]))/, 'string'],
	[/\/\/[^\n]*/, 'comment'],
	[/\/\*[\s\S]*?(?:\*\/|$(?![\s\S]))/, 'comment'],
	[/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
	[/[A-Za-z_]\w*/, (m) => (JSON_WORDS.has(m) ? 'keyword' : 'plain')],
	[/[{}[\]:,]/, 'punct']
]);

const YAML_RULES = rules([
	[/"(?:[^"\\\n]|\\[^\n]?)*(?:"|(?=\n)|$(?![\s\S]))/, 'string'],
	[/'[^'\n]*(?:'|(?=\n)|$(?![\s\S]))/, 'string'],
	[/[A-Za-z_][\w.-]*(?=[ \t]*:(?:[ \t]|\n|$(?![\s\S])))/, 'attr'],
	[/[&*][\w-]+/, 'variable'],
	[/![\w!-]*/, 'keyword'],
	[/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w.-])/, 'number'],
	[/[A-Za-z_][\w.-]*/, (m) => (YAML_WORDS.has(m.toLowerCase()) ? 'keyword' : 'plain')],
	[/[:\-[\]{},|>]/, 'punct']
]);

const SQL_RULES = rules([
	[/--[^\n]*/, 'comment'],
	[/\/\*[\s\S]*?(?:\*\/|$(?![\s\S]))/, 'comment'],
	[/'(?:[^'\n]|'')*(?:'|(?=\n)|$(?![\s\S]))/, 'string'],
	[/\d+(?:\.\d+)?/, 'number'],
	[/[A-Za-z_]\w*(?=\s*\()/, (m) => (SQL_KEYWORDS.has(m.toLowerCase()) ? 'keyword' : 'function')],
	[/[A-Za-z_]\w*/, (m) => (SQL_KEYWORDS.has(m.toLowerCase()) ? 'keyword' : 'plain')],
	[/[(),;.*=<>+\-/%]/, 'punct']
]);

function scanWith(
	rs: Rule[],
	src: string,
	sink: Sink,
	canComment?: (pos: number) => boolean
): void {
	let pos = 0;
	while (pos < src.length) {
		if (canComment && src[pos] === '#') {
			// YAML and shell comments start at a word boundary, not inside `a#b`.
			if (canComment(pos)) {
				const nl = src.indexOf('\n', pos);
				const stop = nl === -1 ? src.length : nl;
				sink.push('comment', src.slice(pos, stop));
				pos = stop;
				continue;
			}
		}
		const t = step(rs, src, pos);
		sink.push(t.kind, t.text);
		pos += t.text.length;
	}
}

const startsWord = (src: string) => (pos: number) => pos === 0 || /\s/.test(src[pos - 1]);

/* ----------------------------------------------------------------- shell */

const SHELL_RULES = rules([
	[/"(?:[^"\\]|\\[\s\S]?)*(?:"|$(?![\s\S]))/, 'string'],
	[/'[^']*(?:'|$(?![\s\S]))/, 'string'],
	[/\$(?:\{[^}\n]*\}?|[A-Za-z_]\w*|[0-9?!#@*$])/, 'variable'],
	[/--?[A-Za-z0-9][\w-]*/, 'attr'],
	[/\b\d+(?:\.\d+)?\b/, 'number'],
	[/[|&;<>(){}=\\]+/, 'punct']
]);

function scanShell(src: string, sink: Sink): void {
	let pos = 0;
	let atCommand = true;
	const prompt = /[ \t]*[$#>][ \t]+/y;
	const word = /[^\s|&;<>(){}=\\"'$]+/y;
	const assign = /[A-Za-z_]\w*(?==)/y;
	const startsWordAt = startsWord(src);
	while (pos < src.length) {
		const ch = src[pos];
		if (ch === '\n') {
			sink.push('plain', ch);
			pos++;
			// A backslash before the newline continues the command.
			if (!/\\[ \t]*\n$/.test(src.slice(Math.max(0, pos - 6), pos))) atCommand = true;
			continue;
		}
		if (atCommand && (pos === 0 || src[pos - 1] === '\n')) {
			prompt.lastIndex = pos;
			const p = prompt.exec(src);
			if (p && src[pos + p[0].search(/\S/)] !== '#') {
				sink.push('punct', p[0]);
				pos += p[0].length;
				continue;
			}
		}
		if (ch === '#' && startsWordAt(pos)) {
			const nl = src.indexOf('\n', pos);
			const stop = nl === -1 ? src.length : nl;
			sink.push('comment', src.slice(pos, stop));
			pos = stop;
			continue;
		}
		const t = step(SHELL_RULES, src, pos);
		if (t.kind !== 'plain') {
			if (t.kind === 'punct' && /[|&;(]/.test(t.text)) atCommand = true;
			sink.push(t.kind, t.text);
			pos += t.text.length;
			continue;
		}
		if (/\s/.test(ch)) {
			sink.push('plain', t.text);
			pos += t.text.length;
			continue;
		}
		assign.lastIndex = pos;
		const a = atCommand ? assign.exec(src) : null;
		if (a) {
			sink.push('variable', a[0]);
			pos += a[0].length;
			continue;
		}
		word.lastIndex = pos;
		const w = word.exec(src);
		const text = w ? w[0] : ch;
		sink.push(atCommand ? 'function' : 'plain', text);
		pos += text.length;
		atCommand = false;
	}
}

/* ------------------------------------------------------- Svelte / HTML */

const TAG_OPEN = /<(\/?)([A-Za-z][\w:.-]*)/y;
const ATTR_NAME = /[^\s=<>/{"']+/y;
const STRING_ATTR = /"[^"]*(?:"|$(?![\s\S]))|'[^']*(?:'|$(?![\s\S]))/y;
const UNQUOTED = /[^\s"'=<>`{]+/y;
const COMMENT = /<!--[\s\S]*?(?:-->|$(?![\s\S]))/y;
const DOCTYPE = /<![^>]*>?/y;
const BLOCK_HEAD = /[#:/@][A-Za-z]*/y;

function scanMarkup(src: string, sink: Sink): void {
	let pos = 0;
	let lower: string | null = null;
	const at = (re: RegExp, from: number) => {
		re.lastIndex = from;
		return re.exec(src);
	};

	// A snippet that opens with imports (or other statements) is script, then markup.
	const prelude = /^\s*(?:import|export|const|let)\b/.exec(src);
	if (prelude) {
		const blank = src.indexOf('\n\n');
		const stop = blank === -1 ? src.length : blank;
		pos = scanJs(src, 0, stop, sink, false);
	}

	const mustache = (from: number): number => {
		// `from` is at `{`. Block and tag heads ({#if}, {:else}, {@html}) get a keyword.
		sink.push('punct', '{');
		let p = from + 1;
		const head = at(BLOCK_HEAD, p);
		if (head) {
			sink.push('punct', head[0][0]);
			sink.push('keyword', head[0].slice(1));
			p += head[0].length;
		}
		p = scanJs(src, p, src.length, sink, true);
		if (p < src.length) {
			sink.push('punct', '}');
			p++;
		}
		return p;
	};

	while (pos < src.length) {
		const ch = src[pos];
		if (ch === '{') {
			pos = mustache(pos);
			continue;
		}
		if (ch === '<') {
			const c = at(COMMENT, pos);
			if (c) {
				sink.push('comment', c[0]);
				pos += c[0].length;
				continue;
			}
			const d = src[pos + 1] === '!' ? at(DOCTYPE, pos) : null;
			if (d) {
				sink.push('comment', d[0]);
				pos += d[0].length;
				continue;
			}
			const open = at(TAG_OPEN, pos);
			if (open) {
				sink.push('punct', '<' + open[1]);
				sink.push('tag', open[2]);
				pos += open[0].length;
				const name = open[2].toLowerCase();
				pos = scanAttrs(pos);
				if (!open[1] && (name === 'script' || name === 'style') && src[pos - 1] === '>') {
					lower ??= src.toLowerCase();
					const close = lower.indexOf('</' + name, pos);
					const stop = close === -1 ? src.length : close;
					if (name === 'script') pos = scanJs(src, pos, stop, sink, false);
					else {
						const inner = new Sink();
						scanCss(src.slice(pos, stop), inner);
						for (const t of inner.tokens) sink.push(t.kind, t.text);
						pos = stop;
					}
				}
				continue;
			}
		}
		// Text up to the next `<` or `{`.
		let next = pos + 1;
		while (next < src.length && src[next] !== '<' && src[next] !== '{') next++;
		sink.push('plain', src.slice(pos, next));
		pos = next;
	}

	/** Attributes of one tag; returns the index after its `>` (or the end of input). */
	function scanAttrs(from: number): number {
		let p = from;
		while (p < src.length) {
			const ch = src[p];
			if (ch === '>') {
				sink.push('punct', '>');
				return p + 1;
			}
			if (ch === '/' && src[p + 1] === '>') {
				sink.push('punct', '/>');
				return p + 2;
			}
			if (ch === '<') return p; // a malformed tag ends where the next one starts
			if (/\s/.test(ch)) {
				let q = p + 1;
				while (q < src.length && /\s/.test(src[q])) q++;
				sink.push('plain', src.slice(p, q));
				p = q;
			} else if (ch === '{') {
				p = mustache(p);
			} else if (ch === '=') {
				sink.push('punct', '=');
				p++;
			} else {
				const s = at(STRING_ATTR, p);
				if (s) {
					sink.push('string', s[0]);
					p += s[0].length;
					continue;
				}
				const n = at(ATTR_NAME, p) ?? at(UNQUOTED, p);
				const text = n ? n[0] : ch;
				// A name after `=` is a value; before it, an attribute.
				const prev = lastSignificant();
				sink.push(prev === '=' ? 'string' : 'attr', text);
				p += text.length;
			}
		}
		return p;
	}

	function lastSignificant(): string {
		for (let i = sink.tokens.length - 1; i >= 0; i--) {
			const t = sink.tokens[i];
			if (t.kind === 'plain' && /^\s*$/.test(t.text)) continue;
			return t.kind === 'punct' ? t.text.slice(-1) : '';
		}
		return '';
	}
}

/* ------------------------------------------------------------------- API */

/**
 * Split `code` into tokens. `language` is any label `normalizeLanguage` knows; anything else
 * becomes one plain token. The texts of the result always join back to `code`.
 */
export function tokenize(code: string, language?: string): Token[] {
	const lang = normalizeLanguage(language);
	if (code === '') return [];
	const sink = new Sink();
	switch (lang) {
		case 'svelte':
			scanMarkup(code, sink);
			break;
		case 'js':
			scanJs(code, 0, code.length, sink, false);
			break;
		case 'css':
			scanCss(code, sink);
			break;
		case 'json':
			scanWith(JSON_RULES, code, sink);
			break;
		case 'yaml':
			scanWith(YAML_RULES, code, sink, startsWord(code));
			break;
		case 'sql':
			scanWith(SQL_RULES, code, sink);
			break;
		case 'shell':
			scanShell(code, sink);
			break;
		default:
			sink.push('plain', code);
	}
	return sink.tokens;
}

/**
 * The same tokens, cut into lines. A token that spans a newline (a block comment, a template
 * string) is split so each line renders on its own, which line numbers need. Line endings are
 * normalised to `\n` and one trailing newline is dropped, matching how the block shows code.
 */
export function tokenizeLines(code: string, language?: string): Token[][] {
	const text = code.replace(/\r\n?/g, '\n').replace(/\n$/, '');
	const lines: Token[][] = [[]];
	for (const token of tokenize(text, language)) {
		const parts = token.text.split('\n');
		parts.forEach((part, i) => {
			if (i > 0) lines.push([]);
			if (part !== '') lines[lines.length - 1].push({ kind: token.kind, text: part });
		});
	}
	return lines;
}
