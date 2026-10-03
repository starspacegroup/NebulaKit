<!-- Checkbox — a box and its label, the whole row clickable. Supports the indeterminate state. -->
<script lang="ts">
	export let label: string;
	export let checked = false;
	export let indeterminate = false;
	export let disabled = false;
	export let hint = '';
	export let name: string | undefined = undefined;
	export let value: string | undefined = undefined;
</script>

<label class="check" class:check--disabled={disabled}>
	<input type="checkbox" bind:checked bind:indeterminate {disabled} {name} {value} on:change />
	<span class="check__text">
		<span>{label}</span>
		{#if hint}<span class="check__hint">{hint}</span>{/if}
	</span>
</label>

<style>
	.check {
		display: inline-flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
		cursor: pointer;
		color: var(--color-text);
	}

	.check input {
		width: 1.125rem;
		height: 1.125rem;
		margin: 0.15rem 0 0;
		padding: 0;
		accent-color: var(--color-primary-solid);
		cursor: inherit;
	}

	.check__text {
		display: grid;
	}

	.check__hint {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.check--disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
