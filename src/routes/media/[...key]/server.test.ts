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

describe('GET /media/[...key] — byte ranges', () => {
	function rangeEvent(range: string, size = 1000) {
		const object = { ...makeObject(), size, body: 'slice' };
		const bucket = {
			head: vi.fn().mockResolvedValue({ size }),
			get: vi.fn().mockResolvedValue(object)
		};
		const event = {
			platform: { env: { BUCKET: bucket } },
			params: { key: 'uploads/clip.mp4' },
			request: { headers: new Headers({ Range: range }) }
		};
		return { event, bucket };
	}

	it('advertises ranges on a normal response', async () => {
		const { event } = makeEvent();
		const response = await GET(event as never);
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(response.status).toBe(200);
	});

	it('answers a range with 206 and its Content-Range', async () => {
		const { event, bucket } = rangeEvent('bytes=100-199');
		const response = await GET(event as never);
		expect(response.status).toBe(206);
		expect(response.headers.get('Content-Range')).toBe('bytes 100-199/1000');
		expect(response.headers.get('Content-Length')).toBe('100');
		expect(bucket.get).toHaveBeenCalledWith('uploads/clip.mp4', {
			range: { offset: 100, length: 100 }
		});
	});

	it('answers an open-ended and a suffix range', async () => {
		const open = await GET(rangeEvent('bytes=900-').event as never);
		expect(open.headers.get('Content-Range')).toBe('bytes 900-999/1000');
		const suffix = await GET(rangeEvent('bytes=-50').event as never);
		expect(suffix.headers.get('Content-Range')).toBe('bytes 950-999/1000');
	});

	it('answers 416 for a range past the end', async () => {
		const { event } = rangeEvent('bytes=2000-3000');
		const response = await GET(event as never);
		expect(response.status).toBe(416);
		expect(response.headers.get('Content-Range')).toBe('bytes */1000');
	});

	it('serves the whole object for a header it cannot use', async () => {
		const { event, bucket } = rangeEvent('bytes=0-1,5-6');
		const response = await GET(event as never);
		expect(response.status).toBe(200);
		expect(bucket.get).toHaveBeenCalledWith('uploads/clip.mp4');
	});

	it('404s when the object is gone before the range is read', async () => {
		const { event, bucket } = rangeEvent('bytes=0-9');
		bucket.head.mockResolvedValue(null);
		await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
	});
});
