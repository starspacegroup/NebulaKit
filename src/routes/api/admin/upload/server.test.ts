import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { MAX_UPLOAD_BYTES } from '$lib/cms/upload';

const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function pngFile(name = 'a.png', type = 'image/png', bytes = 'image-bytes') {
	return new File([bytes], name, { type });
}

function makeEvent(
	opts: {
		user?: { isOwner?: boolean; isAdmin?: boolean } | null;
		bucket?: { put: ReturnType<typeof vi.fn> } | null;
		file?: File | string | null;
		formDataThrows?: boolean;
	} = {}
) {
	const bucket =
		opts.bucket === undefined ? { put: vi.fn().mockResolvedValue(undefined) } : opts.bucket;

	const formData = new FormData();
	if (opts.file instanceof File) {
		formData.append('file', opts.file);
	} else if (typeof opts.file === 'string') {
		formData.append('file', opts.file);
	}

	const event = {
		locals: { user: opts.user === undefined ? { isOwner: true } : opts.user },
		platform: bucket ? { env: { BUCKET: bucket } } : { env: {} },
		request: {
			formData: opts.formDataThrows
				? () => Promise.reject(new TypeError('malformed multipart body'))
				: () => Promise.resolve(formData)
		}
	};
	return { event, bucket };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('POST /api/admin/upload — access control', () => {
	it('rejects an anonymous request', async () => {
		const { event } = makeEvent({ user: null, file: pngFile() });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 401 });
	});

	it('rejects a signed-in user who is neither owner nor admin', async () => {
		const { event } = makeEvent({ user: { isOwner: false, isAdmin: false }, file: pngFile() });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 403 });
	});

	it('allows an admin who is not the owner', async () => {
		const { event } = makeEvent({ user: { isAdmin: true }, file: pngFile() });
		expect((await POST(event as never)).status).toBe(201);
	});

	it('allows the owner', async () => {
		const { event } = makeEvent({ user: { isOwner: true }, file: pngFile() });
		expect((await POST(event as never)).status).toBe(201);
	});

	it('checks authentication before touching storage', async () => {
		// A missing bucket must not turn an anonymous request into a 500.
		const { event } = makeEvent({ user: null, bucket: null, file: pngFile() });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 401 });
	});
});

describe('POST /api/admin/upload — request validation', () => {
	it('fails when the R2 binding is missing', async () => {
		const { event } = makeEvent({ bucket: null, file: pngFile() });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 500 });
	});

	it('rejects a body that is not parseable as form data', async () => {
		const { event } = makeEvent({ formDataThrows: true });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects a request with no file field', async () => {
		const { event } = makeEvent({ file: null });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects a text value sent in the file field', async () => {
		const { event } = makeEvent({ file: 'not-a-file' });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects a disallowed content type and says so', async () => {
		const { event } = makeEvent({ file: pngFile('doc.pdf', 'application/pdf') });
		await expect(POST(event as never)).rejects.toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('Unsupported file type') }
		});
	});

	it('rejects an SVG, which is an image the validator deliberately excludes', async () => {
		const { event } = makeEvent({ file: pngFile('x.svg', 'image/svg+xml') });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects a file over the size limit without writing it', async () => {
		const big = pngFile();
		Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 });
		const { event, bucket } = makeEvent({ file: big });

		await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		expect(bucket?.put).not.toHaveBeenCalled();
	});
});

describe('POST /api/admin/upload — storing the object', () => {
	it('writes to a UUID key under uploads/ and returns its public URL', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
		const file = pngFile();
		const { event, bucket } = makeEvent({ file });

		const response = await POST(event as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({
			url: `/media/uploads/${UUID}.png`,
			key: `uploads/${UUID}.png`,
			size: file.size,
			contentType: 'image/png'
		});
		expect(bucket?.put).toHaveBeenCalledWith(`uploads/${UUID}.png`, expect.any(ArrayBuffer), {
			httpMetadata: { contentType: 'image/png' }
		});
	});

	it('maps each allowed type onto its own extension', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
		const { event } = makeEvent({ file: pngFile('a.webp', 'image/webp') });

		expect((await (await POST(event as never)).json()).key).toBe(`uploads/${UUID}.webp`);
	});

	it('stores the file bytes, not the filename', async () => {
		const { event, bucket } = makeEvent({ file: pngFile('a.png', 'image/png', 'REAL-BYTES') });

		await POST(event as never);

		const stored = bucket?.put.mock.calls[0][1] as ArrayBuffer;
		expect(new TextDecoder().decode(stored)).toBe('REAL-BYTES');
	});
});
