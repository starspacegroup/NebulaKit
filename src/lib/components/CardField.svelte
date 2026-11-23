<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CARD_FIELD_OPTIONS,
		CARD_ONLY,
		loadStripeJs,
		rgbString,
		stripeAppearance,
		type StripeElements,
		type StripeInstance,
		type StripePaymentElement
	} from '$lib/shop/stripe-js';
	import { site } from '$lib/site.config';

	/**
	 * Ported from PinFool's CardField.
	 *
	 * The card field of the checkout form. The payment processor's script draws it inside this page,
	 * in the page's own colours; the card number goes straight to the processor and never reaches
	 * this site. It is a field like the others: the form around it owns the button and the order.
	 *
	 * The parent calls `check()` before it places the order (so a mistyped card costs no order), and
	 * `pay(clientSecret, returnUrl)` once the server has made the payment to confirm.
	 */
	let {
		publishableKey,
		amountCents,
		currency,
		ready = $bindable(false)
	}: {
		publishableKey: string;
		/** What the card will be charged; kept in step with the order's total. */
		amountCents: number;
		currency: string;
		/** True once the card field can be typed in. */
		ready?: boolean;
	} = $props();

	let root = $state<HTMLDivElement>();
	let field = $state<HTMLDivElement>();
	let phase = $state<'loading' | 'ready' | 'blocked'>('loading');
	let stripe: StripeInstance | null = null;
	let elements: StripeElements | null = null;
	let element: StripePaymentElement | null = null;

	/** Stripe refuses an amount under its minimum; the real one is set before any charge. */
	const shownAmount = (cents: number) => Math.max(50, Math.round(cents));

	/** One of the page's colours, as the rgb channels it is actually painted with. */
	function painted(value: string): [number, number, number] {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return [0, 0, 0];
		ctx.fillStyle = value;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	}

	/** The colours of the panel this sits in, so the card field matches the inputs beside it. */
	function appearance() {
		const probe = document.createElement('span');
		probe.style.display = 'none';
		root?.appendChild(probe);
		const read = (css: string) => {
			probe.style.color = css;
			return rgbString(painted(getComputedStyle(probe).color));
		};
		const colors = {
			text: read('var(--color-text)'),
			background: read('var(--color-background)'),
			border: read('var(--color-border)'),
			muted: read('var(--color-text-secondary)'),
			accent: read('var(--color-primary)'),
			danger: read('var(--color-danger)'),
			fontFamily: getComputedStyle(root ?? document.body).fontFamily,
			radius: '4px'
		};
		probe.remove();
		return stripeAppearance(colors);
	}

	async function start() {
		phase = 'loading';
		ready = false;
		try {
			const Stripe = await loadStripeJs();
			stripe = Stripe(publishableKey);
			elements = stripe.elements({
				mode: 'payment',
				amount: shownAmount(amountCents),
				currency: currency.toLowerCase(),
				allowedPaymentMethodTypes: CARD_ONLY,
				appearance: appearance()
			});
			element = elements.create('payment', { ...CARD_FIELD_OPTIONS });
			element.on('ready', () => {
				phase = 'ready';
				ready = true;
			});
			element.on('loaderror', () => {
				phase = 'blocked';
				ready = false;
			});
			if (field) element.mount(field);
		} catch {
			phase = 'blocked';
		}
	}

	// The amount follows the order (a pin added in another tab, credit switched on or off).
	$effect(() => {
		const amount = shownAmount(amountCents);
		const code = currency.toLowerCase();
		elements?.update({ amount, currency: code });
	});

	/** Check what was typed. Returns a message to show, or null when the card can be charged. */
	export async function check(): Promise<string | null> {
		if (!elements || phase !== 'ready')
			return 'The card form is still loading. Try again in a moment.';
		const { error } = await elements.submit();
		return error ? error.message || 'Check the card details.' : null;
	}

	/**
	 * Charge the card for the payment the server made. Returns a message to show, or null when the
	 * payment went through (or the bank took the shopper to its own page, which comes back to
	 * `returnUrl`). `amount` is what the server will charge: the form is told first, so the two agree.
	 */
	export async function pay(
		clientSecret: string,
		returnUrl: string,
		amount: number
	): Promise<string | null> {
		if (!stripe || !elements) return 'The card form is still loading. Try again in a moment.';
		elements.update({ amount: shownAmount(amount), currency: currency.toLowerCase() });
		const { error } = await stripe.confirmPayment({
			elements,
			clientSecret,
			// Only a card whose bank insists on a full page of its own leaves; it comes back here.
			confirmParams: { return_url: returnUrl },
			redirect: 'if_required'
		});
		return error ? error.message || 'The payment did not go through. Please try again.' : null;
	}

	onMount(() => {
		start();
		// The theme switched in the middle of checkout: dress the card field again.
		const restyle = () => elements?.update({ appearance: appearance() });
		const seen = new MutationObserver(restyle);
		seen.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => {
			seen.disconnect();
			try {
				element?.unmount?.();
				element?.destroy?.();
			} catch {
				// Already gone with the page.
			}
		};
	});
</script>

<div class="card" bind:this={root} data-testid="card-field" data-phase={phase}>
	<!-- The processor's script fills this with the card fields. -->
	<div class="field" bind:this={field} class:waiting={phase !== 'ready'}></div>
	{#if phase === 'loading'}
		<p class="state" role="status">Loading the card form…</p>
	{:else if phase === 'blocked'}
		<div class="state" role="alert">
			<p>
				The card form could not load. This is usually a connection problem or a content blocker.
				Nothing has been charged.
			</p>
			<button type="button" onclick={start}>Try again</button>
		</div>
	{/if}
	<p class="safe">
		Your card details go straight to our payment processor over a secure connection. {site.name} never
		sees or stores them.
	</p>
</div>

<style>
	.card {
		display: grid;
		gap: 0.6rem;
	}
	.field.waiting {
		min-height: 0;
		height: 0;
		overflow: hidden;
	}
	.state {
		margin: 0;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}
	.state p {
		margin: 0 0 0.75rem;
	}
	button {
		min-height: 2.75rem;
		padding: 0.5rem 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	button:hover {
		background: var(--color-surface-hover);
	}
	button:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}
	.safe {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		line-height: 1.45;
	}
</style>
