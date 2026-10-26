<!--
	LogoCloud — "trusted by" logos in a plain wrapping grid (no marquee, so
	nothing moves). Every logo image has its company name as `alt`; a logo
	without a `src` falls back to the name as text.
-->
<script lang="ts">
	import { uid } from '$lib/ui/logic';

	export let logos: {
		name: string;
		src?: string;
		href?: string;
		width?: number;
		height?: number;
	}[] = [];
	export let title = 'Trusted by teams at';
	export let level: 2 | 3 | 4 = 2;
	/** Visually hide the heading but keep it for the outline. */
	export let hideTitle = false;

	const titleId = uid('logos');
</script>

<section class="cloud" aria-labelledby={titleId}>
	<svelte:element this={`h${level}`} id={titleId} class="cloud__title" class:sr-only={hideTitle}
		>{title}</svelte:element
	>
	<ul class="cloud__list">
		{#each logos as logo (logo.name)}
			<li class="cloud__item">
				{#if logo.href}
					<a class="cloud__link" href={logo.href}>
						{#if logo.src}
							<img src={logo.src} alt={logo.name} width={logo.width} height={logo.height} />
						{:else}{logo.name}{/if}
					</a>
				{:else if logo.src}
					<img src={logo.src} alt={logo.name} width={logo.width} height={logo.height} />
				{:else}
					<span class="cloud__word">{logo.name}</span>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.cloud {
		min-width: 0;
		text-align: center;
	}

	.cloud__title {
		margin: 0 0 var(--spacing-md);
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.cloud__list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: center;
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.cloud__item {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-block-size: 2.75rem;
	}

	.cloud__item img {
		max-inline-size: 100%;
		max-block-size: 2.5rem;
		object-fit: contain;
	}

	.cloud__link,
	.cloud__word {
		display: inline-flex;
		align-items: center;
		min-block-size: 2.75rem;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		font-weight: 700;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.cloud__link:hover {
		color: var(--color-text);
	}

	@media (min-width: 40rem) {
		.cloud__list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 64rem) {
		.cloud__list {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
