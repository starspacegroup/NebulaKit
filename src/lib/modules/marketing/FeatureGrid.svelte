<!--
	FeatureGrid — what the product does, one card per feature. One column on a
	phone, two from 40rem, three from 64rem (`columns` caps the count). Each
	feature may carry an icon (the `icon` slot gets the feature) and a link.
-->
<script lang="ts">
	import { uid } from '$lib/ui/logic';

	export let features: {
		id?: string;
		title: string;
		text: string;
		href?: string;
		linkLabel?: string;
	}[] = [];
	/** Most columns on a wide screen. */
	export let columns: 1 | 2 | 3 = 3;
	export let title = '';
	export let level: 2 | 3 | 4 = 2;
	export let moreLabel = 'Learn more';

	const titleId = uid('features');
</script>

<section class="features" aria-labelledby={title ? titleId : undefined}>
	{#if title}
		<svelte:element this={`h${level}`} id={titleId} class="features__title">{title}</svelte:element>
	{/if}
	<ul class="features__grid features__grid--{columns}">
		{#each features as feature (feature.id ?? feature.title)}
			<li class="feature">
				{#if $$slots.icon}
					<span class="feature__icon" aria-hidden="true"><slot name="icon" {feature} /></span>
				{/if}
				<svelte:element this={`h${Math.min(level + 1, 6)}`} class="feature__title"
					>{feature.title}</svelte:element
				>
				<p class="feature__text">{feature.text}</p>
				{#if feature.href}
					<a class="feature__link" href={feature.href}
						>{feature.linkLabel ?? moreLabel}<span class="sr-only"> – {feature.title}</span></a
					>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.features {
		min-width: 0;
	}

	.features__title {
		margin: 0 0 var(--spacing-lg);
		font-size: 1.75rem;
	}

	.features__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.feature {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.feature__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 2.75rem;
		block-size: 2.75rem;
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-primary);
		font-size: 1.5rem;
	}

	.feature__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.feature__text {
		margin: 0;
		color: var(--color-text-secondary);
		line-height: 1.55;
	}

	.feature__link {
		display: inline-flex;
		align-items: center;
		min-block-size: 2.75rem;
		color: var(--color-primary);
		font-weight: 600;
	}

	@media (min-width: 40rem) {
		.features__grid--2,
		.features__grid--3 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 64rem) {
		.features__grid--3 {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
