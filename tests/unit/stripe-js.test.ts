import { afterEach, describe, expect, it } from 'vitest';
import {
	CARD_FIELD_OPTIONS,
	CARD_ONLY,
	loadStripeJs,
	resetStripeJs,
	rgbString,
	STRIPE_JS_URL,
	stripeAppearance
} from '../../src/lib/shop/stripe-js';
import { STRIPE_ONPAGE_API_VERSION } from '@nebulakit/commerce';

afterEach(() => resetStripeJs());

describe('stripe-js loader', () => {
	/** A document that records the scripts added to it instead of fetching them. */
	function fakeDocument() {
		const win: { Stripe?: unknown } = {};
		const added: Array<{
			src: string;
			async: boolean;
			onload?: () => void;
			onerror?: () => void;
			remove: () => void;
		}> = [];
		const doc = {
			defaultView: win,
			createElement: () => {
				const script = {
					src: '',
					async: false,
					remove: () => added.splice(added.indexOf(script), 1)
				} as (typeof added)[number];
				return script;
			},
			head: { appendChild: (script: (typeof added)[number]) => added.push(script) }
		};
		return { doc: doc as unknown as Document, win, added };
	}

	it('loads Stripe.js from js.stripe.com only, once, and lazily', async () => {
		const { doc, win, added } = fakeDocument();
		const first = loadStripeJs(doc);
		const second = loadStripeJs(doc);
		expect(added).toHaveLength(1);
		expect(new URL(added[0].src).origin).toBe('https://js.stripe.com');
		expect(added[0].async).toBe(true);
		const factory = () => ({}) as never;
		win.Stripe = factory;
		added[0].onload?.();
		expect(await first).toBe(factory);
		expect(await second).toBe(factory);
	});

	it('forgets a failed load so the next call retries', async () => {
		const { doc, added } = fakeDocument();
		const attempt = loadStripeJs(doc);
		added[0].onerror?.();
		await expect(attempt).rejects.toThrow(/could not be loaded/);
		expect(added).toHaveLength(0);
		loadStripeJs(doc).catch(() => {});
		expect(added).toHaveLength(1);
	});

	it('names the same Stripe version as the server calls', () => {
		expect(STRIPE_JS_URL).toBe(
			`https://js.stripe.com/${STRIPE_ONPAGE_API_VERSION.split('.')[1]}/stripe.js`
		);
	});
});

describe('card form appearance', () => {
	it('dresses Stripe’s fields in the colours read from the page’s theme tokens', () => {
		const look = stripeAppearance({
			text: 'rgb(26, 26, 26)',
			background: 'rgb(255, 255, 255)',
			border: 'rgb(222, 226, 230)',
			muted: 'rgb(90, 97, 105)',
			accent: 'rgb(0, 102, 204)',
			danger: 'rgb(220, 38, 38)',
			fontFamily: 'Inter',
			radius: '4px'
		});
		expect(look.theme).toBe('flat');
		expect(look.variables).toMatchObject({
			colorText: 'rgb(26, 26, 26)',
			colorBackground: 'rgb(255, 255, 255)',
			colorPrimary: 'rgb(0, 102, 204)',
			colorDanger: 'rgb(220, 38, 38)',
			fontSizeBase: '16px'
		});
		expect(look.rules['.Input'].border).toContain('rgb(222, 226, 230)');
		expect(rgbString([1, 2, 3])).toBe('rgb(1, 2, 3)');
	});

	it('asks for cards only, no wallets or Link', () => {
		expect(CARD_ONLY).toEqual(['card']);
		expect(CARD_FIELD_OPTIONS.wallets).toEqual({
			applePay: 'never',
			googlePay: 'never',
			link: 'never'
		});
	});
});
