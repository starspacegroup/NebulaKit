import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	calculateTaxCents,
	calculateTotalCents,
	currencyExponent,
	decidePaymentEvent,
	EMPTY_GOOGLE,
	formatMoney,
	isChargeableAmount,
	nextPaymentStatus,
	ORDER_STATUSES,
	priceCart,
	ratePpm,
	regionalPriceCents,
	regionalUnitMinor,
	STRIPE_MAX_AMOUNT,
	taxMinor,
	type OrderStatus,
	type PaymentEventKind,
	type PaymentFacts,
	type Product
} from '@nebulakit/commerce';

/** Half-up a/b in exact integers: the reference the proved Dafny functions must agree with. */
const roundDiv = (a: bigint, b: bigint) => (2n * a + b) / (2n * b);

const minor = fc.integer({ min: 0, max: 50_000_000 });
const ppm = fc.integer({ min: 0, max: 1_000_000 });

describe('money core: tax (dafny/PaymentCore.dfy TaxOn)', () => {
	it('matches exact integer arithmetic, half up, and stays within 0..subtotal', () => {
		fc.assert(
			fc.property(minor, ppm, fc.boolean(), (subtotal, rate, inclusive) => {
				const tax = taxMinor(subtotal, rate, inclusive);
				const s = BigInt(subtotal);
				const r = BigInt(rate);
				const expected =
					rate === 0 || subtotal === 0
						? 0n
						: inclusive
							? roundDiv(s * r, 1_000_000n + r)
							: roundDiv(s * r, 1_000_000n);
				expect(BigInt(tax)).toBe(expected);
				expect(Number.isSafeInteger(tax)).toBe(true);
				expect(tax).toBeGreaterThanOrEqual(0);
				expect(tax).toBeLessThanOrEqual(subtotal);
			})
		);
	});

	it('does not drift on rates that are not exact in binary (8.25%, 8.875%)', () => {
		// 200 * 0.0825 is 16.500000000000004 in floats; the integer core says 16.5 -> 17.
		expect(
			calculateTaxCents(200, { enabled: true, ratePercent: 8.25, pricesIncludeTax: false })
		).toBe(17);
		expect(ratePpm(8.875)).toBe(88_750);
		expect(
			calculateTaxCents(10_000, { enabled: true, ratePercent: 8.875, pricesIncludeTax: false })
		).toBe(888);
	});

	it('never adds inclusive tax to the total, and always adds exclusive tax', () => {
		fc.assert(
			fc.property(
				minor,
				minor,
				fc.double({ min: 0, max: 100, noNaN: true }),
				fc.boolean(),
				(sub, ship, pct, inc) => {
					const rule = { enabled: true, ratePercent: pct, pricesIncludeTax: inc };
					const tax = calculateTaxCents(sub, rule);
					const total = calculateTotalCents(sub, ship, tax, rule);
					expect(total).toBe(inc ? sub + ship : sub + ship + tax);
					expect(total).toBeGreaterThanOrEqual(sub + ship);
				}
			)
		);
	});

	it('treats corrupt or out-of-range rates as no tax', () => {
		for (const ratePercent of [NaN, -1, 0, 100.5, Infinity]) {
			expect(calculateTaxCents(1000, { enabled: true, ratePercent, pricesIncludeTax: false })).toBe(
				0
			);
		}
		expect(taxMinor(-5, 1000, false)).toBe(0);
		expect(taxMinor(1.5, 1000, false)).toBe(0);
	});
});

describe('money core: regional price (RegionalUnit)', () => {
	it('only ever lowers, never below 0, half up, and respects the floor', () => {
		fc.assert(
			fc.property(
				minor,
				fc.integer({ min: -50, max: 200 }),
				fc.integer({ min: 0, max: 1000 }),
				(base, pct, floor) => {
					const out = regionalUnitMinor(base, pct, floor);
					expect(out).toBeGreaterThanOrEqual(0);
					expect(out).toBeLessThanOrEqual(base);
					if (pct < 1 || pct >= 100) expect(out).toBe(base);
					else {
						const scaled = Number(roundDiv(BigInt(base) * BigInt(pct), 100n));
						expect(out).toBe(Math.max(scaled, Math.min(base, floor)));
					}
				}
			)
		);
	});

	it('agrees with regionalPriceCents for any multiplier, including junk', () => {
		fc.assert(
			fc.property(minor, fc.double({ noNaN: false }), (base, multiplier) => {
				const out = regionalPriceCents(base, multiplier);
				expect(out).toBeLessThanOrEqual(base);
				expect(out).toBeGreaterThanOrEqual(0);
			})
		);
	});
});

describe('money core: priceCart end to end', () => {
	const products = fc.array(
		fc.record({
			price: fc.integer({ min: 0, max: 1_000_000 }),
			physical: fc.boolean(),
			quantity: fc.integer({ min: 1, max: 999 })
		}),
		{ minLength: 1, maxLength: 8 }
	);

	it('is integer, never negative, and never above the catalog price plus shipping and tax', async () => {
		await fc.assert(
			fc.asyncProperty(
				products,
				fc.double({ min: 0, max: 2, noNaN: true }),
				fc.constantFrom<'all' | 'digital'>('all', 'digital'),
				fc.double({ min: 0, max: 30, noNaN: true }),
				fc.boolean(),
				fc.integer({ min: 0, max: 5000 }),
				async (items, multiplier, scope, rate, inclusive, shipping) => {
					const catalog = new Map<string, Product>(
						items.map((item, i) => [
							`p${i}`,
							{
								id: `p${i}`,
								slug: `p${i}`,
								name: `P${i}`,
								description: '',
								priceCents: item.price,
								currency: 'usd',
								imageUrl: null,
								type: item.physical ? 'physical' : 'digital',
								printfulVariantId: null,
								active: true,
								createdAt: '',
								updatedAt: '',
								google: EMPTY_GOOGLE
							}
						])
					);
					const taxRule = { enabled: rate > 0, ratePercent: rate, pricesIncludeTax: inclusive };
					const cart = await priceCart(
						items.map((item, i) => ({ productId: `p${i}`, quantity: item.quantity })),
						async (id) => catalog.get(id) ?? null,
						{
							taxRule,
							shippingCents: shipping,
							regionalMultiplier: multiplier,
							regionalScope: scope
						}
					);
					const catalogSubtotal = items.reduce((n, item) => n + item.price * item.quantity, 0);
					const catalogTax = calculateTaxCents(catalogSubtotal, taxRule);
					for (const value of [cart.subtotalCents, cart.taxCents, cart.totalCents]) {
						expect(Number.isSafeInteger(value)).toBe(true);
						expect(value).toBeGreaterThanOrEqual(0);
					}
					expect(cart.subtotalCents).toBeLessThanOrEqual(catalogSubtotal);
					expect(cart.baseSubtotalCents).toBe(catalogSubtotal);
					expect(cart.totalCents).toBeLessThanOrEqual(
						calculateTotalCents(catalogSubtotal, shipping, catalogTax, taxRule)
					);
					expect(cart.totalCents).toBe(
						calculateTotalCents(cart.subtotalCents, shipping, cart.taxCents, taxRule)
					);
				}
			),
			{ numRuns: 200 }
		);
	});

	it('reads nothing about money from a cart line: extra price fields change nothing', async () => {
		const product: Product = {
			id: 'p',
			slug: 'p',
			name: 'P',
			description: '',
			priceCents: 2500,
			currency: 'usd',
			imageUrl: null,
			type: 'digital',
			printfulVariantId: null,
			active: true,
			createdAt: '',
			updatedAt: '',
			google: EMPTY_GOOGLE
		};
		await fc.assert(
			fc.asyncProperty(fc.integer(), fc.integer(), async (price, total) => {
				const line = { productId: 'p', quantity: 2, unitPriceCents: price, totalCents: total };
				const cart = await priceCart([line], async () => product);
				expect(cart.totalCents).toBe(5000);
			})
		);
	});
});

describe('currencies', () => {
	it('knows zero- and three-decimal currencies', () => {
		expect(currencyExponent('JPY')).toBe(0);
		expect(currencyExponent('krw')).toBe(0);
		expect(currencyExponent('kwd')).toBe(3);
		expect(currencyExponent('usd')).toBe(2);
		expect(formatMoney(500, 'jpy')).toBe('¥500');
		expect(formatMoney(1999, 'usd')).toBe('$19.99');
		expect(formatMoney(5120, 'kwd')).toMatch(/5\.120/);
	});

	it('only lets Stripe be asked for whole, positive, in-range amounts (tens for 3-decimal)', () => {
		fc.assert(
			fc.property(fc.integer({ min: -10, max: STRIPE_MAX_AMOUNT + 10 }), (amount) => {
				const ok = isChargeableAmount(amount, 'usd');
				expect(ok).toBe(amount > 0 && amount <= STRIPE_MAX_AMOUNT);
				expect(isChargeableAmount(amount, 'kwd')).toBe(ok && amount % 10 === 0);
			})
		);
		expect(isChargeableAmount(1.5, 'usd')).toBe(false);
		expect(isChargeableAmount(100, 'US')).toBe(false);
	});
});

describe('payment state machine (dafny/PaymentCore.dfy Decide / Step)', () => {
	const status = fc.constantFrom<OrderStatus>(...ORDER_STATUSES);
	const kind = fc.constantFrom<PaymentEventKind>(
		'paying',
		'cancelling',
		'failed',
		'refunded',
		'other'
	);
	const facts = fc.record<PaymentFacts>({
		status,
		kind,
		known: fc.boolean(),
		moneyIn: fc.boolean(),
		takenMinor: fc.option(fc.integer({ min: 0, max: 10_000 }), { nil: null }),
		dueMinor: fc.integer({ min: 0, max: 10_000 }),
		currencyMatches: fc.boolean()
	});
	const settled = (s: OrderStatus) => s !== 'pending' && s !== 'cancelled';

	it('never moves a paid (or later) order, and never revives a cancelled one', () => {
		fc.assert(
			fc.property(facts, (f) => {
				const next = nextPaymentStatus(f);
				if (settled(f.status) || f.status === 'cancelled') expect(next).toBe(f.status);
			})
		);
	});

	it('moves only out of pending, to paid or cancelled', () => {
		fc.assert(
			fc.property(facts, (f) => {
				const next = nextPaymentStatus(f);
				if (next !== f.status) {
					expect(f.status).toBe('pending');
					expect(['paid', 'cancelled']).toContain(next);
				}
			})
		);
	});

	it('pays only on known money, in the right currency, covering the total', () => {
		fc.assert(
			fc.property(facts, (f) => {
				if (nextPaymentStatus(f) === 'paid' && f.status !== 'paid') {
					expect(f.known && f.kind === 'paying' && f.moneyIn && f.currencyMatches).toBe(true);
					expect(f.takenMinor).not.toBeNull();
					expect(f.takenMinor as number).toBeGreaterThanOrEqual(f.dueMinor);
				}
				if (f.kind === 'paying' && f.known && f.moneyIn && (f.takenMinor ?? -1) < f.dueMinor) {
					expect(decidePaymentEvent(f)).toBe('amount-mismatch');
				}
			})
		);
	});

	it('is idempotent: the same event twice is the same as once', () => {
		fc.assert(
			fc.property(facts, (f) => {
				const once = nextPaymentStatus(f);
				expect(nextPaymentStatus({ ...f, status: once })).toBe(once);
			})
		);
	});

	it('is safe in any order: a sequence of events never takes a settled order back', () => {
		fc.assert(
			fc.property(fc.array(facts, { maxLength: 12 }), (events) => {
				let current: OrderStatus = 'pending';
				let everPaid = false;
				for (const f of events) {
					const next = nextPaymentStatus({ ...f, status: current });
					if (everPaid) expect(settled(next)).toBe(true);
					if (current === 'cancelled') expect(next).toBe('cancelled');
					current = next;
					everPaid ||= current === 'paid';
				}
			})
		);
	});

	it('records failed cards and refunds without moving the order', () => {
		fc.assert(
			fc.property(facts, (f) => {
				for (const k of ['failed', 'refunded'] as const) {
					expect(nextPaymentStatus({ ...f, kind: k })).toBe(f.status);
					if (f.known) expect(decidePaymentEvent({ ...f, kind: k })).toBe('record');
				}
			})
		);
	});
});
