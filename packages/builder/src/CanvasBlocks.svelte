<script lang="ts" module>
	import type { DropDetail } from '$lib/actions/draggable';
	import type { LintIssue } from './lint';
	import type { Block, PageDocument } from './schema';

	/** What the canvas needs from the editor, passed down once instead of threaded through props. */
	export interface CanvasContext {
		doc: PageDocument;
		selectedId: string | null;
		/** The one block that is a tab stop (roving tabindex). */
		focusId: string | null;
		/** Every block id in reading order, for arrow-key travel. */
		order: string[];
		nameOf(block: Block): string;
		issues: Map<string, LintIssue[]>;
		select(id: string): void;
		focus(id: string): void;
		drop(detail: DropDetail): void;
		moveBy(id: string, delta: number): void;
		indent(id: string): void;
		outdent(id: string): void;
		duplicate(id: string): void;
		remove(id: string): void;
		/** Select a block and take the reader to its settings panel. */
		settings(id: string): void;
		can: {
			moveUp(id: string): boolean;
			moveDown(id: string): boolean;
			indent(id: string): boolean;
			outdent(id: string): boolean;
		};
	}

	export const ROOT_GROUP = 'root';
	export const BOARD = 'builder';
</script>

<script lang="ts">
	/**
	 * The editor's canvas, one list at a time; a container's children are the
	 * same component again. Each list is a drop zone, each block a draggable
	 * item, so a block moves between any two lists — page, section, column —
	 * with the mouse, a finger or the keyboard, all through `$lib/actions/draggable`.
	 *
	 * A block has exactly one real control: the button in its bar that selects
	 * it. The big transparent button over a leaf's preview is only a bigger
	 * mouse target (hidden from keyboards and screen readers), and the preview
	 * itself is inert so the links and buttons in it do not steal focus.
	 */
	import { draggable, dropzone } from '$lib/actions/draggable';
	import Self from './CanvasBlocks.svelte';
	import BlockView from './BlockView.svelte';
	import { BLOCK_LIBRARY, isContainer } from './schema';
	import { BREAKPOINTS } from './schema';

	let { blocks, parent, ctx }: { blocks: Block[]; parent: Block | null; ctx: CanvasContext } =
		$props();

	const group = $derived(parent?.id ?? ROOT_GROUP);
	/** A Columns block holds columns only, and columns are not dragged between lists. */
	const acceptsDrops = $derived(parent?.type !== 'columns');

	function zone(node: HTMLElement, options: { enabled: boolean; group: string }) {
		if (!options.enabled) return;
		return dropzone(node, { group: options.group, board: BOARD });
	}

	function onKey(event: KeyboardEvent, block: Block) {
		const alt = event.altKey;
		if (alt && event.key === 'ArrowUp') ctx.moveBy(block.id, -1);
		else if (alt && event.key === 'ArrowDown') ctx.moveBy(block.id, 1);
		else if (alt && event.key === 'ArrowRight') ctx.indent(block.id);
		else if (alt && event.key === 'ArrowLeft') ctx.outdent(block.id);
		else if (!alt && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			const at = ctx.order.indexOf(block.id);
			const next = ctx.order[at + (event.key === 'ArrowDown' ? 1 : -1)];
			if (next) ctx.focus(next);
		} else return;
		event.preventDefault();
		event.stopPropagation();
	}

	const hideClasses = (block: Block) => (block.hide ?? []).map((b) => `nk-hide-${b}`).join(' ');

	const hiddenWords = (block: Block) =>
		(block.hide ?? [])
			.toSorted((a, b) => BREAKPOINTS.indexOf(a) - BREAKPOINTS.indexOf(b))
			.join(', ');
</script>

<ul
	class="cv-list"
	class:nk-page-root={parent === null}
	class:nk-section={parent?.type === 'section'}
	class:nk-columns={parent?.type === 'columns'}
	class:nk-column={parent?.type === 'column'}
	class:cv-list--empty={blocks.length === 0}
	data-gap={parent && 'gap' in parent.props ? parent.props.gap : undefined}
	data-padding={parent?.type === 'section' ? parent.props.padding : undefined}
	data-tone={parent?.type === 'section' ? parent.props.tone : undefined}
	style:--nk-cols={parent?.type === 'columns' ? (parent.children?.length ?? 1) : undefined}
	aria-label={parent ? `Inside ${ctx.nameOf(parent)}` : 'Page blocks'}
	use:zone={{ enabled: acceptsDrops, group }}
>
	{#each blocks as block (block.id)}
		{@const name = ctx.nameOf(block)}
		{@const selected = ctx.selectedId === block.id}
		{@const problems = ctx.issues.get(block.id) ?? []}
		<li
			class="cv-item {hideClasses(block)}"
			class:cv-item--selected={selected}
			class:cv-item--container={isContainer(block.type)}
			data-block-type={block.type}
			data-editing
			use:draggable={{
				id: block.id,
				group,
				board: BOARD,
				label: name,
				disabled: block.type === 'column',
				onDrop: ctx.drop
			}}
		>
			<div class="cv-bar">
				{#if block.type !== 'column'}
					<button type="button" class="cv-handle" data-drag-handle aria-label="Move {name}">
						<span aria-hidden="true">⠿</span>
					</button>
				{/if}
				<button
					type="button"
					class="cv-select"
					id="cv-select-{block.id}"
					aria-pressed={selected}
					tabindex={ctx.focusId === block.id ? 0 : -1}
					onclick={() => ctx.select(block.id)}
					onkeydown={(e) => onKey(e, block)}
				>
					<span class="cv-type">{BLOCK_LIBRARY[block.type].label}</span>
					{#if !isContainer(block.type)}<span class="cv-name"
							>{name.slice(BLOCK_LIBRARY[block.type].label.length + 2)}</span
						>{/if}
				</button>
				{#if block.hide?.length}<span class="cv-tag">Hidden on {hiddenWords(block)}</span>{/if}
				{#if problems.length}
					<span class="cv-tag cv-tag--warn"
						>{problems.length} to fix<span class="sr-only"
							>: {problems.map((p) => p.message).join(' ')}</span
						></span
					>
				{/if}
				{#if selected}
					<span class="cv-tools" role="group" aria-label="Actions for {name}">
						<button
							type="button"
							aria-label="Move up"
							disabled={!ctx.can.moveUp(block.id)}
							onclick={() => ctx.moveBy(block.id, -1)}>↑</button
						>
						<button
							type="button"
							aria-label="Move down"
							disabled={!ctx.can.moveDown(block.id)}
							onclick={() => ctx.moveBy(block.id, 1)}>↓</button
						>
						{#if block.type !== 'column'}
							<button
								type="button"
								aria-label="Move into the block above"
								disabled={!ctx.can.indent(block.id)}
								onclick={() => ctx.indent(block.id)}>⇥</button
							>
							<button
								type="button"
								aria-label="Move out of {parent ? ctx.nameOf(parent) : 'the page'}"
								disabled={!ctx.can.outdent(block.id)}
								onclick={() => ctx.outdent(block.id)}>⇤</button
							>
						{/if}
						<button type="button" class="cv-settings" onclick={() => ctx.settings(block.id)}
							>Settings</button
						>
						<button type="button" aria-label="Duplicate" onclick={() => ctx.duplicate(block.id)}
							>⧉</button
						>
						<button type="button" aria-label="Delete" onclick={() => ctx.remove(block.id)}>✕</button
						>
					</span>
				{/if}
			</div>

			{#if isContainer(block.type)}
				<Self blocks={block.children ?? []} parent={block} {ctx} />
			{:else}
				<!-- Mouse and touch only: a bigger target for selecting. The keyboard has the bar's button. -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="cv-hit" onclick={() => ctx.select(block.id)}>
					<div class="cv-preview" inert aria-hidden="true"><BlockView {block} editing /></div>
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.cv-list {
		list-style: none;
		margin: 0;
		padding: 0.5rem;
		min-height: 3rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	/* Nested lists keep the page's own look; the inset keeps them hit-testable as inner zones. */
	.cv-list.nk-section {
		padding: 0.75rem;
	}
	.cv-list.nk-columns {
		display: grid;
	}
	.cv-list--empty::after {
		content: 'Drop a block here';
		display: grid;
		place-items: center;
		min-height: 3rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	.cv-list--empty.nk-columns::after {
		content: none;
	}

	.cv-item {
		position: relative;
		min-width: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-background);
	}
	.cv-item:hover {
		border-color: var(--color-border);
	}
	.cv-item--selected {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary);
	}
	.cv-item--container {
		background: transparent;
		border-color: var(--color-border);
		border-style: dashed;
	}
	.cv-item--container.cv-item--selected {
		border-style: solid;
	}

	.cv-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.25rem;
		font-size: 0.8125rem;
	}
	.cv-bar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
	.cv-bar button:hover:not(:disabled) {
		background: var(--color-surface-hover);
		border-color: var(--color-border);
	}
	.cv-bar button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.cv-bar button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}
	.cv-handle {
		cursor: grab !important;
		touch-action: none;
	}
	.cv-select {
		flex: 1 1 auto;
		justify-content: flex-start !important;
		gap: 0.5rem;
		min-width: 0 !important;
		text-align: start;
	}
	.cv-type {
		font-weight: 700;
	}
	.cv-name {
		min-width: 0;
		overflow: hidden;
		color: var(--color-text-secondary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cv-tag {
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}
	.cv-tag--warn {
		border-color: var(--color-warning, var(--color-border));
		color: var(--color-text);
	}
	.cv-tools {
		display: flex;
		flex: 1 0 100%;
		flex-wrap: wrap;
		gap: 0.125rem;
	}

	.cv-preview {
		padding: 0.25rem 0.75rem 0.75rem;
		pointer-events: none;
	}
	.cv-hit {
		cursor: pointer;
	}

	/* A block hidden at the previewed width stays editable, but looks switched off. */
	@container nk-page (max-width: 39.999rem) {
		.cv-item:global(.nk-hide-mobile) {
			opacity: 0.45;
		}
	}
	@container nk-page (min-width: 40rem) and (max-width: 63.999rem) {
		.cv-item:global(.nk-hide-tablet) {
			opacity: 0.45;
		}
	}
	@container nk-page (min-width: 64rem) {
		.cv-item:global(.nk-hide-desktop) {
			opacity: 0.45;
		}
	}

	@media (forced-colors: active) {
		.cv-item--selected {
			outline: 2px solid Highlight;
		}
	}
</style>
