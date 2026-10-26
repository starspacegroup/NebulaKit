import { describe, expect, it } from 'vitest';
import {
	addThreadComment,
	buildTree,
	canReplyAtDepth,
	charCount,
	countComments,
	countReplies,
	deleteThreadComment,
	editThreadComment,
	nearLimit,
	reactionSummary,
	setReactions,
	toggleReaction,
	validateComment,
	type CommentNode,
	type ThreadComment
} from './comment-logic';

const who = { id: 'u1', name: 'Ada' };
const c = (id: string, parentId: string | null, minute: number): ThreadComment => ({
	id,
	parentId,
	author: who,
	body: id,
	createdAt: `2026-10-13T10:${String(minute).padStart(2, '0')}:00Z`
});
const shape = (nodes: CommentNode[]): unknown[] =>
	nodes.map((n) =>
		n.children.length
			? [`${n.comment.id}@${n.depth}`, shape(n.children)]
			: `${n.comment.id}@${n.depth}`
	);

describe('buildTree', () => {
	it('nests replies oldest first', () => {
		const tree = buildTree([c('r2', 'a', 5), c('a', null, 1), c('r1', 'a', 2), c('b', null, 3)]);
		expect(shape(tree)).toEqual([['a@1', ['r1@2', 'r2@2']], 'b@1']);
	});
	it('caps depth at 3 by attaching deeper replies beside their parent', () => {
		const tree = buildTree([
			c('a', null, 1),
			c('b', 'a', 2),
			c('c', 'b', 3),
			c('d', 'c', 4),
			c('e', 'd', 5)
		]);
		expect(shape(tree)).toEqual([['a@1', [['b@2', ['c@3', 'd@3', 'e@3']]]]]);
	});
	it('honours a custom cap, including 1', () => {
		expect(shape(buildTree([c('a', null, 1), c('b', 'a', 2)], 1))).toEqual(['a@1', 'b@1']);
		expect(shape(buildTree([c('a', null, 1), c('b', 'a', 2), c('c', 'b', 3)], 2))).toEqual([
			['a@1', ['b@2', 'c@2']]
		]);
	});
	it('treats orphans and cycles as top level', () => {
		const orphan = buildTree([c('x', 'ghost', 1)]);
		expect(shape(orphan)).toEqual(['x@1']);
		const cyc = buildTree([c('p', 'q', 1), c('q', 'p', 2), c('self', 'self', 3)]);
		expect(cyc.map((n) => n.comment.id)).toEqual(['p', 'q', 'self']);
	});
	it('breaks equal timestamps by input order', () => {
		const tree = buildTree([c('b', null, 1), c('a', null, 1)]);
		expect(tree.map((n) => n.comment.id)).toEqual(['b', 'a']);
	});
	it('handles empty', () => {
		expect(buildTree([])).toEqual([]);
	});
});

describe('counts', () => {
	const tree = buildTree([c('a', null, 1), c('b', 'a', 2), c('c', 'b', 3), c('d', null, 4)]);
	it('counts replies and comments', () => {
		expect(countReplies(tree[0])).toBe(2);
		expect(countReplies(tree[1])).toBe(0);
		expect(countComments(tree)).toBe(4);
		const stub = buildTree([{ ...c('a', null, 1), deleted: true }, c('b', 'a', 2)]);
		expect(countComments(stub)).toBe(1);
	});
	it('allows replies below the cap only', () => {
		expect(canReplyAtDepth(1)).toBe(true);
		expect(canReplyAtDepth(2)).toBe(true);
		expect(canReplyAtDepth(3)).toBe(false);
		expect(canReplyAtDepth(3, 4)).toBe(true);
	});
});

describe('compose', () => {
	it('counts characters like a person', () => {
		expect(charCount('héllo')).toBe(5);
		expect(charCount('a😀b')).toBe(3);
	});
	it('validates', () => {
		expect(validateComment('  ', 10)).toMatchObject({ ok: false, error: 'Write something first.' });
		expect(validateComment('hello', 10)).toEqual({ ok: true, error: '', remaining: 5 });
		expect(validateComment('hello world!', 10)).toMatchObject({ ok: false, remaining: -2 });
		expect(validateComment('a'.repeat(11), 10, { empty: 'E', tooLong: 'L' }).error).toBe('L');
		expect(validateComment('', 10, { empty: 'E', tooLong: 'L' }).error).toBe('E');
	});
	it('warns near the limit', () => {
		expect(nearLimit(500, 1000)).toBe(false);
		expect(nearLimit(100, 1000)).toBe(true);
		expect(nearLimit(20, 100)).toBe(true);
		expect(nearLimit(21, 100)).toBe(false);
	});
});

describe('operations', () => {
	const list = [c('a', null, 1), c('b', 'a', 2), c('x', null, 3)];
	it('adds and edits', () => {
		expect(addThreadComment(list, c('n', null, 9))).toHaveLength(4);
		const edited = editThreadComment(list, 'a', 'new', '2026-10-13T11:00:00Z');
		expect(edited[0]).toMatchObject({ body: 'new', editedAt: '2026-10-13T11:00:00Z' });
		expect(edited[2]).toBe(list[2]);
		expect(list[0].body).toBe('a');
	});
	it('deletes a leaf outright', () => {
		expect(deleteThreadComment(list, 'x').map((i) => i.id)).toEqual(['a', 'b']);
	});
	it('keeps a stub when there are replies, and sweeps stubs once empty', () => {
		const stubbed = deleteThreadComment(list, 'a');
		expect(stubbed.find((i) => i.id === 'a')).toMatchObject({ deleted: true, body: '' });
		const swept = deleteThreadComment(stubbed, 'b');
		expect(swept.map((i) => i.id)).toEqual(['x']);
	});
	it('does not sweep a live parent, or a stub that still has replies', () => {
		expect(deleteThreadComment(list, 'b').map((i) => i.id)).toEqual(['a', 'x']);
		const nested = [c('a', null, 1), c('b', 'a', 2), c('d', 'a', 3)];
		const stub = deleteThreadComment(nested, 'a');
		expect(deleteThreadComment(stub, 'b').map((i) => i.id)).toEqual(['a', 'd']);
	});
	it('ignores an unknown id', () => {
		expect(deleteThreadComment(list, 'zzz')).toEqual(list);
	});
});

describe('reactions', () => {
	it('toggles on and off, immutably', () => {
		const first = toggleReaction(undefined, '👍', 'u1');
		expect(first).toEqual({ '👍': ['u1'] });
		const second = toggleReaction(first, '👍', 'u2');
		expect(second['👍']).toEqual(['u1', 'u2']);
		expect(first['👍']).toEqual(['u1']);
		expect(toggleReaction(second, '👍', 'u1')).toEqual({ '👍': ['u2'] });
		expect(toggleReaction(first, '👍', 'u1')).toEqual({});
		expect(toggleReaction(first, '🎉', 'u1')).toEqual({ '👍': ['u1'], '🎉': ['u1'] });
	});
	it('summarises offered emoji plus any extras', () => {
		const s = reactionSummary({ '👍': ['u1', 'u2'], '🚀': ['u2'] }, ['👍', '❤️'], 'u1');
		expect(s).toEqual([
			{ emoji: '👍', count: 2, mine: true },
			{ emoji: '❤️', count: 0, mine: false },
			{ emoji: '🚀', count: 1, mine: false }
		]);
		expect(reactionSummary(undefined, ['👍'], 'u1')).toEqual([
			{ emoji: '👍', count: 0, mine: false }
		]);
	});
	it('stores reactions on a comment', () => {
		const out = setReactions([c('a', null, 1), c('b', null, 2)], 'a', { '👍': ['u1'] });
		expect(out[0].reactions).toEqual({ '👍': ['u1'] });
		expect(out[1].reactions).toBeUndefined();
	});
});
