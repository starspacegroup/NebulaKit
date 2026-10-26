import { describe, expect, it } from 'vitest';
import { parseByteRange } from '../../src/lib/server/media-range';

describe('parseByteRange', () => {
	it.each([
		['bytes=0-99', 1000, { offset: 0, length: 100 }],
		['bytes=500-', 1000, { offset: 500, length: 500 }],
		['bytes=-100', 1000, { offset: 900, length: 100 }],
		['bytes=-5000', 1000, { offset: 0, length: 1000 }],
		['bytes=900-5000', 1000, { offset: 900, length: 100 }]
	])('%s of %i bytes', (header, size, expected) => {
		expect(parseByteRange(header, size)).toEqual(expected);
	});

	it.each([[null], [''], ['items=0-1'], ['bytes=-'], ['bytes=0-1,4-5'], ['bytes=9-2']])(
		'ignores %s',
		(header) => {
			expect(parseByteRange(header as string | null, 1000)).toBeNull();
		}
	);

	it.each([['bytes=1000-'], ['bytes=2000-3000'], ['bytes=-0']])('refuses %s', (header) => {
		expect(parseByteRange(header, 1000)).toBe('unsatisfiable');
	});
});
