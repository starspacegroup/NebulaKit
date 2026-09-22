/**
 * The two doors into the audit, and the fact that they are two.
 *
 * `/api/cron/lighthouse` takes a shared bearer secret because its caller is a
 * scheduler. `/api/admin/lighthouse` takes a session because its caller is a
 * person. They must not accept each other's credential: a bearer secret that
 * works from a browser is a secret in a browser.
 */
import { describe, expect, it, vi } from 'vitest';
import { POST as cronPost } from '../../src/routes/api/cron/lighthouse/+server';
import { POST as adminPost } from '../../src/routes/api/admin/lighthouse/+server';

vi.mock('$lib/server/lighthouse', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/lighthouse')>();
	return { ...actual, runLighthouseSweep: vi.fn().mockResolvedValue({ audited: 3, failed: 0 }) };
});

const db = { batch: vi.fn(), prepare: () => ({ bind: () => ({}) }) };

function cronEvent(
	auth: string | null,
	env: Record<string, unknown> = { CRON_SECRET: 's3cret', DB: db }
) {
	return {
		request: { headers: { get: () => auth } },
		url: new URL('https://x.test/api/cron/lighthouse'),
		platform: { env }
	} as never;
}

function adminEvent(user: unknown, env: Record<string, unknown> = { DB: db }) {
	return {
		request: { json: async () => ({}) },
		locals: { user },
		platform: { env }
	} as never;
}

describe('POST /api/cron/lighthouse', () => {
	it('runs for the right bearer secret', async () => {
		const response = await cronPost(cronEvent('Bearer s3cret'));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ audited: 3, failed: 0 });
	});

	it('refuses a wrong secret', async () => {
		await expect(cronPost(cronEvent('Bearer wrong'))).rejects.toMatchObject({ status: 401 });
	});

	it('refuses a missing header', async () => {
		await expect(cronPost(cronEvent(null))).rejects.toMatchObject({ status: 401 });
	});

	it('refuses to run at all when no secret is configured', async () => {
		// Fail closed. An unset CRON_SECRET must not mean "open endpoint".
		await expect(cronPost(cronEvent('Bearer ', { DB: db }))).rejects.toMatchObject({ status: 503 });
	});

	it('does not accept a session in place of the secret', async () => {
		await expect(cronPost(cronEvent('Bearer '))).rejects.toMatchObject({ status: 401 });
	});
});

describe('POST /api/admin/lighthouse', () => {
	it('runs for an admin', async () => {
		const response = await adminPost(adminEvent({ id: '1', isAdmin: true }));
		expect(response.status).toBe(200);
	});

	it('runs for the owner', async () => {
		const response = await adminPost(adminEvent({ id: '1', isOwner: true }));
		expect(response.status).toBe(200);
	});

	it('refuses a signed-in non-admin', async () => {
		// Guarded server-side, not by hiding the button. Hiding UI is not
		// authorization.
		await expect(adminPost(adminEvent({ id: '2' }))).rejects.toMatchObject({ status: 403 });
	});

	it('refuses an anonymous caller', async () => {
		await expect(adminPost(adminEvent(null))).rejects.toMatchObject({ status: 401 });
	});

	it('does not accept the cron secret in place of a session', async () => {
		// The two doors stay separate: no bearer token opens the admin one.
		await expect(
			adminPost(adminEvent(null, { DB: db, CRON_SECRET: 's3cret' }))
		).rejects.toMatchObject({ status: 401 });
	});
});
