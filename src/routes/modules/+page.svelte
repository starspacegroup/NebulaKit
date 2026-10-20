<!--
	/modules — the composed blocks every app kit should have, running.

	Each demo is the real module from $lib/modules, wired to fake local data,
	with the accessibility promise it keeps and the code underneath. The list
	comes from $lib/modules/catalog.ts, and a test fails if a module is added
	without an entry there.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { MODULE_GROUPS, moduleCatalog, type ModuleGroup } from '$lib/modules/catalog';
	import { site } from '$lib/site.config';
	import Account from './groups/Account.svelte';
	import Commerce from './groups/Commerce.svelte';
	import Data from './groups/Data.svelte';
	import Marketing from './groups/Marketing.svelte';
	import Settings from './groups/Settings.svelte';
	import Shell from './groups/Shell.svelte';
	import ModulesSidebar from './ModulesSidebar.svelte';

	// One demo file per group, so each keeps its own state and imports.
	const demos: Record<ModuleGroup, typeof Account> = {
		Account,
		Settings,
		Marketing,
		'App shell': Shell,
		'Data & teams': Data,
		Commerce
	};

	// Prefixed so a group ("App shell") never shares an id with a module of the same name.
	const groupId = (group: string) =>
		'group-' +
		group
			.toLowerCase()
			.replace(/&/g, 'and')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	const inGroup = (group: string) => moduleCatalog.filter((e) => e.group === group);
	const sidebarGroups = MODULE_GROUPS.map((g) => ({
		id: groupId(g),
		title: g,
		items: inGroup(g).map((e) => ({ id: e.id, name: e.name }))
	}));
</script>

<SharingMeta
	title="Modules"
	description={`${moduleCatalog.length} ready-made modules in ${site.name}: sign-in, settings, pricing, data grids, kanban, billing and more. Mobile-first, themed, keyboard- and screen-reader-ready, with the code for each.`}
	url={`${site.url}/modules`}
/>

<div class="catalog">
	<header class="catalog__header">
		<p class="eyebrow">Module library</p>
		<h1>The blocks every app ends up building</h1>
		<p class="lede">
			{moduleCatalog.length} modules in {MODULE_GROUPS.length} groups. Each is built from the
			<a href="/components">component kit</a>, takes its data and copy as props, emits events, and
			never fetches. Mobile first at 320px, themed with CSS variables in light, dark and forced
			colors, and usable by keyboard and screen reader. Import from <code>$lib/modules</code>.
		</p>
		<p class="lede lede--free">
			Every one is free and MIT-licensed. The demos below run on fake local data, so nothing you
			type leaves this page.
		</p>
		<nav aria-label="Module groups" class="catalog__nav">
			{#each MODULE_GROUPS as group (group)}
				<a href="#{groupId(group)}">{group} <span>{inGroup(group).length}</span></a>
			{/each}
		</nav>
	</header>

	<div class="catalog__body">
		<ModulesSidebar groups={sidebarGroups} />
		<div class="catalog__main">
			{#each MODULE_GROUPS as group (group)}
				<section class="group" id={groupId(group)} aria-labelledby="{groupId(group)}-title">
					<h2 id="{groupId(group)}-title">{group}</h2>
					<div class="list">
						<svelte:component this={demos[group]} />
					</div>
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.catalog {
		width: 100%;
		max-width: var(--layout-page-max-width);
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
		margin: 0 0 var(--spacing-md);
		color: var(--color-text-secondary);
		font-size: 1.125rem;
		line-height: 1.6;
	}

	.lede a {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.lede--free {
		margin-bottom: var(--spacing-lg);
		color: var(--color-text);
		font-weight: 600;
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
		min-height: 2.75rem;
		padding: 0.375rem 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text);
		font-size: 0.875rem;
		text-decoration: none;
	}

	.catalog__nav a:hover {
		border-color: var(--color-primary);
	}

	.catalog__nav a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.catalog__nav span {
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.catalog__body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.catalog__main {
		min-width: 0;
	}

	@media (min-width: 64rem) {
		.catalog__body {
			grid-template-columns: 16rem minmax(0, 1fr);
			gap: var(--spacing-xl);
		}
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

	/* One per row on a phone. */
	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xl);
	}

	/* Wide modules keep a whole row; the compact ones sit two, then three on very wide screens, to a row. */
	@media (min-width: 64rem) {
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.list :global(.module-item--wide) {
			grid-column: 1 / -1;
		}
	}

	@media (min-width: 120rem) {
		.list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.list :global(.stack) {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		width: 100%;
	}

	.list :global(.row) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-md);
		width: 100%;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}
	}
</style>
