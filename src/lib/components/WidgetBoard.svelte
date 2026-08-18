<!--
	WidgetBoard — a drag-and-drop board of widgets in columns.

	The board owns no state. It takes a layout, renders it, and reports a new one
	through `on:change`; where that layout is persisted is the app's business.
	Add `bind:widgets` to keep a parent's copy in step.

	```svelte
	<WidgetBoard
		bind:widgets
		columns={[{ id: 'left' }, { id: 'right' }]}
		on:change={(e) => save(e.detail.widgets)}
	>
		<svelte:fragment slot="actions" let:widget>
			<button on:click={() => remove(widget.id)}>Remove</button>
		</svelte:fragment>
	</WidgetBoard>
	```

	A widget with a value that changes on a timer dispatches `live` instead of
	writing to its own title; the board forwards that as `on:live`, and the app
	feeds it back through the `live` prop. Persisted state never moves.

	Registering a widget type never means editing this file: add a manifest entry
	in `$lib/widgets/manifest.ts` and a component in `$lib/widgets/index.ts`.

	Ordering lives in `$lib/utils/reorder`, dragging in `$lib/actions/draggable`,
	and the ghost/indicator styling in `src/app.css`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { draggable, dropzone, type DropDetail } from '$lib/actions/draggable';
	import { reorder } from '$lib/utils/reorder';
	import { getWidgetComponent } from '$lib/widgets';
	import { getWidgetDefinition } from '$lib/widgets/manifest';
	import type { BoardColumn, BoardWidget } from '$lib/widgets/types';

	/** The layout. Reassigned in place on a successful drop, so `bind:` works. */
	export let widgets: BoardWidget[] = [];
	/** Columns, left to right. Ids are referenced by `BoardWidget.group`. */
	export let columns: BoardColumn[] = [];
	/**
	 * Volatile, display-only titles keyed by widget id.
	 *
	 * A widget with a live value — a price, a clock, a connection count — writes
	 * it here rather than into `widget.title`, because `widget.title` is
	 * persisted: a value that changes on a timer would rewrite the whole layout
	 * on every tick.
	 */
	export let live: Record<string, string> = {};
	/** Set false to render a read-only board with no drag handles. */
	export let editable = true;
	/** Shown in a column with nothing in it. */
	export let emptyMessage = 'Nothing here yet';
	/** Distinguishes two boards on one page; drags never cross boards. */
	export let board = 'widget-board';

	const dispatch = createEventDispatcher<{
		change: { widgets: BoardWidget[] };
		live: { id: string; value: string };
	}>();

	/*
	 * Everything the template needs is derived here rather than by calling a
	 * helper from the markup. A `{@const title = titleOf(widget)}` re-runs only
	 * when something it *names* changes, so a live title would arrive, update
	 * `live`, and never reach the screen. Deriving it in a reactive block names
	 * `live` where Svelte can see it.
	 */
	$: byColumn = columns.map((column) => ({
		column,
		items: widgets
			.filter((widget) => widget.group === column.id)
			.sort((a, b) => a.order - b.order)
			.map((widget) => ({
				widget,
				title: titleOf(widget, live),
				props: propsOf(widget),
				component: getWidgetComponent(widget.type)
			}))
	}));

	function titleOf(widget: BoardWidget, titles: Record<string, string>): string {
		return (
			titles[widget.id] ?? widget.title ?? getWidgetDefinition(widget.type)?.label ?? widget.type
		);
	}

	function propsOf(widget: BoardWidget): Record<string, unknown> {
		return { ...getWidgetDefinition(widget.type)?.defaultProps, ...widget.props };
	}

	function handleDrop(detail: DropDetail) {
		const next = reorder(widgets, detail.id, detail.toGroup, detail.toIndex);
		// `reorder` returns the same array when the drop changed nothing, which is
		// what keeps an idle board from writing to storage.
		if (next === widgets) return;
		widgets = next;
		dispatch('change', { widgets: next });
	}
</script>

<div class="widget-board" style:--widget-board-columns={columns.length} data-board={board}>
	{#each byColumn as { column, items } (column.id)}
		<section class="widget-board__column">
			{#if column.title}
				<h2 class="widget-board__column-title">{column.title}</h2>
			{/if}

			<div class="widget-board__zone" use:dropzone={{ group: column.id, board }}>
				{#each items as { widget, title, props, component } (widget.id)}
					<article
						class="widget"
						use:draggable={{
							id: widget.id,
							group: column.id,
							board,
							label: title,
							disabled: !editable,
							onDrop: handleDrop
						}}
					>
						<header class="widget__header">
							{#if editable}
								<button
									type="button"
									class="widget__handle"
									data-drag-handle
									aria-label={`Move ${title}`}
								>
									<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
										<circle cx="2" cy="2" r="1.4" /><circle cx="8" cy="2" r="1.4" />
										<circle cx="2" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" />
										<circle cx="2" cy="14" r="1.4" /><circle cx="8" cy="14" r="1.4" />
									</svg>
								</button>
							{/if}
							<h3 class="widget__title">{title}</h3>
							<slot name="actions" {widget} />
						</header>

						<div class="widget__body">
							{#if component}
								<svelte:component
									this={component}
									{...props}
									on:live={(event) => dispatch('live', { id: widget.id, value: event.detail })}
								/>
							{:else}
								<p class="widget__unregistered">
									Widget type <code>{widget.type}</code> is not registered.
								</p>
							{/if}
						</div>
					</article>
				{:else}
					<p class="widget-board__empty">{emptyMessage}</p>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	/* One column on a phone; the configured number once there is room for them. */
	.widget-board {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-lg);
		align-items: start;
	}

	@media (min-width: 48rem) {
		.widget-board {
			grid-template-columns: repeat(var(--widget-board-columns, 1), minmax(0, 1fr));
		}
	}

	.widget-board__column {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.widget-board__column-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}

	/*
	 * The zone, not the column, is the drop target, and it keeps a minimum height
	 * so an empty column can still be dropped into — an empty column you cannot
	 * fill is the most common way a board like this feels broken.
	 */
	.widget-board__zone {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		min-height: 6rem;
	}

	.widget-board__empty {
		display: grid;
		place-items: center;
		margin: 0;
		padding: var(--spacing-lg);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-align: center;
	}

	.widget {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		overflow: hidden;
	}

	/*
	 * The header is chrome, not content, and it is what a finger lands on when it
	 * misses the handle. Leaving it selectable is what turns "hold to drag" into
	 * iOS selecting the widget's title and offering to search Google for it. The
	 * body stays selectable — a stat you cannot copy is its own annoyance.
	 */
	.widget__header {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.widget__title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.widget__handle {
		display: grid;
		place-items: center;
		padding: var(--spacing-xs);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text-secondary);
		fill: currentColor;
		transition: color var(--transition-fast);
	}

	.widget__handle:hover,
	.widget__handle:focus-visible {
		color: var(--color-primary);
	}

	/*
	 * Six dots is a 10x16 target — fine for a cursor, far under the ~44px a
	 * fingertip needs. On a touch device the press lands next to it instead, which
	 * is how a drag becomes a text selection. Grow the target, not the icon.
	 */
	@media (pointer: coarse) {
		.widget__handle {
			min-width: 2.75rem;
			min-height: 2.75rem;
			margin: calc(var(--spacing-xs) * -1) 0;
		}
	}

	.widget__body {
		padding: var(--spacing-md);
		color: var(--color-text);
	}

	.widget__unregistered {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
