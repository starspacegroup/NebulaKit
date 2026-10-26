<!--
	Progress — how far along something is. Leave `value` undefined for work of
	unknown length.
-->
<script lang="ts">
	import { percent } from './logic';

	export let value: number | undefined = undefined;
	export let max = 100;
	export let label = 'Progress';
	/** Print the percentage beside the label. */
	export let showValue = true;
	export let tone: 'primary' | 'success' | 'warning' | 'danger' = 'primary';

	$: pct = value === undefined ? undefined : percent(value, max);
</script>

<div class="progress progress--{tone}">
	<div class="progress__label">
		<span>{label}</span>
		{#if showValue && pct !== undefined}<span>{Math.round(pct)}%</span>{/if}
	</div>
	<div
		class="progress__track"
		role="progressbar"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={max}
		aria-valuenow={value}
	>
		<div
			class="progress__bar"
			class:progress__bar--indeterminate={pct === undefined}
			style:width={pct === undefined ? undefined : `${pct}%`}
		></div>
	</div>
</div>

<style>
	.progress {
		--tone: var(--color-primary);
		display: grid;
		gap: var(--spacing-xs);
	}

	.progress--success {
		--tone: var(--color-success);
	}

	.progress--warning {
		--tone: var(--color-warning);
	}

	.progress--danger {
		--tone: var(--color-danger);
	}

	.progress__label {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.progress__track {
		height: 0.5rem;
		overflow: hidden;
		border-radius: 999px;
		background: var(--color-surface-hover);
	}

	.progress__bar {
		height: 100%;
		border-radius: inherit;
		background: var(--tone);
		transition: width var(--transition-base);
	}

	.progress__bar--indeterminate {
		width: 40%;
		animation: slide 1.3s ease-in-out infinite;
	}

	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress__bar--indeterminate {
			animation-duration: 3s;
		}
	}
</style>
