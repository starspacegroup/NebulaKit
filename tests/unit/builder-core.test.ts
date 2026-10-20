import { describe, expect, it } from 'vitest';
import {
	BLOCK_LIBRARY,
	BLOCK_TYPES,
	MAX_BLOCKS,
	MAX_DEPTH,
	PAGE_FORMAT_VERSION,
	PALETTE_TYPES,
	canContain,
	canInsert,
	cloneBlock,
	commit,
	countBlocks,
	createBlock,
	createHistory,
	duplicateBlock,
	emptyPage,
	findBlock,
	indentBlock,
	insertBlock,
	isContainer,
	lintDocument,
	moveBlock,
	moveBy,
	newBlockId,
	outdentBlock,
	pathTo,
	redo,
	removeBlock,
	reset,
	safeHref,
	safeImageSrc,
	selectionAfterRemoval,
	setColumnCount,
	setHidden,
	undo,
	updateBlockProps,
	validatePageDocument,
	walk,
	canRedo,
	canUndo,
	type Block,
	type PageDocument
} from '@nebulakit/builder';

const page = (...blocks: Block[]): PageDocument => ({ version: PAGE_FORMAT_VERSION, blocks });
const leaf = (id: string, type: 'text' | 'heading' = 'text'): Block => ({
	...createBlock(type, id)
});
const section = (id: string, ...children: Block[]): Block => ({
	...createBlock('section', id),
	children
});
const ids = (blocks: Block[]) => blocks.map((b) => b.id);

describe('the block table', () => {
	it('gives every type a spec, and keeps Column out of the palette', () => {
		expect(BLOCK_TYPES).toHaveLength(Object.keys(BLOCK_LIBRARY).length);
		expect(PALETTE_TYPES).not.toContain('column');
		expect(PALETTE_TYPES).toContain('columns');
	});

	it('says what may hold what', () => {
		expect(canContain(null, 'text')).toBe(true);
		expect(canContain(null, 'column')).toBe(false);
		expect(canContain('section', 'columns')).toBe(true);
		expect(canContain('section', 'column')).toBe(false);
		expect(canContain('columns', 'column')).toBe(true);
		expect(canContain('columns', 'text')).toBe(false);
		expect(canContain('column', 'section')).toBe(true);
		expect(canContain('text', 'text')).toBe(false);
		expect(isContainer('columns')).toBe(true);
		expect(isContainer('image')).toBe(false);
	});

	it('creates valid blocks of every type', () => {
		for (const type of BLOCK_TYPES) {
			const block = createBlock(type);
			expect(block.id).toMatch(/^b_[a-f0-9]{12}$/);
			expect(isContainer(type) ? Array.isArray(block.children) : block.children).toBeTruthy;
		}
		expect(createBlock('columns').children).toHaveLength(2);
		expect(newBlockId()).not.toBe(newBlockId());
	});
});

describe('validation', () => {
	const full: PageDocument = page(
		{ id: 'h', type: 'heading', props: { text: 'Hi', level: 1, align: 'center' } },
		{ id: 't', type: 'text', props: { text: '<b>x</b>', align: 'start' }, hide: ['mobile'] },
		{ id: 'i', type: 'image', props: { src: '/a.png', alt: 'A' } },
		{ id: 'b', type: 'button', props: { label: 'Go', href: 'https://x.test' } },
		{ id: 'q', type: 'quote', props: { text: 'Q', cite: 'Me' } },
		{ id: 'g', type: 'product-grid', props: { heading: 'Shop', limit: 3 } },
		{ id: 's', type: 'spacer', props: { size: 'lg' } },
		{ id: 'd', type: 'divider', props: {} },
		{
			id: 'sec',
			type: 'section',
			props: { gap: 'md', padding: 'none', tone: 'accent' },
			children: [
				{
					id: 'cols',
					type: 'columns',
					props: { gap: 'sm' },
					children: [
						{ id: 'c1', type: 'column', props: {}, children: [leaf('in1')] },
						{ id: 'c2', type: 'column', props: {}, children: [] }
					]
				}
			]
		}
	);

	it('accepts every block type, nested, and drops unknown fields', () => {
		const noisy = JSON.parse(JSON.stringify(full));
		noisy.extra = 1;
		noisy.blocks[0].onclick = 'x';
		noisy.blocks[0].props.style = 'x';
		expect(validatePageDocument(noisy)).toEqual({ ok: true, value: full });
	});

	it('upgrades a version 1 page as it is', () => {
		const v1 = { version: 1, blocks: [{ id: 'a', type: 'text', props: { text: 'x' } }] };
		const result = validatePageDocument(v1);
		// A v1 text block had no align: it takes the default rather than failing.
		expect(result).toEqual({
			ok: true,
			value: page({ id: 'a', type: 'text', props: { text: 'x', align: 'start' } })
		});
	});

	it.each([
		[null, 'document must be an object'],
		[{ version: 3, blocks: [] }, 'version'],
		[{ version: 2 }, 'blocks must be an array'],
		[{ version: 2, blocks: ['x'] }, 'must be an object'],
		[{ version: 2, blocks: [{ id: 'bad id', type: 'text', props: {} }] }, 'id is invalid'],
		[{ version: 2, blocks: [{ id: 'a', type: 'video', props: {} }] }, 'not a known block'],
		[{ version: 2, blocks: [{ id: 'a', type: 'toString', props: {} }] }, 'not a known block'],
		[{ version: 2, blocks: [{ id: 'a', type: 'column', props: {} }] }, 'cannot go on the page'],
		[
			{
				version: 2,
				blocks: [
					{ id: 'a', type: 'divider', props: {} },
					{ id: 'a', type: 'divider', props: {} }
				]
			},
			'duplicate'
		],
		[
			{ version: 2, blocks: [{ id: 'a', type: 'divider', props: {}, hide: ['tv'] }] },
			'hide must list'
		],
		[
			{ version: 2, blocks: [{ id: 'a', type: 'divider', props: {}, children: [{}] }] },
			'cannot hold'
		],
		[
			{
				version: 2,
				blocks: [
					{
						id: 'a',
						type: 'section',
						props: { gap: 'md', padding: 'md', tone: 'plain' },
						children: 'x'
					}
				]
			},
			'children must be an array'
		],
		[
			{ version: 2, blocks: [{ id: 'a', type: 'columns', props: { gap: 'md' }, children: [] }] },
			'needs 1 to 4 columns'
		],
		[
			{
				version: 2,
				blocks: [
					{
						id: 'a',
						type: 'columns',
						props: { gap: 'md' },
						children: [{ id: 'x', type: 'text', props: { text: '', align: 'start' } }]
					}
				]
			},
			'cannot go inside a columns'
		],
		[
			{
				version: 2,
				blocks: [{ id: 'a', type: 'heading', props: { text: '', level: 1, align: 'start' } }]
			},
			'text is required'
		],
		[
			{
				version: 2,
				blocks: [{ id: 'a', type: 'heading', props: { text: 'x', level: 4, align: 'start' } }]
			},
			'level must be one of'
		],
		[
			{ version: 2, blocks: [{ id: 'a', type: 'text', props: { text: 5, align: 'start' } }] },
			'must be text'
		],
		[
			{ version: 2, blocks: [{ id: 'a', type: 'image', props: { src: 'javascript:1', alt: '' } }] },
			'src must be a path'
		],
		[
			{
				version: 2,
				blocks: [{ id: 'a', type: 'button', props: { label: 'x', href: 'javascript:alert(1)' } }]
			},
			'href must be a path'
		],
		[
			{
				version: 2,
				blocks: [{ id: 'a', type: 'product-grid', props: { heading: '', limit: 99 } }]
			},
			'1 to 48'
		],
		[
			{
				version: 2,
				blocks: [{ id: 'a', type: 'text', props: { text: 'x'.repeat(5001), align: 'start' } }]
			},
			'must be text'
		]
	])('refuses %j', (doc, message) => {
		const result = validatePageDocument(doc);
		expect(result.ok).toBe(false);
		expect(result.ok ? '' : result.errors.join('\n')).toContain(message);
	});

	it('refuses too many blocks and too deep a tree', () => {
		const many = page(
			...Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => createBlock('divider', `d${i}`))
		);
		const tooMany = validatePageDocument(many);
		expect(tooMany.ok ? '' : tooMany.errors.join()).toContain('at most');

		let deep: Block = createBlock('text', 'leaf');
		for (let i = 0; i < MAX_DEPTH; i++)
			deep = { ...createBlock('section', `s${i}`), children: [deep] };
		const tooDeep = validatePageDocument(page(deep));
		expect(tooDeep.ok ? '' : tooDeep.errors.join()).toContain('nested deeper');
	});

	it('limits hrefs and image sources to safe schemes', () => {
		expect(safeHref('/x')).toBe('/x');
		expect(safeHref('//evil.test')).toBeNull();
		expect(safeHref('mailto:a@b.test')).toBe('mailto:a@b.test');
		expect(safeHref('data:text/html,x')).toBeNull();
		expect(safeHref('not a url')).toBeNull();
		expect(safeHref('')).toBeNull();
		expect(safeImageSrc('')).toBe('');
		expect(safeImageSrc('mailto:a@b.test')).toBeNull();
		expect(safeImageSrc('https://x.test/a.png')).toBe('https://x.test/a.png');
		expect(emptyPage().blocks).toEqual([]);
	});
});

describe('tree operations', () => {
	const base = page(
		leaf('a'),
		section('s', leaf('s1'), leaf('s2')),
		{
			...createBlock('columns', 'cols'),
			children: [
				{ ...createBlock('column', 'c1'), children: [leaf('x')] },
				{ ...createBlock('column', 'c2'), children: [] }
			]
		},
		leaf('z')
	);

	it('finds blocks with their parent, index and depth', () => {
		expect(findBlock(base, 'x')).toMatchObject({ depth: 3, index: 0, parent: { id: 'c1' } });
		expect(findBlock(base, 'a')).toMatchObject({ depth: 1, parent: null });
		expect(findBlock(base, 'nope')).toBeNull();
		expect(pathTo(base, 'x').map((b) => b.id)).toEqual(['cols', 'c1', 'x']);
		expect(pathTo(base, 'nope')).toEqual([]);
		expect(countBlocks(base.blocks)).toBe(9);
		const order: string[] = [];
		walk(base.blocks, (b) => order.push(b.id));
		expect(order).toEqual(['a', 's', 's1', 's2', 'cols', 'c1', 'x', 'c2', 'z']);
	});

	it('inserts at an index, into a container, and refuses what cannot fit', () => {
		const into = insertBlock(base, leaf('n'), 's', 1);
		expect(ids(findBlock(into, 's')!.block.children!)).toEqual(['s1', 'n', 's2']);
		expect(ids(insertBlock(base, leaf('n'), null, 0).blocks)[0]).toBe('n');
		expect(ids(insertBlock(base, leaf('n')).blocks).at(-1)).toBe('n');
		expect(ids(insertBlock(base, leaf('n'), null, NaN).blocks).at(-1)).toBe('n');
		// A text block cannot hold a block, a Columns block holds only columns, a column not the page.
		expect(insertBlock(base, leaf('n'), 'a')).toBe(base);
		expect(insertBlock(base, leaf('n'), 'cols')).toBe(base);
		expect(insertBlock(base, createBlock('column', 'q'), null)).toBe(base);
		expect(insertBlock(base, leaf('n'), 'missing')).toBe(base);
		expect(canInsert(base, leaf('n'), 's')).toBe(true);
	});

	it('refuses to pass the block or depth limit', () => {
		const full = page(
			...Array.from({ length: MAX_BLOCKS }, (_, i) => createBlock('divider', `d${i}`))
		);
		expect(insertBlock(full, createBlock('divider', 'extra'))).toBe(full);
		let deep: Block = section('s0');
		for (let i = 1; i < MAX_DEPTH; i++) deep = section(`s${i}`, deep);
		const doc = page(deep);
		expect(insertBlock(doc, leaf('n'), 's0')).toBe(doc);
	});

	it('moves with the index counted after removal', () => {
		// Same parent: a to the end lands last, not off by one.
		expect(ids(moveBlock(base, 'a', null, 3).blocks)).toEqual(['s', 'cols', 'z', 'a']);
		expect(ids(moveBlock(base, 'z', null, 0).blocks)).toEqual(['z', 'a', 's', 'cols']);
		// Dropping where it already is changes nothing — the same reference.
		expect(moveBlock(base, 'a', null, 0)).toBe(base);
		expect(moveBlock(base, 'a', null, 99)).not.toBe(base);
		// Across parents.
		const moved = moveBlock(base, 'x', 's', 1);
		expect(ids(findBlock(moved, 's')!.block.children!)).toEqual(['s1', 'x', 's2']);
		expect(findBlock(moved, 'c1')!.block.children).toEqual([]);
		// Into a column from the page.
		expect(ids(findBlock(moveBlock(base, 'a', 'c2', 0), 'c2')!.block.children!)).toEqual(['a']);
		// Out to the page.
		expect(ids(moveBlock(base, 's2', null, 1).blocks)).toEqual(['a', 's2', 's', 'cols', 'z']);
	});

	it('never moves a block into itself or its own descendants', () => {
		expect(moveBlock(base, 's', 's', 0)).toBe(base);
		const nested = page(section('outer', section('inner', leaf('leaf'))));
		expect(moveBlock(nested, 'outer', 'inner', 0)).toBe(nested);
		expect(moveBlock(nested, 'outer', 'leaf', 0)).toBe(nested);
	});

	it('refuses moves a parent cannot hold, and unknown ids', () => {
		expect(moveBlock(base, 'a', 'cols', 0)).toBe(base);
		expect(moveBlock(base, 'c1', null, 0)).toBe(base);
		expect(moveBlock(base, 'nope', null, 0)).toBe(base);
		expect(moveBlock(base, 'a', 'nope', 0)).toBe(base);
		expect(moveBlock(base, 'a', 'z', 0)).toBe(base);
		let deep: Block = createBlock('text', 'leaf');
		for (let i = 0; i < MAX_DEPTH - 1; i++)
			deep = { ...createBlock('section', `s${i}`), children: [deep] };
		const doc = page(deep, section('wide', leaf('w')));
		expect(moveBlock(doc, 'wide', 's0', 0)).toBe(doc);
	});

	it('keeps order contiguous across a move out of the middle', () => {
		const out = moveBlock(base, 's1', null, 0);
		expect(ids(findBlock(out, 's')!.block.children!)).toEqual(['s2']);
		expect(ids(out.blocks)).toEqual(['s1', 'a', 's', 'cols', 'z']);
	});

	it('nudges among siblings and stops at the ends', () => {
		expect(ids(moveBy(base, 'a', 1).blocks).slice(0, 2)).toEqual(['s', 'a']);
		expect(moveBy(base, 'a', -1)).toBe(base);
		expect(moveBy(base, 'z', 1)).toBe(base);
		expect(moveBy(base, 'nope', 1)).toBe(base);
		expect(ids(findBlock(moveBy(base, 's2', -1), 's')!.block.children!)).toEqual(['s2', 's1']);
	});

	it('indents into the block before it, and outdents back out', () => {
		const indented = indentBlock(base, 'z');
		expect(ids(findBlock(indented, 'c2')!.block.children!)).toEqual(['z']);
		expect(ids(findBlock(indentBlock(base, 'cols'), 's')!.block.children!)).toContain('cols');
		expect(indentBlock(base, 'a')).toBe(base);
		expect(indentBlock(page(leaf('p'), leaf('q')), 'q').blocks).toHaveLength(2);
		expect(indentBlock(base, 'nope')).toBe(base);

		const out = outdentBlock(base, 's1');
		expect(ids(out.blocks)).toEqual(['a', 's', 's1', 'cols', 'z']);
		// From a column, out of the Columns block altogether.
		expect(ids(outdentBlock(base, 'x').blocks)).toEqual(['a', 's', 'cols', 'x', 'z']);
		expect(outdentBlock(base, 'a')).toBe(base);
	});

	it('removes blocks, and keeps at least one column', () => {
		expect(ids(removeBlock(base, 'a').blocks)).toEqual(['s', 'cols', 'z']);
		expect(findBlock(removeBlock(base, 's'), 's1')).toBeNull();
		expect(removeBlock(base, 'nope')).toBe(base);
		const oneColumn = setColumnCount(base, 'cols', 1);
		expect(removeBlock(oneColumn, 'c1')).toBe(oneColumn);
		expect(ids(findBlock(removeBlock(base, 'c2'), 'cols')!.block.children!)).toEqual(['c1']);
	});

	it('updates props and visibility without touching the original', () => {
		const next = updateBlockProps<'text'>(base, 'a', { text: 'changed' });
		expect(findBlock(next, 'a')!.block.props).toMatchObject({ text: 'changed' });
		expect(findBlock(base, 'a')!.block.props).not.toMatchObject({ text: 'changed' });
		// Untouched branches are shared, not copied.
		expect(next.blocks[1]).toBe(base.blocks[1]);
		expect(updateBlockProps(base, 'nope', {})).toBe(base);
		const hidden = setHidden(base, 's1', ['mobile', 'desktop']);
		expect(findBlock(hidden, 's1')!.block.hide).toEqual(['mobile', 'desktop']);
		expect(findBlock(setHidden(hidden, 's1', []), 's1')!.block.hide).toBeUndefined();
		expect(setHidden(base, 'nope', ['mobile'])).toBe(base);
	});

	it('duplicates a whole subtree with fresh ids', () => {
		const next = duplicateBlock(base, 's', 'copy');
		expect(ids(next.blocks).slice(1, 3)).toEqual(['s', 'copy']);
		const copy = findBlock(next, 'copy')!.block;
		expect(copy.children).toHaveLength(2);
		expect(ids(copy.children!)).not.toContain('s1');
		const all: string[] = [];
		walk(next.blocks, (b) => all.push(b.id));
		expect(new Set(all).size).toBe(all.length);
		expect(duplicateBlock(base, 'nope')).toBe(base);
		const auto = duplicateBlock(base, 'a');
		expect(auto.blocks).toHaveLength(base.blocks.length + 1);
		expect(cloneBlock(base.blocks[0]).id).not.toBe('a');
		// A fifth column would break the Columns rule.
		const four = setColumnCount(base, 'cols', 4);
		expect(duplicateBlock(four, 'c1')).toBe(four);
		expect(findBlock(duplicateBlock(base, 'c1'), 'cols')!.block.children).toHaveLength(3);
	});

	it('changes the column count without losing content', () => {
		const three = setColumnCount(base, 'cols', 3);
		expect(findBlock(three, 'cols')!.block.children).toHaveLength(3);
		const back = setColumnCount(
			setColumnCount(three, 'c1', 1) === three ? three : three,
			'cols',
			1
		);
		expect(ids(findBlock(back, 'c1')!.block.children!)).toEqual(['x']);
		const squeezed = setColumnCount(moveBlock(base, 'a', 'c2', 0), 'cols', 1);
		expect(ids(findBlock(squeezed, 'c1')!.block.children!)).toEqual(['x', 'a']);
		expect(setColumnCount(base, 'cols', 2)).toBe(base);
		expect(setColumnCount(base, 'cols', 99)).not.toBe(base);
		expect(findBlock(setColumnCount(base, 'cols', 0), 'cols')!.block.children).toHaveLength(1);
		expect(setColumnCount(base, 'a', 3)).toBe(base);
		expect(setColumnCount(base, 'nope', 3)).toBe(base);
		const full = page(
			createBlock('columns', 'cols'),
			...Array.from({ length: MAX_BLOCKS - 3 }, (_, i) => createBlock('divider', `d${i}`))
		);
		expect(setColumnCount(full, 'cols', 4)).toBe(full);
	});

	it('says where selection goes after a removal', () => {
		expect(selectionAfterRemoval(base, 'a')).toBe('s');
		expect(selectionAfterRemoval(base, 'z')).toBe('cols');
		expect(selectionAfterRemoval(base, 's2')).toBe('s1');
		expect(selectionAfterRemoval(page(section('only', leaf('x'))), 'x')).toBe('only');
		expect(selectionAfterRemoval(page(leaf('solo')), 'solo')).toBeNull();
		expect(selectionAfterRemoval(base, 'nope')).toBeNull();
	});
});

describe('history', () => {
	it('undoes and redoes, and a new edit clears redo', () => {
		let h = createHistory('a');
		h = commit(h, 'b');
		h = commit(h, 'c');
		expect([canUndo(h), canRedo(h)]).toEqual([true, false]);
		h = undo(undo(h));
		expect(h.present).toBe('a');
		expect(canRedo(h)).toBe(true);
		h = redo(h);
		expect(h.present).toBe('b');
		h = commit(h, 'x');
		expect(canRedo(h)).toBe(false);
		expect(undo(createHistory(1)).present).toBe(1);
		expect(redo(createHistory(1)).present).toBe(1);
		expect(reset('q').past).toEqual([]);
	});

	it('ignores a commit that changes nothing', () => {
		const h = createHistory({ n: 1 });
		expect(commit(h, h.present)).toBe(h);
	});

	it('folds a burst under one key into one step, but not across keys or time', () => {
		let h = createHistory('');
		h = commit(h, 'h', { key: 'text', now: 1000 });
		h = commit(h, 'he', { key: 'text', now: 1200 });
		h = commit(h, 'hey', { key: 'text', now: 1500 });
		expect(h.past).toEqual(['']);
		h = commit(h, 'hey!', { key: 'other', now: 1600 });
		expect(h.past).toEqual(['', 'hey']);
		h = commit(h, 'hey!!', { key: 'other', now: 5000 });
		expect(h.past).toHaveLength(3);
		expect(undo(h).present).toBe('hey!');
	});

	it('keeps at most 100 steps', () => {
		let h = createHistory(0);
		for (let i = 1; i <= 150; i++) h = commit(h, i);
		expect(h.past).toHaveLength(100);
		expect(h.past[0]).toBe(50);
	});
});

describe('lint', () => {
	const issue = (doc: PageDocument, rule: string) =>
		lintDocument(doc).filter((i) => i.rule === rule);

	it('flags images without a picture or a description', () => {
		const doc = page(
			{ id: 'i1', type: 'image', props: { src: '', alt: '' } },
			{ id: 'i2', type: 'image', props: { src: '/a.png', alt: ' ' } },
			{ id: 'i3', type: 'image', props: { src: '/a.png', alt: 'A cat' } }
		);
		expect(issue(doc, 'image-empty').map((i) => i.blockId)).toEqual(['i1']);
		expect(issue(doc, 'image-alt').map((i) => i.blockId)).toEqual(['i2']);
	});

	it('checks heading structure in reading order, including nested ones', () => {
		const h = (id: string, level: 1 | 2 | 3): Block => ({
			id,
			type: 'heading',
			props: { text: 'x', level, align: 'start' }
		});
		const doc = page(h('a', 1), h('b', 1), section('s', h('c', 3)));
		expect(issue(doc, 'heading-h1').map((i) => i.blockId)).toEqual(['b']);
		expect(issue(doc, 'heading-order').map((i) => i.blockId)).toEqual(['c']);
		expect(lintDocument(page(h('a', 2), h('b', 3), h('c', 2)))).toEqual([]);
	});

	it('flags vague links, empty text and containers, and blocks hidden everywhere', () => {
		const doc = page(
			{ id: 'b', type: 'button', props: { label: 'Click here', href: '/x' } },
			{ id: 'ok', type: 'button', props: { label: 'Read the guide', href: '/x' } },
			{ id: 't', type: 'text', props: { text: '  ', align: 'start' } },
			section('s'),
			{ ...leaf('gone'), hide: ['mobile', 'tablet', 'desktop'] }
		);
		expect(issue(doc, 'link-vague').map((i) => i.blockId)).toEqual(['b']);
		expect(issue(doc, 'text-empty')).toHaveLength(1);
		expect(issue(doc, 'container-empty').map((i) => i.blockId)).toEqual(['s']);
		expect(issue(doc, 'hidden-everywhere').map((i) => i.blockId)).toEqual(['gone']);
		expect(issue(doc, 'hidden-everywhere')[0].severity).toBe('warning');
	});
});
