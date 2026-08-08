import { describe, expect, it, vi, beforeEach } from 'vitest';

const contactMocks = vi.hoisted(() => ({ createContactFormSubmission: vi.fn() }));
const turnstileMocks = vi.hoisted(() => ({
	verifyTurnstile: vi.fn(),
	getTurnstileConfig: vi.fn()
}));

vi.mock('$lib/services/contact', () => contactMocks);
vi.mock('$lib/server/turnstile', () => turnstileMocks);

import { load, actions } from './+page.server';

function actionEvent(fields: Record<string, string>, env: Record<string, unknown> = { DB: {} }) {
	const form = new Map(Object.entries(fields));
	return {
		request: { formData: async () => form, headers: { get: () => null } },
		platform: { env }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	turnstileMocks.getTurnstileConfig.mockReturnValue({ enabled: false });
});

describe('contact load', () => {
	it('surfaces the turnstile site key when both keys are present', async () => {
		turnstileMocks.getTurnstileConfig.mockReturnValue({
			enabled: true,
			siteKey: 'site',
			secretKey: 'secret'
		});
		const data = (await load({
			platform: { env: { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' } }
		} as never)) as { turnstileSiteKey: string | null };
		expect(data.turnstileSiteKey).toBe('site');
	});
	it('is null when the site key is absent', async () => {
		const data = (await load({ platform: { env: {} } } as never)) as {
			turnstileSiteKey: string | null;
		};
		expect(data.turnstileSiteKey).toBeNull();
	});
	it('reports partial configuration as an operator error', async () => {
		turnstileMocks.getTurnstileConfig.mockReturnValue({
			enabled: false,
			error: 'Turnstile requires both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.'
		});
		await expect(
			load({ platform: { env: { TURNSTILE_SITE_KEY: 'site' } } } as never)
		).rejects.toMatchObject({ status: 500 });
	});
});

describe('contact default action', () => {
	const valid = { name: 'Ada', email: 'ada@example.com', message: 'hello world' };

	it('fails with 500 when the database is unavailable', async () => {
		const res = await actions.default(actionEvent(valid, {}) as never);
		expect(res).toMatchObject({ status: 500 });
	});

	it('fails with 400 on invalid input', async () => {
		const res = await actions.default(actionEvent({ name: 'x' }) as never);
		expect(res).toMatchObject({ status: 400 });
	});

	it('creates a submission on valid input', async () => {
		const res = await actions.default(actionEvent(valid) as never);
		expect(res).toMatchObject({ success: true });
		expect(contactMocks.createContactFormSubmission).toHaveBeenCalledWith(
			{},
			{ name: 'Ada', email: 'ada@example.com', message: 'hello world' }
		);
	});

	it('fails when turnstile is enabled and verification fails', async () => {
		turnstileMocks.getTurnstileConfig.mockReturnValue({
			enabled: true,
			siteKey: 'site',
			secretKey: 'sk'
		});
		turnstileMocks.verifyTurnstile.mockResolvedValue(false);
		const res = await actions.default(
			actionEvent(valid, { DB: {}, TURNSTILE_SECRET_KEY: 'sk' }) as never
		);
		expect(res).toMatchObject({ status: 400 });
		expect(contactMocks.createContactFormSubmission).not.toHaveBeenCalled();
	});

	it('creates when turnstile is enabled and verification passes', async () => {
		turnstileMocks.getTurnstileConfig.mockReturnValue({
			enabled: true,
			siteKey: 'site',
			secretKey: 'sk'
		});
		turnstileMocks.verifyTurnstile.mockResolvedValue(true);
		const res = await actions.default(
			actionEvent(
				{ ...valid, 'cf-turnstile-response': 'tok' },
				{
					DB: {},
					TURNSTILE_SECRET_KEY: 'sk'
				}
			) as never
		);
		expect(res).toMatchObject({ success: true });
	});

	it('fails safely when Turnstile is partially configured', async () => {
		turnstileMocks.getTurnstileConfig.mockReturnValue({
			enabled: false,
			error: 'Turnstile requires both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.'
		});
		const res = await actions.default(
			actionEvent(valid, { DB: {}, TURNSTILE_SECRET_KEY: 'sk' }) as never
		);
		expect(res).toMatchObject({ status: 503 });
		expect(contactMocks.createContactFormSubmission).not.toHaveBeenCalled();
	});
});
