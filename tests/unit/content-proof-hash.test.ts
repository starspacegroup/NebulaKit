/**
 * Tests for canonical prediction content hashing ($lib/content-proof/hash)
 */
import { describe, expect, it } from 'vitest';
import { computeCanonicalHash } from '../../src/lib/content-proof/hash';

const BASE = {
	title: 'AI will pass the bar exam',
	slug: 'ai-bar-exam',
	body: '<p>By 2028, an AI system will pass a state bar exam.</p>',
	dateWindowStart: null,
	dateWindowEnd: '2028-12-31'
};

describe('computeCanonicalHash', () => {
	it('produces a 64-char hex SHA-256 digest', async () => {
		const hash = await computeCanonicalHash(BASE);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic for the same input', async () => {
		const a = await computeCanonicalHash(BASE);
		const b = await computeCanonicalHash({ ...BASE });
		expect(a).toBe(b);
	});

	it('is independent of property insertion order', async () => {
		const reordered = {
			dateWindowEnd: BASE.dateWindowEnd,
			dateWindowStart: BASE.dateWindowStart,
			body: BASE.body,
			slug: BASE.slug,
			title: BASE.title
		};
		const a = await computeCanonicalHash(BASE);
		const b = await computeCanonicalHash(reordered);
		expect(a).toBe(b);
	});

	it('changes when the title changes', async () => {
		const a = await computeCanonicalHash(BASE);
		const b = await computeCanonicalHash({ ...BASE, title: 'Different title' });
		expect(a).not.toBe(b);
	});

	it('changes when the body changes', async () => {
		const a = await computeCanonicalHash(BASE);
		const b = await computeCanonicalHash({ ...BASE, body: 'different body' });
		expect(a).not.toBe(b);
	});

	it('changes when the date window changes', async () => {
		const a = await computeCanonicalHash(BASE);
		const b = await computeCanonicalHash({ ...BASE, dateWindowEnd: '2029-12-31' });
		expect(a).not.toBe(b);
	});

	it('distinguishes null from an empty string date window', async () => {
		const a = await computeCanonicalHash({ ...BASE, dateWindowStart: null });
		const b = await computeCanonicalHash({ ...BASE, dateWindowStart: '' });
		expect(a).not.toBe(b);
	});
});
