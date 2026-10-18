<script lang="ts">
	/**
	 * The drag-and-drop page editor (MVP).
	 *
	 * Drag a block from the palette onto the canvas, drag blocks to reorder,
	 * select one to edit its fields. Every drag move also has a keyboard path
	 * (Add buttons, Move up/down) — drag-and-drop alone is not accessible.
	 * All edits go through the pure functions in ops.ts; this file only wires
	 * them to the pointer and the keyboard. Saving is the caller's job
	 * (`onsave`), which the admin route does through the site API.
	 */
	import {
		BLOCK_LIBRARY,
		BLOCK_TYPES,
		type Block,
		type BlockType,
		type PageDocument
	} from './schema';
	import {
		createBlock,
		duplicateBlock,
		insertBlock,
		moveBlock,
		removeBlock,
		updateBlockProps
	} from './ops';
	import PageRenderer from './PageRenderer.svelte';

	let {
		document = $bindable(),
		onsave,
		saving = false
	}: { document: PageDocument; onsave?: (doc: PageDocument) => void; saving?: boolean } = $props();

	let selectedId = $state<string | null>(null);
	let dropIndex = $state<number | null>(null);
	let preview = $state(false);
	const selected = $derived(document.blocks.find((b) => b.id === selectedId) ?? null);

	type DragPayload = { kind: 'new'; type: BlockType } | { kind: 'move'; from: number };
	let dragging: DragPayload | null = null;

	function add(type: BlockType, index = document.blocks.length) {
		const block = createBlock(type);
		document = insertBlock(document, block, index);
		selectedId = block.id;
	}

	function onDrop(index: number) {
		if (dragging?.kind === 'new') add(dragging.type, index);
		else if (dragging?.kind === 'move') {
			// Dropping below its own position shifts the target up by one once it is removed.
			const to = index > dragging.from ? index - 1 : index;
			document = moveBlock(document, dragging.from, to);
		}
		dragging = null;
		dropIndex = null;
	}

	function update(block: Block, field: string, value: unknown) {
		document = updateBlockProps(document, block.id, { [field]: value });
	}

	function nudge(index: number, delta: number) {
		document = moveBlock(document, index, index + delta);
	}
</script>

<div class="editor">
	<aside class="palette" aria-label="Blocks">
		<h2>Blocks</h2>
		{#each BLOCK_TYPES as type (type)}
			<button
				type="button"
				draggable="true"
				ondragstart={() => (dragging = { kind: 'new', type })}
				onclick={() => add(type)}>+ {BLOCK_LIBRARY[type].label}</button
			>
		{/each}
		<label class="toggle"><input type="checkbox" bind:checked={preview} /> Preview</label>
		{#if onsave}
			<button type="button" class="save" disabled={saving} onclick={() => onsave?.(document)}>
				{saving ? 'Saving…' : 'Save page'}
			</button>
		{/if}
	</aside>

	{#if preview}
		<div class="canvas"><PageRenderer {document} /></div>
	{:else}
		<ol class="canvas" aria-label="Page blocks">
			{#each document.blocks as block, index (block.id)}
				<li
					class:drop={dropIndex === index}
					class:selected={selectedId === block.id}
					draggable="true"
					ondragstart={() => (dragging = { kind: 'move', from: index })}
					ondragover={(e) => {
						e.preventDefault();
						dropIndex = index;
					}}
					ondrop={(e) => {
						e.preventDefault();
						onDrop(index);
					}}
				>
					<button type="button" class="pick" onclick={() => (selectedId = block.id)}>
						<strong>{BLOCK_LIBRARY[block.type].label}</strong>
						<span
							>{'text' in block.props
								? block.props.text
								: 'label' in block.props
									? block.props.label
									: ''}</span
						>
					</button>
					<span class="tools">
						<button
							type="button"
							aria-label="Move up"
							disabled={index === 0}
							onclick={() => nudge(index, -1)}>↑</button
						>
						<button
							type="button"
							aria-label="Move down"
							disabled={index === document.blocks.length - 1}
							onclick={() => nudge(index, 1)}>↓</button
						>
						<button
							type="button"
							aria-label="Duplicate"
							onclick={() => (document = duplicateBlock(document, block.id))}>⧉</button
						>
						<button
							type="button"
							aria-label="Remove"
							onclick={() => (document = removeBlock(document, block.id))}>✕</button
						>
					</span>
				</li>
			{/each}
			<li
				class="end"
				class:drop={dropIndex === document.blocks.length}
				ondragover={(e) => {
					e.preventDefault();
					dropIndex = document.blocks.length;
				}}
				ondrop={(e) => {
					e.preventDefault();
					onDrop(document.blocks.length);
				}}
			>
				Drop a block here
			</li>
		</ol>
	{/if}

	<aside class="inspector" aria-label="Block settings">
		{#if selected}
			<h2>{BLOCK_LIBRARY[selected.type].label}</h2>
			{#if selected.type === 'heading'}
				<label
					>Text <input
						value={selected.props.text}
						oninput={(e) => update(selected, 'text', e.currentTarget.value)}
					/></label
				>
				<label
					>Level
					<select
						value={selected.props.level}
						onchange={(e) => update(selected, 'level', Number(e.currentTarget.value))}
					>
						<option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
					</select>
				</label>
			{:else if selected.type === 'text'}
				<label
					>Text <textarea
						rows="6"
						value={selected.props.text}
						oninput={(e) => update(selected, 'text', e.currentTarget.value)}></textarea></label
				>
			{:else if selected.type === 'image'}
				<label
					>Image URL <input
						value={selected.props.src}
						oninput={(e) => update(selected, 'src', e.currentTarget.value)}
					/></label
				>
				<label
					>Alt text <input
						value={selected.props.alt}
						oninput={(e) => update(selected, 'alt', e.currentTarget.value)}
					/></label
				>
			{:else if selected.type === 'button'}
				<label
					>Label <input
						value={selected.props.label}
						oninput={(e) => update(selected, 'label', e.currentTarget.value)}
					/></label
				>
				<label
					>Link <input
						value={selected.props.href}
						oninput={(e) => update(selected, 'href', e.currentTarget.value)}
					/></label
				>
			{:else if selected.type === 'product-grid'}
				<label
					>Heading <input
						value={selected.props.heading}
						oninput={(e) => update(selected, 'heading', e.currentTarget.value)}
					/></label
				>
				<label
					>How many <input
						type="number"
						min="1"
						max="48"
						value={selected.props.limit}
						oninput={(e) => update(selected, 'limit', Number(e.currentTarget.value))}
					/></label
				>
			{:else if selected.type === 'spacer'}
				<label
					>Size
					<select
						value={selected.props.size}
						onchange={(e) => update(selected, 'size', e.currentTarget.value)}
					>
						<option value="sm">Small</option><option value="md">Medium</option><option value="lg"
							>Large</option
						>
					</select>
				</label>
			{/if}
		{:else}
			<p>Select a block to edit it.</p>
		{/if}
	</aside>
</div>

<style>
	.editor {
		display: grid;
		grid-template-columns: 12rem 1fr 16rem;
		gap: 1rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.editor {
			grid-template-columns: 1fr;
		}
	}
	.palette,
	.inspector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	h2 {
		font-size: 0.9rem;
		margin: 0 0 0.25rem;
		color: var(--color-text-secondary);
	}
	button {
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
	}
	button:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}
	.save {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		text-align: center;
	}
	.save:hover:not(:disabled) {
		background: var(--color-primary-solid-hover);
	}
	.canvas {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 20rem;
	}
	.canvas li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.canvas li.selected {
		border-color: var(--color-primary);
	}
	.canvas li.drop {
		box-shadow: 0 -3px 0 var(--color-primary);
	}
	.canvas li.end {
		justify-content: center;
		border-style: dashed;
		color: var(--color-text-secondary);
	}
	.pick {
		flex: 1;
		display: flex;
		gap: 0.75rem;
		border: none;
		background: transparent;
		overflow: hidden;
	}
	.pick span {
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tools {
		display: flex;
		gap: 0.25rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
	}
	input,
	textarea,
	select {
		padding: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
	}
	.toggle {
		flex-direction: row;
		align-items: center;
	}
</style>
