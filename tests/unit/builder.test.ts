import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createBlock,
	deletePage,
	duplicateBlock,
	emptyPage,
	getPage,
	insertBlock,
	listPages,
	MAX_BLOCKS,
	moveBlock,
	removeBlock,
	safeHref,
	safeImageSrc,
	savePage,
	updateBlockProps,
	validatePageDocument,
	type PageDocument
} from '@nebulakit/builder';
import PageRenderer from '../../packages/builder/src/PageRenderer.svelte';
import PageEditor from '../../packages/builder/src/PageEditor.svelte';
import { createSqliteD1 } from '../helpers/sqlite-d1';

const doc: PageDocument = {
	version: 1,
	blocks: [
		{ id: 'h', type: 'heading', props: { text: 'Hello', level: 1 } },
		{ id: 't', type: 'text', props: { text: '<script>alert(1)</script>' } },
		{ id: 'i', type: 'image', props: { src: '/a.png', alt: 'A' } },
		{ id: 'b', type: 'button', props: { label: 'Go', href: 'https://x.test' } },
		{ id: 'g', type: 'product-grid', props: { heading: 'Shop', limit: 1 } },
		{ id: 's', type: 'spacer', props: { size: 'lg' } }
	]
};

describe('page document validation', () => {
	it('accepts every block type and drops unknown fields', () => {
		const withExtra = {
			...doc,
			extra: true,
			blocks: doc.blocks.map((b) => ({ ...b, onclick: 'x' }))
		};
		const result = validatePageDocument(withExtra);
		expect(result).toEqual({ ok: true, value: doc });
	});

	it.each([
		[null, 'document must be an object'],
		[{ version: 2, blocks: [] }, 'version'],
		[{ version: 1 }, 'blocks must be an array'],
		[{ version: 1, blocks: Array(MAX_BLOCKS + 1).fill({}) }, 'at most'],
		[{ version: 1, blocks: ['x'] }, 'must be an object'],
		[
			{ version: 1, blocks: [{ id: 'bad id', type: 'text', props: { text: '' } }] },
			'id is invalid'
		],
		[{ version: 1, blocks: [{ id: 'a', type: 'video', props: {} }] }, 'not a known block'],
		[
			{ version: 1, blocks: [{ id: 'a', type: 'heading', props: { text: '', level: 1 } }] },
			'text is required'
		],
		[
			{ version: 1, blocks: [{ id: 'a', type: 'heading', props: { text: 'x', level: 4 } }] },
			'level'
		],
		[{ version: 1, blocks: [{ id: 'a', type: 'text', props: { text: 5 } }] }, 'must be text'],
		[
			{ version: 1, blocks: [{ id: 'a', type: 'image', props: { src: 'javascript:x', alt: '' } }] },
			'src'
		],
		[{ version: 1, blocks: [{ id: 'a', type: 'image', props: { src: '', alt: 3 } }] }, 'alt'],
		[
			{ version: 1, blocks: [{ id: 'a', type: 'button', props: { label: '', href: '/' } }] },
			'label'
		],
		[
			{
				version: 1,
				blocks: [{ id: 'a', type: 'button', props: { label: 'x', href: 'javascript:x' } }]
			},
			'href'
		],
		[
			{ version: 1, blocks: [{ id: 'a', type: 'product-grid', props: { heading: 1, limit: 1 } }] },
			'heading'
		],
		[
			{
				version: 1,
				blocks: [{ id: 'a', type: 'product-grid', props: { heading: '', limit: 99 } }]
			},
			'limit'
		],
		[{ version: 1, blocks: [{ id: 'a', type: 'spacer', props: { size: 'xl' } }] }, 'size'],
		[{ version: 1, blocks: [{ id: 'a', type: 'spacer' }] }, 'size'],
		[
			{
				version: 1,
				blocks: [
					{ id: 'a', type: 'spacer', props: { size: 'sm' } },
					{ id: 'a', type: 'spacer', props: { size: 'sm' } }
				]
			},
			'duplicate'
		]
	])('refuses a bad document %#', (raw, message) => {
		const result = validatePageDocument(raw);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.join(' ')).toContain(message);
	});

	it('allows only safe links and images', () => {
		expect(safeHref('/about')).toBe('/about');
		expect(safeHref('//evil.test')).toBeNull();
		expect(safeHref('mailto:a@b.co')).toBe('mailto:a@b.co');
		expect(safeHref('data:text/html,x')).toBeNull();
		expect(safeHref('nope')).toBeNull();
		expect(safeHref('')).toBeNull();
		expect(safeHref('/' + 'a'.repeat(2001))).toBeNull();
		expect(safeImageSrc('')).toBe('');
		expect(safeImageSrc('mailto:a@b.co')).toBeNull();
		expect(safeImageSrc('https://x.test/a.png')).toBe('https://x.test/a.png');
	});
});

describe('page editing operations', () => {
	it('inserts, moves, updates, duplicates and removes without mutating', () => {
		const start = emptyPage();
		const heading = createBlock('heading', 'h1');
		const text = createBlock('text', 't1');
		let page = insertBlock(start, heading);
		page = insertBlock(page, text, 0);
		expect(start.blocks).toEqual([]);
		expect(page.blocks.map((b) => b.id)).toEqual(['t1', 'h1']);

		page = moveBlock(page, 0, 1);
		expect(page.blocks.map((b) => b.id)).toEqual(['h1', 't1']);
		expect(moveBlock(page, 5, 0)).toBe(page);
		expect(moveBlock(page, 0, NaN).blocks.map((b) => b.id)).toEqual(['t1', 'h1']);

		page = updateBlockProps(page, 'h1', { text: 'Changed' });
		expect(page.blocks[0].props).toEqual({ text: 'Changed', level: 2 });

		page = duplicateBlock(page, 'h1');
		expect(page.blocks).toHaveLength(3);
		expect(page.blocks[1].id).not.toBe('h1');
		expect(page.blocks[1].props).toEqual({ text: 'Changed', level: 2 });
		expect(duplicateBlock(page, 'missing')).toBe(page);

		page = removeBlock(page, 'h1');
		expect(page.blocks.map((b) => b.id)).not.toContain('h1');
		expect(createBlock('spacer').id).toMatch(/^b_[0-9a-f]{12}$/);
	});

	it('stops inserting at the block limit', () => {
		const full: PageDocument = {
			version: 1,
			blocks: Array.from({ length: MAX_BLOCKS }, (_, i) => createBlock('spacer', `s${i}`))
		};
		expect(insertBlock(full, createBlock('text'))).toBe(full);
	});
});

describe('page store', () => {
	let db: D1Database;
	beforeEach(() => {
		db = createSqliteD1(['0017_builder_pages.sql']);
	});

	it('creates, replaces, lists and deletes pages', async () => {
		const first = await savePage(db, {
			slug: 'home',
			title: 'Home',
			document: doc,
			published: false
		});
		expect(first.created).toBe(true);
		expect(first.page).toMatchObject({ slug: 'home', published: false, document: doc });
		const second = await savePage(db, {
			slug: 'home',
			title: 'Home 2',
			document: emptyPage(),
			published: true
		});
		expect(second.created).toBe(false);
		expect(second.page).toMatchObject({ title: 'Home 2', published: true, id: first.page.id });
		await savePage(db, { slug: 'draft', title: 'Draft', document: emptyPage(), published: false });

		expect((await listPages(db)).map((p) => p.slug)).toEqual(['draft', 'home']);
		expect((await listPages(db, { publishedOnly: true })).map((p) => p.slug)).toEqual(['home']);
		expect(await getPage(db, 'missing')).toBeNull();
		expect(await deletePage(db, 'draft')).toBe(true);
		expect(await deletePage(db, 'draft')).toBe(false);
	});

	it('reads a corrupt or outdated row as an empty page', async () => {
		await savePage(db, { slug: 'x', title: 'X', document: doc, published: true });
		await db.prepare("UPDATE builder_pages SET document = '{nope'").run();
		expect((await getPage(db, 'x'))?.document).toEqual(emptyPage());
		await db.prepare(`UPDATE builder_pages SET document = '{"version":9,"blocks":[]}'`).run();
		expect((await getPage(db, 'x'))?.document).toEqual(emptyPage());
	});
});

describe('PageRenderer', () => {
	it('renders block text as text, never as HTML', () => {
		const { container } = render(PageRenderer, {
			document: doc,
			products: [
				{ slug: 'tee', name: 'Tee', price: '$25.00', imageUrl: '/tee.png' },
				{ slug: 'mug', name: 'Mug', price: '$9.00', imageUrl: null }
			]
		});
		expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeTruthy();
		expect(container.querySelector('script')).toBeNull();
		expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Go' }).getAttribute('href')).toBe('https://x.test');
		expect(screen.getByText('Tee')).toBeTruthy();
		expect(screen.queryByText('Mug')).toBeNull();
	});

	it('shows an empty product grid and skips an unset image', () => {
		const { container } = render(PageRenderer, {
			document: {
				version: 1,
				blocks: [
					{ id: 'g', type: 'product-grid', props: { heading: '', limit: 3 } },
					{ id: 'i', type: 'image', props: { src: '', alt: '' } }
				]
			}
		});
		expect(screen.getByText('No products yet.')).toBeTruthy();
		expect(container.querySelector('img')).toBeNull();
	});
});

describe('PageEditor', () => {
	it('adds, edits, reorders and saves blocks from the keyboard path', async () => {
		let saved: PageDocument | null = null;
		render(PageEditor, {
			document: emptyPage(),
			onsave: (d: PageDocument) => (saved = d)
		});
		await fireEvent.click(screen.getByRole('button', { name: '+ Heading' }));
		await fireEvent.click(screen.getByRole('button', { name: '+ Text' }));
		const input = screen.getByLabelText('Text') as HTMLTextAreaElement;
		await fireEvent.input(input, { target: { value: 'Body copy' } });
		await fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1]);
		await fireEvent.click(screen.getByRole('button', { name: 'Save page' }));
		expect(saved).not.toBeNull();
		expect(saved!.blocks.map((b) => b.type)).toEqual(['text', 'heading']);
		expect(saved!.blocks[0].props).toEqual({ text: 'Body copy' });
	});
});
