<!--
	Renders a commerce module the way a page would, with state bound and events
	reported through `onEvent`; the bound values are readable from
	`data-testid="state"`. A callback prop works under Svelte 4 and 5 alike.
-->
<script lang="ts">
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

	export let which: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let props: any = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let value: any = 0;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let items: any[] = [];
	export let index = 0;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let types: any[] = [];
	export let page = 1;
	export let wstate: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ev = (name: string) => (e: CustomEvent<any>) => onEvent(name, e.detail);
</script>

{#if which === 'billing'}
	<BillingOverview
		{...props}
		on:upgrade={ev('upgrade')}
		on:cancel={ev('cancel')}
		on:resume={ev('resume')}
	/>
{:else if which === 'usage'}
	<UsageMeters {...props} />
{:else if which === 'invoices'}
	<InvoiceList {...props} bind:page on:download={ev('download')} on:pagechange={ev('pagechange')} />
{:else if which === 'pm-card'}
	<PaymentMethodCard {...props} on:setDefault={ev('setDefault')} on:remove={ev('remove')} />
{:else if which === 'pm-form'}
	<PaymentMethodForm {...props} on:submit={ev('submit')} />
{:else if which === 'checkout'}
	<CheckoutForm {...props} on:submit={ev('submit')}>
		<p slot="payment">Payment fields here</p>
	</CheckoutForm>
{:else if which === 'cart'}
	<CartSummary
		bind:items
		{...props}
		on:quantity={ev('quantity')}
		on:remove={ev('remove')}
		on:applypromo={ev('applypromo')}
		on:promo={ev('promo')}
		on:checkout={ev('checkout')}
	/>
{:else if which === 'tracker'}
	<OrderStatusTracker {...props} />
{:else if which === 'product'}
	<ProductCard {...props} on:add={ev('add')} />
{:else if which === 'gallery'}
	<ProductGallery bind:index {...props} on:change={ev('change')} />
{:else if which === 'reviews'}
	<ReviewsRatings
		{...props}
		on:helpful={ev('helpful')}
		on:submit={ev('submit')}
		on:sort={ev('sort')}
	/>
{:else if which === 'stars'}
	<RatingStars bind:value {...props} on:change={ev('change')} />
{:else if which === 'status'}
	<StatusPage {...props} />
{:else if which === 'changelog'}
	<ChangelogList bind:types {...props} on:filter={ev('filter')} />
{:else if which === 'waitlist'}
	<WaitlistSignup
		bind:state={wstate}
		{...props}
		on:join={ev('join')}
		on:copy={ev('copy')}
		on:reset={ev('reset')}
	/>
{:else if which === 'coupon'}
	<CouponBanner
		{...props}
		on:dismiss={ev('dismiss')}
		on:expire={ev('expire')}
		on:copy={ev('copy')}
	/>
{/if}
<span data-testid="state">{JSON.stringify({ value, items, index, types, page, wstate })}</span>
