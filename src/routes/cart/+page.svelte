<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { formatMoney } from '@nebulakit/commerce';
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

	onMount(() => {
		if (returnedOrder) saveCart(localStorage, []);
		else cart = loadCart(localStorage);
		loaded = true;
	});

	function update(next: Cart) {
		cart = next;
		saveCart(localStorage, cart);
	}

	const currency = $derived(cart[0]?.currency ?? 'usd');
	const shipping = $derived(needsShipping(cart));

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
		<p role="status">Thank you. Your order is in. A receipt is on its way to your email.</p>
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
					<span>{formatMoney(line.unitPriceCents * line.quantity, line.currency)}</span>
					<button
						type="button"
						aria-label="Remove {line.name}"
						onclick={() => update(removeFromCart(cart, line.productId))}>Remove</button
					>
				</li>
			{/each}
		</ul>
		<p class="subtotal">
			Subtotal {formatMoney(cartSubtotalCents(cart), currency)}. Shipping and tax are added when you
			place the order.
		</p>

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
</style>
