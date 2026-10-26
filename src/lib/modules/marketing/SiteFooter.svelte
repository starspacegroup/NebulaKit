<!--
	SiteFooter — link columns, social links, and a legal row.

	Each column is its own labelled <nav>, so a screen reader can jump between
	them. Social links are named by the network (an icon alone is not a name)
	and say when they open a new tab. One column on a phone, two from 30rem,
	one per column from 48rem.
-->
<script lang="ts">
	import { uid } from '$lib/ui/logic';

	export let brand = '';
	export let tagline = '';
	export let columns: { title: string; links: { label: string; href: string }[] }[] = [];
	export let social: { name: string; href: string; icon?: string }[] = [];
	export let legal: { label: string; href: string }[] = [];
	export let copyright = '';
	export let level: 2 | 3 | 4 = 2;
	export let socialLabel = 'Social media';
	export let legalLabel = 'Legal';
	export let newTabLabel = '(opens in a new tab)';

	const base = uid('footer');
</script>

<footer class="footer">
	<div class="footer__top">
		{#if brand || tagline}
			<div class="footer__brand">
				{#if brand}<p class="footer__name">{brand}</p>{/if}
				{#if tagline}<p class="footer__tagline">{tagline}</p>{/if}
			</div>
		{/if}
		<div class="footer__cols">
			{#each columns as column, i (column.title)}
				<nav aria-labelledby="{base}-c{i}">
					<svelte:element this={`h${level}`} id="{base}-c{i}" class="footer__heading"
						>{column.title}</svelte:element
					>
					<ul>
						{#each column.links as link (link.href + link.label)}
							<li><a href={link.href}>{link.label}</a></li>
						{/each}
					</ul>
				</nav>
			{/each}
		</div>
	</div>

	<div class="footer__bottom">
		{#if social.length > 0}
			<nav aria-label={socialLabel}>
				<ul class="footer__social">
					{#each social as item (item.href)}
						<li>
							<a href={item.href} target="_blank" rel="noopener noreferrer">
								{#if item.icon}<span aria-hidden="true">{item.icon}</span>{/if}
								<span class={item.icon ? 'sr-only' : ''}>{item.name}</span>
								<span class="sr-only">{newTabLabel}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
		<div class="footer__legal">
			{#if legal.length > 0}
				<nav aria-label={legalLabel}>
					<ul>
						{#each legal as link (link.href + link.label)}
							<li><a href={link.href}>{link.label}</a></li>
						{/each}
					</ul>
				</nav>
			{/if}
			{#if copyright}<p>{copyright}</p>{/if}
		</div>
	</div>
</footer>

<style>
	.footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xl);
		min-width: 0;
		padding: var(--spacing-xl) var(--spacing-md);
		border-block-start: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.footer__top {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xl);
		min-width: 0;
	}

	.footer__name {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
	}

	.footer__tagline {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
	}

	.footer__cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.footer__heading {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.9rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-block-size: 2.75rem;
		color: var(--color-text-secondary);
		text-decoration: none;
	}

	a:hover {
		color: var(--color-text);
		text-decoration: underline;
	}

	.footer__bottom {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		padding-block-start: var(--spacing-lg);
		border-block-start: 1px solid var(--color-border);
	}

	.footer__social,
	.footer__legal ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs) var(--spacing-lg);
	}

	.footer__legal {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.footer__legal p {
		margin: 0;
	}

	@media (min-width: 30rem) {
		.footer__cols {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 48rem) {
		.footer {
			padding-inline: var(--spacing-xl);
		}

		.footer__top {
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		}

		.footer__cols {
			grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		}

		.footer__bottom {
			grid-template-columns: auto 1fr;
			align-items: center;
		}

		.footer__legal {
			justify-items: end;
			text-align: end;
		}
	}
</style>
