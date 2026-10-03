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

	input {
		flex: 1;
		padding: 0;
		border: 0;
		background: transparent;
		accent-color: var(--color-primary-solid);
	}

	output {
		min-width: 3.5ch;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		text-align: right;
		color: var(--color-text);
	}
</style>
