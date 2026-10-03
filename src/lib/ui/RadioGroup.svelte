<!-- RadioGroup — one choice from a few, as a fieldset with a legend. Arrow keys move between choices natively. -->
<script lang="ts">
	import { uid } from './logic';

	export let legend: string;
	export let value = '';
	export let options: { value: string; label: string; hint?: string; disabled?: boolean }[] = [];
	export let name: string = uid('radio');
	export let inline = false;
</script>

<fieldset class="radios" class:radios--inline={inline}>
	<legend>{legend}</legend>
	{#each options as option (option.value)}
		<label class="radio" class:radio--disabled={option.disabled}>
			<input
				type="radio"
				{name}
				value={option.value}
				bind:group={value}
				disabled={option.disabled}
				on:change
			/>
			<span class="radio__text">
				<span>{option.label}</span>
				{#if option.hint}<span class="radio__hint">{option.hint}</span>{/if}
			</span>
		</label>
	{/each}
</fieldset>

<style>
	.radios {
		display: grid;
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		border: 0;
	}

	.radios--inline {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm) var(--spacing-lg);
	}

	legend {
		margin-bottom: var(--spacing-xs);
		padding: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.radio {
		display: inline-flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
		cursor: pointer;
		color: var(--color-text);
	}

	.radio input {
		width: 1.125rem;
		height: 1.125rem;
		margin: 0.15rem 0 0;
		padding: 0;
		accent-color: var(--color-primary-solid);
		cursor: inherit;
	}

	.radio__text {
		display: grid;
	}

	.radio__hint {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.radio--disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
