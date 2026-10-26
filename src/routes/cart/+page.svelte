<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { formatMoney } from '@nebulakit/commerce';
	import { waitForOrderPaid, type OrderWait } from '$lib/shop/order-status';
	import {
		cartSubtotalCents,
		checkoutLines,
		loadCart,
		needsShipping,
		removeFromCart,
		saveCart,
		setQuantity,
		type Cart
	} from '$lib/shop/cart';

	let cart = $state<Cart>([]);
	let loaded = $state(false);
	let email = $state('');
	let address = $state({
		name: '',
		line1: '',
		line2: '',
		city: '',
		state: '',
		postalCode: '',
		country: 'US'
	});
	let placing = $state(false);
	let problems = $state<string[]>([]);
	let placed = $state<{ id: string; totalCents: number; currency: string } | null>(null);

	// Coming back from the payment page with ?order=…, the cart has been paid for.
	const returnedOrder = $derived(page.url.searchParams.get('order'));

	// 'checking' until the server says otherwise. The redirect back from the
	// payment page proves nothing; only the order's status does.
	let returnState = $state<OrderWait | 'checking'>('checking');

	onMount(() => {
		const controller = new AbortController();
		if (returnedOrder) {
			saveCart(localStorage, []);
			waitForOrderPaid(returnedOrder, { signal: controller.signal }).then((result) => {
				if (!controller.signal.aborted) returnState = result;
			});
		} else {
			cart = loadCart(localStorage);
		}
		loaded = true;
		return () => controller.abort();
	});

	function update(next: Cart) {
		cart = next;
		saveCart(localStorage, cart);
	}

	const currency = $derived(cart[0]?.currency ?? 'usd');
	const shipping = $derived(needsShipping(cart));

	// What the server says this cart costs, regional pricing included. The
	// prices stored in the cart are only a first guess shown until it answers.
	interface Quote {
		currency: string;
		lines: { productId: string; lineTotalCents: number }[];
		subtotalCents: number;
		baseSubtotalCents: number;
		shippingCents: number;
		taxCents: number;
		totalCents: number;
		regional: { discountPercent: number; notice: string | null } | null;
	}
	let quote = $state<Quote | null>(null);
	let quoteFailed = $state(false);
	let quoteRun = 0;

	$effect(() => {
		if (!loaded || returnedOrder || placed || cart.length === 0) return;
		const run = ++quoteRun;
		const country = shipping && /^[A-Za-z]{2}$/.test(address.country) ? address.country : undefined;
		const body = JSON.stringify({
			lines: checkoutLines(cart),
			...(country ? { shippingCountry: country.toUpperCase() } : {})
		});
		(async () => {
			try {
				const response = await fetch('/api/v1/checkout/quote', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body
				});
				const result = await response.json();
				if (run !== quoteRun) return;
				quote = response.ok ? result.quote : null;
				quoteFailed = !response.ok;
			} catch {
				if (run === quoteRun) {
					quote = null;
					quoteFailed = true;
				}
			}
		})();
	});

	const lineTotal = (line: (typeof cart)[number]) =>
		quote?.lines.find((l) => l.productId === line.productId)?.lineTotalCents ??
		line.unitPriceCents * line.quantity;

	async function checkout(event: SubmitEvent) {
		event.preventDefault();
		placing = true;
		problems = [];
		try {
			const response = await fetch('/api/v1/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					lines: checkoutLines(cart),
					...(shipping ? { shippingAddress: address } : {})
				})
			});
			const body = await response.json();
			if (!response.ok) {
				problems = [body.error, ...(body.details ?? [])].filter(Boolean);
				return;
			}
			update([]);
			if (body.payment?.redirectUrl) {
				window.location.href = body.payment.redirectUrl;
				return;
			}
			placed = {
				id: body.order.id,
				totalCents: body.order.totalCents,
				currency: body.order.currency
			};
		} catch {
			problems = ['Could not reach the shop. Nothing was ordered.'];
		} finally {
			placing = false;
		}
	}
</script>

<svelte:head>
	<title>Cart</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="cart">
	<h1>Cart</h1>

	{#if returnedOrder}
		<div role="status" aria-live="polite">
			{#if returnState === 'checking'}
				<p>Confirming your payment…</p>
			{:else if returnState === 'paid'}
				<p>Thank you. Your payment is confirmed. A receipt is on its way to your email.</p>
			{:else if returnState === 'cancelled'}
				<p>
					This order was cancelled and you have not been charged. You can start again from the shop.
				</p>
			{:else if returnState === 'pending'}
				<p>
					We are still confirming your payment. Some payment methods take longer to clear than a
					card. Nothing is wrong, and we will email you when it settles.
				</p>
			{:else}
				<p>
					We could not check your payment from here. If you were charged, a receipt will arrive by
					email; if it does not, contact the shop and quote order {returnedOrder}.
				</p>
			{/if}
		</div>
		<p><a href="/shop">Keep shopping</a></p>
	{:else if placed}
		<p role="status">
			Order placed: {formatMoney(placed.totalCents, placed.currency)}. The shop will send payment
			details to {email}.
		</p>
		<p><a href="/shop">Keep shopping</a></p>
	{:else if !loaded}
		<p>Loading your cart…</p>
	{:else if cart.length === 0}
		<p>Your cart is empty.</p>
		<p><a href="/shop">Browse the shop</a></p>
	{:else}
		<ul class="lines">
			{#each cart as line (line.productId)}
				<li>
					<a href="/shop/{line.slug}">{line.name}</a>
					<label>
						<span class="sr-only">Quantity for {line.name}</span>
						<input
							type="number"
							min="1"
							step="1"
							value={line.quantity}
							onchange={(e) =>
								update(setQuantity(cart, line.productId, e.currentTarget.valueAsNumber))}
						/>
					</label>
					<span>{formatMoney(lineTotal(line), quote?.currency ?? line.currency)}</span>
					<button
						type="button"
						aria-label="Remove {line.name}"
						onclick={() => update(removeFromCart(cart, line.productId))}>Remove</button
					>
				</li>
			{/each}
		</ul>
		{#if quote}
			{#if quote.regional?.notice}
				<p class="notice" role="status">
					{quote.regional.notice}
					Without it this cart would be {formatMoney(quote.baseSubtotalCents, quote.currency)}.
				</p>
			{/if}
			<dl class="totals" aria-live="polite">
				<div>
					<dt>Subtotal</dt>
					<dd>{formatMoney(quote.subtotalCents, quote.currency)}</dd>
				</div>
				<div>
					<dt>Shipping</dt>
					<dd>{formatMoney(quote.shippingCents, quote.currency)}</dd>
				</div>
				<div>
					<dt>Tax</dt>
					<dd>{formatMoney(quote.taxCents, quote.currency)}</dd>
				</div>
				<div class="grand">
					<dt>Total</dt>
					<dd>{formatMoney(quote.totalCents, quote.currency)}</dd>
				</div>
			</dl>
		{:else}
			<p class="subtotal">
				Subtotal {formatMoney(cartSubtotalCents(cart), currency)}{quoteFailed
					? ' (could not be confirmed just now)'
					: ''}. Shipping and tax are added when you place the order.
			</p>
		{/if}

		<form onsubmit={checkout}>
			<h2>Checkout</h2>
			<label>Email <input type="email" bind:value={email} required autocomplete="email" /></label>
			{#if shipping}
				<fieldset>
					<legend>Shipping address</legend>
					<label>Name <input bind:value={address.name} required autocomplete="name" /></label>
					<label
						>Address <input
							bind:value={address.line1}
							required
							autocomplete="address-line1"
						/></label
					>
					<label
						>Address line 2 <input bind:value={address.line2} autocomplete="address-line2" /></label
					>
					<label
						>City <input bind:value={address.city} required autocomplete="address-level2" /></label
					>
					<label
						>State or region <input
							bind:value={address.state}
							autocomplete="address-level1"
						/></label
					>
					<label
						>Postal code <input
							bind:value={address.postalCode}
							required
							autocomplete="postal-code"
						/></label
					>
					<label
						>Country (2 letters) <input
							bind:value={address.country}
							required
							minlength="2"
							maxlength="2"
							autocomplete="country"
						/></label
					>
				</fieldset>
			{/if}
			{#if problems.length}
				<ul class="problems" role="alert">
					{#each problems as problem (problem)}<li>{problem}</li>{/each}
				</ul>
			{/if}
			<button type="submit" disabled={placing}>{placing ? 'Placing order…' : 'Place order'}</button>
		</form>
	{/if}
</section>

<style>
	.cart {
		max-width: 44rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		color: var(--color-text);
	}
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.lines li {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}
	@media (max-width: 30rem) {
		.lines li {
			grid-template-columns: 1fr auto;
		}
	}
	form,
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border: 0;
		padding: 0;
		margin: 0;
	}
	fieldset {
		margin-top: 0.5rem;
	}
	legend {
		font-weight: 600;
		padding: 0;
		margin-bottom: 0.5rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	input {
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	.lines input {
		width: 5rem;
	}
	button {
		min-height: 2.75rem;
		padding: 0 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
	form > button[type='submit'] {
		border: 0;
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font-weight: 600;
	}
	button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.problems {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-danger);
	}
	.subtotal {
		color: var(--color-text-secondary);
	}
	.notice {
		padding: 0.75rem;
		border: 1px solid var(--color-success);
		border-radius: var(--radius-md);
	}
	.totals {
		margin: 1rem 0;
	}
	.totals div {
		display: flex;
		justify-content: space-between;
		padding: 0.25rem 0;
	}
	.totals dt {
		color: var(--color-text-secondary);
	}
	.totals dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.totals .grand {
		border-top: 1px solid var(--color-border);
		font-weight: 700;
	}
	.totals .grand dt {
		color: var(--color-text);
	}
</style>
