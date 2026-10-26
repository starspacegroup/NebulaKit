<!--
	Hero — headline, lede and up to two calls to action, with a slot for media.
	`layout="split"` puts the media beside the copy from 48rem up; below that
	(and when centered) everything stacks. A CTA with an `href` is a link, one
	without is a button that fires `primary` / `secondary`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import { uid } from '$lib/ui/logic';

	export let title: string;
	export let lede = '';
	export let eyebrow = '';
	export let primary: { label: string; href?: string } | undefined = undefined;
	export let secondary: { label: string; href?: string } | undefined = undefined;
	export let layout: 'centered' | 'split' = 'centered';
	/** Heading level. A page's hero is normally the h1. */
	export let level: 1 | 2 | 3 = 1;

	const titleId = uid('hero');
	const dispatch = createEventDispatcher<{ primary: void; secondary: void }>();
</script>

<section class="hero hero--{layout}" aria-labelledby={titleId}>
	<div class="hero__copy">
		{#if eyebrow}<p class="hero__eyebrow">{eyebrow}</p>{/if}
		<svelte:element this={`h${level}`} id={titleId} class="hero__title">{title}</svelte:element>
		{#if lede}<p class="hero__lede">{lede}</p>{/if}
		{#if primary || secondary}
			<div class="hero__actions">
				{#if primary}
					<Button
						size="lg"
						href={primary.href}
						on:click={() => !primary?.href && dispatch('primary')}>{primary.label}</Button
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
	</div>
	{#if $$slots.media}
		<div class="hero__media"><slot name="media" /></div>
	{/if}
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xl);
		min-width: 0;
		padding: var(--spacing-2xl) var(--spacing-md);
		color: var(--color-text);
	}

	.hero__copy,
	.hero__media {
		min-width: 0;
	}

	.hero--centered {
		justify-items: center;
		text-align: center;
	}

	.hero--centered .hero__copy {
		max-inline-size: 48rem;
	}

	.hero--centered .hero__actions {
		justify-content: center;
	}

	.hero__eyebrow {
		margin: 0 0 var(--spacing-sm);
		color: var(--color-primary);
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.hero__title {
		margin: 0;
		font-size: clamp(1.75rem, 6vw + 0.5rem, 3.5rem);
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.hero__lede {
		margin: var(--spacing-md) 0 0;
		color: var(--color-text-secondary);
		font-size: 1.125rem;
		line-height: 1.6;
	}

	.hero__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
		margin-block-start: var(--spacing-lg);
	}

	.hero__media :global(img),
	.hero__media :global(svg),
	.hero__media :global(video) {
		max-inline-size: 100%;
		block-size: auto;
	}

	@media (min-width: 48rem) {
		.hero {
			padding: 4rem var(--spacing-xl);
		}

		.hero--split {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: center;
		}
	}
</style>
