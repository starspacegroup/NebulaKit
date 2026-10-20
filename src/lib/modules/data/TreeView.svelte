<!--
	TreeView — a hierarchy you can walk without a mouse, following the WAI-ARIA
	tree pattern. One item is in the tab order; Up/Down move through the visible
	items, Right opens a branch (then steps into it), Left closes it (then steps
	out to the parent), Home/End jump to the ends, `*` opens every sibling
	branch, Enter or Space selects, and typing letters jumps to the next label
	that starts with them. Levels, positions and open/closed state are exposed
	with aria-level, aria-posinset, aria-setsize and aria-expanded. Bind
	`expanded` and `selected`.

	<TreeView label="Project files" {nodes} bind:expanded bind:selected />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import {
		flattenVisible,
		isTypeAheadKey,
		pushTypeAhead,
		siblingsToExpand,
		toggleExpanded,
		treeKey,
		typeAheadTarget,
		type TreeNode,
		type TypeAhead
	} from './tree-logic';

	export let label: string;
	export let nodes: TreeNode[] = [];
	/** Ids of the open branches. */
	export let expanded: string[] = [];
	/** The selected node's id, or null. */
	export let selected: string | null = null;
	/** How long typing keeps building the same search, in ms. */
	export let typeAheadMs = 600;
	export let empty = 'Nothing here.';

	const dispatch = createEventDispatcher<{
		select: { id: string };
		toggle: { id: string; open: boolean };
	}>();

	let root: HTMLElement;
	let focusId = '';
	let typed: TypeAhead = { buffer: '', at: 0 };

	$: visible = flattenVisible(nodes, expanded);
	// Keep the tab stop on something that exists: the focused node, else the selection, else the first.
	$: if (!visible.some((n) => n.id === focusId && !n.disabled)) {
		focusId =
			visible.find((n) => n.id === selected && !n.disabled)?.id ??
			visible.find((n) => !n.disabled)?.id ??
			'';
	}

	async function focusNode(id: string) {
		focusId = id;
		await tick();
		root?.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
	}

	function setOpen(id: string, open: boolean) {
		const isOpen = expanded.includes(id);
		if (isOpen === open) return;
		expanded = toggleExpanded(expanded, id);
		dispatch('toggle', { id, open });
	}

	function choose(id: string) {
		selected = id;
		dispatch('select', { id });
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (isTypeAheadKey(event)) {
			typed = pushTypeAhead(typed, event.key, event.timeStamp || performance.now(), typeAheadMs);
			const target = typeAheadTarget(visible, focusId, typed.buffer);
			if (target) {
				event.preventDefault();
				focusNode(target);
			}
			return;
		}
		const result = treeKey(visible, focusId, event.key);
		if (!result) return;
		event.preventDefault();
		if (result.expand) setOpen(result.expand.id, result.expand.open);
		if (result.expandSiblings) {
			for (const id of siblingsToExpand(visible, result.expandSiblings)) setOpen(id, true);
		}
		if (result.select) choose(result.select);
		if (result.focus) focusNode(result.focus);
	}

	function onClick(node: (typeof visible)[number]) {
		if (node.disabled) return;
		focusId = node.id;
		choose(node.id);
		if (node.hasChildren) setOpen(node.id, !node.expanded);
	}
</script>

{#if visible.length === 0}
	<p class="tree__empty">{empty}</p>
{:else}
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<ul class="tree" role="tree" aria-label={label} bind:this={root} on:keydown={onKeydown}>
		{#each visible as node (node.id)}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<li
				class="tree__item"
				class:tree__item--selected={selected === node.id}
				class:tree__item--disabled={node.disabled}
				role="treeitem"
				data-node-id={node.id}
				aria-level={node.level}
				aria-posinset={node.posInSet}
				aria-setsize={node.setSize}
				aria-expanded={node.hasChildren ? node.expanded : undefined}
				aria-selected={selected === node.id}
				aria-disabled={node.disabled || undefined}
				tabindex={node.id === focusId ? 0 : -1}
				style="--level: {node.level}"
				on:focus={() => (focusId = node.id)}
				on:click|stopPropagation={() => onClick(node)}
			>
				<span class="tree__twist" aria-hidden="true"
					>{node.hasChildren ? (node.expanded ? '▾' : '▸') : ''}</span
				>
				<span class="tree__label">{node.label}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.tree {
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 0;
	}

	.tree__item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-height: 2.75rem;
		padding-block: var(--spacing-xs);
		padding-inline: calc(var(--level, 1) * 1.25rem - 0.75rem) var(--spacing-md);
		border-inline-start: 3px solid transparent;
		border-radius: var(--radius-md);
		color: var(--color-text);
		cursor: pointer;
		overflow-wrap: anywhere;
	}

	.tree__item:hover {
		background: var(--color-surface-hover);
	}

	.tree__item--selected {
		background: color-mix(in srgb, var(--color-primary) 14%, var(--color-background));
		border-inline-start-color: var(--color-primary);
		font-weight: 700;
	}

	.tree__item--disabled {
		color: var(--color-text-secondary);
		cursor: not-allowed;
	}

	.tree__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.tree__twist {
		display: inline-block;
		flex-shrink: 0;
		width: 1.25rem;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.tree__empty {
		margin: 0;
		color: var(--color-text-secondary);
	}
</style>
