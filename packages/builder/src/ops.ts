/**
 * Editing operations on a page document. Pure: each returns a new document
 * and never mutates its input, so the editor can keep an undo stack by
 * holding on to old values, and the same moves can run on a server or in an
 * agent through the API.
 */
import { BLOCK_LIBRARY, MAX_BLOCKS, type Block, type BlockType, type PageDocument } from './schema';

export function newBlockId(): string {
	return `b_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function createBlock(type: BlockType, id = newBlockId()): Block {
	return { id, type, props: structuredClone(BLOCK_LIBRARY[type].defaults) } as Block;
}

function clampIndex(index: number, length: number): number {
	if (!Number.isFinite(index)) return length;
	return Math.min(Math.max(Math.trunc(index), 0), length);
}

export function insertBlock(
	doc: PageDocument,
	block: Block,
	index = doc.blocks.length
): PageDocument {
	if (doc.blocks.length >= MAX_BLOCKS) return doc;
	const blocks = [...doc.blocks];
	blocks.splice(clampIndex(index, blocks.length), 0, block);
	return { ...doc, blocks };
}

/** Move the block at `from` so it ends up at index `to` — the drag-and-drop move. */
export function moveBlock(doc: PageDocument, from: number, to: number): PageDocument {
	if (from < 0 || from >= doc.blocks.length) return doc;
	const blocks = [...doc.blocks];
	const [block] = blocks.splice(from, 1);
	blocks.splice(clampIndex(to, blocks.length), 0, block);
	return { ...doc, blocks };
}

export function removeBlock(doc: PageDocument, id: string): PageDocument {
	return { ...doc, blocks: doc.blocks.filter((block) => block.id !== id) };
}

export function updateBlockProps<T extends Block>(
	doc: PageDocument,
	id: string,
	props: Partial<T['props']>
): PageDocument {
	return {
		...doc,
		blocks: doc.blocks.map((block) =>
			block.id === id ? ({ ...block, props: { ...block.props, ...props } } as Block) : block
		)
	};
}

export function duplicateBlock(doc: PageDocument, id: string): PageDocument {
	const index = doc.blocks.findIndex((block) => block.id === id);
	if (index === -1) return doc;
	const copy = { ...structuredClone(doc.blocks[index]), id: newBlockId() };
	return insertBlock(doc, copy, index + 1);
}
