import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

const ETAG = '"abc123"';

function makeObject(
	overrides: Partial<{
		httpEtag: string;
		httpMetadata: { contentType?: string };
		body: string;
	}> = {}
) {
	return {
		httpEtag: ETAG,
		httpMetadata: { contentType: 'image/png' },
		body: 'bytes',
		...overrides
	};
}

function makeEvent(
	opts: {
		key?: string;
		object?: ReturnType<typeof makeObject> | null;
		hasBucket?: boolean;
		ifNoneMatch?: string;
	} = {}
) {
	const object = opts.object === undefined ? makeObject() : opts.object;
	const bucket = { get: vi.fn().mockResolvedValue(object) };
	const headers = new Headers();
	if (opts.ifNoneMatch) {
		headers.set('If-None-Match', opts.ifNoneMatch);
	}

	const event = {
		platform: opts.hasBucket === false ? { env: {} } : { env: { BUCKET: bucket } },
		params: { key: opts.key ?? 'uploads/abc.png' },
		request: { headers }
	};
	return { event, bucket };
}

describe('GET /media/[...key] — guards', () => {
	it('fails when the R2 binding is missing', async () => {
		const { event } = makeEvent({ hasBucket: false });
		await expect(GET(event as never)).rejects.toMatchObject({ status: 500 });
	});

	it.each([
		['a path traversal', 'uploads/../secrets.png'],
		['a key outside uploads/', 'secrets/key.png'],
		['a doubled slash', 'uploads//key.png']
	])('404s on %s without asking storage for it', async (_label, key) => {
		const { event, bucket } = makeEvent({ key });

		await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
		expect(bucket.get).not.toHaveBeenCalled();
	});

	it('404s when the key is valid but the object is absent', async () => {
		const { event } = makeEvent({ object: null });
		await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
	});
});

describe('GET /media/[...key] — responses', () => {
	it('streams the object with its stored content type and an immutable cache', async () => {
		const { event, bucket } = makeEvent();

		const response = await GET(event as never);

		expect(bucket.get).toHaveBeenCalledWith('uploads/abc.png');
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
		expect(response.headers.get('ETag')).toBe(ETAG);
	});

	it('falls back to a generic content type when R2 recorded none', async () => {
		const { event } = makeEvent({ object: makeObject({ httpMetadata: {} }) });

		expect((await GET(event as never)).headers.get('Content-Type')).toBe(
			'application/octet-stream'
		);
	});

	it('omits the ETag header when the object has no etag', async () => {
		const { event } = makeEvent({ object: makeObject({ httpEtag: '' }) });

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('ETag')).toBeNull();
	});

	it('returns 304 with no body when the client already has the current etag', async () => {
		const { event } = makeEvent({ ifNoneMatch: ETAG });

		const response = await GET(event as never);

		expect(response.status).toBe(304);
		expect(response.body).toBeNull();
		expect(response.headers.get('ETag')).toBe(ETAG);
	});

	it('serves the body when the client sends a stale etag', async () => {
		const { event } = makeEvent({ ifNoneMatch: '"stale"' });

		expect((await GET(event as never)).status).toBe(200);
	});

	it('serves the body when the object has no etag to compare against', async () => {
		const { event } = makeEvent({
			object: makeObject({ httpEtag: '' }),
			ifNoneMatch: ''
		});

		expect((await GET(event as never)).status).toBe(200);
	});
});
