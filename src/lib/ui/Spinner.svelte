<!-- Spinner — indeterminate activity. Announced as a status with its label. -->
<script lang="ts">
	export let label = 'Loading';
	export let size: 'sm' | 'md' | 'lg' = 'md';
</script>

<span class="spinner spinner--{size}" role="status">
	<span class="spinner__ring" aria-hidden="true"></span>
	<span class="sr-only">{label}</span>
</span>

<style>
	.spinner {
		display: inline-flex;
	}

	.spinner__ring {
		width: var(--size);
		height: var(--size);
		border: 3px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.spinner--sm {
		--size: 1rem;
	}

	.spinner--md {
		--size: 1.75rem;
	}

	.spinner--lg {
		--size: 2.75rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner__ring {
			animation-duration: 2.4s;
		}
	}
</style>
