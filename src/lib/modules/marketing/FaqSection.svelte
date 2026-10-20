<!--
	FaqSection — questions as an accordion, with a search box that filters them.

	Each question is a heading containing a button (`aria-expanded`,
	`aria-controls`). After a search a polite live region says how many match,
	or that none do. `open` holds the ids of the open answers; `single` keeps
	at most one open.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import { uid } from '$lib/ui/logic';
	import { filterFaq, resultsAnnouncement, toggleFaqOpen, type FaqItem } from './logic';

	export let items: FaqItem[] = [];
	export let title = 'Frequently asked questions';
	export let level: 2 | 3 | 4 = 2;
	export let searchable = true;
	export let single = false;
	export let query = '';
	export let open: string[] = [];
	export let labels = {
		search: 'Search questions',
		placeholder: 'Search',
		none: (q: string) => `No questions match "${q}".`,
		some: (n: number) => `${n} ${n === 1 ? 'question matches' : 'questions match'}.`,
		clear: 'Clear search'
	};

	const base = uid('faq');
	const dispatch = createEventDispatcher<{ toggle: { id: string; open: boolean } }>();

	$: keyed = items.map((item, i) => ({ ...item, key: item.id ?? `${base}-q${i}` }));
	$: shownItems = filterFaq(keyed, query);
	$: announcement = resultsAnnouncement(shownItems.length, query, {
		none: labels.none,
		some: labels.some
	});

	function toggle(id: string) {
		open = toggleFaqOpen(open, id, single);
		dispatch('toggle', { id, open: open.includes(id) });
	}
</script>

<section class="faq" aria-labelledby="{base}-title">
	<svelte:element this={`h${level}`} id="{base}-title" class="faq__title">{title}</svelte:element>

	{#if searchable}
		<div class="faq__search">
			<TextInput
				type="search"
				label={labels.search}
				placeholder={labels.placeholder}
				bind:value={query}
			/>
		</div>
	{/if}

	<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

	{#if shownItems.length === 0}
		<p class="faq__none">{labels.none(query.trim())}</p>
	{:else}
		<ul class="faq__list">
			{#each shownItems as item (item.key)}
				{@const isOpen = open.includes(item.key)}
				<li class="q">
					<svelte:element this={`h${Math.min(level + 1, 6)}`} class="q__heading">
						<button
							type="button"
							class="q__button"
							aria-expanded={isOpen}
							aria-controls="{item.key}-a"
							on:click={() => toggle(item.key)}
						>
							<span>{item.question}</span>
							<span class="q__icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
						</button>
					</svelte:element>
					<div id="{item.key}-a" class="q__answer" hidden={!isOpen}>
						<p>{item.answer}</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.faq {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.faq__title {
		margin: 0;
		font-size: 1.75rem;
	}

	.faq__none {
		margin: 0;
		padding: var(--spacing-lg);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		text-align: center;
	}

	.faq__list {
		margin: 0;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		list-style: none;
		overflow: hidden;
	}

	.q + .q {
		border-block-start: 1px solid var(--color-border);
	}

	.q__heading {
		margin: 0;
		font-size: 1rem;
	}

	.q__button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		inline-size: 100%;
		min-block-size: 2.75rem;
		padding: var(--spacing-md);
		border: 0;
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		text-align: start;
		cursor: pointer;
	}

	.q__button:hover {
		background: var(--color-surface-hover);
	}

	.q__button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.q__icon {
		flex: none;
		font-size: 1.25rem;
	}

	.q__answer {
		padding: 0 var(--spacing-md) var(--spacing-md);
		background: var(--color-background);
		color: var(--color-text-secondary);
		line-height: 1.6;
	}

	.q__answer[hidden] {
		display: none;
	}

	.q__answer p {
		margin: 0;
	}
</style>
