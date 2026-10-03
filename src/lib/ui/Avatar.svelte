<!--
	Avatar — a picture, or the person's initials when there is no picture or it
	fails to load. The name is the accessible label either way.
-->
<script lang="ts">
	import { initials } from './logic';

	export let name: string;
	export let src: string | undefined = undefined;
	export let size: 'sm' | 'md' | 'lg' = 'md';

	let failed = false;
	$: if (src) failed = false;
</script>

<span class="avatar avatar--{size}" role="img" aria-label={name}>
	{#if src && !failed}
		<img {src} alt="" on:error={() => (failed = true)} />
	{:else}
		<span aria-hidden="true">{initials(name)}</span>
	{/if}
</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
		color: var(--color-text);
		font-weight: 700;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar--sm {
		width: 2rem;
		height: 2rem;
		font-size: 0.75rem;
	}

	.avatar--md {
		width: 2.75rem;
		height: 2.75rem;
		font-size: 0.9375rem;
	}

	.avatar--lg {
		width: 4rem;
		height: 4rem;
		font-size: 1.25rem;
	}
</style>
