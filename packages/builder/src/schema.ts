/**
 * The page document: what the drag-and-drop builder saves, and all it saves.
 *
 * A page is DATA — a tree of typed blocks with plain props — rendered by
 * `PageRenderer.svelte`. It is never HTML and never code: block text is
 * rendered as text, links and images are restricted to safe URL schemes, and
 * an unknown block type is refused at the door. That is what lets a client
 * edit freely without their edits ever touching the site's code.
 *
 * ## One table drives three things
 *
 * `BLOCK_LIBRARY` says, for each block type, what it is called, what a fresh
 * one holds, where it may sit, and which fields it has. The validator reads the
 * fields, the inspector draws them, and the lint reads them — so adding a block
 * type or a field is one edit here, and the three cannot drift apart.
 *
 * ## Shape
 *
 * - Leaf blocks (`heading`, `text`, `image`, …) have props only.
 * - `section` holds any blocks, in a stack.
 * - `columns` holds `column` blocks and nothing else; its column count is the
 *   number of children (1–4), never a separate prop that could disagree.
 * - `column` holds any blocks, and may sit only inside `columns`.
 * - Any block may carry `hide`, a list of breakpoints it is hidden on.
 *
 * `version` is the format version. A change that old documents cannot satisfy
 * bumps it and adds an upgrade step in `validatePageDocument`. Version 1 pages
 * (a flat list of leaf blocks) are valid version 2 pages, so they upgrade as-is.
 */

export const PAGE_FORMAT_VERSION = 2;
/** Every block counts, nested or not. */
export const MAX_BLOCKS = 300;
export const MAX_DEPTH = 6;
export const MAX_COLUMNS = 4;
const MAX_TEXT = 5000;
const MAX_SHORT = 300;

export const BREAKPOINTS = ['mobile', 'tablet', 'desktop'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

export type Gap = 'sm' | 'md' | 'lg';
export type Align = 'start' | 'center' | 'end';

export interface BlockProps {
	heading: { text: string; level: 1 | 2 | 3; align: Align };
	text: { text: string; align: Align };
	image: { src: string; alt: string };
	button: { label: string; href: string };
	quote: { text: string; cite: string };
	'product-grid': { heading: string; limit: number };
	spacer: { size: Gap };
	divider: Record<string, never>;
	section: { gap: Gap; padding: 'none' | Gap; tone: 'plain' | 'surface' | 'accent' };
	columns: { gap: Gap };
	column: Record<string, never>;
}

export type BlockType = keyof BlockProps;

export type Block = {
	[T in BlockType]: {
		id: string;
		type: T;
		props: BlockProps[T];
		/** Present on container blocks only (`section`, `columns`, `column`). */
		children?: Block[];
		/** Breakpoints this block is hidden on. Absent or empty: shown everywhere. */
		hide?: Breakpoint[];
	};
}[BlockType];

export interface PageDocument {
	version: typeof PAGE_FORMAT_VERSION;
	blocks: Block[];
}

/** One editable field of a block: drives the inspector, the validator and the lint. */
export type Field =
	| { key: string; label: string; kind: 'text'; required?: boolean; max?: number }
	| { key: string; label: string; kind: 'textarea'; max?: number }
	| { key: string; label: string; kind: 'link'; help?: string }
	| { key: string; label: string; kind: 'image'; help?: string }
	| { key: string; label: string; kind: 'number'; min: number; max: number }
	| {
			key: string;
			label: string;
			kind: 'select';
			options: readonly { value: string | number; label: string }[];
	  };

export type Containment = 'none' | 'any' | 'columns';

export interface BlockSpec {
	label: string;
	/** One line for the palette. */
	description: string;
	defaults: Record<string, unknown>;
	fields: readonly Field[];
	/** What the block may hold: nothing, any block, or only columns. */
	holds: Containment;
}

const GAPS = [
	{ value: 'sm', label: 'Small' },
	{ value: 'md', label: 'Medium' },
	{ value: 'lg', label: 'Large' }
] as const;

const ALIGNS = [
	{ value: 'start', label: 'Start' },
	{ value: 'center', label: 'Centre' },
	{ value: 'end', label: 'End' }
] as const;

/** The editor's palette and the validator's rules, in one place. */
export const BLOCK_LIBRARY: Record<BlockType, BlockSpec> = {
	heading: {
		label: 'Heading',
		description: 'A title for a part of the page.',
		holds: 'none',
		defaults: { text: 'A new heading', level: 2, align: 'start' },
		fields: [
			{ key: 'text', label: 'Text', kind: 'text', required: true, max: MAX_SHORT },
			{
				key: 'level',
				label: 'Level',
				kind: 'select',
				options: [
					{ value: 1, label: 'Heading 1' },
					{ value: 2, label: 'Heading 2' },
					{ value: 3, label: 'Heading 3' }
				]
			},
			{ key: 'align', label: 'Align', kind: 'select', options: ALIGNS }
		]
	},
	text: {
		label: 'Text',
		description: 'A paragraph.',
		holds: 'none',
		defaults: { text: 'Write something here.', align: 'start' },
		fields: [
			{ key: 'text', label: 'Text', kind: 'textarea', max: MAX_TEXT },
			{ key: 'align', label: 'Align', kind: 'select', options: ALIGNS }
		]
	},
	image: {
		label: 'Image',
		description: 'A picture, with a description for people who cannot see it.',
		holds: 'none',
		defaults: { src: '', alt: '' },
		fields: [
			{ key: 'src', label: 'Image address', kind: 'image' },
			{
				key: 'alt',
				label: 'Description (alt text)',
				kind: 'text',
				max: MAX_SHORT
			}
		]
	},
	button: {
		label: 'Button',
		description: 'A link that looks like a button.',
		holds: 'none',
		defaults: { label: 'Learn more', href: '/' },
		fields: [
			{ key: 'label', label: 'Label', kind: 'text', required: true, max: 100 },
			{ key: 'href', label: 'Link', kind: 'link' }
		]
	},
	quote: {
		label: 'Quote',
		description: 'A pull quote, with who said it.',
		holds: 'none',
		defaults: { text: 'A short, honest quote.', cite: '' },
		fields: [
			{ key: 'text', label: 'Quote', kind: 'textarea', max: MAX_TEXT },
			{ key: 'cite', label: 'Who said it', kind: 'text', max: MAX_SHORT }
		]
	},
	'product-grid': {
		label: 'Products',
		description: 'The shop’s newest products. Needs the commerce package.',
		holds: 'none',
		defaults: { heading: 'Shop', limit: 6 },
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text', max: MAX_SHORT },
			{ key: 'limit', label: 'How many', kind: 'number', min: 1, max: 48 }
		]
	},
	spacer: {
		label: 'Spacer',
		description: 'Empty space between blocks.',
		holds: 'none',
		defaults: { size: 'md' },
		fields: [{ key: 'size', label: 'Size', kind: 'select', options: GAPS }]
	},
	divider: {
		label: 'Divider',
		description: 'A thin line.',
		holds: 'none',
		defaults: {},
		fields: []
	},
	section: {
		label: 'Section',
		description: 'A box that holds other blocks, with its own background and spacing.',
		holds: 'any',
		defaults: { gap: 'md', padding: 'md', tone: 'plain' },
		fields: [
			{ key: 'gap', label: 'Space between blocks', kind: 'select', options: GAPS },
			{
				key: 'padding',
				label: 'Padding',
				kind: 'select',
				options: [{ value: 'none', label: 'None' }, ...GAPS]
			},
			{
				key: 'tone',
				label: 'Background',
				kind: 'select',
				options: [
					{ value: 'plain', label: 'Plain' },
					{ value: 'surface', label: 'Card' },
					{ value: 'accent', label: 'Accent' }
				]
			}
		]
	},
	columns: {
		label: 'Columns',
		description: 'Side by side on a wide screen, stacked on a phone.',
		holds: 'columns',
		defaults: { gap: 'md' },
		fields: [{ key: 'gap', label: 'Space between columns', kind: 'select', options: GAPS }]
	},
	column: {
		label: 'Column',
		description: 'One column of a Columns block.',
		holds: 'any',
		defaults: {},
		fields: []
	}
};

export const BLOCK_TYPES = Object.keys(BLOCK_LIBRARY) as BlockType[];

/** Types the palette offers. `column` is made by Columns, never dropped on its own. */
export const PALETTE_TYPES: readonly BlockType[] = BLOCK_TYPES.filter((t) => t !== 'column');

export function isContainer(type: BlockType): boolean {
	return BLOCK_LIBRARY[type].holds !== 'none';
}

/**
 * May a block of `child` type sit directly inside `parent` (`null` is the page
 * itself)? The one rule that keeps every document renderable.
 */
export function canContain(parent: BlockType | null, child: BlockType): boolean {
	if (parent === null) return child !== 'column';
	const holds = BLOCK_LIBRARY[parent].holds;
	if (holds === 'none') return false;
	if (holds === 'columns') return child === 'column';
	return child !== 'column';
}

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, max: number, allowEmpty = false): string | null {
	if (typeof value !== 'string' || value.length > max) return null;
	return allowEmpty || value.trim() ? value : null;
}

/**
 * A link a visitor may follow: a same-site path, http(s), or mailto. A
 * `javascript:` href in a client's button would run in every visitor's browser.
 */
export function safeHref(value: unknown): string | null {
	if (typeof value !== 'string' || !value || value.length > 2000) return null;
	if (value.startsWith('/') && !value.startsWith('//')) return value;
	try {
		const url = new URL(value);
		return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : null;
	} catch {
		return null;
	}
}

/** An image source: a same-site path or http(s). Empty means "not chosen yet". */
export function safeImageSrc(value: unknown): string | null {
	if (value === '') return '';
	const href = safeHref(value);
	return href && !href.startsWith('mailto:') ? href : null;
}

const BLOCK_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Rebuild a block's props from its fields only; a string is an error message. */
function validateProps(
	type: BlockType,
	raw: unknown,
	at: string
): Record<string, unknown> | string {
	const given = isRecord(raw) ? raw : {};
	const out: Record<string, unknown> = {};
	for (const field of BLOCK_LIBRARY[type].fields) {
		// A field added after a page was saved (or left out by an API client) takes its
		// default; fields that must be chosen — a heading's text, a link — never do.
		const optional = field.kind !== 'link' && !(field.kind === 'text' && field.required);
		const value =
			given[field.key] === undefined && optional
				? BLOCK_LIBRARY[type].defaults[field.key]
				: given[field.key];
		const where = `${at}.props.${field.key}`;
		switch (field.kind) {
			case 'text': {
				const ok = str(value, field.max ?? MAX_SHORT, !field.required);
				if (ok === null) return field.required ? `${where} is required` : `${where} must be text`;
				out[field.key] = ok;
				break;
			}
			case 'textarea': {
				const ok = str(value, field.max ?? MAX_TEXT, true);
				if (ok === null) return `${where} must be text`;
				out[field.key] = ok;
				break;
			}
			case 'link': {
				const ok = safeHref(value);
				if (!ok) return `${where} must be a path, an http(s) URL or mailto`;
				out[field.key] = ok;
				break;
			}
			case 'image': {
				const ok = safeImageSrc(value);
				if (ok === null) return `${where} must be a path or an http(s) URL`;
				out[field.key] = ok;
				break;
			}
			case 'number': {
				if (
					!Number.isInteger(value) ||
					(value as number) < field.min ||
					(value as number) > field.max
				)
					return `${where} must be ${field.min} to ${field.max}`;
				out[field.key] = value;
				break;
			}
			case 'select': {
				const match = field.options.find((o) => o.value === value);
				if (!match)
					return `${where} must be one of ${field.options.map((o) => o.value).join(', ')}`;
				out[field.key] = match.value;
				break;
			}
		}
	}
	return out;
}

/** Record a problem and give back `null`, so a validator can `return fail(…)`. */
function fail(errors: string[], message: string): null {
	errors.push(message);
	return null;
}

interface Budget {
	count: number;
	seen: Set<string>;
}

function validateBlock(
	raw: unknown,
	at: string,
	parent: BlockType | null,
	depth: number,
	budget: Budget,
	errors: string[]
): Block | null {
	if (!isRecord(raw)) return fail(errors, `${at} must be an object`);
	if (typeof raw.id !== 'string' || !BLOCK_ID.test(raw.id))
		return fail(errors, `${at}.id is invalid`);
	const type = raw.type as BlockType;
	if (typeof raw.type !== 'string' || !Object.hasOwn(BLOCK_LIBRARY, raw.type))
		return fail(errors, `${at}.type is not a known block`);
	if (budget.seen.has(raw.id)) return fail(errors, `${at}.id is a duplicate`);
	if (!canContain(parent, type))
		return fail(
			errors,
			`${at}: a ${type} cannot go ${parent ? `inside a ${parent}` : 'on the page'}`
		);
	if (depth > MAX_DEPTH) return fail(errors, `${at} is nested deeper than ${MAX_DEPTH}`);
	if (++budget.count > MAX_BLOCKS) return fail(errors, `a page holds at most ${MAX_BLOCKS} blocks`);
	budget.seen.add(raw.id);

	const props = validateProps(type, raw.props, at);
	if (typeof props === 'string') return fail(errors, props);

	const block = { id: raw.id, type, props } as Block;

	if (raw.hide !== undefined) {
		if (!Array.isArray(raw.hide) || raw.hide.some((h) => !BREAKPOINTS.includes(h as Breakpoint)))
			return fail(errors, `${at}.hide must list breakpoints: ${BREAKPOINTS.join(', ')}`);
		const hide = BREAKPOINTS.filter((b) => (raw.hide as string[]).includes(b));
		if (hide.length) block.hide = hide;
	}

	const holds = BLOCK_LIBRARY[type].holds;
	if (holds !== 'none') {
		const kids = raw.children === undefined ? [] : raw.children;
		if (!Array.isArray(kids)) return fail(errors, `${at}.children must be an array`);
		const children: Block[] = [];
		kids.forEach((kid, i) => {
			const checked = validateBlock(kid, `${at}.children[${i}]`, type, depth + 1, budget, errors);
			if (checked) children.push(checked);
		});
		if (type === 'columns' && (children.length < 1 || children.length > MAX_COLUMNS))
			return fail(errors, `${at} needs 1 to ${MAX_COLUMNS} columns`);
		block.children = children;
	} else if (
		raw.children !== undefined &&
		!(Array.isArray(raw.children) && raw.children.length === 0)
	) {
		return fail(errors, `${at} cannot hold other blocks`);
	}
	return block;
}

/**
 * Validate a document and rebuild it from known fields only; anything extra is
 * dropped. A version 1 document is upgraded to the current version.
 */
export function validatePageDocument(raw: unknown): Validated<PageDocument> {
	if (!isRecord(raw)) return { ok: false, errors: ['document must be an object'] };
	if (raw.version !== PAGE_FORMAT_VERSION && raw.version !== 1)
		return { ok: false, errors: [`document.version must be ${PAGE_FORMAT_VERSION}`] };
	if (!Array.isArray(raw.blocks))
		return { ok: false, errors: ['document.blocks must be an array'] };
	const errors: string[] = [];
	const budget: Budget = { count: 0, seen: new Set() };
	const blocks: Block[] = [];
	raw.blocks.forEach((entry, i) => {
		const block = validateBlock(entry, `blocks[${i}]`, null, 1, budget, errors);
		if (block) blocks.push(block);
	});
	return errors.length
		? { ok: false, errors: [...new Set(errors)] }
		: { ok: true, value: { version: PAGE_FORMAT_VERSION, blocks } };
}

export function emptyPage(): PageDocument {
	return { version: PAGE_FORMAT_VERSION, blocks: [] };
}
