/**
 * The card form on the site's own cart: loading Stripe's script and dressing its fields in the
 * site's colours. Ported from PinFool (which took the pattern from davis9001.com's shop): our own
 * page, Stripe's Payment Element only as the card field, cards only, no wallets, no Link, no
 * Stripe wording. Stripe requires the script to come from its own address (it may not be bundled or
 * self-hosted), and the card fields it draws are frames owned by Stripe, so card numbers never
 * touch this site. Everything around them is ours.
 *
 * The script is loaded lazily, only when the cart's card form mounts, so no other page talks to
 * Stripe. The CSP allows exactly js.stripe.com and hooks.stripe.com frames (svelte.config.js).
 *
 * Keep the version in the address in step with `STRIPE_ONPAGE_API_VERSION` (packages/commerce).
 */
export const STRIPE_JS_URL = 'https://js.stripe.com/endive/stripe.js';

/** The parts of Stripe.js this site uses (docs.stripe.com/js: Elements and confirmPayment). */
export interface StripeError {
	message?: string;
	code?: string;
	type?: string;
}
export interface StripePaymentElement {
	mount(target: HTMLElement | string): void;
	unmount?(): void;
	destroy?(): void;
	on(event: 'ready' | 'change' | 'loaderror', handler: (payload: unknown) => void): void;
}
export interface StripeElements {
	create(type: 'payment', options?: Record<string, unknown>): StripePaymentElement;
	/** Checks what was typed in the card form; an error here is shown and nothing is charged. */
	submit(): Promise<{ error?: StripeError }>;
	update(options: { amount?: number; currency?: string; appearance?: StripeAppearance }): void;
}
export interface StripeInstance {
	elements(options: {
		mode: 'payment';
		amount: number;
		currency: string;
		/** Named `paymentMethodTypes` before this version of Stripe.js, which refuses the old name. */
		allowedPaymentMethodTypes: string[];
		appearance?: StripeAppearance;
	}): StripeElements;
	confirmPayment(options: {
		elements: StripeElements;
		clientSecret: string;
		confirmParams: { return_url: string };
		redirect: 'if_required';
	}): Promise<{ error?: StripeError; paymentIntent?: { id: string; status: string } }>;
}
type StripeFactory = (publishableKey: string) => StripeInstance;

let loading: Promise<StripeFactory> | null = null;

/**
 * Load Stripe's script once and return its `Stripe` function. Rejects when the script cannot be
 * loaded (offline, or a content blocker), and may then be called again to retry.
 */
export function loadStripeJs(doc: Document = document): Promise<StripeFactory> {
	const win = doc.defaultView as (Window & { Stripe?: StripeFactory }) | null;
	if (win?.Stripe) return Promise.resolve(win.Stripe);
	if (loading) return loading;
	loading = new Promise<StripeFactory>((resolve, reject) => {
		const script = doc.createElement('script');
		script.src = STRIPE_JS_URL;
		script.async = true;
		script.onload = () => {
			if (win?.Stripe) resolve(win.Stripe);
			else reject(new Error('Stripe.js loaded without defining Stripe'));
		};
		script.onerror = () => {
			script.remove();
			reject(new Error('Stripe.js could not be loaded'));
		};
		doc.head.appendChild(script);
	}).catch((err) => {
		// A failed load is not remembered: the next call tries again.
		loading = null;
		throw err;
	});
	return loading;
}

/** Only for tests: forget a load in progress. */
export function resetStripeJs(): void {
	loading = null;
}

/** The site's colours where the form will sit, as plain `rgb(…)`/hex values Stripe can read. */
export interface FormColors {
	text: string;
	background: string;
	border: string;
	muted: string;
	accent: string;
	danger: string;
	fontFamily: string;
	radius: string;
}

export interface StripeAppearance {
	theme: 'stripe' | 'night' | 'flat';
	labels: 'above';
	variables: Record<string, string>;
	rules: Record<string, Record<string, string>>;
}

/**
 * Stripe's fields dressed as the site's own: the same paper, ink, border, corners and typeface as the
 * inputs beside them, and the same focus ring. Built from colours read off the page, so it follows
 * whichever theme the shopper is in.
 */
export function stripeAppearance(colors: FormColors): StripeAppearance {
	return {
		// "flat" has no shadows or gradients of Stripe's own: the fields are only what is set here.
		theme: 'flat',
		labels: 'above',
		variables: {
			colorPrimary: colors.accent,
			colorBackground: colors.background,
			colorText: colors.text,
			colorTextSecondary: colors.muted,
			colorTextPlaceholder: colors.muted,
			colorDanger: colors.danger,
			fontFamily: colors.fontFamily,
			// Never under 16px: below that, iOS zooms the page in when the card field is tapped.
			fontSizeBase: '16px',
			borderRadius: colors.radius,
			spacingUnit: '4px'
		},
		rules: {
			'.Input': {
				border: `1px solid ${colors.border}`,
				boxShadow: 'none',
				padding: '14px 12px'
			},
			'.Input:focus': {
				border: `1px solid ${colors.accent}`,
				boxShadow: `0 0 0 2px ${colors.accent}`
			},
			'.Label': { fontWeight: '700', color: colors.text },
			'.Error': { color: colors.danger }
		}
	};
}

/**
 * How the card field is asked for: one card form and nothing else. No wallet buttons, no Link, and
 * no line of Stripe's terms under it (a card payment needs none), so nothing on the page names
 * anyone but the shop.
 */
export const CARD_FIELD_OPTIONS = {
	layout: 'tabs',
	terms: { card: 'never' },
	wallets: { applePay: 'never', googlePay: 'never', link: 'never' }
} as const;

/** The only way to pay on the page, matching `allowed_payment_method_types` on the server's PaymentIntent. */
export const CARD_ONLY = ['card'];

/** `rgb(r, g, b)` from the channels of one painted pixel. */
export function rgbString([r, g, b]: readonly number[]): string {
	return `rgb(${r}, ${g}, ${b})`;
}
