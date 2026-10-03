<!-- Slider — a labelled range input that shows its current value, with an optional unit. -->
<script lang="ts">
	import Field from './Field.svelte';

	export let label: string;
	export let value = 50;
	export let min = 0;
	export let max = 100;
	export let step = 1;
	export let unit = '';
	export let hint = '';
	export let disabled = false;
	export let id: string | undefined = undefined;
</script>

<Field {label} {hint} {...id ? { id } : {}} let:id={fieldId} let:describedBy>
	<div class="slider">
		<input
			id={fieldId}
			type="range"
			bind:value
			{min}
			{max}
			{step}
			{disabled}
			aria-describedby={describedBy}
			aria-valuetext={`${value}${unit}`}
			on:input
			on:change
		/>
		<output for={fieldId}>{value}{unit}</output>
	</div>
</Field>

<style>
	.slider {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	/* Drawn here rather than left to the browser: the native track is a light
	   grey that disappears on the dark theme's surface. */
	input {
		flex: 1;
		height: 1.5rem;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		appearance: none;
		cursor: pointer;
	}

	input::-webkit-slider-runnable-track {
		height: 0.375rem;
		border-radius: 999px;
		background: var(--color-border);
	}

	input::-moz-range-track {
		height: 0.375rem;
		border-radius: 999px;
		background: var(--color-border);
	}

	input::-moz-range-progress {
		height: 0.375rem;
		border-radius: 999px;
		background: var(--color-primary-solid);
	}

	input::-webkit-slider-thumb {
		width: 1.125rem;
		height: 1.125rem;
		margin-top: -0.375rem;
		border: 2px solid var(--color-background);
		border-radius: 50%;
		background: var(--color-primary-solid);
		appearance: none;
	}

	input::-moz-range-thumb {
		width: 1.125rem;
		height: 1.125rem;
		border: 2px solid var(--color-background);
		border-radius: 50%;
		background: var(--color-primary-solid);
	}

	input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	output {
		min-width: 3.5ch;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		text-align: right;
		color: var(--color-text);
	}
</style>
