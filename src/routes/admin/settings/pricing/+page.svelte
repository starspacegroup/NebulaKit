<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		formatMoney,
		overrideLines,
		parseOverrideLines,
		previewMultiplier,
		regionalPriceCents,
		type RegionalPricingSettings
	} from '@nebulakit/commerce';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The form edits percentages; the preview reads the same fields live, so
	// the owner sees what a setting will do before saving it.
	// svelte-ignore state_referenced_locally
	let enabled = $state(data.settings.enabled);
	// svelte-ignore state_referenced_locally
	let strength = $state(Math.round(data.settings.strength * 100));
	// svelte-ignore state_referenced_locally
	let maxDiscount = $state(Math.round(data.settings.maxDiscount * 100));
	// svelte-ignore state_referenced_locally
	let scope = $state<'digital' | 'all'>(data.settings.scope);
	// svelte-ignore state_referenced_locally
	let overrides = $state(overrideLines(data.settings.overrides));
	// svelte-ignore state_referenced_locally
	let country = $state(data.yourCountry ?? 'IN');
	let samplePrice = $state(2000);

	const draft = $derived<RegionalPricingSettings>({
		// Preview what the settings do when on, whatever the switch says now.
		enabled: true,
		strength: Math.min(Math.max(strength / 100, 0), 1),
		maxDiscount: Math.min(Math.max(maxDiscount / 100, 0), 0.9),
		scope,
		overrides: parseOverrideLines(overrides).overrides
	});
	const preview = $derived(previewMultiplier(draft, country));
	const sampleCents = $derived(Math.max(0, Math.round(samplePrice)));
	const previewCents = $derived(regionalPriceCents(sampleCents, preview.multiplier));
	const countryName = $derived.by(() => {
		if (!preview.country) return null;
		try {
			return new Intl.DisplayNames(['en'], { type: 'region' }).of(preview.country) ?? null;
		} catch {
			return null;
		}
	});
	const sources = {
		override: 'your override',
		index: 'the price level index',
		none: 'no index data for this country, so full price',
		disabled: ''
	} as const;
</script>

<svelte:head><title>Regional pricing</title></svelte:head>

<section class="pricing">
	<header>
		<h1>Regional pricing</h1>
		<p>
			Lower prices for shoppers in countries where money buys more, using the World Bank price level
			index (data from {data.priceLevelIndexUpdated}). Prices only ever go down. A shopper pays the
			least generous price among the countries their request, billing and shipping address point to,
			so a VPN alone does not earn a discount. Each order records the multiplier and countries used.
		</p>
	</header>

	{#if form?.saved}<p class="ok" role="status">Saved.</p>{/if}
	{#if form?.errors}
		<ul class="error" role="alert">
			{#each form.errors as problem (problem)}<li>{problem}</li>{/each}
		</ul>
	{/if}

	<form method="POST" action="?/save" use:enhance>
		<label class="check">
			<input type="checkbox" name="enabled" bind:checked={enabled} />
			Turn regional pricing on
		</label>
		<p class="hint">
			Off by default. While off, every shopper pays the catalog price. {enabled
				? ''
				: 'It is off now.'}
		</p>

		<label>
			How much of the price gap to pass on (percent)
			<input
				type="number"
				name="strength"
				min="0"
				max="100"
				step="1"
				bind:value={strength}
				required
				aria-describedby="strength-hint"
			/>
		</label>
		<p class="hint" id="strength-hint">
			At 50, a country whose prices are 40% of US prices gets 30% off (half of the 60% gap).
		</p>

		<label>
			Largest discount anyone gets (percent)
			<input
				type="number"
				name="maxDiscount"
				min="0"
				max="90"
				step="1"
				bind:value={maxDiscount}
				required
				aria-describedby="max-hint"
			/>
		</label>
		<p class="hint" id="max-hint">
			Protects your margin, including for your overrides. Never more than 90. A discount never takes
			a unit below {formatMoney(50, 'usd')} (or its own price, if lower).
		</p>

		<fieldset>
			<legend>Which products</legend>
			<label class="check">
				<input type="radio" name="scope" value="digital" bind:group={scope} />
				Digital products only
			</label>
			<label class="check">
				<input type="radio" name="scope" value="all" bind:group={scope} />
				All products
			</label>
			<p class="hint">
				A printed shirt costs you the same wherever it is sent, so lowering it comes out of your
				margin.
			</p>
		</fieldset>

		<label>
			Country overrides
			<textarea
				name="overrides"
				rows="4"
				bind:value={overrides}
				spellcheck="false"
				aria-describedby="overrides-hint"
				placeholder="IN 40"></textarea>
		</label>
		<p class="hint" id="overrides-hint">
			One per line: a country code, then the percent off. <code>IN 40</code> is 40% off;
			<code>CH 0</code> pins a country to full price. An override beats the index but not the largest-discount
			cap.
		</p>

		<button type="submit">Save</button>
	</form>

	<section class="preview" aria-labelledby="preview-title">
		<h2 id="preview-title">Preview</h2>
		<p class="hint">
			Uses the values above, as if regional pricing were on, whether or not you have saved them.
			{#if data.yourCountry}You appear to be in {data.yourCountry}.{/if}
		</p>
		<div class="row">
			<label>
				Country code
				<input bind:value={country} maxlength="2" autocomplete="off" spellcheck="false" />
			</label>
			<label>
				Catalog price (cents)
				<input type="number" min="0" step="1" bind:value={samplePrice} />
			</label>
		</div>
		<p role="status" aria-live="polite">
			{#if !preview.country}
				Enter a two-letter country code.
			{:else}
				{countryName ?? preview.country} pays <strong>{preview.multiplier * 100}%</strong> of the
				catalog price ({preview.discountPercent}% off), from {sources[preview.source]}:
				{formatMoney(sampleCents, 'usd')} becomes
				<strong>{formatMoney(previewCents, 'usd')}</strong>.
			{/if}
		</p>
	</section>
</section>

<style>
	.pricing {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 44rem;
		color: var(--color-text);
	}
	p,
	.hint {
		color: var(--color-text-secondary);
		margin: 0;
	}
	.hint {
		font-size: 0.875rem;
	}
	form,
	.preview {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
	}
	input,
	textarea {
		min-height: 2.75rem;
		padding: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	input[type='checkbox'],
	input[type='radio'] {
		min-height: 0;
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--color-primary-solid);
	}
	textarea {
		font-family: var(--font-mono);
	}
	fieldset {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	button {
		align-self: flex-start;
		min-height: 2.75rem;
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		cursor: pointer;
	}
	.ok {
		color: var(--color-success);
	}
	.error {
		color: var(--color-error);
		margin: 0;
	}
</style>
