<!--
	CheckoutForm — contact, shipping address (fields follow the country), a
	shipping method as radio cards, and an order summary. On a phone the summary
	is a disclosure above the form ("Show order summary  $42.00"); from 48rem it
	sits beside the form, always open. The pay button shows loading and keeps
	focus. Put your payment fields in the `payment` slot (see PaymentMethodForm,
	which is demo-only: use your processor's hosted fields in production).
-->
<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Field from '$lib/ui/Field.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		SHIPPING_COUNTRIES,
		EMPTY_SHIPPING_ADDRESS,
		addressRule,
		cartTotals,
		formatMoney,
		isValidCheckoutEmail,
		lineTotal,
		validateAddress,
		type ShippingAddress,
		type LineItem,
		type Promo,
		type ShippingMethod
	} from './logic';

	export let items: LineItem[] = [];
	export let shippingMethods: ShippingMethod[] = [];
	export let shippingMethod = shippingMethods[0]?.id ?? '';
	export let address: ShippingAddress = { ...EMPTY_SHIPPING_ADDRESS };
	export let email = '';
	export let countries = SHIPPING_COUNTRIES;
	export let currency = 'USD';
	export let locale = 'en-US';
	export let taxRate = 0;
	export let promo: Promo | null = null;
	export let loading = false;
	/** An error from the payment step (declined, etc.), shown above the pay button. */
	export let error = '';
	export let heading = 'Checkout';
	export let level: 2 | 3 | 4 = 2;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		contact: 'Contact',
		email: 'Email',
		emailRequired: 'Enter your email address.',
		emailFormat: 'Enter a valid email address, like name@example.com.',
		shipping: 'Shipping address',
		country: 'Country',
		name: 'Full name',
		line1: 'Address',
		line2: 'Apartment, suite, etc. (optional)',
		city: 'City',
		method: 'Shipping method',
		methodRequired: 'Choose a shipping method.',
		free: 'Free',
		payment: 'Payment',
		summary: 'Order summary',
		showSummary: 'Show order summary',
		hideSummary: 'Hide order summary',
		subtotal: 'Subtotal',
		discount: 'Discount',
		shippingLine: 'Shipping',
		shippingPending: 'Choose a method',
		tax: 'Tax',
		total: 'Total',
		quantityTimes: 'Quantity {quantity}',
		pay: 'Pay {amount}',
		errors: 'Fix {count} problems to continue:',
		errorsOne: 'Fix 1 problem to continue:'
	};

	const dispatch = createEventDispatcher<{
		submit: {
			email: string;
			address: ShippingAddress;
			shippingMethod: string;
			totals: ReturnType<typeof cartTotals>;
		};
	}>();

	const id = uid('checkout');
	let form: HTMLFormElement;
	let summaryEl: HTMLDivElement;
	let details: HTMLDetailsElement;
	let summaryOpen = true;
	let submitted = false;
	let touched: Record<string, boolean> = {};

	$: t = { ...defaults, ...labels };
	$: rule = addressRule(address.country);
	$: chosen = shippingMethods.find((m) => m.id === shippingMethod);
	$: totals = cartTotals(items, {
		taxRate,
		promo,
		shippingCents: chosen?.cents ?? 0
	});
	$: money = (cents: number) => formatMoney(cents, currency, locale);

	$: addressErrors = validateAddress(address);
	$: errors = (() => {
		const out: Record<string, string> = { ...addressErrors };
		if (!email.trim()) out.email = t.emailRequired;
		else if (!isValidCheckoutEmail(email)) out.email = t.emailFormat;
		if (shippingMethods.length && !chosen) out.method = t.methodRequired;
		return out;
	})();
	$: shown = (f: string) => (submitted || touched[f] ? (errors[f] ?? '') : '');
	$: errorFields = submitted ? Object.keys(errors) : [];

	const labelOf: Record<string, () => string> = {
		email: () => t.email,
		name: () => t.name,
		line1: () => t.line1,
		city: () => t.city,
		region: () => rule.regionLabel,
		postal: () => rule.postalLabel,
		country: () => t.country,
		method: () => t.method
	};

	onMount(() => {
		// Open on wide screens (the summary is a sidebar), closed on phones.
		const query = window.matchMedia('(min-width: 48rem)');
		const sync = () => (summaryOpen = query.matches);
		sync();
		if (query.addEventListener) query.addEventListener('change', sync);
		return () => query.removeEventListener?.('change', sync);
	});

	function touch(f: string) {
		touched = { ...touched, [f]: true };
	}

	function setCountry(event: Event) {
		address = { ...address, country: (event.currentTarget as HTMLSelectElement).value, region: '' };
	}

	async function onSubmit() {
		submitted = true;
		if (Object.keys(errors).length === 0) {
			dispatch('submit', { email: email.trim(), address, shippingMethod, totals });
			return;
		}
		await tick();
		summaryEl?.focus();
	}

	function focusField(f: string) {
		const target =
			form.querySelector<HTMLElement>(`[name="${f}"]`) ??
			form.querySelector<HTMLElement>(`[name="shippingMethod"]`);
		target?.focus();
	}

	function onToggle() {
		summaryOpen = details.open;
	}
</script>

<div class="checkout">
	<aside class="checkout__summary" aria-label={t.summary}>
		<details bind:this={details} open={summaryOpen} on:toggle={onToggle}>
			<summary>
				<span class="checkout__sumtitle">{summaryOpen ? t.hideSummary : t.showSummary}</span>
				<span class="checkout__sumtotal">{money(totals.total)}</span>
			</summary>
			<div class="sum">
				<h3 class="sr-only">{t.summary}</h3>
				<ul class="sum__lines">
					{#each items as item (item.id)}
						<li>
							<span class="sum__name"
								>{item.name}{#if item.variant}<span class="sum__variant">· {item.variant}</span
									>{/if}
								<span class="sum__qty"
									>{t.quantityTimes.replace('{quantity}', String(item.quantity))}</span
								></span
							>
							<span>{money(lineTotal(item))}</span>
						</li>
					{/each}
				</ul>
				<dl class="sum__totals" aria-live="polite">
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
						<dt>{t.shippingLine}</dt>
						<dd>
							{#if !chosen}{t.shippingPending}{:else if totals.shipping === 0}{t.free}{:else}{money(
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
					<div class="sum__total">
						<dt>{t.total}</dt>
						<dd>{money(totals.total)}</dd>
					</div>
				</dl>
			</div>
		</details>
	</aside>

	<form
		bind:this={form}
		class="checkout__form"
		novalidate
		on:submit|preventDefault={onSubmit}
		aria-labelledby="{id}-h"
	>
		<svelte:element this={`h${level}`} class="checkout__title" id="{id}-h">{heading}</svelte:element
		>

		{#if errorFields.length}
			<div bind:this={summaryEl} class="alertbox" role="alert" tabindex="-1">
				<p>
					{errorFields.length === 1
						? t.errorsOne
						: t.errors.replace('{count}', String(errorFields.length))}
				</p>
				<ul>
					{#each errorFields as f (f)}
						<li>
							<a href="#{id}-{f}" on:click|preventDefault={() => focusField(f)}
								>{labelOf[f]?.() ?? f}: {errors[f]}</a
							>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<fieldset class="group">
			<legend>{t.contact}</legend>
			<Field
				label={t.email}
				error={shown('email')}
				required
				id="{id}-email"
				let:describedBy
				let:invalid
			>
				<input
					id="{id}-email"
					name="email"
					type="email"
					autocomplete="email"
					inputmode="email"
					bind:value={email}
					required
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					on:blur={() => touch('email')}
				/>
			</Field>
		</fieldset>

		<fieldset class="group">
			<legend>{t.shipping}</legend>
			<Field
				label={t.country}
				error={shown('country')}
				required
				id="{id}-country"
				let:describedBy
				let:invalid
			>
				<select
					id="{id}-country"
					name="country"
					autocomplete="shipping country"
					value={address.country}
					required
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					on:change={setCountry}
				>
					{#each countries as c (c.value)}
						<option value={c.value}>{c.label}</option>
					{/each}
				</select>
			</Field>
			<Field
				label={t.name}
				error={shown('name')}
				required
				id="{id}-name"
				let:describedBy
				let:invalid
			>
				<input
					id="{id}-name"
					name="name"
					type="text"
					autocomplete="shipping name"
					bind:value={address.name}
					required
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					on:blur={() => touch('name')}
				/>
			</Field>
			<Field
				label={t.line1}
				error={shown('line1')}
				required
				id="{id}-line1"
				let:describedBy
				let:invalid
			>
				<input
					id="{id}-line1"
					name="line1"
					type="text"
					autocomplete="shipping address-line1"
					bind:value={address.line1}
					required
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					on:blur={() => touch('line1')}
				/>
			</Field>
			<Field label={t.line2} id="{id}-line2" let:describedBy>
				<input
					id="{id}-line2"
					name="line2"
					type="text"
					autocomplete="shipping address-line2"
					bind:value={address.line2}
					aria-describedby={describedBy}
				/>
			</Field>
			<div class="grid">
				<Field
					label={t.city}
					error={shown('city')}
					required
					id="{id}-city"
					let:describedBy
					let:invalid
				>
					<input
						id="{id}-city"
						name="city"
						type="text"
						autocomplete="shipping address-level2"
						bind:value={address.city}
						required
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
						on:blur={() => touch('city')}
					/>
				</Field>
				<Field
					label={rule.regionLabel}
					error={shown('region')}
					required={rule.regionRequired}
					id="{id}-region"
					let:describedBy
					let:invalid
				>
					{#if rule.regions.length}
						<select
							id="{id}-region"
							name="region"
							autocomplete="shipping address-level1"
							bind:value={address.region}
							required={rule.regionRequired}
							aria-describedby={describedBy}
							aria-invalid={invalid || undefined}
							on:blur={() => touch('region')}
						>
							<option value="" disabled>—</option>
							{#each rule.regions as r (r.value)}
								<option value={r.value}>{r.label}</option>
							{/each}
						</select>
					{:else}
						<input
							id="{id}-region"
							name="region"
							type="text"
							autocomplete="shipping address-level1"
							bind:value={address.region}
							aria-describedby={describedBy}
						/>
					{/if}
				</Field>
				<Field
					label={rule.postalLabel}
					error={shown('postal')}
					hint={rule.postalExample ? `e.g. ${rule.postalExample}` : ''}
					required={rule.postalRequired}
					id="{id}-postal"
					let:describedBy
					let:invalid
				>
					<input
						id="{id}-postal"
						name="postal"
						type="text"
						autocomplete="shipping postal-code"
						autocapitalize="characters"
						bind:value={address.postal}
						required={rule.postalRequired}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
						on:blur={() => touch('postal')}
					/>
				</Field>
			</div>
		</fieldset>

		{#if shippingMethods.length}
			<fieldset class="group" aria-describedby={shown('method') ? `${id}-method-err` : undefined}>
				<legend>{t.method}</legend>
				<div class="methods">
					{#each shippingMethods as m (m.id)}
						<label class="method" class:method--on={shippingMethod === m.id}>
							<input type="radio" name="shippingMethod" value={m.id} bind:group={shippingMethod} />
							<span class="method__text">
								<span class="method__label">{m.label}</span>
								{#if m.eta}<span class="method__eta">{m.eta}</span>{/if}
							</span>
							<span class="method__price">{m.cents === 0 ? t.free : money(m.cents)}</span>
						</label>
					{/each}
				</div>
				{#if shown('method')}<p id="{id}-method-err" class="err">{shown('method')}</p>{/if}
			</fieldset>
		{/if}

		<slot name="payment" />

		{#if error}<p class="alertbox alertbox--plain" role="alert">{error}</p>{/if}

		<Button type="submit" size="lg" block {loading}
			>{t.pay.replace('{amount}', money(totals.total))}</Button
		>
	</form>
</div>

<style>
	.checkout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
		color: var(--color-text);
	}

	.checkout__summary {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		min-height: 2.75rem;
		padding: var(--spacing-sm) var(--spacing-md);
		cursor: pointer;
		font-weight: 600;
	}

	.checkout__sumtotal {
		font-variant-numeric: tabular-nums;
	}

	.sum {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		padding: 0 var(--spacing-md) var(--spacing-md);
	}

	.sum__lines {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.sum__lines li,
	.sum__totals div {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.sum__name {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.sum__qty,
	.sum__variant {
		display: block;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.sum__variant {
		display: inline;
		margin-inline-start: var(--spacing-xs);
	}

	.sum__totals {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
	}

	.sum__totals dt {
		color: var(--color-text-secondary);
	}

	.sum__totals dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.sum__total {
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--color-border);
		font-size: 1.125rem;
		font-weight: 700;
	}

	.sum__total dt {
		color: var(--color-text);
	}

	.checkout__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.checkout__title {
		margin: 0;
		font-size: 1.5rem;
	}

	.group {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.group legend {
		margin-bottom: var(--spacing-sm);
		padding: 0;
		font-size: 1.0625rem;
		font-weight: 700;
	}

	.checkout :global(input[type='text']),
	.checkout :global(input[type='email']),
	.checkout :global(select) {
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.grid {
		display: grid;
		gap: var(--spacing-md);
		grid-template-columns: minmax(0, 1fr);
	}

	.methods {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.method {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		min-height: 2.75rem;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		cursor: pointer;
	}

	.method--on {
		border-color: var(--color-primary);
		outline: 1px solid var(--color-primary);
	}

	.method:has(input:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.method input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--color-primary-solid);
	}

	.method__text {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1;
		min-width: 0;
	}

	.method__label {
		font-weight: 600;
	}

	.method__eta {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.method__price {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.err {
		margin: 0;
		color: var(--color-error);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.alertbox {
		margin: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
	}

	.alertbox p {
		margin: 0 0 var(--spacing-xs);
		font-weight: 700;
	}

	.alertbox--plain {
		font-weight: 700;
	}

	.alertbox ul {
		margin: 0;
		padding-inline-start: var(--spacing-lg);
	}

	.alertbox a {
		color: var(--color-error);
	}

	.checkout :global(.btn) {
		min-height: 2.75rem;
	}

	@media (min-width: 30rem) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 48rem) {
		.checkout {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
			align-items: start;
		}

		/* Summary sits at the end (right in LTR) and is always open. */
		.checkout__summary {
			order: 2;
			position: sticky;
			inset-block-start: var(--spacing-md);
		}

		.checkout__form {
			order: 1;
		}

		/* Always open here, so the toggle goes; the sr-only heading names it. */
		summary {
			display: none;
		}
	}
</style>
