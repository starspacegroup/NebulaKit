<!--
	One group of demos that mounts when it is near the screen.

	Every demo on /modules is a live, interactive module. Hydrating all of them
	at once took the main thread for ~750 ms on load, so only the first group
	is built with the page. The rest are server-rendered as a heading per
	module (so the page, its anchors and its outline exist without script) and
	swap for the real demos when the reader is within a screen of them, or a
	link points inside them.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';

	/** The module ids in this group; each gets a stub with its anchor until the demos mount. */
	export let items: { id: string; name: string }[] = [];
	/** Build with the page instead of waiting. */
	export let eager = false;

	// No IntersectionObserver (old browsers, test DOMs): show it, never hide it.
	let show =
		eager || (typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined');
	let stub: HTMLElement | undefined;

	async function reveal(scrollTo?: string) {
		if (show) return;
		show = true;
		if (!scrollTo) return;
		// The real demos are taller than the stubs: land on the one that was linked.
		await tick();
		document.getElementById(scrollTo)?.scrollIntoView();
	}

	function onHash() {
		const id = decodeURIComponent(window.location.hash.slice(1));
		if (items.some((item) => item.id === id)) void reveal(id);
	}

	onMount(() => {
		if (show) return;
		onHash();
		window.addEventListener('hashchange', onHash);
		let observer: IntersectionObserver | undefined;
		if (stub) {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) void reveal();
				},
				{ rootMargin: '900px 0px' }
			);
			observer.observe(stub);
		}
		return () => {
			observer?.disconnect();
			window.removeEventListener('hashchange', onHash);
		};
	});
</script>

{#if show}
	<slot />
{:else}
	<div bind:this={stub} class="stubs">
		{#each items as item (item.id)}
			<section id={item.id} class="stub" aria-label={item.name}>
				<h3>{item.name}</h3>
			</section>
		{/each}
	</div>
{/if}

<style>
	.stub {
		min-height: 14rem;
		padding-block: var(--spacing-md);
	}
	.stub h3 {
		margin: 0;
		font-size: var(--text-lg, 1.125rem);
		color: var(--color-text-secondary);
	}
</style>
