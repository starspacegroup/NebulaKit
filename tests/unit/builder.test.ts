import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createBlock,
	deletePage,
	emptyPage,
	getPage,
	listPages,
	savePage,
	type Block,
	type PageDocument
} from '@nebulakit/builder';
import PageRenderer from '../../packages/builder/src/PageRenderer.svelte';
import PageEditor from '../../packages/builder/src/PageEditor.svelte';
import { createSqliteD1 } from '../helpers/sqlite-d1';

const doc: PageDocument = {
	version: 2,
	blocks: [
		{ id: 'h', type: 'heading', props: { text: 'Hello', level: 1, align: 'start' } },
		{ id: 't', type: 'text', props: { text: '<script>alert(1)</script>', align: 'start' } },
		{ id: 'i', type: 'image', props: { src: '/a.png', alt: 'A' } },
		{ id: 'b', type: 'button', props: { label: 'Go', href: 'https://x.test' } },
		{ id: 'q', type: 'quote', props: { text: 'Fine work', cite: 'A client' } },
		{ id: 'g', type: 'product-grid', props: { heading: 'Shop', limit: 1 } },
		{ id: 's', type: 'spacer', props: { size: 'lg' } },
		{ id: 'd', type: 'divider', props: {} }
	]
};

describe('page store', () => {
	let db: D1Database;
	beforeEach(() => {
		db = createSqliteD1(['0017_builder_pages.sql', '0019_builder_page_revisions.sql']);
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
		expect(screen.getByText('Fine work')).toBeTruthy();
		expect(screen.getByText('A client')).toBeTruthy();
		expect(screen.getByText('Tee')).toBeTruthy();
		expect(screen.queryByText('Mug')).toBeNull();
		expect(container.querySelector('hr')).toBeTruthy();
	});

	it('shows an empty product grid and skips an unset image', () => {
		const { container } = render(PageRenderer, {
			document: {
				version: 2,
				blocks: [
					{ id: 'g', type: 'product-grid', props: { heading: '', limit: 3 } },
					{ id: 'i', type: 'image', props: { src: '', alt: '' } }
				]
			}
		});
		expect(screen.getByText('No products yet.')).toBeTruthy();
		expect(container.querySelector('img')).toBeNull();
	});

	it('renders sections and columns with their layout hooks and hide classes', () => {
		const text = (id: string, t: string): Block => ({
			...createBlock('text', id),
			props: { text: t, align: 'start' }
		});
		const document: PageDocument = {
			version: 2,
			blocks: [
				{
					...createBlock('section', 's'),
					props: { gap: 'lg', padding: 'sm', tone: 'surface' },
					children: [
						{
							...createBlock('columns', 'c'),
							children: [
								{ ...createBlock('column', 'c1'), children: [text('a', 'Left')] },
								{
									...createBlock('column', 'c2'),
									children: [{ ...text('b', 'Right'), hide: ['mobile'] }]
								}
							]
						}
					]
				}
			]
		};
		const { container } = render(PageRenderer, { document });
		const section = container.querySelector('.nk-section') as HTMLElement;
		expect(section.dataset).toMatchObject({ gap: 'lg', padding: 'sm', tone: 'surface' });
		const columns = container.querySelector('.nk-columns') as HTMLElement;
		expect(columns.style.getPropertyValue('--nk-cols')).toBe('2');
		expect(container.querySelectorAll('.nk-column')).toHaveLength(2);
		expect(
			screen.getByText('Right').closest('.nk-leaf')?.classList.contains('nk-hide-mobile')
		).toBe(true);
	});
});

describe('PageEditor', () => {
	const addButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}$`) });

	it('adds, edits, reorders and saves blocks without dragging', async () => {
		let saved: PageDocument | null = null;
		render(PageEditor, { document: emptyPage(), onsave: (d: PageDocument) => void (saved = d) });
		await fireEvent.click(addButton('Heading'));
		await fireEvent.click(addButton('Text'));
		await fireEvent.input(screen.getByLabelText('Text'), { target: { value: 'Body copy' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Move up' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save page' }));
		expect(saved!.blocks.map((b) => b.type)).toEqual(['text', 'heading']);
		expect(saved!.blocks[0].props).toMatchObject({ text: 'Body copy' });
		expect(screen.getByText('All changes saved')).toBeTruthy();
	});

	it('adds inside a selected section or column, and moves blocks in and out', async () => {
		let saved: PageDocument | null = null;
		render(PageEditor, { document: emptyPage(), onsave: (d: PageDocument) => void (saved = d) });
		await fireEvent.click(addButton('Section'));
		await fireEvent.click(addButton('Text'));
		await fireEvent.click(addButton('Divider'));
		// Text went inside the Section; the divider went after the (selected) text, in the Section too.
		await fireEvent.click(screen.getByRole('button', { name: /Move out of Section/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save page' }));
		expect(saved!.blocks.map((b) => b.type)).toEqual(['section', 'divider']);
		expect(saved!.blocks[0].children!.map((b) => b.type)).toEqual(['text']);

		// Moving it back into the block above.
		await fireEvent.click(screen.getByRole('button', { name: /Move into the block above/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save page' }));
		expect(saved!.blocks.map((b) => b.type)).toEqual(['section']);
		expect(saved!.blocks[0].children!.map((b) => b.type)).toEqual(['text', 'divider']);
	});

	it('undoes and redoes, from the buttons and the keyboard', async () => {
		render(PageEditor, { document: emptyPage() });
		const undo = screen.getByRole('button', { name: 'Undo' });
		const redo = screen.getByRole('button', { name: 'Redo' });
		expect(undo).toBeDisabled();
		await fireEvent.click(addButton('Heading'));
		expect(screen.getAllByRole('button', { name: /^Heading A new heading/ })).toHaveLength(1);
		await fireEvent.click(undo);
		expect(screen.queryByRole('button', { name: /^Heading A new heading/ })).toBeNull();
		expect(redo).toBeEnabled();
		await fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'y', ctrlKey: true });
		expect(screen.getAllByRole('button', { name: /^Heading A new heading/ })).toHaveLength(1);
		await fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'z', ctrlKey: true });
		expect(screen.queryByRole('button', { name: /^Heading A new heading/ })).toBeNull();
		await fireEvent.keyDown(screen.getByRole('toolbar'), {
			key: 'z',
			ctrlKey: true,
			shiftKey: true
		});
		expect(screen.getAllByRole('button', { name: /^Heading A new heading/ })).toHaveLength(1);
	});

	it('folds typing into one undo step', async () => {
		render(PageEditor, { document: emptyPage() });
		await fireEvent.click(addButton('Heading'));
		const input = screen.getByLabelText('Text');
		for (const value of ['H', 'He', 'Hey']) await fireEvent.input(input, { target: { value } });
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(screen.getByRole('button', { name: /^Heading A new heading/ })).toBeTruthy();
	});

	it('only commits a link the page may hold, and says why not', async () => {
		render(PageEditor, { document: { version: 2, blocks: [doc.blocks[3]] } });
		await fireEvent.click(screen.getByRole('button', { name: /^Button Go/ }));
		const link = screen.getByLabelText('Link') as HTMLInputElement;
		await fireEvent.input(link, { target: { value: 'javascript:alert(1)' } });
		expect(link.getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByText(/Use a path such as/)).toBeTruthy();
		await fireEvent.input(link, { target: { value: '/pricing' } });
		expect(link.getAttribute('aria-invalid')).toBe('false');
	});

	it('changes the column count and hides a block on a breakpoint', async () => {
		let saved: PageDocument | null = null;
		render(PageEditor, { document: emptyPage(), onsave: (d: PageDocument) => void (saved = d) });
		await fireEvent.click(addButton('Columns'));
		await fireEvent.change(screen.getByLabelText('Number of columns'), { target: { value: '3' } });
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Mobile' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save page' }));
		expect(saved!.blocks[0].children).toHaveLength(3);
		expect(saved!.blocks[0].hide).toEqual(['mobile']);
		expect(screen.getByText(/Hidden on mobile/)).toBeTruthy();
	});

	it('lists what to fix, and duplicates, copies, pastes and deletes from the keyboard', async () => {
		render(PageEditor, {
			document: {
				version: 2,
				blocks: [{ id: 'i', type: 'image', props: { src: '/a.png', alt: '' } }]
			}
		});
		expect(screen.getByText(/1 to check/)).toBeTruthy();
		await fireEvent.click(
			screen.getByRole('button', { name: /Image: empty — Image has no description/ })
		);
		const block = screen.getByRole('button', { name: /^Image empty/ });
		await fireEvent.keyDown(block, { key: 'd', ctrlKey: true });
		expect(screen.getAllByRole('button', { name: /^Image empty/ })).toHaveLength(2);
		await fireEvent.keyDown(document.activeElement ?? block, { key: 'c', ctrlKey: true });
		await fireEvent.keyDown(document.activeElement ?? block, { key: 'v', ctrlKey: true });
		expect(screen.getAllByRole('button', { name: /^Image empty/ })).toHaveLength(3);
		await fireEvent.keyDown(document.activeElement ?? block, { key: 'Delete' });
		expect(screen.getAllByRole('button', { name: /^Image empty/ })).toHaveLength(2);
	});

	it('travels between blocks with the arrow keys and clears with Escape', async () => {
		render(PageEditor, { document: { version: 2, blocks: [doc.blocks[0], doc.blocks[1]] } });
		const first = screen.getByRole('button', { name: /^Heading Hello/ });
		await fireEvent.keyDown(first, { key: 'ArrowDown' });
		expect(document.activeElement?.id).toContain('cv-select-');
		expect(document.activeElement?.textContent).toContain('Text');
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp', altKey: true });
		const list = screen.getByRole('list', { name: 'Page blocks' });
		expect(
			within(list).getAllByRole('button', { name: /^(Heading|Text) / })[0].textContent
		).toContain('Text');
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		expect(screen.getByText('Select a block to change its settings.')).toBeTruthy();
	});

	it('previews at a chosen width and as the live page', async () => {
		const { container } = render(PageEditor, { document: { version: 2, blocks: [doc.blocks[0]] } });
		await fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
		expect(screen.getByRole('button', { name: 'Mobile' }).getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(
			(container.querySelector('.pe__frame-wrap') as HTMLElement).style.getPropertyValue(
				'--frame-width'
			)
		).toBe('24.375rem');
		await fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
		expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeTruthy();
	});
});
