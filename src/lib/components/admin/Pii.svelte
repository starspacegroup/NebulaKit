<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	/** A PII string (email, name, …) hidden until the admin reveal toggle is on. */
	export let value: string | null | undefined;
	/** Shown when revealed but the value is empty. */
	export let empty = '—';

	// Reveal state comes from the admin layout via context. Absent context
	// (e.g. outside the admin area) => stays hidden, which is the safe default.
	const piiRevealed = getContext<Writable<boolean> | undefined>('piiRevealed');
	$: revealed = piiRevealed ? $piiRevealed : false;
</script>

{#if !revealed}
	<span class="pii-masked" title="Hidden — reveal with the admin privacy toggle" aria-label="hidden"
		>•••••</span
	>
{:else if value == null || value === ''}
	{empty}
{:else}
	{value}
{/if}

<style>
	.pii-masked {
		letter-spacing: 0.1em;
		color: var(--color-text-secondary);
		user-select: none;
	}
</style>
