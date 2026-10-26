<!--
	AnnouncementBar — a slim notice above the page, optionally dismissible.

	It does not remember anything itself: dismissing fires `dismiss` and hides
	the bar for this render, and the app decides whether to store that (and
	passes `open={false}` next time). The text is plain content, not an alert,
	so it does not interrupt anyone.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let message: string;
	export let link: { label: string; href: string } | undefined = undefined;
	export let dismissible = true;
	export let open = true;
	export let label = 'Announcement';
	export let dismissLabel = 'Dismiss announcement';

	const dispatch = createEventDispatcher<{ dismiss: void }>();

	function dismiss() {
		open = false;
		dispatch('dismiss');
	}
</script>

{#if open}
	<aside class="bar" aria-label={label}>
		<p class="bar__text">
			{message}
			{#if link}<a class="bar__link" href={link.href}>{link.label}</a>{/if}
		</p>
		{#if dismissible}
			<button type="button" class="bar__close" aria-label={dismissLabel} on:click={dismiss}>
				<span aria-hidden="true">×</span>
			</button>
		{/if}
	</aside>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-xs) var(--spacing-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.bar__text {
		flex: 1;
		margin: 0;
		padding-block: var(--spacing-sm);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.bar__link {
		margin-inline-start: var(--spacing-xs);
		color: inherit;
		font-weight: 700;
		text-decoration: underline;
	}

	.bar__close {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 2.75rem;
		block-size: 2.75rem;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font-size: 1.5rem;
		cursor: pointer;
	}

	.bar__close:hover {
		border-color: currentColor;
	}

	.bar a:focus-visible,
	.bar__close:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
</style>
