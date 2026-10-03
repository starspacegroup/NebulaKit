<!--
	Container — the page-width wrapper. Centres its content at a max width
	(sm 40rem, md 48rem, lg 64rem, xl 80rem, full) with gutters that grow on
	wider screens. Render it as any landmark with `as`. The class is
	`layout-container`, apart from app.css's global `.container` utility.
-->
<script lang="ts">
	import { containerMaxWidth } from './layout-logic';

	export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'lg';
	export let as: 'div' | 'main' | 'section' | 'article' | 'header' | 'footer' = 'div';

	$: maxWidth = containerMaxWidth(size);
</script>

<svelte:element this={as} class="layout-container" style="max-width: {maxWidth}">
	<slot />
</svelte:element>

<style>
	.layout-container {
		box-sizing: border-box;
		width: 100%;
		margin-inline: auto;
		padding-inline: var(--spacing-md);
	}

	@media (min-width: 640px) {
		.layout-container {
			padding-inline: var(--spacing-lg);
		}
	}

	@media (min-width: 1024px) {
		.layout-container {
			padding-inline: var(--spacing-xl);
		}
	}
</style>
