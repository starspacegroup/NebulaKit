<!-- Links — a short list of bookmarks. External links open in a new tab and say so. -->
<script lang="ts">
	export let links: { label: string; href: string }[] = [];

	const external = (href: string) => /^https?:\/\//.test(href);
</script>

{#if links.length}
	<ul class="links">
		{#each links as link (link.href)}
			<li>
				{#if external(link.href)}
					<a href={link.href} target="_blank" rel="noopener noreferrer">
						{link.label}<span class="sr-only"> (opens in a new tab)</span><span aria-hidden="true">
							↗</span
						>
					</a>
				{:else}
					<a href={link.href}>{link.label}</a>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="links__empty">No links yet.</p>
{/if}

<style>
	.links {
		display: grid;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.links__empty {
		margin: 0;
		color: var(--color-text-secondary);
	}
</style>
