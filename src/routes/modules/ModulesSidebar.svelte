<!--
	ModulesSidebar — jump links for the /modules gallery.

	One <nav> of groups, each listing its modules. From 64rem it sits beside the
	page and stays in view; on a phone it folds behind a button so it does not
	push the first module off screen. The module nearest the top of the page is
	marked aria-current="location" as you scroll.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	export let groups: { id: string; title: string; items: { id: string; name: string }[] }[] = [];

	let open = false;
	let active = '';
	let panel: HTMLElement;

	function keepVisible(id: string) {
		const link = panel?.querySelector<HTMLElement>(`a[href="#${id}"]`);
		if (!link || panel.scrollHeight <= panel.clientHeight) return;
		const top = link.offsetTop - panel.offsetTop;
		if (top < panel.scrollTop || top + link.offsetHeight > panel.scrollTop + panel.clientHeight) {
			panel.scrollTop = top - panel.clientHeight / 2;
		}
	}

	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		const targets = groups.flatMap((g) => g.items).map((i) => document.getElementById(i.id));
		const seen = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) seen.add(entry.target.id);
					else seen.delete(entry.target.id);
				}
				// The first module (in page order) that is inside the reading band.
				const first = targets.find((t) => t && seen.has(t.id));
				if (first && first.id !== active) {
					active = first.id;
					keepVisible(active);
				}
			},
			{ rootMargin: '-15% 0px -65% 0px' }
		);
		for (const t of targets) if (t) observer.observe(t);
		return () => observer.disconnect();
	});
</script>

<aside class="sidebar" aria-label="Module navigation">
	<button
		type="button"
		class="sidebar__toggle"
		aria-expanded={open}
		aria-controls="modules-sidebar-nav"
		on:click={() => (open = !open)}
	>
		Jump to a module
		<span aria-hidden="true">{open ? '−' : '+'}</span>
	</button>
	<nav
		id="modules-sidebar-nav"
		class="sidebar__nav"
		class:sidebar__nav--open={open}
		aria-label="Modules"
		bind:this={panel}
	>
		{#each groups as group (group.id)}
			<div class="sidebar__group">
				<a class="sidebar__title" href="#{group.id}">{group.title}</a>
				<ul>
					{#each group.items as item (item.id)}
						<li>
							<a
								href="#{item.id}"
								aria-current={active === item.id ? 'location' : undefined}
								on:click={() => (open = false)}>{item.name}</a
							>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>
</aside>

<style>
	.sidebar {
		min-width: 0;
		margin-bottom: var(--spacing-lg);
	}

	.sidebar__toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 2.75rem;
		padding: 0.375rem var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.sidebar__toggle:focus-visible,
	.sidebar a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.sidebar__nav {
		display: none;
		margin-top: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		max-height: 60vh;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.sidebar__nav--open {
		display: block;
	}

	.sidebar__group + .sidebar__group {
		margin-top: var(--spacing-md);
	}

	.sidebar__title {
		display: flex;
		align-items: center;
		min-height: 2rem;
		color: var(--color-text);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li a {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm);
		border-inline-start: 3px solid transparent;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
		text-decoration: none;
	}

	li a:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	li a[aria-current='location'] {
		border-inline-start-color: var(--color-primary);
		background: var(--color-surface-hover);
		color: var(--color-text);
		font-weight: 600;
	}

	@media (forced-colors: active) {
		li a[aria-current='location'] {
			border-inline-start-color: Highlight;
		}
	}

	@media (min-width: 64rem) {
		.sidebar {
			position: sticky;
			top: 5rem;
			align-self: start;
			margin-bottom: 0;
		}

		.sidebar__toggle {
			display: none;
		}

		.sidebar__nav {
			display: block;
			margin-top: 0;
			max-height: calc(100vh - 6.5rem);
		}

		li a {
			min-height: 2rem;
		}
	}
</style>
