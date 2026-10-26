/**
 * Kanban board state: cards in columns, WIP limits, moves and reorders. The
 * move itself is `reorder()` from `$lib/utils/reorder`, so a keyboard move, a
 * menu move and a pointer drag all land through one code path.
 */
import { normalize, reorder, type Orderable } from '$lib/utils/reorder';

export interface KanbanColumn {
	id: string;
	title: string;
	/** Work-in-progress limit. Omit for none. */
	limit?: number;
}

/** A card. `group` is the id of the column it is in; `order` its place there. */
export interface KanbanCard extends Orderable {
	title: string;
	description?: string;
	tags?: string[];
	assignee?: string;
}

export type WipStatus = 'none' | 'ok' | 'at' | 'over';

export function wipStatus(count: number, limit: number | undefined): WipStatus {
	if (limit === undefined || !(limit > 0)) return 'none';
	if (count > limit) return 'over';
	return count === limit ? 'at' : 'ok';
}

/** "3 / 5", or just "3" when the column has no limit. */
export function wipText(count: number, limit: number | undefined): string {
	return limit !== undefined && limit > 0 ? `${count} / ${limit}` : String(count);
}

export function columnCards<T extends KanbanCard>(cards: readonly T[], columnId: string): T[] {
	return cards.filter((c) => c.group === columnId).sort((a, b) => a.order - b.order);
}

export interface MoveResult<T> {
	cards: T[];
	moved: boolean;
	/** Why nothing moved, when it did not. */
	reason?: 'unknown-card' | 'unknown-column' | 'wip-limit' | 'no-change';
	column?: KanbanColumn;
	/** 1-based place in the destination column after the move. */
	position?: number;
	total?: number;
}

/**
 * Move a card to `toIndex` of a column (index counted with the card removed,
 * the same contract as `reorder`). A move into a full column from another
 * column is refused; reordering inside a full column is always fine.
 */
export function moveCard<T extends KanbanCard>(
	cards: T[],
	columns: readonly KanbanColumn[],
	cardId: string,
	toColumn: string,
	toIndex: number
): MoveResult<T> {
	const card = cards.find((c) => c.id === cardId);
	if (!card) return { cards, moved: false, reason: 'unknown-card' };
	const column = columns.find((c) => c.id === toColumn);
	if (!column) return { cards, moved: false, reason: 'unknown-column' };
	const there = columnCards(cards, toColumn);
	if (card.group !== toColumn && column.limit !== undefined && there.length >= column.limit) {
		return { cards, moved: false, reason: 'wip-limit', column };
	}
	const next = reorder(cards, cardId, toColumn, toIndex);
	if (next === cards) return { cards, moved: false, reason: 'no-change', column };
	const after = columnCards(next, toColumn);
	return {
		cards: next,
		moved: true,
		column,
		position: after.findIndex((c) => c.id === cardId) + 1,
		total: after.length
	};
}

export type StepDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Where an arrow-key (or menu) step sends a card: up/down within its column,
 * left/right to the neighbouring column, landing at the same height. Null when
 * the card is already at that edge.
 */
export function stepTarget(
	cards: readonly KanbanCard[],
	columns: readonly KanbanColumn[],
	cardId: string,
	direction: StepDirection
): { column: string; index: number } | null {
	const card = cards.find((c) => c.id === cardId);
	if (!card) return null;
	const own = columnCards(cards, card.group);
	const at = own.findIndex((c) => c.id === cardId);
	if (direction === 'up') return at > 0 ? { column: card.group, index: at - 1 } : null;
	if (direction === 'down')
		return at < own.length - 1 ? { column: card.group, index: at + 1 } : null;
	const col = columns.findIndex((c) => c.id === card.group);
	const target = columns[col + (direction === 'left' ? -1 : 1)];
	if (!target) return null;
	const size = columnCards(cards, target.id).length;
	return { column: target.id, index: Math.min(at, size) };
}

/** Move a card one step. */
export function stepCard<T extends KanbanCard>(
	cards: T[],
	columns: readonly KanbanColumn[],
	cardId: string,
	direction: StepDirection
): MoveResult<T> {
	const target = stepTarget(cards, columns, cardId, direction);
	if (!target) return { cards, moved: false, reason: 'no-change' };
	return moveCard(cards, columns, cardId, target.column, target.index);
}

export interface AddResult<T> {
	cards: T[];
	error: string;
	card?: T;
}

/** Add a card at the bottom of a column. Refuses blank titles and a full column. */
export function addCard<T extends KanbanCard>(
	cards: T[],
	columns: readonly KanbanColumn[],
	columnId: string,
	title: string,
	id: string,
	messages = { blank: 'Enter a title for the card.', full: 'This column is at its limit.' }
): AddResult<T> {
	const column = columns.find((c) => c.id === columnId);
	const clean = title.trim();
	if (!clean) return { cards, error: messages.blank };
	if (!column) return { cards, error: messages.full };
	const there = columnCards(cards, columnId);
	if (column.limit !== undefined && there.length >= column.limit) {
		return { cards, error: messages.full };
	}
	const card = { id, group: columnId, order: there.length, title: clean } as T;
	return { cards: normalize([...cards, card]), error: '', card };
}

export function removeCard<T extends KanbanCard>(cards: T[], cardId: string): T[] {
	return normalize(cards.filter((c) => c.id !== cardId));
}

/** The live-region text for a finished move. */
export function moveAnnouncement(
	title: string,
	result: Pick<MoveResult<KanbanCard>, 'moved' | 'reason' | 'column' | 'position' | 'total'>
): string {
	if (result.moved) {
		return `${title} moved to ${result.column?.title}, position ${result.position} of ${result.total}.`;
	}
	if (result.reason === 'wip-limit') {
		return `${title} stays put: ${result.column?.title} is at its limit of ${result.column?.limit}.`;
	}
	return `${title} cannot move further.`;
}

/** The "Move to" menu entries for a card: every other column, plus up and down where possible. */
export function moveMenuItems(
	cards: readonly KanbanCard[],
	columns: readonly KanbanColumn[],
	cardId: string
): { id: string; label: string; disabled?: boolean }[] {
	const card = cards.find((c) => c.id === cardId);
	if (!card) return [];
	const items: { id: string; label: string; disabled?: boolean }[] = [];
	if (stepTarget(cards, columns, cardId, 'up')) items.push({ id: 'up', label: 'Move up' });
	if (stepTarget(cards, columns, cardId, 'down')) items.push({ id: 'down', label: 'Move down' });
	for (const column of columns) {
		if (column.id === card.group) continue;
		const full = column.limit !== undefined && columnCards(cards, column.id).length >= column.limit;
		items.push({
			id: `to:${column.id}`,
			label: full ? `Move to ${column.title} (full)` : `Move to ${column.title}`,
			disabled: full
		});
	}
	return items;
}
