<!--
	Switch — an on/off setting that takes effect immediately. A real checkbox
	with role="switch", so it is a form control, keyboard-operable with Space,
	and announced as on or off.
-->
<script lang="ts">
	export let label: string;
	export let checked = false;
	export let disabled = false;
	export let name: string | undefined = undefined;
</script>

<label class="switch" class:switch--disabled={disabled}>
	<input type="checkbox" role="switch" bind:checked {disabled} {name} on:change />
	<span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
	<span>{label}</span>
</label>

<style>
	.switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		cursor: pointer;
		color: var(--color-text);
	}

	.switch input {
		position: absolute;
		width: 2.5rem;
		height: 1.5rem;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.switch__track {
		display: inline-flex;
		align-items: center;
		width: 2.5rem;
		height: 1.5rem;
		padding: 0.1875rem;
		box-sizing: border-box;
		border-radius: 999px;
		background: var(--color-border);
		transition: background-color var(--transition-fast);
	}

	.switch__thumb {
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		background: var(--color-background);
		box-shadow: var(--shadow-sm);
		transition: transform var(--transition-fast);
	}

	.switch input:checked + .switch__track {
		background: var(--color-primary-solid);
	}

	.switch input:checked + .switch__track .switch__thumb {
		transform: translateX(1rem);
		background: var(--color-on-solid);
	}

	.switch input:focus-visible + .switch__track {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.switch--disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.switch__thumb,
		.switch__track {
			transition: none;
		}
	}
</style>
