<!--
	TabsPageNav — tab-style navigation between pages (routes), as opposed to
	Tabs, which switches panels on one page. It is a <nav> of real links; the
	one for the current page carries aria-current="page" (and a bar under it,
	not colour alone). When the links do not fit, the row scrolls inside its
	own region and an arrow marks each edge that has more past it. The
	current link is scrolled into view when the nav appears. Badges are part
	of the link's accessible name.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { scrollEdges, type ScrollEdges } from '$lib/ui';
	import { isNavCurrent, navItemName } from './logic';

	export let items: { id: string; label: string; href: string; badge?: number | string }[] = [];
	/** The current page's path; the item whose href matches is current. */
	export let current = '';
	/** Match only the exact path. Off, a section link stays current on its sub-pages. */
	export let exact = false;
	export let label = 'Page sections';
	/** Said after a badge in the link's name: "Billing, 2 new". */
	export let badgeWord = '';

	let scroller: HTMLElement;
	let edges: ScrollEdges = { top: false, bottom: false, left: false, right: false };

	function measure() {
		if (!scroller) return;
		edges = scrollEdges({
			scrollTop: scroller.scrollTop,
			scrollLeft: scroller.scrollLeft,
			scrollHeight: scroller.scrollHeight,
			scrollWidth: scroller.scrollWidth,
			clientHeight: scroller.clientHeight,
			clientWidth: scroller.clientWidth
		});
	}

	$: (items, current, tick().then(measure));

	onMount(() => {
		scroller.querySelector('[aria-current="page"]')?.scrollIntoView?.({
			block: 'nearest',
			inline: 'center'
		});
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		return () => observer.disconnect();
	});
</script>

<nav class="tabs-nav" aria-label={label}>
	{#if edges.left}<span class="tabs-nav__edge tabs-nav__edge--start" aria-hidden="true">‹</span
		>{/if}
	<div class="tabs-nav__scroller" bind:this={scroller} on:scroll={measure}>
		<ul>
			{#each items as item (item.id)}
				{@const isCurrent = isNavCurrent(item.href, current, exact)}
				<li>
					<a
						href={item.href}
						class="tab"
						class:tab--current={isCurrent}
						aria-current={isCurrent ? 'page' : undefined}
						aria-label={item.badge === undefined
							? undefined
							: navItemName(item.label, item.badge, badgeWord)}
					>
						{item.label}
						{#if item.badge !== undefined && item.badge !== ''}<span
								class="tab__badge"
								aria-hidden="true">{item.badge}</span
							>{/if}
					</a>
				</li>
			{/each}
		</ul>
	</div>
	{#if edges.right}<span class="tabs-nav__edge tabs-nav__edge--end" aria-hidden="true">›</span>{/if}
</nav>

<style>
	.tabs-nav {
		position: relative;
		min-width: 0;
		border-block-end: 1px solid var(--color-border);
	}

	.tabs-nav__scroller {
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
	}

	ul {
		display: flex;
		gap: var(--spacing-xs);
		width: max-content;
		min-width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-height: 44px;
		padding: 0 var(--spacing-md);
		border-block-end: 3px solid transparent;
		color: var(--color-text-secondary);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.tab:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	.tab:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.tab--current {
		border-block-end-color: var(--color-primary);
		color: var(--color-text);
	}

	@media (forced-colors: active) {
		.tab--current {
			border-block-end-color: Highlight;
		}
	}

	.tab__badge {
		padding: 0 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.tabs-nav__edge {
		position: absolute;
		inset-block: 0;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		width: 1.75rem;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 1.25rem;
		pointer-events: none;
	}

	.tabs-nav__edge--start {
		inset-inline-start: 0;
		box-shadow: 6px 0 8px -6px var(--color-border);
	}

	.tabs-nav__edge--end {
		inset-inline-end: 0;
		box-shadow: -6px 0 8px -6px var(--color-border);
	}

	:global([dir='rtl']) .tabs-nav__edge {
		transform: scaleX(-1);
	}
</style>
