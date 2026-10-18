/**
 * Checkout money rules, in integer cents.
 *
 * Ported from Ammoura's `checkout-pricing.ts` (2026-10-18). Ammoura worked in
 * float dollars and rounded after every step; here every amount is an integer
 * number of cents, so the only rounding left is the one tax genuinely needs.
 */

/** What a site charges in sales tax. Read from the site's own settings, never the request. */
export interface TaxRule {
	enabled: boolean;
	/** Percent as an admin types it: `8.25` means 8.25%. */
	ratePercent: number;
	/** Displayed prices already include tax: nothing is added, the tax is reported as the share it is. */
	pricesIncludeTax: boolean;
}

/**
 * A site that never set its tax rule charges none. Inventing a rate takes
 * money from customers on a guess; charging nothing is recoverable.
 */
export const NO_TAX: TaxRule = { enabled: false, ratePercent: 0, pricesIncludeTax: false };

function usableRate(rule: TaxRule): number {
	if (!rule.enabled) return 0;
	const percent = rule.ratePercent;
	// A stored rate beyond 100% is corrupt, and charging it is worse than charging nothing.
	if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return 0;
	return percent / 100;
}

export function isCents(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Tax on a subtotal: added on top for tax-exclusive prices, extracted for tax-inclusive ones. */
export function calculateTaxCents(subtotalCents: number, rule: TaxRule = NO_TAX): number {
	const rate = usableRate(rule);
	if (rate === 0 || !isCents(subtotalCents) || subtotalCents === 0) return 0;
	if (rule.pricesIncludeTax) return Math.round(subtotalCents - subtotalCents / (1 + rate));
	return Math.round(subtotalCents * rate);
}

/** What the customer pays. Inclusive tax is already inside the subtotal, so it is never added twice. */
export function calculateTotalCents(
	subtotalCents: number,
	shippingCents: number,
	taxCents: number,
	rule: TaxRule = NO_TAX
): number {
	return subtotalCents + shippingCents + (rule.pricesIncludeTax ? 0 : taxCents);
}

/** Regional (PPP) price: the base price times the shopper's multiplier, never above base. */
export function regionalPriceCents(baseCents: number, multiplier: number): number {
	if (!Number.isFinite(multiplier) || multiplier >= 1 || multiplier <= 0) return baseCents;
	return Math.round(baseCents * multiplier);
}

export function formatMoney(cents: number, currency = 'usd', locale = 'en-US'): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency.toUpperCase()
	}).format(cents / 100);
}
