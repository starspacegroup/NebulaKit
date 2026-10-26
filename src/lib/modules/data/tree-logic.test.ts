import { describe, expect, it } from 'vitest';
import {
	ancestorsOf,
	flattenVisible,
	isTypeAheadKey,
	parentIds,
	pushTypeAhead,
	revealNode,
	siblingsToExpand,
	toggleExpanded,
	treeKey,
	typeAheadTarget,
	type TreeNode
} from './tree-logic';

const nodes: TreeNode[] = [
	{
		id: 'src',
		label: 'src',
		children: [
			{
				id: 'lib',
				label: 'lib',
				children: [
					{ id: 'a', label: 'alpha.ts' },
					{ id: 'b', label: 'beta.ts', disabled: true }
				]
			},
			{ id: 'routes', label: 'routes', children: [] },
			{ id: 'app', label: 'app.css' }
		]
	},
	{ id: 'docs', label: 'docs', children: [{ id: 'readme', label: 'README' }] },
	{ id: 'pkg', label: 'package.json' }
];

describe('flattenVisible', () => {
	it('hides children of collapsed nodes', () => {
		const v = flattenVisible(nodes, []);
		expect(v.map((n) => n.id)).toEqual(['src', 'docs', 'pkg']);
		expect(v[0]).toMatchObject({
			level: 1,
			posInSet: 1,
			setSize: 3,
			hasChildren: true,
			expanded: false,
			parentId: null
		});
	});
	it('shows expanded children with levels and positions', () => {
		const v = flattenVisible(nodes, ['src', 'lib']);
		expect(v.map((n) => n.id)).toEqual(['src', 'lib', 'a', 'b', 'routes', 'app', 'docs', 'pkg']);
		expect(v[2]).toMatchObject({ level: 3, posInSet: 1, setSize: 2, parentId: 'lib' });
		expect(v[3].disabled).toBe(true);
	});
	it('treats an empty children array as a leaf', () => {
		const v = flattenVisible(nodes, ['src', 'routes']);
		const routes = v.find((n) => n.id === 'routes');
		expect(routes).toMatchObject({ hasChildren: false, expanded: false });
	});
});

describe('expansion helpers', () => {
	it('lists parents', () => {
		expect(parentIds(nodes)).toEqual(['src', 'lib', 'docs']);
	});
	it('toggles', () => {
		expect(toggleExpanded([], 'a')).toEqual(['a']);
		expect(toggleExpanded(['a', 'b'], 'a')).toEqual(['b']);
	});
	it('finds ancestors and reveals', () => {
		expect(ancestorsOf(nodes, 'a')).toEqual(['src', 'lib']);
		expect(ancestorsOf(nodes, 'lib')).toEqual(['src']);
		expect(ancestorsOf(nodes, 'src')).toEqual([]);
		expect(ancestorsOf(nodes, 'nope')).toEqual([]);
		expect(ancestorsOf(nodes, 'pkg')).toEqual([]);
		expect(ancestorsOf(nodes, 'readme')).toEqual(['docs']);
		expect(revealNode(nodes, ['docs'], 'a').sort()).toEqual(['docs', 'lib', 'src']);
	});
});

describe('treeKey', () => {
	const v = flattenVisible(nodes, ['src', 'lib']);
	it('moves with arrows, skipping disabled', () => {
		expect(treeKey(v, 'src', 'ArrowDown')).toEqual({ focus: 'lib' });
		expect(treeKey(v, 'a', 'ArrowDown')).toEqual({ focus: 'routes' });
		expect(treeKey(v, 'routes', 'ArrowUp')).toEqual({ focus: 'a' });
		expect(treeKey(v, 'src', 'ArrowUp')).toEqual({});
		expect(treeKey(v, 'pkg', 'ArrowDown')).toEqual({});
	});
	it('jumps with Home and End', () => {
		expect(treeKey(v, 'app', 'Home')).toEqual({ focus: 'src' });
		expect(treeKey(v, 'app', 'End')).toEqual({ focus: 'pkg' });
		expect(treeKey([{ ...v[0], disabled: true }], 'src', 'Home')).toEqual({});
		expect(treeKey([{ ...v[0], disabled: true }], 'src', 'End')).toEqual({});
	});
	it('ArrowRight expands, then enters, and does nothing on a leaf', () => {
		expect(treeKey(v, 'docs', 'ArrowRight')).toEqual({ expand: { id: 'docs', open: true } });
		expect(treeKey(v, 'src', 'ArrowRight')).toEqual({ focus: 'lib' });
		expect(treeKey(v, 'pkg', 'ArrowRight')).toEqual({});
		const closed = flattenVisible(nodes, ['src']);
		expect(treeKey(closed, 'src', 'ArrowRight')).toEqual({ focus: 'lib' });
		const onlyDisabled = flattenVisible(
			[{ id: 'p', label: 'p', children: [{ id: 'c', label: 'c', disabled: true }] }],
			['p']
		);
		expect(treeKey(onlyDisabled, 'p', 'ArrowRight')).toEqual({});
	});
	it('ArrowLeft collapses, then goes to the parent', () => {
		expect(treeKey(v, 'lib', 'ArrowLeft')).toEqual({ expand: { id: 'lib', open: false } });
		expect(treeKey(v, 'a', 'ArrowLeft')).toEqual({ focus: 'lib' });
		expect(treeKey(v, 'pkg', 'ArrowLeft')).toEqual({});
		expect(treeKey(v, 'docs', 'ArrowLeft')).toEqual({});
	});
	it('Enter and Space select, unless disabled', () => {
		expect(treeKey(v, 'a', 'Enter')).toEqual({ select: 'a' });
		expect(treeKey(v, 'a', ' ')).toEqual({ select: 'a' });
		expect(treeKey(v, 'b', 'Enter')).toEqual({});
	});
	it('star expands siblings', () => {
		expect(treeKey(v, 'src', '*')).toEqual({ expandSiblings: 'src' });
		expect(siblingsToExpand(v, 'src')).toEqual(['docs']);
		expect(siblingsToExpand(v, 'nope')).toEqual([]);
	});
	it('ignores other keys and unknown focus', () => {
		expect(treeKey(v, 'src', 'x')).toBeNull();
		expect(treeKey(v, 'nope', 'ArrowDown')).toBeNull();
	});
});

describe('type-ahead', () => {
	const v = flattenVisible(nodes, ['src', 'lib']);
	it('builds and resets the buffer', () => {
		let s = pushTypeAhead({ buffer: '', at: 0 }, 'A', 100);
		expect(s).toEqual({ buffer: 'a', at: 100 });
		s = pushTypeAhead(s, 'l', 300);
		expect(s.buffer).toBe('al');
		s = pushTypeAhead(s, 'x', 2000);
		expect(s.buffer).toBe('x');
		expect(pushTypeAhead(s, 'y', 2100, 50).buffer).toBe('y');
	});
	it('recognises typing keys', () => {
		expect(isTypeAheadKey({ key: 'a' })).toBe(true);
		expect(isTypeAheadKey({ key: 'a', ctrlKey: true })).toBe(false);
		expect(isTypeAheadKey({ key: 'a', metaKey: true })).toBe(false);
		expect(isTypeAheadKey({ key: 'a', altKey: true })).toBe(false);
		expect(isTypeAheadKey({ key: ' ' })).toBe(false);
		expect(isTypeAheadKey({ key: '*' })).toBe(false);
		expect(isTypeAheadKey({ key: 'Enter' })).toBe(false);
	});
	it('finds the next match, wrapping', () => {
		expect(typeAheadTarget(v, 'src', 'r')).toBe('routes');
		expect(typeAheadTarget(v, 'routes', 'p')).toBe('pkg');
		expect(typeAheadTarget(v, 'pkg', 'a')).toBe('a');
		expect(typeAheadTarget(v, 'src', 'zzz')).toBeNull();
		expect(typeAheadTarget(v, 'src', '')).toBeNull();
		expect(typeAheadTarget([], 'src', 'a')).toBeNull();
	});
	it('refines with more letters from the current node', () => {
		expect(typeAheadTarget(v, 'app', 'ap')).toBe('app');
		expect(typeAheadTarget(v, 'src', 'al')).toBe('a');
	});
	it('cycles on a repeated letter and skips disabled', () => {
		const w = flattenVisible(
			[
				{ id: '1', label: 'ant' },
				{ id: '2', label: 'axe' },
				{ id: '3', label: 'ash', disabled: true },
				{ id: '4', label: 'bee' }
			],
			[]
		);
		expect(typeAheadTarget(w, '1', 'aa')).toBe('2');
		expect(typeAheadTarget(w, '2', 'aa')).toBe('1');
		expect(typeAheadTarget(w, '1', 'as')).toBeNull();
	});
	it('starts at the first node when none is focused', () => {
		expect(typeAheadTarget(v, 'nope', 'src')).toBe('src');
	});
});
