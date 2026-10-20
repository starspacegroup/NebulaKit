/**
 * Editing operations on a page document. Pure: each returns a new document
 * and never mutates its input, so the editor can keep an undo stack by
 * holding on to old values, and the same moves can run on a server or in an
 * agent through the API.
 *
 * ## The rules this file exists to enforce
 *
 * - **One shape.** The document is a tree, and the tree is the only
 *   representation. The predecessor kept a flat list with `parent_id` and
 *   `position` columns *and* a nested `children` form, converted between them
 *   ad hoc, and numbered positions across the whole page instead of per
 *   parent — so moving one child renumbered every other container's. Here
 *   order is the array order of `children`; there is no position to drift.
 * - **A move is remove, then insert.** `toIndex` counts the destination with
 *   the moved block already taken out, the same space a drop indicator is
 *   drawn in (see `$lib/actions/draggable` and `$lib/utils/reorder`), so a
 *   block lands where the indicator was without an off-by-one correction.
 * - **Never refuse silently into a broken tree.** A move into the block's own
 *   descendant (a cycle), into a parent that cannot hold it, or past the depth
 *   or count limit returns the *same document reference*, so a caller can test
 *   `next === prev` to know nothing happened.
 * - **Ids are never time-based.** Duplicates get fresh random ids, children
 *   included.
 */
import {
	BLOCK_LIBRARY,
	MAX_BLOCKS,
	MAX_COLUMNS,
	MAX_DEPTH,
	canContain,
	isContainer,
	type Block,
	type BlockProps,
	type BlockType,
	type Breakpoint,
	type PageDocument
} from './schema';

export function newBlockId(): string {
	return `b_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** A fresh block of `type`, holding what it needs to be valid (Columns start with two columns). */
export function createBlock<T extends BlockType>(
	type: T,
	id = newBlockId()
): Extract<Block, { type: T }> {
	const block = { id, type, props: structuredClone(BLOCK_LIBRARY[type].defaults) } as Block;
	if (type === 'columns') block.children = [createBlock('column'), createBlock('column')];
	else if (isContainer(type)) block.children = [];
	return block as Extract<Block, { type: T }>;
}

/** A deep copy with new ids all the way down. */
export function cloneBlock(block: Block, id = newBlockId()): Block {
	const copy = { ...structuredClone(block), id } as Block;
	if (copy.children) copy.children = copy.children.map((child) => cloneBlock(child));
	return copy;
}

export interface Found {
	block: Block;
	/** `null` when the block sits on the page itself. */
	parent: Block | null;
	/** Index among its siblings. */
	index: number;
	/** 1 for a block on the page. */
	depth: number;
	siblings: Block[];
}

export function findBlock(doc: PageDocument, id: string): Found | null {
	function search(blocks: Block[], parent: Block | null, depth: number): Found | null {
		for (let index = 0; index < blocks.length; index++) {
			const block = blocks[index];
			if (block.id === id) return { block, parent, index, depth, siblings: blocks };
			if (block.children) {
				const inside = search(block.children, block, depth + 1);
				if (inside) return inside;
			}
		}
		return null;
	}
	return search(doc.blocks, null, 1);
}

/** Every block, in reading order, with where it sits. */
export function walk(
	blocks: Block[],
	visit: (block: Block, parent: Block | null, depth: number) => void,
	parent: Block | null = null,
	depth = 1
): void {
	for (const block of blocks) {
		visit(block, parent, depth);
		if (block.children) walk(block.children, visit, block, depth + 1);
	}
}

export function countBlocks(blocks: Block[]): number {
	let total = 0;
	walk(blocks, () => total++);
	return total;
}

/** How many levels a block's own subtree adds (1 for a leaf). */
function height(block: Block): number {
	return 1 + Math.max(0, ...(block.children ?? []).map(height));
}

/** The blocks from the page down to `id`, ending with `id` itself. */
export function pathTo(doc: PageDocument, id: string): Block[] {
	const path: Block[] = [];
	function search(blocks: Block[]): boolean {
		for (const block of blocks) {
			path.push(block);
			if (block.id === id || (block.children && search(block.children))) return true;
			path.pop();
		}
		return false;
	}
	return search(doc.blocks) ? path : [];
}

/** Rebuild the tree with `parentId`'s children (or the page's blocks) replaced by `change`. */
function editChildren(
	doc: PageDocument,
	parentId: string | null,
	change: (children: Block[]) => Block[]
): PageDocument {
	if (parentId === null) {
		const blocks = change(doc.blocks);
		return blocks === doc.blocks ? doc : { ...doc, blocks };
	}
	function rebuild(blocks: Block[]): Block[] {
		let changed = false;
		const next = blocks.map((block) => {
			if (block.id === parentId) {
				const children = change(block.children ?? []);
				if (children === block.children) return block;
				changed = true;
				return { ...block, children } as Block;
			}
			if (!block.children) return block;
			const children = rebuild(block.children);
			if (children === block.children) return block;
			changed = true;
			return { ...block, children } as Block;
		});
		return changed ? next : blocks;
	}
	const blocks = rebuild(doc.blocks);
	return blocks === doc.blocks ? doc : { ...doc, blocks };
}

function clampIndex(index: number, length: number): number {
	if (!Number.isFinite(index)) return length;
	return Math.min(Math.max(Math.trunc(index), 0), length);
}

/** May `block` go directly inside `parentId` (`null` is the page), by type, depth and count? */
export function canInsert(
	doc: PageDocument,
	block: Block,
	parentId: string | null,
	extraBlocks = countBlocks([block])
): boolean {
	const parent = parentId === null ? null : (findBlock(doc, parentId)?.block ?? undefined);
	if (parent === undefined) return false;
	if (!canContain(parent?.type ?? null, block.type)) return false;
	const depth = parentId === null ? 0 : (findBlock(doc, parentId)?.depth ?? 0);
	if (depth + height(block) > MAX_DEPTH) return false;
	return countBlocks(doc.blocks) + extraBlocks <= MAX_BLOCKS;
}

/**
 * Put `block` inside `parentId` (`null`: on the page) at `index`. Returns the
 * same document when the parent cannot hold it or a limit would be passed.
 */
export function insertBlock(
	doc: PageDocument,
	block: Block,
	parentId: string | null = null,
	index = Infinity
): PageDocument {
	if (!canInsert(doc, block, parentId)) return doc;
	return editChildren(doc, parentId, (children) => {
		const next = [...children];
		next.splice(clampIndex(index, next.length), 0, block);
		return next;
	});
}

/**
 * Move a block to `toIndex` of `toParentId`, counted with the block already
 * removed. The same document comes back for an unknown id, a move into the
 * block's own subtree, a parent that cannot hold it, or a drop where it
 * already is.
 */
export function moveBlock(
	doc: PageDocument,
	id: string,
	toParentId: string | null,
	toIndex: number
): PageDocument {
	const from = findBlock(doc, id);
	if (!from) return doc;
	if (toParentId !== null) {
		if (toParentId === id) return doc;
		// A block cannot move inside itself or anything it holds.
		const inside = findBlock({ ...doc, blocks: [from.block] }, toParentId);
		if (inside) return doc;
	}
	const target = toParentId === null ? null : findBlock(doc, toParentId);
	if (toParentId !== null && !target) return doc;
	if (!canContain(target?.block.type ?? null, from.block.type)) return doc;
	if ((target?.depth ?? 0) + height(from.block) > MAX_DEPTH) return doc;

	const fromParentId = from.parent?.id ?? null;
	const destLength = (target?.block.children ?? doc.blocks).filter((b) => b.id !== id).length;
	const index = clampIndex(toIndex, destLength);
	if (fromParentId === toParentId && index === from.index) return doc;

	const without = editChildren(doc, fromParentId, (children) =>
		children.filter((b) => b.id !== id)
	);
	return editChildren(without, toParentId, (children) => {
		const next = [...children];
		next.splice(index, 0, from.block);
		return next;
	});
}

/** Nudge a block up (`-1`) or down (`1`) among its siblings. */
export function moveBy(doc: PageDocument, id: string, delta: number): PageDocument {
	const found = findBlock(doc, id);
	if (!found) return doc;
	const to = found.index + delta;
	if (to < 0 || to >= found.siblings.length) return doc;
	return moveBlock(doc, id, found.parent?.id ?? null, to);
}

/**
 * Move a block into the block just before it, at the end — the keyboard way
 * to nest. A Columns block receives it in its last column.
 */
export function indentBlock(doc: PageDocument, id: string): PageDocument {
	const found = findBlock(doc, id);
	if (!found || found.index === 0) return doc;
	let host = found.siblings[found.index - 1];
	if (host.type === 'columns' && host.children?.length)
		host = host.children[host.children.length - 1];
	if (!isContainer(host.type)) return doc;
	return moveBlock(doc, id, host.id, Infinity);
}

/** Move a block out to just after the container that holds it. */
export function outdentBlock(doc: PageDocument, id: string): PageDocument {
	const found = findBlock(doc, id);
	if (!found?.parent) return doc;
	// A column's parent is its Columns block; step out of both at once.
	let holder = found.parent;
	if (holder.type === 'column') {
		const above = pathTo(doc, holder.id);
		holder = above[above.length - 2] ?? holder;
	}
	const outer = findBlock(doc, holder.id);
	if (!outer) return doc;
	return moveBlock(doc, id, outer.parent?.id ?? null, outer.index + 1);
}

export function removeBlock(doc: PageDocument, id: string): PageDocument {
	const found = findBlock(doc, id);
	if (!found) return doc;
	// A Columns block keeps at least one column; remove the whole Columns block instead.
	if (found.block.type === 'column' && found.siblings.length <= 1) return doc;
	return editChildren(doc, found.parent?.id ?? null, (children) =>
		children.filter((b) => b.id !== id)
	);
}

/** Merge `props` into a block's props. The editor sends one field at a time. */
export function updateBlockProps<T extends BlockType>(
	doc: PageDocument,
	id: string,
	props: Partial<BlockProps[T]>
): PageDocument {
	return updateBlock(
		doc,
		id,
		(block) => ({ ...block, props: { ...block.props, ...props } }) as Block
	);
}

/** Choose the breakpoints a block is hidden on. An empty list shows it everywhere. */
export function setHidden(doc: PageDocument, id: string, hide: Breakpoint[]): PageDocument {
	return updateBlock(doc, id, (block) => {
		const { hide: _old, ...rest } = block;
		return (hide.length ? { ...rest, hide } : rest) as Block;
	});
}

function updateBlock(doc: PageDocument, id: string, change: (block: Block) => Block): PageDocument {
	const found = findBlock(doc, id);
	if (!found) return doc;
	return editChildren(doc, found.parent?.id ?? null, (children) =>
		children.map((b) => (b.id === id ? change(b) : b))
	);
}

/** Copy a block (and everything in it) to just after itself; the copy's root gets `newId`. */
export function duplicateBlock(doc: PageDocument, id: string, newId = newBlockId()): PageDocument {
	const found = findBlock(doc, id);
	if (!found) return doc;
	// A lone column cannot be copied out of its Columns block.
	if (found.block.type === 'column' && found.siblings.length >= MAX_COLUMNS) return doc;
	return insertBlock(
		doc,
		cloneBlock(found.block, newId),
		found.parent?.id ?? null,
		found.index + 1
	);
}

/**
 * Give a Columns block `count` columns. New ones are empty; when there are
 * fewer, the content of the dropped columns joins the last one kept, so
 * nothing the author wrote is lost by changing their mind.
 */
export function setColumnCount(doc: PageDocument, id: string, count: number): PageDocument {
	const found = findBlock(doc, id);
	if (!found || found.block.type !== 'columns') return doc;
	const wanted = Math.min(Math.max(Math.trunc(count), 1), MAX_COLUMNS);
	const columns = found.block.children ?? [];
	if (wanted === columns.length) return doc;
	let next: Block[];
	if (wanted > columns.length) {
		const added = Array.from({ length: wanted - columns.length }, () => createBlock('column'));
		if (countBlocks(doc.blocks) + added.length > MAX_BLOCKS) return doc;
		next = [...columns, ...added];
	} else {
		const kept = columns.slice(0, wanted);
		const spill = columns.slice(wanted).flatMap((c) => c.children ?? []);
		const last = kept[wanted - 1];
		kept[wanted - 1] = { ...last, children: [...(last.children ?? []), ...spill] } as Block;
		next = kept;
	}
	return updateBlock(doc, id, (block) => ({ ...block, children: next }) as Block);
}

/**
 * Where selection should go after `id` is removed: the next sibling, else the
 * previous one, else the container it was in, else nothing.
 */
export function selectionAfterRemoval(doc: PageDocument, id: string): string | null {
	const found = findBlock(doc, id);
	if (!found) return null;
	return (
		(found.siblings[found.index + 1] ?? found.siblings[found.index - 1] ?? found.parent)?.id ?? null
	);
}
