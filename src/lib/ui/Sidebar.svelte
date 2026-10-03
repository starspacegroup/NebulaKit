<!--
	Sidebar — an app's side navigation. Sections with headings; items with an
	icon (the `icon` slot, or `item.icon`), a label, a badge and an href; the
	current one is marked aria-current="page". An item with `children` is a
	button that shows and hides them (aria-expanded), and starts open when the
	current page is inside it.

	`bind:collapsed` shrinks it to icons: labels then live in each item's
	accessible name and in a tooltip on hover and focus. Below `breakpoint`
	pixels it goes off-canvas behind a Menu button: it slides in over a scrim,
	Escape or a pick closes it, and focus goes back to the button.
	Leaf items without an href are buttons that report `on:select`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { uid } from './logic';
	import { containsCurrent, isCurrent, isOffCanvas, itemName } from './layout-logic';

	interface Item {
		id: string;
		label: string;
		href?: string;
		icon?: string;
		badge?: string | number;
		children?: Item[];
	}

	export let sections: { heading?: string; items: Item[] }[] = [];
	export let current = '';
	export let collapsed = false;
	export let collapsible = true;
	export let open = false;
	export let breakpoint = 768;
	export let label = 'Sidebar';

	const dispatch = createEventDispatcher<{ select: { id: string; href: string | undefined } }>();
	const id = uid('sidebar');
	let width = 0;
	let root: HTMLElement;
	let menuButton: HTMLButtonElement;
	let expanded: Record<string, boolean> = {};

	$: offCanvas = isOffCanvas(width, breakpoint);
	$: iconsOnly = collapsed && !offCanvas;
	$: openCurrent(sections, current);

	// Open every group that holds the current page; leave the rest as they are.
	function openCurrent(list: typeof sections, here: string) {
		for (const section of list) {
			for (const item of section.items) {
				if (containsCurrent(item, here)) expanded[item.id] = true;
			}
		}
	}

	async function setOpen(want: boolean, returnFocus = true) {
		open = want;
		await tick();
		if (want) root?.querySelector<HTMLElement>('a, button')?.focus();
		else if (returnFocus) menuButton?.focus();
	}

	function activate(item: Item) {
		if (item.children?.length) {
			if (iconsOnly) {
				collapsed = false;
				expanded[item.id] = true;
			} else {
				expanded[item.id] = !expanded[item.id];
			}
			return;
		}
		dispatch('select', { id: item.id, href: item.href });
		if (offCanvas && open) setOpen(false);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && offCanvas && open) {
			event.preventDefault();
			setOpen(false);
		}
	}
</script>

<svelte:window bind:innerWidth={width} />

{#if offCanvas}
	<button
		bind:this={menuButton}
		type="button"
		class="sidebar__menu-button"
		aria-expanded={open}
		aria-controls={id}
		on:click={() => setOpen(!open)}
	>
		<span aria-hidden="true">☰</span>
		Menu
	</button>
	{#if open}
		<div class="sidebar__scrim" aria-hidden="true" on:click={() => setOpen(false)}></div>
	{/if}
{/if}

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<nav
	bind:this={root}
	{id}
	class="sidebar"
	class:sidebar--collapsed={iconsOnly}
	class:sidebar--off-canvas={offCanvas}
	class:sidebar--open={offCanvas && open}
	aria-label={label}
	on:keydown={onKeydown}
>
	{#if $$slots.header}<div class="sidebar__header"><slot name="header" /></div>{/if}
	<div class="sidebar__body">
		{#each sections as section, s (s)}
			<div class="sidebar__section">
				{#if section.heading}
					<h2 class="sidebar__heading" id="{id}-section-{s}">{section.heading}</h2>
				{/if}
				<ul
					class="sidebar__list"
					aria-labelledby={section.heading ? `${id}-section-${s}` : undefined}
				>
					{#each section.items as item (item.id)}
						{@const group = !!item.children?.length}
						{@const here = isCurrent(item, current)}
						<li class="sidebar__entry">
							{#if item.href && !group}
								<a
									href={item.href}
									class="sidebar__item"
									class:sidebar__item--current={here}
									aria-current={here ? 'page' : undefined}
									aria-label={iconsOnly ? itemName(item.label, item.badge) : undefined}
									on:click={() => activate(item)}
								>
									<span class="sidebar__icon" aria-hidden="true">
										<slot name="icon" {item}>{item.icon ?? item.label.slice(0, 1)}</slot>
									</span>
									<span class="sidebar__label">{item.label}</span>
									{#if item.badge !== undefined && item.badge !== ''}
										<span class="sidebar__badge">{item.badge}</span>
									{/if}
									{#if iconsOnly}
										<span class="sidebar__tip" aria-hidden="true">{item.label}</span>
									{/if}
								</a>
							{:else}
								<button
									type="button"
									class="sidebar__item"
									class:sidebar__item--current={here}
									class:sidebar__item--holds-current={group && containsCurrent(item, current)}
									aria-current={here ? 'page' : undefined}
									aria-label={iconsOnly ? itemName(item.label, item.badge) : undefined}
									on:click={() => activate(item)}
									aria-expanded={group ? !!expanded[item.id] && !iconsOnly : undefined}
									aria-controls={group ? `${id}-group-${item.id}` : undefined}
								>
									<span class="sidebar__icon" aria-hidden="true">
										<slot name="icon" {item}>{item.icon ?? item.label.slice(0, 1)}</slot>
									</span>
									<span class="sidebar__label">{item.label}</span>
									{#if item.badge !== undefined && item.badge !== ''}
										<span class="sidebar__badge">{item.badge}</span>
									{/if}
									{#if group}
										<span class="sidebar__chevron" aria-hidden="true">▸</span>
									{/if}
									{#if iconsOnly}
										<span class="sidebar__tip" aria-hidden="true">{item.label}</span>
									{/if}
								</button>
							{/if}
							{#if group}
								<ul
									class="sidebar__sublist"
									id="{id}-group-{item.id}"
									hidden={!expanded[item.id] || iconsOnly}
								>
									{#each item.children ?? [] as child (child.id)}
										{@const childHere = isCurrent(child, current)}
										<li>
											{#if child.href}
												<a
													href={child.href}
													class="sidebar__subitem"
													class:sidebar__item--current={childHere}
													aria-current={childHere ? 'page' : undefined}
													on:click={() => activate(child)}
												>
													<span class="sidebar__label">{child.label}</span>
													{#if child.badge !== undefined && child.badge !== ''}
														<span class="sidebar__badge">{child.badge}</span>
													{/if}
												</a>
											{:else}
												<button
													type="button"
													class="sidebar__subitem"
													class:sidebar__item--current={childHere}
													aria-current={childHere ? 'page' : undefined}
													on:click={() => activate(child)}
												>
													<span class="sidebar__label">{child.label}</span>
													{#if child.badge !== undefined && child.badge !== ''}
														<span class="sidebar__badge">{child.badge}</span>
													{/if}
												</button>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
	{#if $$slots.footer}<div class="sidebar__footer"><slot name="footer" /></div>{/if}
	{#if collapsible && !offCanvas}
		<button
			type="button"
			class="sidebar__collapse"
			aria-expanded={!collapsed}
			aria-controls={id}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			on:click={() => (collapsed = !collapsed)}
		>
			<span aria-hidden="true">{collapsed ? '»' : '«'}</span>
			<span class="sidebar__label">Collapse</span>
		</button>
	{/if}
</nav>

<style>
	.sidebar {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		width: 16rem;
		max-width: 100%;
		height: 100%;
		padding: var(--spacing-md) var(--spacing-sm);
		border-right: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		transition: width var(--transition-base);
	}

	.sidebar--collapsed {
		width: 4rem;
	}

	.sidebar__body {
		display: grid;
		flex: 1;
		align-content: start;
		gap: var(--spacing-md);
		min-height: 0;
		overflow-y: auto;
	}

	.sidebar--collapsed .sidebar__body {
		overflow: visible;
	}

	.sidebar__heading {
		margin: 0 0 var(--spacing-xs);
		padding: 0 var(--spacing-sm);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.sidebar--collapsed .sidebar__heading {
		height: 1px;
		margin: 0 var(--spacing-sm) var(--spacing-xs);
		padding: 0;
		overflow: hidden;
		background: var(--color-border);
		color: transparent;
	}

	.sidebar__list,
	.sidebar__sublist {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.sidebar__sublist {
		margin: 2px 0 var(--spacing-xs) calc(var(--spacing-sm) + 0.75rem);
		padding-left: var(--spacing-sm);
		border-left: 1px solid var(--color-border);
	}

	.sidebar__sublist[hidden] {
		display: none;
	}

	.sidebar__item,
	.sidebar__subitem,
	.sidebar__collapse {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		box-sizing: border-box;
		width: 100%;
		min-height: 2.25rem;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-size: 0.9375rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.sidebar__item:hover,
	.sidebar__subitem:hover,
	.sidebar__collapse:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	.sidebar__item:focus-visible,
	.sidebar__subitem:focus-visible,
	.sidebar__collapse:focus-visible,
	.sidebar__menu-button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.sidebar__item--current,
	.sidebar__item--holds-current {
		color: var(--color-text);
		font-weight: 600;
	}

	.sidebar__item--current {
		background: var(--color-surface-hover);
		box-shadow: inset 3px 0 0 var(--color-primary);
	}

	.sidebar__icon {
		display: inline-grid;
		flex: 0 0 1.5rem;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		font-size: 1rem;
		line-height: 1;
	}

	.sidebar__label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar__badge {
		flex: 0 0 auto;
		min-width: 1.25rem;
		padding: 0 0.375rem;
		border-radius: 999px;
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.25rem;
		text-align: center;
	}

	.sidebar__chevron {
		color: var(--color-text-secondary);
		transition: transform var(--transition-fast);
	}

	.sidebar__item[aria-expanded='true'] .sidebar__chevron {
		transform: rotate(90deg);
	}

	/* Icons only: the label leaves the layout, the badge becomes a dot. */
	.sidebar--collapsed .sidebar__item,
	.sidebar--collapsed .sidebar__collapse {
		justify-content: center;
		padding: var(--spacing-xs);
	}

	.sidebar--collapsed .sidebar__label,
	.sidebar--collapsed .sidebar__chevron {
		display: none;
	}

	.sidebar--collapsed .sidebar__badge {
		position: absolute;
		top: 2px;
		right: 4px;
		min-width: 0.5rem;
		height: 0.5rem;
		padding: 0;
		overflow: hidden;
		color: transparent;
		font-size: 0;
	}

	.sidebar__tip {
		position: absolute;
		left: calc(100% + var(--spacing-sm));
		top: 50%;
		z-index: 50;
		display: none;
		width: max-content;
		max-width: 14rem;
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		background: var(--color-text);
		color: var(--color-background);
		font-size: 0.8125rem;
		font-weight: 400;
		pointer-events: none;
		transform: translateY(-50%);
	}

	.sidebar__item:hover .sidebar__tip,
	.sidebar__item:focus-visible .sidebar__tip {
		display: block;
	}

	.sidebar__collapse {
		flex: 0 0 auto;
	}

	.sidebar__header,
	.sidebar__footer {
		padding: 0 var(--spacing-sm);
	}

	.sidebar--collapsed .sidebar__header,
	.sidebar--collapsed .sidebar__footer {
		padding: 0;
		overflow: hidden;
		text-align: center;
	}

	/* Off-canvas: a panel that slides in over the page. Hidden, it is out of
	   the tab order and the accessibility tree. */
	.sidebar__menu-button {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.sidebar--off-canvas {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		z-index: 70;
		width: min(18rem, 85vw);
		height: auto;
		box-shadow: var(--shadow-xl);
		visibility: hidden;
		transform: translateX(-100%);
		transition:
			transform var(--transition-base),
			visibility var(--transition-base);
	}

	.sidebar--open {
		visibility: visible;
		transform: none;
	}

	.sidebar__scrim {
		position: fixed;
		inset: 0;
		z-index: 65;
		background: rgb(0 0 0 / 0.5);
	}

	@media (prefers-reduced-motion: reduce) {
		.sidebar,
		.sidebar--off-canvas,
		.sidebar__chevron {
			transition: none;
		}
	}
</style>
