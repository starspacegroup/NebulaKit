/** Comment threads: building the nested tree (capped depth), editing, deleting and reactions. */

export interface CommentAuthor {
	id: string;
	name: string;
	avatar?: string;
}

export interface ThreadComment {
	id: string;
	parentId: string | null;
	author: CommentAuthor;
	body: string;
	createdAt: string;
	editedAt?: string;
	/** Emoji → ids of the people who reacted. */
	reactions?: Record<string, string[]>;
	/** A removed comment that still has replies keeps its place as a stub. */
	deleted?: boolean;
}

export interface CommentNode {
	comment: ThreadComment;
	/** 1 for a top-level comment. */
	depth: number;
	children: CommentNode[];
}

export const MAX_COMMENT_DEPTH = 3;

/**
 * The thread as a tree, oldest first. Replies deeper than `maxDepth` are shown
 * at `maxDepth` (as siblings of their parent) rather than indenting forever.
 * A reply whose parent is missing, or that sits in a cycle, becomes top-level.
 */
export function buildTree(
	comments: readonly ThreadComment[],
	maxDepth = MAX_COMMENT_DEPTH
): CommentNode[] {
	const byId = new Map(comments.map((c) => [c.id, c]));

	// The chain of ids from the top-level ancestor down to the comment. A reply
	// whose parent is missing, or that sits in a cycle, is its own top.
	const chainOf = (c: ThreadComment): string[] => {
		const chain = [c.id];
		const seen = new Set(chain);
		let cursor = c.parentId ? byId.get(c.parentId) : undefined;
		while (cursor) {
			if (seen.has(cursor.id)) return [c.id];
			seen.add(cursor.id);
			chain.unshift(cursor.id);
			cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
		}
		return chain;
	};

	const byTime = (a: ThreadComment, b: ThreadComment) =>
		Date.parse(a.createdAt) - Date.parse(b.createdAt) || comments.indexOf(a) - comments.indexOf(b);
	const nodes = new Map<string, CommentNode>();
	for (const c of comments) nodes.set(c.id, { comment: c, depth: 1, children: [] });

	const roots: CommentNode[] = [];
	for (const c of [...comments].sort(byTime)) {
		const chain = chainOf(c);
		const node = nodes.get(c.id) as CommentNode;
		node.depth = Math.min(chain.length, maxDepth);
		// Deeper than the cap: attach to the ancestor one level above the cap.
		const parentId = chain.length > 1 ? chain[node.depth - 2] : undefined;
		const parent = parentId ? nodes.get(parentId) : undefined;
		if (parent) parent.children.push(node);
		else roots.push(node);
	}
	return roots;
}

/** How many comments sit below a node, at any depth. */
export function countReplies(node: CommentNode): number {
	return node.children.reduce((sum, child) => sum + 1 + countReplies(child), 0);
}

/** Total comments in a tree that are not deleted stubs. */
export function countComments(nodes: readonly CommentNode[]): number {
	return nodes.reduce((sum, n) => sum + (n.comment.deleted ? 0 : 1) + countComments(n.children), 0);
}

export function canReplyAtDepth(depth: number, maxDepth = MAX_COMMENT_DEPTH): boolean {
	return depth < maxDepth;
}

/* --------------------------------------------------------------- compose */

export interface Validation {
	ok: boolean;
	error: string;
	remaining: number;
}

/** Length in characters as a person counts them (an emoji is one, not two). */
export function charCount(text: string): number {
	return Array.from(text).length;
}

export function validateComment(
	text: string,
	max: number,
	messages = { empty: 'Write something first.', tooLong: 'This comment is too long.' }
): Validation {
	const length = charCount(text.trim());
	const remaining = max - charCount(text);
	if (length === 0) return { ok: false, error: messages.empty, remaining };
	if (remaining < 0) return { ok: false, error: messages.tooLong, remaining };
	return { ok: true, error: '', remaining };
}

/** When to warn that the limit is near: the last 10% (and at least 20 characters' worth). */
export function nearLimit(remaining: number, max: number): boolean {
	return remaining <= Math.max(20, Math.floor(max * 0.1));
}

/* ------------------------------------------------------------- operations */

export function addThreadComment(
	comments: readonly ThreadComment[],
	comment: ThreadComment
): ThreadComment[] {
	return [...comments, comment];
}

export function editThreadComment(
	comments: readonly ThreadComment[],
	id: string,
	body: string,
	now: string
): ThreadComment[] {
	return comments.map((c) => (c.id === id ? { ...c, body, editedAt: now } : c));
}

/**
 * Remove a comment. With replies it stays as a "deleted" stub so the thread
 * keeps its shape; without, it is gone (and so is any stub parent left empty).
 */
export function deleteThreadComment(
	comments: readonly ThreadComment[],
	id: string
): ThreadComment[] {
	const target = comments.find((c) => c.id === id);
	if (!target) return comments.slice();
	const hasReplies = comments.some((c) => c.parentId === id);
	if (hasReplies) {
		return comments.map((c) =>
			c.id === id ? { ...c, deleted: true, body: '', reactions: undefined } : c
		);
	}
	const rest = comments.filter((c) => c.id !== id);
	const parent = target.parentId ? rest.find((c) => c.id === target.parentId) : undefined;
	if (parent?.deleted && !rest.some((c) => c.parentId === parent.id)) {
		return deleteThreadComment(rest, parent.id);
	}
	return rest;
}

/** Add the person's reaction, or take it back if they already made it. */
export function toggleReaction(
	reactions: Record<string, string[]> | undefined,
	emoji: string,
	userId: string
): Record<string, string[]> {
	const next: Record<string, string[]> = {};
	for (const [key, ids] of Object.entries(reactions ?? {})) next[key] = [...ids];
	const ids = next[emoji] ?? [];
	next[emoji] = ids.includes(userId) ? ids.filter((i) => i !== userId) : [...ids, userId];
	if (next[emoji].length === 0) delete next[emoji];
	return next;
}

export interface ReactionSummary {
	emoji: string;
	count: number;
	mine: boolean;
}

/** Every offered emoji with its count, whether it is the viewer's, in the offered order. */
export function reactionSummary(
	reactions: Record<string, string[]> | undefined,
	offered: readonly string[],
	userId: string
): ReactionSummary[] {
	const extra = Object.keys(reactions ?? {}).filter((e) => !offered.includes(e));
	return [...offered, ...extra].map((emoji) => {
		const ids = reactions?.[emoji] ?? [];
		return { emoji, count: ids.length, mine: ids.includes(userId) };
	});
}

export function setReactions(
	comments: readonly ThreadComment[],
	id: string,
	reactions: Record<string, string[]>
): ThreadComment[] {
	return comments.map((c) => (c.id === id ? { ...c, reactions } : c));
}
