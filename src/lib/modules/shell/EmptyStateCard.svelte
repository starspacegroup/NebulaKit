<!--
	EmptyStateCard — what a list or page shows when it has nothing to show,
	with presets for the three situations that need different words: `no-data`
	(nothing yet), `no-results` (a search or filter matched nothing — pass the
	`query` and it is quoted back) and `first-run` (a brand-new account). It
	always offers a next step: a primary call to action and an optional
	secondary one. Actions with an `href` are links; the rest fire
	`on:action` (`{ id }`). The title is a heading at your `level`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button, uid } from '$lib/ui';
	import { resolveEmptyCopy, type EmptyKind } from './logic';

	export let kind: EmptyKind = 'no-data';
	export let title = '';
	export let description = '';
	/** What was searched for, quoted into the "no results" description. */
	export let query = '';
	/** 1 to 6: the heading level of the title. */
	export let level: 2 | 3 | 4 | 5 | 6 = 2;
	/** An emoji or character that replaces the preset's icon. */
	export let icon = '';
	export let action: { id?: string; label: string; href?: string } | undefined = undefined;
	export let secondaryAction: { id?: string; label: string; href?: string } | undefined = undefined;

	const dispatch = createEventDispatcher<{ action: { id: string } }>();
	const id = uid('empty-card');

	$: copy = resolveEmptyCopy(kind, { title, description, query });
</script>

<section class="empty-card empty-card--{kind}" aria-labelledby="{id}-title">
	<div class="empty-card__icon" aria-hidden="true">{icon || copy.icon}</div>
	<svelte:element this={`h${level}`} class="empty-card__title" id="{id}-title"
		>{copy.title}</svelte:element
	>
	<p class="empty-card__description">{copy.description}</p>
	{#if action || secondaryAction}
		<div class="empty-card__actions">
			{#if action}
				<Button
					href={action.href}
					on:click={() => dispatch('action', { id: action?.id ?? 'primary' })}
					>{action.label}</Button
				>
			{/if}
			{#if secondaryAction}
				<Button
					variant="secondary"
					href={secondaryAction.href}
					on:click={() => dispatch('action', { id: secondaryAction?.id ?? 'secondary' })}
					>{secondaryAction.label}</Button
				>
			{/if}
		</div>
	{/if}
</section>

<style>
	.empty-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-xl, var(--spacing-lg)) var(--spacing-lg);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		text-align: center;
	}

	.empty-card--first-run {
		border-style: solid;
		border-color: var(--color-primary);
	}

	.empty-card__icon {
		font-size: 2.5rem;
		line-height: 1;
	}

	.empty-card__title {
		margin: 0;
		font-size: 1.25rem;
		overflow-wrap: anywhere;
	}

	.empty-card__description {
		max-width: 40ch;
		margin: 0;
		color: var(--color-text-secondary);
		overflow-wrap: anywhere;
	}

	.empty-card__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
	}

	.empty-card__actions :global(.btn) {
		min-height: 44px;
	}
</style>
