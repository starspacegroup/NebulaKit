<!--
	RatingStars — a star rating, to read or to give.

	Display: stars are decoration; the rating is one text alternative ("4.5 out
	of 5 stars, 12 reviews") so a screen reader hears it once. Half stars round
	to the nearest half. Input: a real radio group (fieldset + legend), so arrow
	keys, Tab and form submission work natively; bind `value` (0 = none yet).
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { uid } from '$lib/ui/logic';
	import { ratingText, roundToHalf, starFill } from './logic';

	export let value = 0;
	export let max = 5;
	export let variant: 'display' | 'input' = 'display';
	/** Input: the legend. Display: not used (the text alternative is built from the numbers). */
	export let label = 'Your rating';
	/** Display: the review count, read with the rating. */
	export let count: number | undefined = undefined;
	/** Display: print "4.5" and the count beside the stars. */
	export let showValue = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let disabled = false;
	export let required = false;
	export let error = '';
	export let name: string = uid('rating');
	/** Template for the text alternative; {rating} and {max} are filled in. */
	export let textTemplate = '{rating} out of {max} stars';
	/** Input: how one radio is named; {n} and {max} are filled in. */
	export let optionLabel = '{n} out of {max} stars';

	const dispatch = createEventDispatcher<{ change: { value: number } }>();
	const errorId = uid('rating-error');

	$: stars = Array.from({ length: max }, (_, i) => i);
	$: text = ratingText(value, max, count, textTemplate);
	$: shown = roundToHalf(value, max);

	function optionText(n: number): string {
		return optionLabel.replace('{n}', String(n)).replace('{max}', String(max));
	}

	function pick(n: number) {
		if (disabled) return;
		value = n;
		dispatch('change', { value: n });
	}
</script>

{#if variant === 'display'}
	<span class="rating rating--{size}">
		<span class="rating__stars" aria-hidden="true">
			{#each stars as i (i)}
				<span class="star star--{starFill(value, i, max)}">
					<svg viewBox="0 0 24 24" focusable="false"
						><path
							d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z"
						/></svg
					>
				</span>
			{/each}
		</span>
		<span class="sr-only">{text}</span>
		{#if showValue}
			<span class="rating__value" aria-hidden="true"
				>{shown.toFixed(1)}{#if count !== undefined}
					<span class="rating__count">({count})</span>{/if}</span
			>
		{/if}
	</span>
{:else}
	<fieldset
		class="rating rating--{size} rating--input"
		{disabled}
		aria-describedby={error ? errorId : undefined}
	>
		<legend class="rating__legend"
			>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</legend
		>
		<div class="rating__stars">
			{#each stars as i (i)}
				<label class="pick" class:pick--on={value >= i + 1}>
					<input
						type="radio"
						{name}
						value={i + 1}
						checked={value === i + 1}
						{required}
						on:change={() => pick(i + 1)}
					/>
					<span class="sr-only">{optionText(i + 1)}</span>
					<span class="star star--{value >= i + 1 ? 'full' : 'empty'}" aria-hidden="true">
						<svg viewBox="0 0 24 24" focusable="false"
							><path
								d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z"
							/></svg
						>
					</span>
				</label>
			{/each}
		</div>
		{#if error}<p id={errorId} class="rating__error">{error}</p>{/if}
	</fieldset>
{/if}

<style>
	.rating {
		--star: 1.25rem;
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.rating--sm {
		--star: 1rem;
	}

	.rating--lg {
		--star: 1.75rem;
	}

	.rating__stars {
		display: inline-flex;
	}

	.rating__value {
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.rating__count {
		color: var(--color-text-secondary);
		font-weight: 400;
	}

	.star {
		position: relative;
		display: inline-block;
		width: var(--star);
		height: var(--star);
		color: var(--color-text-secondary);
	}

	.star svg {
		display: block;
		width: 100%;
		height: 100%;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	.star--full svg {
		fill: var(--color-warning);
	}

	/* A half star: the filled star is laid over the outline and clipped. */
	.star--half::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--color-warning);
		clip-path: polygon(50% 0, 50% 100%, 0 100%, 0 0);
		-webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z'/></svg>")
			center / 100% 100% no-repeat;
		mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z'/></svg>")
			center / 100% 100% no-repeat;
	}

	:global([dir='rtl']) .star--half::after {
		clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
	}

	@media (forced-colors: active) {
		.star--full svg {
			fill: Highlight;
		}

		.star--half::after {
			background: Highlight;
		}
	}

	/* Input */
	.rating--input {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		border: 0;
	}

	.rating__legend {
		padding: 0;
		color: var(--color-text);
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.pick {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		cursor: pointer;
	}

	.pick input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.pick:has(input:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		border-radius: var(--radius-md);
	}

	.pick:hover .star svg {
		fill: color-mix(in srgb, var(--color-warning) 55%, transparent);
	}

	.pick--on:hover .star svg {
		fill: var(--color-warning);
	}

	fieldset:disabled .pick {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.rating__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.8125rem;
		font-weight: 600;
	}
</style>
