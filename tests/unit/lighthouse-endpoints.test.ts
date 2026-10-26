/**
 * The two doors into the audit, and the fact that they are two.
 *
 * `/api/cron/lighthouse` takes a shared bearer secret because its caller is a
 * scheduler. `/api/admin/lighthouse` takes a session because its caller is a
 * person. They must not accept each other's credential: a bearer secret that
 * works from a browser is a secret in a browser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { POST as cronPost } from '../../src/routes/api/cron/lighthouse/+server';
import { POST as adminPost } from '../../src/routes/api/admin/lighthouse/+server';

const sweep = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/lighthouse', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/lighthouse')>();
	return { ...actual, runLighthouseSweep: sweep };
});

beforeEach(() => {
	sweep.mockReset().mockResolvedValue({ audited: 3, failed: 0 });
});

function cronEvent(
	auth: string | null,
	env: Record<string, unknown> = { CRON_SECRET: 's3cret', DB: createSqliteD1() },
	search = ''
) {
	const headers = new Headers();
	if (auth !== null) headers.set('authorization', auth);
	return {
		request: new Request('https://x.test/api/cron/lighthouse', { method: 'POST', headers }),
		url: new URL(`https://x.test/api/cron/lighthouse${search}`),
		platform: { env }
	} as never;
}

function adminEvent(user: unknown, env: Record<string, unknown> = { DB: createSqliteD1() }) {
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
		const body = await response.json();
		expect(body).toMatchObject({
			job: 'lighthouse',
			outcome: 'succeeded',
			detail: { strategy: 'mobile', audited: 3, failed: 0 }
		});
	});

	it('passes the strategy through and ignores nonsense', async () => {
		await cronPost(cronEvent('Bearer s3cret', undefined, '?strategy=desktop'));
		expect(sweep.mock.calls[0][1].strategy).toBe('desktop');
		await cronPost(cronEvent('Bearer s3cret', undefined, '?strategy=weird'));
		expect(sweep.mock.calls[1][1].strategy).toBe('mobile');
	});

	it('answers 500 when the sweep throws, so the scheduler retries', async () => {
		sweep.mockRejectedValue(new Error('PSI is down'));
		const response = await cronPost(cronEvent('Bearer s3cret'));
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ outcome: 'failed', error: 'PSI is down' });
	});

	it('refuses a wrong secret', async () => {
		await expect(cronPost(cronEvent('Bearer wrong'))).rejects.toMatchObject({ status: 401 });
		expect(sweep).not.toHaveBeenCalled();
	});

	it('refuses a missing header', async () => {
		await expect(cronPost(cronEvent(null))).rejects.toMatchObject({ status: 401 });
	});

	it('refuses to run at all when no secret is configured', async () => {
		// Fail closed. An unset CRON_SECRET must not mean "open endpoint".
		await expect(cronPost(cronEvent('Bearer ', { DB: createSqliteD1() }))).rejects.toMatchObject({
			status: 503
		});
	});

	it('does not accept a session in place of the secret', async () => {
		await expect(cronPost(cronEvent('Bearer '))).rejects.toMatchObject({ status: 401 });
	});
});

describe('POST /api/admin/lighthouse', () => {
	it('runs for an admin', async () => {
		const response = await adminPost(
			adminEvent({ id: '1', isAdmin: true, permissions: ['lighthouse'] })
		);
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
			adminPost(adminEvent(null, { DB: createSqliteD1(), CRON_SECRET: 's3cret' }))
		).rejects.toMatchObject({ status: 401 });
	});
});
