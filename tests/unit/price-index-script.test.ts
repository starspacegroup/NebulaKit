import { describe, expect, it } from 'vitest';
import { PRICE_LEVEL_INDEX, PRICE_LEVEL_INDEX_UPDATED } from '@nebulakit/commerce';
import { buildRows, render } from '../../scripts/update-price-index.mjs';

const series = (entries: Record<string, Record<number, number>>) =>
	new Map(
		Object.entries(entries).map(([c, y]) => [
			c,
			new Map(Object.entries(y).map(([k, v]) => [Number(k), v]))
		])
	);

describe('scripts/update-price-index.mjs', () => {
	it('computes PPP / exchange rate from the latest year both series share', () => {
		const rows = buildRows(
			series({ IN: { 2023: 20, 2024: 25 }, BR: { 2024: 2.5 }, XA: { 2024: 1 }, LR: { 2024: 0.4 } }),
			series({ IN: { 2023: 82, 2024: 83 }, BR: { 2024: 5 }, XA: { 2024: 1 }, LR: { 2024: 185 } }),
			new Set(['IN', 'BR', 'LR'])
		);
		// XA is an aggregate (not a known country); LR's ratio is implausible.
		expect(rows).toEqual([
			{ code: 'BR', year: 2024, ratio: 0.5 },
			{ code: 'IN', year: 2024, ratio: 0.301 }
		]);
	});
	it('skips countries with no overlapping year or no exchange rate', () => {
		expect(
			buildRows(
				series({ IN: { 2022: 20 }, BR: { 2024: 2 } }),
				series({ IN: { 2024: 80 } }),
				new Set(['IN', 'BR'])
			)
		).toEqual([]);
	});
	it('renders a file the package can read, in the checked-in format', () => {
		const text = render([{ code: 'IN', year: 2024, ratio: 0.301 }], '2026-01-01');
		expect(text).toContain('\tIN: [0.301, 2024]\n};');
		expect(text).toContain("PRICE_LEVEL_INDEX_UPDATED = '2026-01-01'");
	});
	it('matches the shape of the checked-in table', () => {
		expect(PRICE_LEVEL_INDEX_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(Object.keys(PRICE_LEVEL_INDEX).length).toBeGreaterThanOrEqual(150);
	});
});
