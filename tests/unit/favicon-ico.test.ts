import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET, HEAD } from '../../src/routes/favicon.ico/+server';

function call(handler: typeof GET, origin: string) {
	return handler({ url: new URL('/favicon.ico', origin) } as Parameters<typeof GET>[0]);
}

describe('/favicon.ico', () => {
	it('redirects to the SVG icon on the same origin', async () => {
		const response = (await call(GET, 'https://example.com')) as Response;
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://example.com/favicon.svg');
	});

	it('keeps the origin it was asked on', async () => {
		const response = (await call(GET, 'http://localhost:4277')) as Response;
		expect(response.headers.get('location')).toBe('http://localhost:4277/favicon.svg');
	});

	it('answers HEAD the same way', async () => {
		const response = (await call(HEAD, 'https://example.com')) as Response;
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://example.com/favicon.svg');
	});

	it('points at an icon that ships in static/', () => {
		expect(existsSync(resolve(__dirname, '../../static/favicon.svg'))).toBe(true);
	});
});
