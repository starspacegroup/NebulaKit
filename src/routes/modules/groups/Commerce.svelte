<!-- /modules demos: Commerce. Fake local data only; nothing is charged or fetched. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BillingOverview,
		CartSummary,
		ChangelogList,
		CheckoutForm,
		CouponBanner,
		InvoiceList,
		OrderStatusTracker,
		PaymentMethodCard,
		PaymentMethodForm,
		ProductCard,
		ProductGallery,
		RatingStars,
		ReviewsRatings,
		StatusPage,
		UsageMeters,
		WaitlistSignup
	} from '$lib/modules/commerce';
	import type {
		ChangeType,
		Invoice,
		LineItem,
		UsageMeter,
		Promo,
		Release,
		Review,
		SystemComponent,
		Incident,
		UptimeDay
	} from '$lib/modules/commerce';
	import ModuleItem from '../ModuleItem.svelte';

	// A fixed "now" so every demo renders the same on server and client.
	const now = new Date('2026-10-13T12:00:00Z');

	// Tiny inline pictures, so nothing is fetched.
	function picture(label: string, hue: number): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="hsl(${hue} 45% 60%)"/><text x="200" y="165" font-size="44" text-anchor="middle" fill="white" font-family="sans-serif">${label}</text></svg>`;
		return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	}

	const meters: UsageMeter[] = [
		{ id: 'api', label: 'API calls', used: 8400, limit: 10000, unit: 'calls' },
		{ id: 'storage', label: 'Storage', used: 3.2, limit: 50, unit: 'GB' },
		{ id: 'seats', label: 'Seats', used: 12, limit: 10, unit: 'seats' },
		{ id: 'email', label: 'Emails sent', used: 4200, limit: null }
	];

	let billingNote = '';
	let billingCancelling = false;

	const invoices: Invoice[] = Array.from({ length: 12 }, (_, i) => ({
		id: `inv-${i + 1}`,
		number: `INV-${1012 - i}`,
		date: new Date(Date.UTC(2026, 9 - i, 1)).toISOString().slice(0, 10),
		amountCents: i === 4 ? 0 : 2900,
		status: i === 0 ? 'open' : i === 1 ? 'overdue' : i === 5 ? 'refunded' : 'paid',
		description: 'Pro plan, monthly',
		downloadUrl: i % 2 === 0 ? undefined : '#invoice'
	}));
	let invoicePage = 1;
	let invoiceNote = '';

	let methods = [
		{
			id: 'pm1',
			brand: 'visa' as const,
			last4: '4242',
			expMonth: 12,
			expYear: 2028,
			holder: 'Ada Lovelace',
			isDefault: true
		},
		{
			id: 'pm2',
			brand: 'amex' as const,
			last4: '0005',
			expMonth: 11,
			expYear: 2026,
			isDefault: false
		},
		{
			id: 'pm3',
			brand: 'mastercard' as const,
			last4: '4444',
			expMonth: 3,
			expYear: 2025,
			isDefault: false
		}
	];
	let formNote = '';

	let cartItems: LineItem[] = [
		{
			id: 'mug',
			name: 'Ceramic mug',
			variant: 'White',
			unitCents: 1800,
			quantity: 2,
			image: picture('Mug', 200)
		},
		{
			id: 'tote',
			name: 'Canvas tote',
			variant: 'Natural',
			unitCents: 2400,
			quantity: 1,
			image: picture('Tote', 30)
		}
	];
	const promos: Promo[] = [
		{ code: 'SAVE10', kind: 'percent', value: 10 },
		{ code: 'BIG', kind: 'fixed', value: 1000, minSubtotalCents: 10000 },
		{ code: 'SHIPFREE', kind: 'shipping' }
	];
	let cartNote = '';

	const shippingMethods = [
		{ id: 'standard', label: 'Standard', cents: 500, eta: '3 to 5 business days' },
		{ id: 'express', label: 'Express', cents: 1500, eta: '1 to 2 business days' },
		{ id: 'pickup', label: 'Pick up in store', cents: 0, eta: 'Ready tomorrow' }
	];
	let paying = false;
	let checkoutNote = '';
	function pay(e: CustomEvent<{ totals: { total: number } }>) {
		paying = true;
		checkoutNote = '';
		setTimeout(() => {
			paying = false;
			checkoutNote = `Demo only: would charge ${e.detail.totals.total} minor units.`;
		}, 900);
	}

	const steps = [
		{ id: 'placed', label: 'Order placed', at: '2026-10-11' },
		{
			id: 'packed',
			label: 'Packed',
			description: 'Packed at the Lewiston warehouse',
			at: '2026-10-12'
		},
		{ id: 'shipped', label: 'Shipped', description: 'On its way with the courier' },
		{ id: 'delivered', label: 'Delivered' }
	];
	let trackerStep = 2;

	let products = [
		{
			id: 'p1',
			name: 'Ceramic mug',
			image: picture('Mug', 200),
			imageAlt: 'White ceramic mug',
			priceCents: 1800,
			rating: 4.5,
			reviewCount: 32,
			href: '#product-card'
		},
		{
			id: 'p2',
			name: 'Canvas tote',
			image: picture('Tote', 30),
			imageAlt: 'Natural canvas tote bag',
			priceCents: 2800,
			salePriceCents: 2100,
			rating: 4,
			reviewCount: 8
		},
		{
			id: 'p3',
			name: 'Enamel pin',
			priceCents: 900,
			imageAlt: '',
			rating: 5,
			reviewCount: 1,
			soldOut: true
		}
	];
	let addedNote = '';
	let addingId = '';
	function add(e: CustomEvent<{ id: string }>) {
		addingId = e.detail.id;
		addedNote = '';
		setTimeout(() => {
			addingId = '';
			addedNote = `Added ${e.detail.id} (demo).`;
		}, 600);
	}

	const galleryImages = [
		{ src: picture('Front', 210), alt: 'Front of the mug' },
		{ src: picture('Side', 150), alt: 'Side of the mug with its handle' },
		{ src: picture('Top', 280), alt: 'Looking down into the mug' },
		{ src: picture('Box', 20), alt: 'The mug in its gift box' }
	];
	let galleryIndex = 0;

	let reviews: Review[] = [
		{
			id: 'r1',
			author: 'Ada',
			rating: 5,
			title: 'Perfect',
			body: 'Keeps my tea hot for ages and looks great.',
			date: '2026-09-30',
			helpful: 12
		},
		{
			id: 'r2',
			author: 'Grace',
			rating: 4,
			body: 'Lovely, a little smaller than I expected.',
			date: '2026-09-12',
			helpful: 3
		},
		{
			id: 'r3',
			author: 'Linus',
			rating: 2,
			title: 'Chipped',
			body: 'Arrived with a chip on the rim. Support was quick to replace it.',
			date: '2026-08-02',
			helpful: 7
		},
		{
			id: 'r4',
			author: 'Margaret',
			rating: 5,
			body: 'Bought four as gifts.',
			date: '2026-07-19',
			helpful: 0
		}
	];
	let reviewNote = '';
	let mine = 3;

	function days(
		pattern: Record<number, UptimeDay['status']>,
		minutes: Record<number, number> = {}
	): UptimeDay[] {
		return Array.from({ length: 90 }, (_, i) => {
			const d = new Date(Date.UTC(2026, 9, 13 - (89 - i)));
			return {
				date: d.toISOString().slice(0, 10),
				status: pattern[i] ?? 'up',
				minutes: minutes[i]
			};
		});
	}
	const systemComponents: SystemComponent[] = [
		{
			id: 'web',
			name: 'Website',
			status: 'operational',
			days: days({ 20: 'degraded', 61: 'down' }, { 20: 14, 61: 42 })
		},
		{
			id: 'api',
			name: 'API',
			status: 'degraded',
			description: 'Elevated latency on some requests.',
			days: days({ 88: 'degraded', 89: 'degraded', 40: 'down' }, { 88: 30, 89: 55, 40: 8 })
		},
		{ id: 'mail', name: 'Email delivery', status: 'operational', days: days({}) }
	];
	const incidents: Incident[] = [
		{
			id: 'i1',
			title: 'Elevated API latency',
			status: 'monitoring',
			startedAt: '2026-10-12T18:20:00Z',
			updates: [
				{
					at: '2026-10-13T08:00:00Z',
					status: 'Monitoring',
					text: 'A fix is deployed. We are watching error rates.'
				},
				{
					at: '2026-10-12T18:20:00Z',
					status: 'Investigating',
					text: 'Some requests are slower than usual.'
				}
			]
		},
		{
			id: 'i2',
			title: 'Website outage',
			status: 'resolved',
			startedAt: '2026-08-13T06:10:00Z',
			updates: [
				{ at: '2026-08-13T06:52:00Z', status: 'Resolved', text: 'A bad deploy was rolled back.' }
			]
		}
	];

	const releases: Release[] = [
		{
			version: '2.1.0',
			date: '2026-10-08',
			title: 'Faster reports',
			changes: [
				{ type: 'feature', text: 'Scheduled report emails.' },
				{ type: 'improvement', text: 'Reports load twice as fast.' },
				{ type: 'fix', text: 'Fixed a blank chart in Safari.' }
			]
		},
		{
			version: '2.0.1',
			date: '2026-09-21',
			changes: [
				{ type: 'security', text: 'Tightened session expiry.' },
				{ type: 'fix', text: 'Fixed duplicate invoice emails.' }
			]
		},
		{
			version: '2.0.0',
			date: '2026-09-01',
			title: 'New dashboard',
			changes: [
				{ type: 'breaking', text: 'The v1 API is removed. See the migration guide.' },
				{ type: 'feature', text: 'A redesigned dashboard.' },
				{ type: 'deprecated', text: 'The legacy export format.' }
			]
		}
	];
	let changeTypes: ChangeType[] = [];

	let waitState: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	let waitEmail = '';
	function join(e: CustomEvent<{ email: string }>) {
		waitState = 'submitting';
		setTimeout(() => {
			waitState = e.detail.email.startsWith('fail') ? 'error' : 'success';
		}, 700);
	}

	let couponEnds = '2026-10-15T15:04:05Z';
	let liveEnds = '';
	onMount(() => {
		liveEnds = new Date(Date.now() + 3 * 3600_000 + 25 * 60_000).toISOString();
	});
</script>

<ModuleItem id="billing-overview">
	<BillingOverview
		plan={{ name: 'Pro', priceCents: 2900, interval: 'month' }}
		renewsAt="2026-11-01T00:00:00Z"
		{meters}
		resetsAt="2026-11-01T00:00:00Z"
		{now}
		busy={billingCancelling}
		on:upgrade={() => (billingNote = 'Upgrade clicked.')}
		on:cancel={() => (billingNote = 'Cancel confirmed (demo).')}
	/>
	<p role="status">{billingNote}</p>
</ModuleItem>

<ModuleItem id="usage-meters">
	<UsageMeters {meters} resetsAt="2026-11-01T00:00:00Z" {now} />
</ModuleItem>

<ModuleItem id="invoice-list">
	<InvoiceList
		{invoices}
		pageSize={4}
		bind:page={invoicePage}
		on:download={(e) => (invoiceNote = `Download ${e.detail.invoice.number}`)}
	/>
	<p role="status">{invoiceNote}</p>
</ModuleItem>

<ModuleItem id="payment-method-card">
	<div class="stack">
		{#each methods as method (method.id)}
			<PaymentMethodCard
				{method}
				{now}
				on:setDefault={(e) =>
					(methods = methods.map((m) => ({ ...m, isDefault: m.id === e.detail.id })))}
				on:remove={(e) => (methods = methods.filter((m) => m.id !== e.detail.id))}
			/>
		{/each}
		{#if methods.length === 0}<p>All cards removed. Reload the page to reset the demo.</p>{/if}
	</div>
</ModuleItem>

<ModuleItem id="payment-method-form">
	<PaymentMethodForm
		{now}
		on:submit={(e) =>
			(formNote = `Valid ${e.detail.brand} card ending ${e.detail.last4} (demo, nothing sent).`)}
	/>
	<p role="status">{formNote}</p>
</ModuleItem>

<ModuleItem id="checkout-form">
	<CheckoutForm
		items={cartItems}
		{shippingMethods}
		taxRate={0.08}
		loading={paying}
		on:submit={pay}
	/>
	<p role="status">{checkoutNote}</p>
</ModuleItem>

<ModuleItem id="cart-summary">
	<CartSummary
		bind:items={cartItems}
		{promos}
		taxRate={0.08}
		shippingCents={500}
		on:checkout={() => (cartNote = 'Checkout clicked.')}
	>
		<button
			slot="empty"
			type="button"
			on:click={() =>
				(cartItems = [{ id: 'mug', name: 'Ceramic mug', unitCents: 1800, quantity: 1 }])}
			>Add a mug</button
		>
	</CartSummary>
	<p role="status">{cartNote}</p>
	<p>Try the codes SAVE10 and SHIPFREE.</p>
</ModuleItem>

<ModuleItem id="order-status-tracker">
	<OrderStatusTracker {steps} current={trackerStep} eta="2026-10-17" orderNumber="#10482" />
	<p>
		<label
			>Step in progress
			<select bind:value={trackerStep}>
				<option value={0}>Order placed</option>
				<option value={1}>Packed</option>
				<option value={2}>Shipped</option>
				<option value={3}>Delivered</option>
				<option value={4}>All done</option>
			</select>
		</label>
	</p>
</ModuleItem>

<ModuleItem id="product-card">
	<div class="grid">
		{#each products as product (product.id)}
			<ProductCard {product} adding={addingId === product.id} on:add={add} />
		{/each}
	</div>
	<p role="status">{addedNote}</p>
</ModuleItem>

<ModuleItem id="product-gallery">
	<ProductGallery images={galleryImages} bind:index={galleryIndex} />
</ModuleItem>

<ModuleItem id="reviews-ratings">
	<ReviewsRatings
		{reviews}
		canWrite
		on:submit={(e) => {
			reviews = [
				{
					id: `r${reviews.length + 1}`,
					author: 'You',
					rating: e.detail.rating,
					title: e.detail.title,
					body: e.detail.body,
					date: '2026-10-13',
					helpful: 0
				},
				...reviews
			];
			reviewNote = 'Review added.';
		}}
	/>
	<p role="status">{reviewNote}</p>
</ModuleItem>

<ModuleItem id="rating-stars">
	<div class="stack">
		<RatingStars value={4.5} count={12} showValue />
		<RatingStars value={3} size="lg" />
		<RatingStars variant="input" label="Your rating" bind:value={mine} />
		<p>You chose {mine} of 5.</p>
	</div>
</ModuleItem>

<ModuleItem id="status-page">
	<StatusPage components={systemComponents} {incidents} updatedAt="2026-10-13T09:00:00Z" />
</ModuleItem>

<ModuleItem id="changelog-list">
	<ChangelogList {releases} bind:types={changeTypes} />
</ModuleItem>

<ModuleItem id="waitlist-signup">
	<WaitlistSignup
		bind:state={waitState}
		bind:email={waitEmail}
		error="We could not add you right now. Try again in a minute."
		position={1204}
		total={5890}
		referralCode="ada"
		shareUrl="https://example.com/"
		on:join={join}
	/>
	<p>Use an address starting with "fail" to see the error state.</p>
</ModuleItem>

<ModuleItem id="coupon-banner">
	<div class="stack">
		{#if liveEnds}
			<CouponBanner message="Flash sale: 20% off today" code="FLASH20" endsAt={liveEnds} />
		{/if}
		<CouponBanner message="Spring sale: free shipping" code="SPRING" endsAt={couponEnds} {now} />
		<CouponBanner message="Old offer" endsAt="2026-10-01T00:00:00Z" {now} />
	</div>
</ModuleItem>

<style>
	.stack {
		display: grid;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.grid {
		display: grid;
		gap: var(--spacing-md);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
	}
</style>
