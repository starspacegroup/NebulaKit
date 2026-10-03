<!--
	InputOTP — a one-time code as a row of single-character cells, labelled
	as one group. Typing fills a cell and moves on; Backspace clears and steps
	back; arrow keys, Home and End move; a paste fills every cell at once. The
	first cell asks for autocomplete="one-time-code", so phones offer the code
	from a text message. Bind `value`; `on:complete` fires with the full code.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { fillOtp, otpCells, otpPasteStart, otpTyped, otpValue, type OtpMode } from './form-logic';
	import { uid } from './logic';

	export let label = 'One-time code';
	export let value = '';
	export let length = 6;
	export let mode: OtpMode = 'numeric';
	export let hint = '';
	export let error = '';
	export let disabled = false;
	/** Hide the label visually while keeping it for assistive technology. */
	export let hideLabel = false;

	const dispatch = createEventDispatcher<{ complete: { value: string } }>();
	const id = uid('otp');
	let inputs: HTMLInputElement[] = [];

	$: cells = otpCells(value, length);
	$: describedBy =
		[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
	$: noun = mode === 'numeric' ? 'Digit' : 'Character';

	async function update(next: string[], focusAt: number) {
		const before = value;
		value = otpValue(next);
		// Keep a typed-over cell showing what the code holds, even when the
		// value itself did not change (a rejected letter in a numeric cell).
		cells = otpCells(value, length);
		await tick();
		inputs.forEach((input, i) => {
			if (input && input.value !== cells[i]) input.value = cells[i];
		});
		focusCell(focusAt);
		if (value.length === length && value !== before) dispatch('complete', { value });
	}

	function focusCell(i: number) {
		const input = inputs[Math.max(0, Math.min(length - 1, i))];
		input?.focus();
		input?.select();
	}

	function onInput(i: number, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const typed = otpTyped(cells[i], input.value);
		if (typed === '') {
			const next = [...cells];
			next[i] = '';
			update(next, i);
			return;
		}
		const { cells: next, focus } = fillOtp(cells, Math.min(i, value.length), typed, mode);
		update(next, focus);
	}

	function onKeydown(i: number, event: KeyboardEvent) {
		const at = (n: number) => {
			event.preventDefault();
			focusCell(n);
		};
		switch (event.key) {
			case 'Backspace': {
				event.preventDefault();
				const target = cells[i] ? i : i - 1;
				if (target < 0) return;
				// Clearing a cell drops the cells after it too: the code has no holes.
				update(otpCells(value.slice(0, target), length), target);
				return;
			}
			case 'Delete':
				event.preventDefault();
				update(otpCells(value.slice(0, i), length), i);
				return;
			case 'ArrowLeft':
				return at(i - 1);
			case 'ArrowRight':
				return at(Math.min(i + 1, value.length));
			case 'Home':
				return at(0);
			case 'End':
				return at(value.length);
		}
	}

	function onPaste(i: number, event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData?.getData('text') ?? '';
		const start = Math.min(otpPasteStart(i, text, length, mode), value.length);
		const { cells: next, focus } = fillOtp(cells, start, text, mode);
		update(next, focus);
	}

	// A click on a cell past the end of the code goes to the first empty one.
	function onFocus(i: number) {
		if (i > value.length) focusCell(value.length);
		else inputs[i]?.select();
	}
</script>

<div
	class="otp"
	class:otp--invalid={error}
	role="group"
	aria-labelledby="{id}-label"
	aria-describedby={describedBy}
>
	<span id="{id}-label" class="otp__label" class:sr-only={hideLabel}>{label}</span>
	<div class="otp__cells">
		{#each cells as cell, i}
			<input
				bind:this={inputs[i]}
				class="otp__cell"
				type="text"
				inputmode={mode === 'numeric' ? 'numeric' : 'text'}
				pattern={mode === 'numeric' ? '[0-9]*' : '[A-Za-z0-9]*'}
				autocomplete={i === 0 ? 'one-time-code' : 'off'}
				autocapitalize="characters"
				spellcheck="false"
				aria-label="{noun} {i + 1} of {length}"
				aria-invalid={error ? true : undefined}
				value={cell}
				{disabled}
				on:input={(e) => onInput(i, e)}
				on:keydown={(e) => onKeydown(i, e)}
				on:paste={(e) => onPaste(i, e)}
				on:focus={() => onFocus(i)}
			/>
		{/each}
	</div>
	{#if hint}<p id="{id}-hint" class="otp__hint">{hint}</p>{/if}
	{#if error}<p id="{id}-error" class="otp__error">{error}</p>{/if}
</div>

<style>
	.otp {
		display: grid;
		gap: var(--spacing-xs);
	}

	.otp__label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.otp__cells {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.otp__cell {
		width: 2.75rem;
		height: 3rem;
		box-sizing: border-box;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 600;
		text-align: center;
		caret-color: var(--color-primary);
	}

	.otp__cell:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.otp--invalid .otp__cell {
		border-color: var(--color-error);
	}

	.otp__hint,
	.otp__error {
		margin: 0;
		font-size: 0.8125rem;
	}

	.otp__hint {
		color: var(--color-text-secondary);
	}

	.otp__error {
		color: var(--color-error);
		font-weight: 600;
	}

	@media (max-width: 380px) {
		.otp__cells {
			gap: var(--spacing-xs);
		}

		.otp__cell {
			width: 2.4rem;
		}
	}
</style>
