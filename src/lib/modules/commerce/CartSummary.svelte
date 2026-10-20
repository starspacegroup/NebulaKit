<!--
	CartSummary — line items with a quantity stepper and remove, a promo code
	box, and subtotal / discount / shipping / tax / total. Quantity changes and
	removals update `items` and are announced in a polite status line; focus
	returns to the heading after a removal so it is never lost.

	Promo codes: pass `promos` to check codes here (a demo or a static list), or
	leave it null and handle the `applypromo` event, then set `promo` or
	`promoError` yourself.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import NumberInput from '$lib/ui/NumberInput.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		cartTotals,
		findPromo,
		formatMoney,
		lineTotal,
		type LineItem,
		type Promo
	} from './logic';

	export let items: LineItem[] = [];
	export let currency = 'USD';
	export let locale = 'en-US';
	export let taxRate = 0;
	/** Shipping in minor units; undefined shows "Calculated at checkout". */
	export let shippingCents: number | undefined = undefined;
	export let promos: Promo[] | null = null;
	export let promo: Promo | null = null;
	export let promoError = '';
	export let maxQuantity = 99;
	export let loading = false;
	export let checkoutHref: string | undefined = undefined;
	export let heading = 'Your cart';
	export let level: 2 | 3 | 4 = 2;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		items: '{count} items',
		itemsOne: '1 item',
		quantity: 'Quantity of {name}',
		remove: 'Remove',
		removeFor: 'Remove {name} from cart',
		promoLabel: 'Promo code',
		promoApply: 'Apply',
		promoApplied: 'Code {code} applied',
		promoRemove: 'Remove code',
		promoEmpty: 'Enter a promo code.',
		promoUnknown: 'That code is not valid.',
		promoMinimum: 'Spend {amount} or more to use this code.',
		subtotal: 'Subtotal',
		discount: 'Discount',
		shipping: 'Shipping',
		shippingLater: 'Calculated at checkout',
		free: 'Free',
		tax: 'Tax',
		total: 'Total',
		checkout: 'Checkout',
		emptyTitle: 'Your cart is empty',
		emptyHint: 'Add something and it will show up here.',
		removedStatus: '{name} removed from cart.',
		quantityStatus: '{name}: quantity {quantity}.'
	};

	const dispatch = createEventDispatcher<{
		quantity: { id: string; quantity: number };
		remove: { id: string };
		applypromo: { code: string };
		promo: { promo: Promo | null };
		checkout: { totals: ReturnType<typeof cartTotals> };
	}>();

	const titleId = uid('cart');
	let headingEl: HTMLElement;
	let code = '';
	let status = '';

	$: t = { ...defaults, ...labels };
	$: totals = cartTotals(items, { taxRate, shippingCents, promo });
	$: count = items.reduce((n, i) => n + i.quantity, 0);
	$: money = (cents: number) => formatMoney(cents, currency, locale);

	function setQuantity(item: LineItem, quantity: number | null) {
		const q = quantity ?? item.quantity;
		items = items.map((i) => (i.id === item.id ? { ...i, quantity: q } : i));
		status = t.quantityStatus.replace('{name}', item.name).replace('{quantity}', String(q));
		dispatch('quantity', { id: item.id, quantity: q });
	}

	async function remove(item: LineItem) {
		items = items.filter((i) => i.id !== item.id);
		status = t.removedStatus.replace('{name}', item.name);
		dispatch('remove', { id: item.id });
		await tick();
		headingEl?.focus();
	}

	function apply() {
		if (promos === null) {
			dispatch('applypromo', { code: code.trim() });
			return;
		}
		const result = findPromo(code, promos, totals.subtotal);
		if (result.ok) {
			promo = result.promo;
			promoError = '';
			code = '';
			dispatch('promo', { promo });
		} else {
			promoError =
				result.reason === 'empty'
					? t.promoEmpty
					: result.reason === 'minimum'
						? t.promoMinimum.replace('{amount}', money(result.minSubtotalCents ?? 0))
						: t.promoUnknown;
		}
	}

	function removePromo() {
		promo = null;
		promoError = '';
		dispatch('promo', { promo: null });
	}
</script>

<section class="cart" aria-labelledby={titleId}>
	<header class="cart__head">
		<svelte:element
			this={`h${level}`}
			class="cart__title"
			id={titleId}
			tabindex="-1"
			bind:this={headingEl}>{heading}</svelte:element
		>
		{#if items.length}<span class="cart__count"
				>{count === 1 ? t.itemsOne : t.items.replace('{count}', String(count))}</span
			>{/if}
	</header>

	<p class="sr-only" role="status">{status}</p>

	{#if items.length === 0}
		<EmptyState title={t.emptyTitle} description={t.emptyHint} icon="🛒">
			<slot name="empty" />
		</EmptyState>
	{:else}
		<ul class="lines">
			{#each items as item (item.id)}
				<li class="line">
					{#if item.image}<img class="line__img" src={item.image} alt="" loading="lazy" />{/if}
					<div class="line__main">
						<p class="line__name">{item.name}</p>
						{#if item.variant}<p class="line__variant">{item.variant}</p>{/if}
						<p class="line__unit">{money(item.unitCents)}</p>
					</div>
					<div class="line__qty">
						<NumberInput
							label={t.quantity.replace('{name}', item.name)}
							hideLabel
							value={item.quantity}
							min={1}
							max={maxQuantity}
							on:change={(e) => setQuantity(item, e.detail.value)}
						/>
					</div>
					<p class="line__total">{money(lineTotal(item))}</p>
					<button
						type="button"
						class="line__remove"
						aria-label={t.removeFor.replace('{name}', item.name)}
						on:click={() => remove(item)}>{t.remove}</button
					>
				</li>
			{/each}
		</ul>

		<form class="promo" on:submit|preventDefault={apply} novalidate>
			{#if promo}
				<p class="promo__applied">
					<span aria-hidden="true">✓</span>
					{t.promoApplied.replace('{code}', promo.code)}
					<button type="button" class="promo__remove" on:click={removePromo}>{t.promoRemove}</button
					>
				</p>
			{:else}
				<div class="promo__row">
					<TextInput
						label={t.promoLabel}
						bind:value={code}
						error={promoError}
						autocomplete="off"
						autocapitalize="characters"
						spellcheck="false"
					/>
					<Button type="submit" variant="secondary">{t.promoApply}</Button>
				</div>
			{/if}
		</form>

		<dl class="totals" aria-live="polite">
			<div>
				<dt>{t.subtotal}</dt>
				<dd>{money(totals.subtotal)}</dd>
			</div>
			{#if totals.discount > 0}
				<div>
					<dt>{t.discount}</dt>
					<dd>−{money(totals.discount)}</dd>
				</div>
			{/if}
			<div>
				<dt>{t.shipping}</dt>
				<dd>
					{#if shippingCents === undefined}{t.shippingLater}{:else if totals.shipping === 0}{t.free}{:else}{money(
							totals.shipping
						)}{/if}
				</dd>
			</div>
			{#if taxRate > 0}
				<div>
					<dt>{t.tax}</dt>
					<dd>{money(totals.tax)}</dd>
				</div>
			{/if}
			<div class="totals__total">
				<dt>{t.total}</dt>
				<dd>{money(totals.total)}</dd>
			</div>
		</dl>

		<Button
			block
			size="lg"
			{loading}
			href={checkoutHref}
			on:click={() => dispatch('checkout', { totals })}>{t.checkout}</Button
		>
	{/if}
</section>

<style>
	.cart {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		color: var(--color-text);
	}

	.cart__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.cart__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.cart__title:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.cart__count {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.lines {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.line {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas:
			'img main total'
			'img qty remove';
		gap: var(--spacing-xs) var(--spacing-md);
		align-items: center;
		padding: var(--spacing-md) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.line:not(:has(.line__img)) {
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'main total'
			'qty remove';
	}

	.line__img {
		grid-area: img;
		width: 4rem;
		height: 4rem;
		border-radius: var(--radius-md);
		object-fit: cover;
		background: var(--color-surface-hover);
	}

	.line__main {
		grid-area: main;
		min-width: 0;
	}

	.line__name,
	.line__variant,
	.line__unit {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.line__name {
		font-weight: 600;
	}

	.line__variant,
	.line__unit {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.line__qty {
		grid-area: qty;
		min-width: 0;
	}

	.line__qty :global(.number) {
		max-width: 10rem;
	}

	.line__qty :global(.number__step) {
		width: 2.75rem;
		min-height: 2.75rem;
	}

	.line__total {
		grid-area: total;
		margin: 0;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: end;
	}

	.line__remove,
	.promo__remove {
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm);
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: underline;
	}

	.line__remove {
		grid-area: remove;
		justify-self: end;
	}

	.promo__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: var(--spacing-sm);
	}

	.promo__row :global(.field__label) {
		font-size: 0.875rem;
	}

	.promo__row :global(.btn) {
		min-height: 2.75rem;
		margin-top: 1.6rem;
	}

	.promo__applied {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		margin: 0;
		font-weight: 600;
	}

	.totals {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
	}

	.totals div {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.totals dt {
		color: var(--color-text-secondary);
	}

	.totals dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		text-align: end;
	}

	.totals__total {
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--color-border);
		font-size: 1.125rem;
		font-weight: 700;
	}

	.totals__total dt {
		color: var(--color-text);
	}

	.cart :global(.btn) {
		min-height: 2.75rem;
	}
</style>
