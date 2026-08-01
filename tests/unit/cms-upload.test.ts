import { describe, expect, it } from 'vitest';
import {
	ALLOWED_IMAGE_TYPES,
	buildMediaKey,
	isValidMediaKey,
	MAX_UPLOAD_BYTES,
	mediaUrlForKey,
	validateUpload
} from '../../src/lib/cms/upload';

describe('validateUpload', () => {
	it.each(Object.entries(ALLOWED_IMAGE_TYPES))('accepts %s and maps it to .%s', (type, ext) => {
		expect(validateUpload({ type, size: 1024 })).toEqual({ ok: true, ext });
	});

	it('rejects SVG, which is an image type but a stored-XSS vector', () => {
		const result = validateUpload({ type: 'image/svg+xml', size: 1024 });
		expect(result).toMatchObject({ ok: false });
		expect(ALLOWED_IMAGE_TYPES['image/svg+xml']).toBeUndefined();
	});

	it.each(['application/pdf', 'text/html', 'application/javascript', ''])(
		'rejects the non-image type %o',
		(type) => {
			expect(validateUpload({ type, size: 1024 })).toMatchObject({ ok: false });
		}
	);

	it('names the allowed formats in the rejection message', () => {
		const result = validateUpload({ type: 'application/pdf', size: 1024 });
		expect(result).toMatchObject({
			ok: false,
			error: expect.stringContaining('png, jpeg, gif, webp')
		});
	});

	it.each([0, -1, NaN, Infinity])('rejects the size %o as an empty upload', (size) => {
		expect(validateUpload({ type: 'image/png', size })).toEqual({
			ok: false,
			error: 'Empty upload'
		});
	});

	it('accepts a file of exactly the maximum size', () => {
		expect(validateUpload({ type: 'image/png', size: MAX_UPLOAD_BYTES })).toEqual({
			ok: true,
			ext: 'png'
		});
	});

	it('rejects a file one byte over the maximum', () => {
		expect(validateUpload({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1 })).toMatchObject({
			ok: false,
			error: expect.stringContaining('max 10 MB')
		});
	});

	it('reports the offending size in whole megabytes', () => {
		expect(validateUpload({ type: 'image/png', size: 25 * 1024 * 1024 })).toMatchObject({
			error: expect.stringContaining('(25 MB)')
		});
	});

	it('checks the type before the size, so a bad type never reports a size error', () => {
		expect(validateUpload({ type: 'text/html', size: 0 })).toMatchObject({
			error: expect.stringContaining('Unsupported file type')
		});
	});
});

describe('media keys', () => {
	it('builds an R2 key under uploads/', () => {
		expect(buildMediaKey('png', 'abc-123')).toBe('uploads/abc-123.png');
	});

	it('builds the public URL for a key', () => {
		expect(mediaUrlForKey('uploads/abc-123.png')).toBe('/media/uploads/abc-123.png');
	});

	it('accepts the keys it generates itself', () => {
		expect(isValidMediaKey(buildMediaKey('webp', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'))).toBe(
			true
		);
	});

	it.each([
		['a parent-directory traversal', 'uploads/../secrets.png'],
		['a traversal in the filename', 'uploads/..%2fsecrets.png'],
		['a doubled slash', 'uploads//secrets.png'],
		['a key outside uploads/', 'secrets/key.png'],
		['an absolute path', '/uploads/key.png'],
		['a bare filename', 'key.png'],
		['an empty key', ''],
		['a key with a space', 'uploads/my key.png'],
		['a key with a query string', 'uploads/key.png?raw=1']
	])('rejects %s', (_label, key) => {
		expect(isValidMediaKey(key)).toBe(false);
	});

	it('allows the characters a UUID filename actually needs', () => {
		expect(isValidMediaKey('uploads/a-B_9.0/nested.png')).toBe(true);
	});
});
