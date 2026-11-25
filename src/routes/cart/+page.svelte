<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import CardField from '$lib/components/CardField.svelte';
	import { onMount, tick } from 'svelte';
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

	let { data } = $props();

	// With on-page checkout configured, the card form is drawn here and the order is paid on this
	// page (docs/CHECKOUT.md). Otherwise the shopper is sent to Stripe's page, or the shop arranges
	// payment. The key is public; it only draws the form.
	const stripeKey = $derived(data.checkout?.publishableKey ?? null);

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
	let problemsBox = $state<HTMLElement>();
	let card = $state<ReturnType<typeof CardField>>();
	let cardReady = $state(false);
	/** The order this checkout made, once the server has made it; kept for "Cancel order". */
	let pendingOrderId = $state<string | null>(null);
	let cancelling = $state(false);
	let cancelled = $state(false);

	/**
	 * This checkout's id, made once per tab and sent with every "Pay": a double click or a retry
	 * after a declined card finds the same order and payment instead of making another. Forgotten
	 * when the checkout ends (paid, cancelled), so the next one starts afresh.
	 */
	const KEY_STORE = 'nk-checkout-key';
	function checkoutKey(): string {
		try {
			const saved = sessionStorage.getItem(KEY_STORE);
			if (saved) return saved;
			const made = crypto.randomUUID();
			sessionStorage.setItem(KEY_STORE, made);
			return made;
		} catch {
			return crypto.randomUUID();
		}
	}
	function forgetCheckout() {
		try {
			sessionStorage.removeItem(KEY_STORE);
		} catch {
			// nothing saved
		}
		pendingOrderId = null;
	}

	/** Show problems and move focus to them, so a keyboard or screen reader user lands on what to fix. */
	async function showProblems(list: string[]) {
		problems = list.filter(Boolean);
		await tick();
		problemsBox?.focus();
	}
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
			forgetCheckout();
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
	/** Bumped to ask the server for the quote again (the total changed under the shopper). */
	let quoteRefresh = $state(0);

	$effect(() => {
		void quoteRefresh;
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
		if (placing) return;
		placing = true;
		problems = [];
		cancelled = false;
		try {
			// The card is checked before an order exists, so a mistyped card costs no order.
			if (stripeKey) {
				const wrong = card
					? await card.check()
					: 'The card form is still loading. Try again in a moment.';
				if (wrong) return await showProblems([wrong]);
			}
			// Product ids and quantities only. Every price is the server's.
			const response = await fetch('/api/v1/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					lines: checkoutLines(cart),
					...(shipping ? { shippingAddress: address } : {}),
					...(stripeKey ? { onSite: true, checkoutKey: checkoutKey() } : {})
				})
			});
			const body = await response.json();
			if (response.status === 409 && body.orderId) {
				// This checkout is over: paid (show it) or cancelled (start a fresh one).
				forgetCheckout();
				if (body.orderStatus === 'paid' || body.orderStatus === 'pending') {
					return showOrder(body.orderId);
				}
				return await showProblems([body.error]);
			}
			if (!response.ok) {
				return await showProblems([body.error, ...(body.details ?? [])]);
			}
			if (stripeKey && body.payment?.clientSecret) {
				pendingOrderId = body.order.id;
				const due = body.order.totalCents as number;
				if (quote && (due !== quote.totalCents || body.order.currency !== quote.currency)) {
					// Never charge a total the shopper has not seen: show the server's, ask again.
					quoteRefresh += 1;
					return await showProblems([
						`The total is now ${formatMoney(due, body.order.currency)}. Check it, then pay again.`
					]);
				}
				// Charge the card. The cart is kept until the payment is confirmed, so a declined
				// card loses nothing: the shopper corrects it and pays the same order.
				const declined = await card?.pay(
					body.payment.clientSecret,
					`${window.location.origin}/cart?order=${encodeURIComponent(body.order.id)}`,
					due
				);
				if (declined !== null) {
					return await showProblems([
						declined ?? 'The card form is still loading. Try again in a moment.'
					]);
				}
				// Stripe took the card. The order is marked paid by Stripe's signed notice to the
				// server, not by this page: the order's own page waits for it.
				return showOrder(body.order.id);
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
			await showProblems(['Could not reach the shop. If a charge shows on your card, contact us.']);
		} finally {
			placing = false;
		}
	}

	/** The card went through: the order's status page takes over (it also empties the cart). */
	function showOrder(orderId: string) {
		forgetCheckout();
		window.location.assign(`/cart?order=${encodeURIComponent(orderId)}`);
	}

	/** Back out of the order this checkout made. Stripe closes the payment first, so it can never be paid later. */
	async function cancelOrder() {
		if (!pendingOrderId || cancelling) return;
		cancelling = true;
		try {
			const response = await fetch('/api/v1/checkout/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderId: pendingOrderId })
			});
			const body = await response.json().catch(() => ({}));
			if (response.status === 409) return showOrder(pendingOrderId);
			if (!response.ok) return await showProblems([body.error ?? 'Could not cancel the order.']);
			forgetCheckout();
			problems = [];
			cancelled = true;
		} catch {
			await showProblems(['Could not reach the shop. Nothing more will be charged.']);
		} finally {
			cancelling = false;
		}
	}
</script>

<SharingMeta title="Cart" noindex={true} />

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
			{#if stripeKey}
				<fieldset class="payment">
					<legend>Payment</legend>
					<CardField
						bind:this={card}
						bind:ready={cardReady}
						publishableKey={stripeKey}
						amountCents={quote?.totalCents ?? cartSubtotalCents(cart)}
						currency={quote?.currency ?? currency}
					/>
				</fieldset>
			{/if}
			<div
				class="problems-box"
				bind:this={problemsBox}
				tabindex="-1"
				aria-live="assertive"
				data-testid="checkout-problems"
			>
				{#if problems.length}
					<ul class="problems" role="alert">
						{#each problems as problem (problem)}<li>{problem}</li>{/each}
					</ul>
				{/if}
			</div>
			{#if cancelled}
				<p role="status">Your order was cancelled. Nothing was charged.</p>
			{/if}
			<button type="submit" disabled={placing || (!!stripeKey && !cardReady)}>
				{#if placing}
					{stripeKey ? 'Paying…' : 'Placing order…'}
				{:else if stripeKey && quote}
					Pay {formatMoney(quote.totalCents, quote.currency)}
				{:else if stripeKey}
					Pay
				{:else}
					Place order
				{/if}
			</button>
			{#if stripeKey && pendingOrderId}
				<button type="button" class="cancel" onclick={cancelOrder} disabled={cancelling || placing}>
					{cancelling ? 'Cancelling…' : 'Cancel order'}
				</button>
			{/if}
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
	.problems-box:focus {
		outline: none;
	}
	.problems-box:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.payment {
		margin-top: 0.5rem;
	}
	button:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
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
