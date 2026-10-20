<!--
	NavigationMenu — a site's top navigation: plain links, and items that open
	a panel of links with descriptions. It is the APG disclosure navigation,
	not an ARIA menu, so links stay links. Enter, Space or Down opens a panel
	(Down also moves into it); Up, Down, Home and End move inside it; Escape
	closes it and returns focus to its button; Left and Right move along the
	top row. One panel is open at a time, and it closes on a click outside or
	when focus leaves the navigation. On a narrow screen the row stacks.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { nextIndex, uid } from './logic';
	import { containsCurrent, disclosureKey, isCurrent } from './layout-logic';

	interface NavLink {
		label: string;
		href: string;
		description?: string;
	}

	export let items: { id: string; label: string; href?: string; links?: NavLink[] }[] = [];
	export let label = 'Main';
	export let current = '';

	const base = uid('navigation-menu');
	let root: HTMLElement;
	let tops: HTMLElement[] = [];
	let panels: Record<string, HTMLElement> = {};
	let openId: string | null = null;

	const asNav = (link: NavLink) => ({ id: link.href, href: link.href });
	const holdsCurrent = (links: NavLink[], here: string) =>
		containsCurrent({ id: '', children: links.map(asNav) }, here);

	function panelLinks(itemId: string): HTMLElement[] {
		return Array.from(panels[itemId]?.querySelectorAll<HTMLElement>('a') ?? []);
	}

	function close(returnTo?: number) {
		openId = null;
		if (returnTo !== undefined) tops[returnTo]?.focus();
	}

	async function openPanel(itemId: string, focusFirst: boolean) {
		openId = itemId;
		if (!focusFirst) return;
		await tick();
		panelLinks(itemId)[0]?.focus();
	}

	function onTopKeydown(event: KeyboardEvent, i: number) {
		const item = items[i];
		if (item.links?.length) {
			const action = disclosureKey(event.key, openId === item.id);
			if (action) {
				event.preventDefault();
				if (action === 'open') openPanel(item.id, true);
				else close(i);
				return;
			}
		}
		const next = nextIndex(i, items.length, event.key, 'horizontal');
		if (next === null) return;
		event.preventDefault();
		openId = null;
		tops[next]?.focus();
	}

	function onPanelKeydown(event: KeyboardEvent, i: number) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close(i);
			return;
		}
		const links = panelLinks(items[i].id);
		const at = links.indexOf(document.activeElement as HTMLElement);
		const next = nextIndex(at, links.length, event.key, 'vertical');
		if (next === null) return;
		event.preventDefault();
		links[next].focus();
	}

	function onFocusOut(event: FocusEvent) {
		const to = event.relatedTarget as Node | null;
		if (openId && (!to || !root.contains(to))) close();
	}

	function onWindowPointer(event: PointerEvent) {
		if (openId && !root.contains(event.target as Node)) close();
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<nav bind:this={root} class="navigation-menu" aria-label={label} on:focusout={onFocusOut}>
	<ul class="navigation-menu__list">
		{#each items as item, i (item.id)}
			<li class="navigation-menu__item">
				{#if item.links?.length}
					{@const open = openId === item.id}
					<button
						bind:this={tops[i]}
						type="button"
						class="navigation-menu__trigger"
						class:navigation-menu__trigger--current={holdsCurrent(item.links, current)}
						aria-expanded={open}
						aria-controls="{base}-{item.id}"
						on:click={() => (open ? close() : openPanel(item.id, false))}
						on:keydown={(e) => onTopKeydown(e, i)}
					>
						{item.label}
						<span class="navigation-menu__chevron" aria-hidden="true">▾</span>
					</button>
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						bind:this={panels[item.id]}
						id="{base}-{item.id}"
						class="navigation-menu__panel"
						hidden={!open}
						on:keydown={(e) => onPanelKeydown(e, i)}
					>
						<ul class="navigation-menu__links">
							{#each item.links as link (link.href)}
								{@const here = isCurrent(asNav(link), current)}
								<li>
									<a
										href={link.href}
										class="navigation-menu__link"
										aria-current={here ? 'page' : undefined}
										on:click={() => close()}
									>
										<span class="navigation-menu__link-label">{link.label}</span>
										{#if link.description}
											<span class="navigation-menu__description">{link.description}</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{:else}
					{@const here = isCurrent(item, current)}
					<a
						bind:this={tops[i]}
						href={item.href ?? '#'}
						class="navigation-menu__trigger"
						aria-current={here ? 'page' : undefined}
						on:keydown={(e) => onTopKeydown(e, i)}
					>
						{item.label}
					</a>
				{/if}
			</li>
		{/each}
	</ul>
</nav>

<style>
	.navigation-menu {
		position: relative;
		min-width: 0;
	}

	.navigation-menu__list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.navigation-menu__item {
		position: relative;
	}

	.navigation-menu__trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	.navigation-menu__trigger:hover,
	.navigation-menu__trigger[aria-expanded='true'] {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	.navigation-menu__trigger[aria-current='page'],
	.navigation-menu__trigger--current {
		color: var(--color-text);
		box-shadow: inset 0 -2px 0 var(--color-primary);
	}

	.navigation-menu__trigger:focus-visible,
	.navigation-menu__link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.navigation-menu__chevron {
		font-size: 0.75rem;
		transition: transform var(--transition-fast);
	}

	.navigation-menu__trigger[aria-expanded='true'] .navigation-menu__chevron {
		transform: rotate(180deg);
	}

	.navigation-menu__panel {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 60;
		width: min(22rem, calc(100vw - 2rem));
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.navigation-menu__panel[hidden] {
		display: none;
	}

	.navigation-menu__links {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.navigation-menu__link {
		display: grid;
		gap: 2px;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		color: var(--color-text);
		text-decoration: none;
	}

	.navigation-menu__link:hover {
		background: var(--color-surface-hover);
	}

	.navigation-menu__link[aria-current='page'] {
		background: var(--color-surface-hover);
		box-shadow: inset 3px 0 0 var(--color-primary);
	}

	.navigation-menu__link-label {
		font-weight: 600;
	}

	.navigation-menu__description {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	/* Narrow screens: one column, and panels open in the flow, pushing the
	   items below them down instead of floating off the edge. */
	@media (max-width: 640px) {
		.navigation-menu__list {
			flex-direction: column;
			flex-wrap: nowrap;
		}

		.navigation-menu__trigger {
			justify-content: space-between;
			box-sizing: border-box;
			width: 100%;
		}

		.navigation-menu__panel {
			position: static;
			width: auto;
			margin: 2px 0 var(--spacing-xs) var(--spacing-md);
			border: 0;
			border-left: 1px solid var(--color-border);
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.navigation-menu__chevron {
			transition: none;
		}
	}
</style>
