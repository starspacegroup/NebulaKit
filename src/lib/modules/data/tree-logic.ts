/** Tree view: flattening the visible nodes and the WAI-ARIA tree keyboard model. */

export interface TreeNode {
	id: string;
	label: string;
	children?: TreeNode[];
	disabled?: boolean;
}

export interface FlatNode {
	id: string;
	label: string;
	/** 1-based, as aria-level wants it. */
	level: number;
	posInSet: number;
	setSize: number;
	parentId: string | null;
	hasChildren: boolean;
	expanded: boolean;
	disabled: boolean;
}

/** The nodes a person can currently reach, in order: children only appear under expanded parents. */
export function flattenVisible(
	nodes: readonly TreeNode[],
	expanded: readonly string[],
	level = 1,
	parentId: string | null = null
): FlatNode[] {
	const out: FlatNode[] = [];
	nodes.forEach((node, index) => {
		const hasChildren = Boolean(node.children && node.children.length > 0);
		const open = hasChildren && expanded.includes(node.id);
		out.push({
			id: node.id,
			label: node.label,
			level,
			posInSet: index + 1,
			setSize: nodes.length,
			parentId,
			hasChildren,
			expanded: open,
			disabled: Boolean(node.disabled)
		});
		if (open)
			out.push(...flattenVisible(node.children as TreeNode[], expanded, level + 1, node.id));
	});
	return out;
}

/** Ids of every node that has children. */
export function parentIds(nodes: readonly TreeNode[]): string[] {
	return nodes.flatMap((n) => (n.children?.length ? [n.id, ...parentIds(n.children)] : []));
}

export function toggleExpanded(expanded: readonly string[], id: string): string[] {
	return expanded.includes(id) ? expanded.filter((e) => e !== id) : [...expanded, id];
}

/** Ancestors of a node, outermost first. */
export function ancestorsOf(nodes: readonly TreeNode[], id: string): string[] {
	for (const node of nodes) {
		if (node.id === id) return [];
		const inside = node.children ? ancestorsOf(node.children, id) : null;
		if (inside && (inside.length > 0 || node.children?.some((c) => c.id === id))) {
			return [node.id, ...inside];
		}
	}
	return [];
}

/** Expanded list with every ancestor of `id` opened, so the node is visible. */
export function revealNode(
	nodes: readonly TreeNode[],
	expanded: readonly string[],
	id: string
): string[] {
	const merged = new Set([...expanded, ...ancestorsOf(nodes, id)]);
	return [...merged];
}

export interface TreeKeyResult {
	/** Move focus to this node. */
	focus?: string;
	/** Expand or collapse this node. */
	expand?: { id: string; open: boolean };
	/** Select this node. */
	select?: string;
	/** Expand all siblings of this node (the `*` key). */
	expandSiblings?: string;
}

/**
 * What a key press does in a tree. Disabled nodes are skipped by arrows and
 * cannot be selected. Returns null for a key the tree does not handle.
 */
export function treeKey(
	visible: readonly FlatNode[],
	focusedId: string,
	key: string
): TreeKeyResult | null {
	const at = visible.findIndex((n) => n.id === focusedId);
	if (at === -1) return null;
	const node = visible[at];
	const scan = (from: number, step: 1 | -1) => {
		for (let i = from + step; i >= 0 && i < visible.length; i += step) {
			if (!visible[i].disabled) return visible[i].id;
		}
		return undefined;
	};
	switch (key) {
		case 'ArrowDown': {
			const id = scan(at, 1);
			return id ? { focus: id } : {};
		}
		case 'ArrowUp': {
			const id = scan(at, -1);
			return id ? { focus: id } : {};
		}
		case 'Home': {
			const id = scan(-1, 1);
			return id ? { focus: id } : {};
		}
		case 'End': {
			const id = scan(visible.length, -1);
			return id ? { focus: id } : {};
		}
		case 'ArrowRight': {
			if (!node.hasChildren) return {};
			if (!node.expanded) return { expand: { id: node.id, open: true } };
			const child = visible[at + 1];
			return child && !child.disabled ? { focus: child.id } : {};
		}
		case 'ArrowLeft': {
			if (node.hasChildren && node.expanded) return { expand: { id: node.id, open: false } };
			return node.parentId ? { focus: node.parentId } : {};
		}
		case 'Enter':
		case ' ':
			return node.disabled ? {} : { select: node.id };
		case '*':
			return { expandSiblings: node.id };
		default:
			return null;
	}
}

/** The ids to open when `*` is pressed: every collapsed sibling (same parent) that has children. */
export function siblingsToExpand(visible: readonly FlatNode[], id: string): string[] {
	const node = visible.find((n) => n.id === id);
	if (!node) return [];
	return visible
		.filter((n) => n.parentId === node.parentId && n.hasChildren && !n.expanded)
		.map((n) => n.id);
}

export interface TypeAhead {
	buffer: string;
	at: number;
}

/** Add a typed character to the buffer; it restarts after `timeout` ms of silence. */
export function pushTypeAhead(
	state: TypeAhead,
	char: string,
	now: number,
	timeout = 600
): TypeAhead {
	const fresh = now - state.at > timeout;
	return { buffer: (fresh ? '' : state.buffer) + char.toLocaleLowerCase(), at: now };
}

/** The key presses that add to type-ahead: one printable character, no modifiers. */
export function isTypeAheadKey(event: {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
}): boolean {
	return (
		event.key.length === 1 &&
		event.key !== ' ' &&
		event.key !== '*' &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	);
}

/**
 * The node type-ahead lands on: the next one after the focused node whose label
 * starts with the buffer (wrapping). Typing one letter repeatedly cycles through
 * the nodes that start with it.
 */
export function typeAheadTarget(
	visible: readonly FlatNode[],
	focusedId: string,
	buffer: string
): string | null {
	if (!buffer || visible.length === 0) return null;
	const at = visible.findIndex((n) => n.id === focusedId);
	const cycling = buffer.length > 1 && buffer.split('').every((c) => c === buffer[0]);
	const needle = cycling ? buffer[0] : buffer;
	const start = needle.length === 1 || cycling ? at + 1 : Math.max(at, 0);
	for (let i = 0; i < visible.length; i++) {
		const node = visible[(start + i + visible.length) % visible.length];
		if (!node.disabled && node.label.toLocaleLowerCase().startsWith(needle)) return node.id;
	}
	return null;
}
