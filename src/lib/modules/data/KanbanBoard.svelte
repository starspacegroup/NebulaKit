<!--
	KanbanBoard — columns of cards you can move by pointer, touch or keyboard.

	Pointer and touch use `$lib/actions/draggable`; the keyboard path is the same
	action (focus a card's grip, Space to pick up, arrows to move, Space to drop,
	Escape to cancel) plus Alt+arrows on the grip for a one-press move, plus a
	"Move" menu on every card that lists each destination in words. Every move is
	announced in a live region. A column with a WIP limit refuses a card from
	another column when full (and says so in text, not just colour). Bind `cards`.

	<KanbanBoard label="Sprint" {columns} bind:cards on:move={…} />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { draggable, dropzone, type DropDetail } from '$lib/actions/draggable';
	import { uid } from '$lib/ui/logic';
	import ActionMenu from './parts/ActionMenu.svelte';
	import {
		addCard,
		columnCards,
		moveAnnouncement,
		moveCard,
		moveMenuItems,
		removeCard,
		stepCard,
		wipStatus,
		wipText,
		type KanbanCard,
		type KanbanColumn,
		type MoveResult,
		type StepDirection
	} from './kanban-logic';

	export let label: string;
	export let columns: KanbanColumn[] = [];
	export let cards: KanbanCard[] = [];
	/** Heading level of the column titles. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;
	export let addable = true;
	export let removable = true;
	/** Two boards on one page must differ, so a drag never crosses them. */
	export let board: string = uid('kanban');
	export let newId: () => string = () => uid('card');
	export let copy = {
		addCard: 'Add card',
		cardTitle: 'Card title',
		add: 'Add',
		cancel: 'Cancel',
		grip: 'Move card',
		moveMenu: 'Move',
		remove: 'Delete card',
		emptyColumn: 'No cards',
		atLimit: 'At limit',
		overLimit: 'Over limit',
		limit: 'Limit'
	};

	const dispatch = createEventDispatcher<{
		change: { cards: KanbanCard[] };
		move: { id: string; from: string; to: string; position: number };
		add: { card: KanbanCard };
		remove: { id: string };
	}>();

	const idBase = uid('kb');
	let announcement = '';
	let adding: string | null = null;
	let draft = '';
	let error = '';
	let root: HTMLElement;

	$: heading = `h${level}`;
	$: byColumn = Object.fromEntries(columns.map((c) => [c.id, columnCards(cards, c.id)])) as Record<
		string,
		KanbanCard[]
	>;

	function apply(result: MoveResult<KanbanCard>, card: KanbanCard | undefined, from: string) {
		announcement = moveAnnouncement(card?.title ?? '', result);
		if (!result.moved || !card) return false;
		cards = result.cards;
		dispatch('change', { cards });
		dispatch('move', {
			id: card.id,
			from,
			to: result.column?.id ?? from,
			position: result.position ?? 0
		});
		return true;
	}

	function onDrop(detail: DropDetail) {
		const card = cards.find((c) => c.id === detail.id);
		apply(
			moveCard(cards, columns, detail.id, detail.toGroup, detail.toIndex),
			card,
			detail.fromGroup
		);
	}

	async function refocus(id: string) {
		await tick();
		root?.querySelector<HTMLElement>(`[data-card-grip="${id}"]`)?.focus();
	}

	async function step(card: KanbanCard, direction: StepDirection) {
		if (apply(stepCard(cards, columns, card.id, direction), card, card.group))
			await refocus(card.id);
		else announcement = moveAnnouncement(card.title, { moved: false });
	}

	async function onMenu(card: KanbanCard, action: string) {
		if (action === 'remove') {
			cards = removeCard(cards, card.id);
			announcement = `${card.title} deleted.`;
			dispatch('change', { cards });
			dispatch('remove', { id: card.id });
			return;
		}
		if (action === 'up' || action === 'down') return step(card, action);
		const to = action.slice('to:'.length);
		const size = (byColumn[to] ?? []).length;
		if (apply(moveCard(cards, columns, card.id, to, size), card, card.group))
			await refocus(card.id);
	}

	function onGripKey(event: KeyboardEvent, card: KanbanCard) {
		if (!event.altKey) return;
		const map: Record<string, StepDirection> = {
			ArrowUp: 'up',
			ArrowDown: 'down',
			ArrowLeft: 'left',
			ArrowRight: 'right'
		};
		const direction = map[event.key];
		if (!direction) return;
		event.preventDefault();
		event.stopPropagation();
		step(card, direction);
	}

	async function openAdd(columnId: string) {
		adding = columnId;
		draft = '';
		error = '';
		await tick();
		root.querySelector<HTMLElement>(`#${idBase}-new-${columnId} input`)?.focus();
	}

	async function closeAdd() {
		const was = adding;
		adding = null;
		await tick();
		root.querySelector<HTMLElement>(`[data-add="${was}"]`)?.focus();
	}

	function submitAdd(columnId: string) {
		const result = addCard(cards, columns, columnId, draft, newId());
		error = result.error;
		if (result.error || !result.card) return;
		cards = result.cards;
		announcement = `${result.card.title} added to ${columns.find((c) => c.id === columnId)?.title}.`;
		draft = '';
		dispatch('change', { cards });
		dispatch('add', { card: result.card });
	}

	function onAddKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeAdd();
		}
	}

	function limitText(count: number, limit: number | undefined) {
		const status = wipStatus(count, limit);
		if (status === 'over') return copy.overLimit;
		return status === 'at' ? copy.atLimit : '';
	}
</script>

<section class="kanban" aria-label={label} bind:this={root}>
	<div class="kanban__columns">
		{#each columns as column (column.id)}
			{@const list = byColumn[column.id] ?? []}
			{@const status = wipStatus(list.length, column.limit)}
			<section
				class="kanban__column kanban__column--{status}"
				aria-labelledby="{idBase}-{column.id}"
			>
				<header class="kanban__head">
					<svelte:element this={heading} id="{idBase}-{column.id}" class="kanban__title">
						{column.title}
					</svelte:element>
					<span class="kanban__count">
						<span class="sr-only">{copy.limit}: </span>{wipText(list.length, column.limit)}
						{#if limitText(list.length, column.limit)}
							<strong class="kanban__flag">{limitText(list.length, column.limit)}</strong>
						{/if}
					</span>
				</header>

				<ul class="kanban__list" use:dropzone={{ group: column.id, board }}>
					{#each list as card (card.id)}
						<li
							class="kanban__card"
							use:draggable={{
								id: card.id,
								group: column.id,
								board,
								label: card.title,
								onDrop
							}}
						>
							<div class="kanban__cardhead">
								<button
									type="button"
									class="kanban__grip"
									data-drag-handle
									data-card-grip={card.id}
									aria-label="{copy.grip}: {card.title}"
									on:keydown={(e) => onGripKey(e, card)}><span aria-hidden="true">⠿</span></button
								>
								<span class="kanban__cardtitle">{card.title}</span>
								<ActionMenu
									label="{copy.moveMenu}: {card.title}"
									items={[
										...moveMenuItems(cards, columns, card.id),
										...(removable ? [{ id: 'remove', label: copy.remove, danger: true }] : [])
									]}
									on:select={(e) => onMenu(card, e.detail.id)}
								/>
							</div>
							{#if card.description}<p class="kanban__desc">{card.description}</p>{/if}
							{#if card.tags?.length}
								<ul class="kanban__tags" aria-label="Tags">
									{#each card.tags as tag (tag)}<li>{tag}</li>{/each}
								</ul>
							{/if}
						</li>
					{:else}
						<li class="kanban__empty">{copy.emptyColumn}</li>
					{/each}
				</ul>

				{#if addable}
					{#if adding === column.id}
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<form
							id="{idBase}-new-{column.id}"
							class="kanban__form"
							on:submit|preventDefault={() => submitAdd(column.id)}
							on:keydown={onAddKey}
						>
							<label class="kanban__label">
								{copy.cardTitle}
								<input
									type="text"
									bind:value={draft}
									autocomplete="off"
									aria-invalid={error ? 'true' : undefined}
									aria-describedby={error ? `${idBase}-err` : undefined}
								/>
							</label>
							{#if error}<p id="{idBase}-err" class="kanban__error" role="alert">{error}</p>{/if}
							<div class="kanban__buttons">
								<button type="submit" class="kanban__primary">{copy.add}</button>
								<button type="button" class="kanban__btn" on:click={closeAdd}>{copy.cancel}</button>
							</div>
						</form>
					{:else}
						<button
							type="button"
							class="kanban__btn kanban__addbtn"
							data-add={column.id}
							aria-label="{copy.addCard}: {column.title}"
							on:click={() => openAdd(column.id)}>+ {copy.addCard}</button
						>
					{/if}
				{/if}
			</section>
		{/each}
	</div>
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</section>

<style>
	.kanban {
		min-width: 0;
	}

	.kanban__columns {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.kanban__column {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.kanban__column--over {
		border-color: var(--color-danger);
		border-width: 2px;
	}

	.kanban__column--at {
		border-style: dashed;
	}

	.kanban__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.kanban__title {
		margin: 0;
		font-size: 1rem;
	}

	.kanban__count {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.kanban__flag {
		margin-inline-start: var(--spacing-xs);
		color: var(--color-text);
	}

	.kanban__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		align-content: start;
		min-height: 3.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.kanban__card {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-sm);
	}

	.kanban__cardhead {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.kanban__cardtitle {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.kanban__grip {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		min-width: 2.75rem;
		min-height: 2.75rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		cursor: grab;
	}

	.kanban__grip:hover {
		background: var(--color-surface-hover);
	}

	.kanban__desc {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.kanban__tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.75rem;
	}

	.kanban__tags li {
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
	}

	.kanban__empty {
		padding: var(--spacing-md);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-align: center;
	}

	.kanban__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.kanban__label {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.kanban__label input {
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.kanban__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.kanban__buttons {
		display: flex;
		gap: var(--spacing-sm);
	}

	.kanban__btn,
	.kanban__primary {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.kanban__primary {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.kanban__btn:hover {
		background: var(--color-surface-hover);
	}

	.kanban__addbtn {
		justify-self: stretch;
		border-style: dashed;
	}

	.kanban__grip:focus-visible,
	.kanban__btn:focus-visible,
	.kanban__primary:focus-visible,
	.kanban__label input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (min-width: 48rem) {
		.kanban__columns {
			grid-auto-flow: column;
			grid-auto-columns: minmax(16rem, 1fr);
			overflow-x: auto;
			padding-block-end: var(--spacing-sm);
		}
	}
</style>
