<!-- Skeleton — a placeholder shape while content loads. Hidden from assistive technology. -->
<script lang="ts">
	export let width = '100%';
	export let height = '1rem';
	export let shape: 'line' | 'circle' | 'block' = 'line';
	/** Several lines in a column, the last one shorter. */
	export let lines = 1;
</script>

<span class="skeleton-stack" aria-hidden="true">
	{#each Array.from({ length: Math.max(1, lines) }) as _, i (i)}
		<span
			class="skeleton skeleton--{shape}"
			style:width={shape === 'circle' ? height : lines > 1 && i === lines - 1 ? '60%' : width}
			style:height
		></span>
	{/each}
</span>

<style>
	.skeleton-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.skeleton {
		display: block;
		background: linear-gradient(
			90deg,
			var(--color-surface-hover) 0%,
			color-mix(in srgb, var(--color-surface-hover) 55%, var(--color-surface)) 50%,
			var(--color-surface-hover) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}

	.skeleton--line {
		border-radius: var(--radius-sm);
	}

	.skeleton--block {
		border-radius: var(--radius-lg);
	}

	.skeleton--circle {
		border-radius: 50%;
	}

	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}
</style>
