<!--
	InputGroup — a labelled input joined to addons on either side: text such
	as "https://" or ".com" (`prefix`, `suffix`), or anything in the `leading`
	and `trailing` slots — an icon, or a button. Text addons are read with the
	input through aria-describedby, so "https://" is heard, not just seen.
-->
<script lang="ts">
	import Field from './Field.svelte';

	export let label: string;
	export let value = '';
	export let type: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' = 'text';
	export let prefix = '';
	export let suffix = '';
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let hideLabel = false;
	export let id: string | undefined = undefined;

	function onInput(event: Event) {
		value = (event.currentTarget as HTMLInputElement).value;
	}

	function describe(fieldId: string, describedBy: string | undefined) {
		const ids = [prefix && `${fieldId}-prefix`, suffix && `${fieldId}-suffix`, describedBy];
		return ids.filter(Boolean).join(' ') || undefined;
	}
</script>

<Field
	{label}
	{hint}
	{error}
	{required}
	{hideLabel}
	{...id ? { id } : {}}
	let:id={fieldId}
	let:describedBy
	let:invalid
>
	<div class="input-group" class:input-group--disabled={disabled}>
		{#if $$slots.leading}<span class="input-group__addon input-group__addon--slot"
				><slot name="leading" /></span
			>{/if}
		{#if prefix}<span id="{fieldId}-prefix" class="input-group__addon">{prefix}</span>{/if}
		<input
			id={fieldId}
			class="input-group__input"
			{type}
			{value}
			{placeholder}
			{required}
			{disabled}
			aria-describedby={describe(fieldId, describedBy)}
			aria-invalid={invalid || undefined}
			on:input={onInput}
			on:input
			on:change
			on:blur
			{...$$restProps}
		/>
		{#if suffix}<span id="{fieldId}-suffix" class="input-group__addon">{suffix}</span>{/if}
		{#if $$slots.trailing}<span class="input-group__addon input-group__addon--slot"
				><slot name="trailing" /></span
			>{/if}
	</div>
</Field>

<style>
	.input-group {
		display: flex;
		align-items: stretch;
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		transition: border-color var(--transition-fast);
	}

	.input-group:focus-within {
		border-color: var(--color-primary);
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	:global(.field--invalid) .input-group {
		border-color: var(--color-error);
	}

	.input-group__input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}

	.input-group__input:focus {
		box-shadow: none;
	}

	.input-group__addon {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		padding: 0 var(--spacing-sm);
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.input-group__addon:first-child {
		padding-left: var(--spacing-md);
	}

	.input-group__addon:last-child {
		padding-right: var(--spacing-xs);
	}

	.input-group__addon:not(.input-group__addon--slot):last-child {
		padding-right: var(--spacing-md);
	}

	.input-group__addon:first-child + .input-group__input {
		padding-left: 0;
	}

	.input-group--disabled {
		opacity: 0.55;
	}

	@media (prefers-reduced-motion: reduce) {
		.input-group {
			transition: none;
		}
	}
</style>
