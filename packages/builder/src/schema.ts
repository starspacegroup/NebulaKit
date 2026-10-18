/**
 * The page document: what the drag-and-drop builder saves, and all it saves.
 *
 * A page is DATA — an ordered list of typed blocks with plain props — rendered
 * by `PageRenderer.svelte`. It is never HTML and never code: block text is
 * rendered as text, links and images are restricted to safe URL schemes, and
 * an unknown block type is refused at the door. That is what lets a client
 * edit freely without their edits ever touching the site's code.
 *
 * `version` is the format version. A change that old documents cannot satisfy
 * bumps it and adds an upgrade step in `parsePageDocument`.
 */

export const PAGE_FORMAT_VERSION = 1;
export const MAX_BLOCKS = 200;
const MAX_TEXT = 5000;
const MAX_SHORT = 300;

export interface HeadingBlock {
	id: string;
	type: 'heading';
	props: { text: string; level: 1 | 2 | 3 };
}
export interface TextBlock {
	id: string;
	type: 'text';
	props: { text: string };
}
export interface ImageBlock {
	id: string;
	type: 'image';
	props: { src: string; alt: string };
}
export interface ButtonBlock {
	id: string;
	type: 'button';
	props: { label: string; href: string };
}
export interface ProductGridBlock {
	id: string;
	type: 'product-grid';
	/** Shows the shop's newest active products, up to `limit`. Needs @nebulakit/commerce. */
	props: { heading: string; limit: number };
}
export interface SpacerBlock {
	id: string;
	type: 'spacer';
	props: { size: 'sm' | 'md' | 'lg' };
}

export type Block =
	HeadingBlock | TextBlock | ImageBlock | ButtonBlock | ProductGridBlock | SpacerBlock;
export type BlockType = Block['type'];

export interface PageDocument {
	version: typeof PAGE_FORMAT_VERSION;
	blocks: Block[];
}

export const BLOCK_TYPES: readonly BlockType[] = [
	'heading',
	'text',
	'image',
	'button',
	'product-grid',
	'spacer'
];

/** The editor's palette: what each block is called and what a fresh one holds. */
export const BLOCK_LIBRARY: Record<BlockType, { label: string; defaults: Block['props'] }> = {
	heading: { label: 'Heading', defaults: { text: 'A new heading', level: 2 } },
	text: { label: 'Text', defaults: { text: 'Write something here.' } },
	image: { label: 'Image', defaults: { src: '', alt: '' } },
	button: { label: 'Button', defaults: { label: 'Learn more', href: '/' } },
	'product-grid': { label: 'Products', defaults: { heading: 'Shop', limit: 6 } },
	spacer: { label: 'Spacer', defaults: { size: 'md' } }
};

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

function validateBlock(raw: unknown, index: number): Block | string {
	const at = `blocks[${index}]`;
	if (!isRecord(raw)) return `${at} must be an object`;
	if (typeof raw.id !== 'string' || !BLOCK_ID.test(raw.id)) return `${at}.id is invalid`;
	const p = isRecord(raw.props) ? raw.props : {};
	const id = raw.id;
	switch (raw.type) {
		case 'heading': {
			const text = str(p.text, MAX_SHORT);
			const level = p.level;
			if (!text) return `${at}.props.text is required`;
			if (level !== 1 && level !== 2 && level !== 3) return `${at}.props.level must be 1, 2 or 3`;
			return { id, type: 'heading', props: { text, level } };
		}
		case 'text': {
			const text = str(p.text, MAX_TEXT, true);
			if (text === null) return `${at}.props.text must be text`;
			return { id, type: 'text', props: { text } };
		}
		case 'image': {
			const src = safeImageSrc(p.src);
			const alt = str(p.alt, MAX_SHORT, true);
			if (src === null) return `${at}.props.src must be a path or an http(s) URL`;
			if (alt === null) return `${at}.props.alt must be text`;
			return { id, type: 'image', props: { src, alt } };
		}
		case 'button': {
			const label = str(p.label, 100);
			const href = safeHref(p.href);
			if (!label) return `${at}.props.label is required`;
			if (!href) return `${at}.props.href must be a path, an http(s) URL or mailto`;
			return { id, type: 'button', props: { label, href } };
		}
		case 'product-grid': {
			const heading = str(p.heading, MAX_SHORT, true);
			const limit = p.limit;
			if (heading === null) return `${at}.props.heading must be text`;
			if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 48)
				return `${at}.props.limit must be 1 to 48`;
			return { id, type: 'product-grid', props: { heading, limit: limit as number } };
		}
		case 'spacer': {
			const size = p.size;
			if (size !== 'sm' && size !== 'md' && size !== 'lg')
				return `${at}.props.size must be sm, md or lg`;
			return { id, type: 'spacer', props: { size } };
		}
		default:
			return `${at}.type is not a known block`;
	}
}

/** Validate a document and rebuild it from known fields only; anything extra is dropped. */
export function validatePageDocument(raw: unknown): Validated<PageDocument> {
	if (!isRecord(raw)) return { ok: false, errors: ['document must be an object'] };
	if (raw.version !== PAGE_FORMAT_VERSION)
		return { ok: false, errors: [`document.version must be ${PAGE_FORMAT_VERSION}`] };
	if (!Array.isArray(raw.blocks))
		return { ok: false, errors: ['document.blocks must be an array'] };
	if (raw.blocks.length > MAX_BLOCKS)
		return { ok: false, errors: [`a page holds at most ${MAX_BLOCKS} blocks`] };
	const errors: string[] = [];
	const blocks: Block[] = [];
	const seen = new Set<string>();
	raw.blocks.forEach((entry, i) => {
		const block = validateBlock(entry, i);
		if (typeof block === 'string') errors.push(block);
		else if (seen.has(block.id)) errors.push(`blocks[${i}].id is a duplicate`);
		else {
			seen.add(block.id);
			blocks.push(block);
		}
	});
	return errors.length
		? { ok: false, errors }
		: { ok: true, value: { version: PAGE_FORMAT_VERSION, blocks } };
}

export function emptyPage(): PageDocument {
	return { version: PAGE_FORMAT_VERSION, blocks: [] };
}
