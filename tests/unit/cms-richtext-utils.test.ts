import { describe, expect, it, vi } from 'vitest';
import { extractImageFiles, uploadImage } from '../../src/lib/cms/richtext-utils';

const file = (name: string, type: string) => new File(['x'], name, { type });

const jsonResponse = (body: unknown, ok = true) =>
	({ ok, json: () => Promise.resolve(body) }) as unknown as Response;

describe('extractImageFiles', () => {
	it.each([
		['null', null],
		['undefined', undefined],
		['an object with no files', {}],
		['an empty file list', { files: [] as unknown as ArrayLike<File> }]
	])('returns nothing for %s', (_label, input) => {
		expect(extractImageFiles(input as never)).toEqual([]);
	});

	it('keeps every image and drops everything else', () => {
		const png = file('a.png', 'image/png');
		const webp = file('b.webp', 'image/webp');
		const files = [png, file('c.pdf', 'application/pdf'), webp, file('d.txt', 'text/plain')];

		expect(extractImageFiles({ files })).toEqual([png, webp]);
	});

	it('reads a DataTransfer-style list rather than requiring a real array', () => {
		const png = file('a.png', 'image/png');
		const arrayLike = { 0: png, length: 1 } as unknown as ArrayLike<File>;
		expect(extractImageFiles({ files: arrayLike })).toEqual([png]);
	});

	it('skips holes in a sparse list without throwing', () => {
		const png = file('a.png', 'image/png');
		const sparse = { 0: undefined, 1: png, length: 2 } as unknown as ArrayLike<File>;
		expect(extractImageFiles({ files: sparse })).toEqual([png]);
	});

	it('returns an empty list when nothing is an image', () => {
		expect(extractImageFiles({ files: [file('a.pdf', 'application/pdf')] })).toEqual([]);
	});
});

describe('uploadImage', () => {
	it('posts the file to the admin upload endpoint as multipart form data', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ url: '/media/uploads/x.png' }));
		const png = file('a.png', 'image/png');

		const result = await uploadImage(png, fetchFn as unknown as typeof fetch);

		expect(result).toEqual({ ok: true, url: '/media/uploads/x.png' });
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('/api/admin/upload');
		expect(init.method).toBe('POST');
		expect(init.body).toBeInstanceOf(FormData);
		expect((init.body as FormData).get('file')).toBe(png);
	});

	it('surfaces the server message when the response is not ok', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ message: 'File too large' }, false));

		expect(
			await uploadImage(file('a.png', 'image/png'), fetchFn as unknown as typeof fetch)
		).toEqual({ ok: false, error: 'File too large' });
	});

	it('falls back to a generic error when a failed response carries no message', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false));

		expect(
			await uploadImage(file('a.png', 'image/png'), fetchFn as unknown as typeof fetch)
		).toEqual({ ok: false, error: 'Upload failed' });
	});

	it('treats an unparseable error body as a generic failure', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: false,
			json: () => Promise.reject(new Error('not json'))
		} as unknown as Response);

		expect(
			await uploadImage(file('a.png', 'image/png'), fetchFn as unknown as typeof fetch)
		).toEqual({ ok: false, error: 'Upload failed' });
	});

	it('returns a failure instead of throwing when the network is down', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

		expect(
			await uploadImage(file('a.png', 'image/png'), fetchFn as unknown as typeof fetch)
		).toEqual({ ok: false, error: 'Upload failed' });
	});
});
