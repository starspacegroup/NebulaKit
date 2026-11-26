/**
 * Integer/decimal grouping with a FIXED locale. A bare `n.toLocaleString()` uses
 * the runtime's default locale, which differs between the server and a visitor's
 * browser and so mismatches on hydration. Admin code uses this instead.
 */
const FORMAT = new Intl.NumberFormat('en-US');

export function formatNumber(value: number): string {
	return Number.isFinite(value) ? FORMAT.format(value) : '—';
}
