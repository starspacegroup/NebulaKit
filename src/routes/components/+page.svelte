<!--
	/components — every standard element and widget in the kit, running.

	Each demo is the real component from $lib/ui or $lib/widgets, with the code
	that produced it underneath. The list comes from $lib/ui/catalog.ts, and a
	test fails if a component or widget is added without an entry there.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { site } from '$lib/site.config';
	import { CATALOG_GROUPS, catalog, type CatalogGroup } from '$lib/ui/catalog';
	import Actions from './groups/Actions.svelte';
	import DataDisplay from './groups/DataDisplay.svelte';
	import Feedback from './groups/Feedback.svelte';
	import Forms from './groups/Forms.svelte';
	import Navigation from './groups/Navigation.svelte';
	import Overlays from './groups/Overlays.svelte';
	import Widgets from './groups/Widgets.svelte';

	// One demo file per group, so each keeps its own state and imports.
	const demos: Record<CatalogGroup, typeof Actions> = {
		Actions,
		Forms,
		Feedback,
		Overlays,
		Navigation,
		'Data display': DataDisplay,
		Widgets
	};

	const groupId = (group: string) => group.toLowerCase().replace(/\s+/g, '-');
	const inGroup = (group: string) => catalog.filter((e) => e.group === group);
</script>

<SharingMeta
	title="Components"
	description={`Every standard element and widget in ${site.name}, running: forms, buttons, dialogs, tabs, tables, toasts and dashboard widgets, with the code for each.`}
	url={`${site.url}/components`}
/>

<div class="catalog">
	<header class="catalog__header">
		<p class="eyebrow">Component catalog</p>
		<h1>Every standard element, running</h1>
		<p class="lede">
			{catalog.filter((e) => e.group !== 'Widgets').length} elements and
			{inGroup('Widgets').length} widgets, all themed with CSS variables, all usable by keyboard, all
			in light and dark. Import from <code>$lib/ui</code>; register widgets in
			<code>$lib/widgets</code>.
		</p>
		<nav aria-label="Catalog sections" class="catalog__nav">
			{#each CATALOG_GROUPS as group (group)}
				<a href="#{groupId(group)}">{group} <span>{inGroup(group).length}</span></a>
			{/each}
		</nav>
	</header>

	{#each CATALOG_GROUPS as group (group)}
		<section class="group" id={groupId(group)} aria-labelledby="{groupId(group)}-title">
			<h2 id="{groupId(group)}-title">{group}</h2>
			<div class="grid">
				<svelte:component this={demos[group]} />
			</div>
			{#if group === 'Widgets'}
				<p class="note note--after">
					Widgets render inside the drag-and-drop <code>&lt;WidgetBoard&gt;</code>. Each is one
					manifest entry and one registry line in <code>$lib/widgets</code>; see the documentation
					for the board.
				</p>
			{/if}
		</section>
	{/each}
</div>

<style>
	.catalog {
		width: 100%;
		max-width: 90rem;
		margin: 0 auto;
		padding: var(--spacing-2xl) var(--spacing-md);
		box-sizing: border-box;
	}

	@media (min-width: 768px) {
		.catalog {
			padding-inline: var(--spacing-xl);
		}
	}

	.catalog__header {
		max-width: 48rem;
		margin-bottom: var(--spacing-2xl);
	}

	.eyebrow {
		margin: 0 0 var(--spacing-sm);
		color: var(--color-primary);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0 0 var(--spacing-md);
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 0 0 var(--spacing-lg);
		color: var(--color-text-secondary);
		font-size: 1.125rem;
		line-height: 1.6;
	}

	.catalog__nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.catalog__nav a {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text);
		font-size: 0.875rem;
		text-decoration: none;
	}

	.catalog__nav a:hover {
		border-color: var(--color-primary);
	}

	.catalog__nav span {
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.group {
		margin-bottom: var(--spacing-2xl);
		scroll-margin-top: 5rem;
	}

	h2 {
		margin: 0 0 var(--spacing-lg);
		padding-bottom: var(--spacing-sm);
		border-bottom: 1px solid var(--color-border);
		font-size: 1.5rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: var(--spacing-lg);
	}

	.grid :global(.stack) {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		width: 100%;
	}

	.grid :global(.row) {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		width: 100%;
	}

	.grid :global(.grow) {
		flex: 1;
	}

	.grid :global(.cards) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: var(--spacing-md);
		width: 100%;
	}

	.grid :global(.widget) {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.catalog :global(.note) {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.note--after {
		margin-top: var(--spacing-lg);
	}

	.grid :global(input[type='color']) {
		width: 4rem;
		height: 2.5rem;
		padding: 0.125rem;
	}
</style>
