<!--
	BottomNav — the mobile tab bar: three to five destinations pinned to the
	bottom of the screen, each a link with an icon, a label and an optional
	badge. The current one has aria-current="page" and is marked by a bar and
	bold text as well as colour; a badge is part of the link's name ("Inbox, 3
	new"). It respects the device's safe-area insets (home indicator, notch)
	and hides at `md` and wider, where a sidebar takes over — pass
	`hideAbove="never"` to keep it. `fixed` pins it to the viewport; without
	it the bar sticks to the bottom of its container.
-->
<script lang="ts">
	import { formatCountBadge, isNavCurrent } from './logic';

	export let items: {
		id: string;
		label: string;
		href: string;
		/** An emoji or character; decorative, the label names the link. */
		icon: string;
		badge?: number | string;
	}[] = [];
	export let current = '';
	export let exact = false;
	export let label = 'Primary';
	export let badgeWord = 'new';
	/** `md`: hidden from 48rem up. `never`: always shown. */
	export let hideAbove: 'md' | 'never' = 'md';
	export let fixed = false;

	function badgeText(badge: number | string | undefined): string {
		if (badge === undefined || badge === '') return '';
		return typeof badge === 'number' ? formatCountBadge(badge) : badge;
	}
</script>

<nav
	class="bottom-nav"
	class:bottom-nav--fixed={fixed}
	class:bottom-nav--hide-md={hideAbove === 'md'}
	aria-label={label}
>
	<ul>
		{#each items as item (item.id)}
			{@const isCurrent = isNavCurrent(item.href, current, exact)}
			{@const text = badgeText(item.badge)}
			<li>
				<a
					href={item.href}
					class="item"
					class:item--current={isCurrent}
					aria-current={isCurrent ? 'page' : undefined}
				>
					<span class="item__icon" aria-hidden="true"
						>{item.icon}{#if text}<span class="item__badge">{text}</span>{/if}</span
					>
					<span class="item__label">{item.label}</span>{#if text}<span class="sr-only"
							>{text}{badgeWord ? ` ${badgeWord}` : ''}</span
						>{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.bottom-nav {
		position: sticky;
		inset-block-end: 0;
		z-index: 40;
		padding-block-end: env(safe-area-inset-bottom, 0px);
		padding-inline: env(safe-area-inset-left, 0px) env(safe-area-inset-right, 0px);
		border-block-start: 1px solid var(--color-border);
		background: var(--color-background);
	}

	.bottom-nav--fixed {
		position: fixed;
		inset-inline: 0;
	}

	@media (min-width: 48rem) {
		.bottom-nav--hide-md {
			display: none;
		}
	}

	ul {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		align-content: center;
		gap: 2px;
		min-height: 56px;
		min-width: 44px;
		padding: var(--spacing-xs);
		border-block-start: 3px solid transparent;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		text-decoration: none;
	}

	.item:hover {
		background: var(--color-surface-hover);
	}

	.item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.item--current {
		border-block-start-color: var(--color-primary);
		color: var(--color-text);
		font-weight: 700;
	}

	@media (forced-colors: active) {
		.item--current {
			border-block-start-color: Highlight;
		}
	}

	.item__icon {
		position: relative;
		font-size: 1.25rem;
		line-height: 1.2;
	}

	.item__badge {
		position: absolute;
		inset-block-start: -4px;
		inset-inline-start: 100%;
		min-width: 1.1rem;
		padding: 0 0.25rem;
		border-radius: 999px;
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
		font-size: 0.65rem;
		font-weight: 700;
		line-height: 1.1rem;
		text-align: center;
	}

	.item__label {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	.item__badge {
		font-variant-numeric: tabular-nums;
	}
</style>
