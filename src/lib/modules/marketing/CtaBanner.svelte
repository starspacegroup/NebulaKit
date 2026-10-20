<!--
	CtaBanner — one message and one or two actions, to close a page. A CTA with
	an `href` is a link; without one it is a button that fires `primary` /
	`secondary`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import { uid } from '$lib/ui/logic';

	export let title: string;
	export let text = '';
	export let primary: { label: string; href?: string } | undefined = undefined;
	export let secondary: { label: string; href?: string } | undefined = undefined;
	export let level: 2 | 3 | 4 = 2;

	const titleId = uid('cta');
	const dispatch = createEventDispatcher<{ primary: void; secondary: void }>();
</script>

<section class="cta" aria-labelledby={titleId}>
	<div class="cta__copy">
		<svelte:element this={`h${level}`} id={titleId} class="cta__title">{title}</svelte:element>
		{#if text}<p class="cta__text">{text}</p>{/if}
	</div>
	{#if primary || secondary}
		<div class="cta__actions">
			{#if primary}
				<Button size="lg" href={primary.href} on:click={() => !primary?.href && dispatch('primary')}
					>{primary.label}</Button
				>
			{/if}
			{#if secondary}
				<Button
					size="lg"
					variant="secondary"
					href={secondary.href}
					on:click={() => !secondary?.href && dispatch('secondary')}>{secondary.label}</Button
				>
			{/if}
		</div>
	{/if}
</section>

<style>
	.cta {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
		padding: var(--spacing-xl) var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}

	.cta__copy {
		min-width: 0;
	}

	.cta__title {
		margin: 0;
		font-size: 1.5rem;
		overflow-wrap: anywhere;
	}

	.cta__text {
		margin: var(--spacing-sm) 0 0;
		color: var(--color-text-secondary);
	}

	.cta__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
	}

	@media (min-width: 48rem) {
		.cta {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			padding: var(--spacing-xl);
		}
	}
</style>
