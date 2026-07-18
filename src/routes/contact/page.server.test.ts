import { describe, expect, it, vi, beforeEach } from 'vitest';

const contactMocks = vi.hoisted(() => ({ createContactFormSubmission: vi.fn() }));
const turnstileMocks = vi.hoisted(() => ({ verifyTurnstile: vi.fn(), turnstileEnabled: vi.fn() }));

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
	turnstileMocks.turnstileEnabled.mockReturnValue(false);
});

describe('contact load', () => {
	it('surfaces the turnstile site key when present', async () => {
		const data = (await load({
			platform: { env: { TURNSTILE_SITE_KEY: 'sk' } }
		} as never)) as { turnstileSiteKey: string | null };
		expect(data.turnstileSiteKey).toBe('sk');
	});
	it('is null when the site key is absent', async () => {
		const data = (await load({ platform: { env: {} } } as never)) as {
			turnstileSiteKey: string | null;
		};
		expect(data.turnstileSiteKey).toBeNull();
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
		turnstileMocks.turnstileEnabled.mockReturnValue(true);
		turnstileMocks.verifyTurnstile.mockResolvedValue(false);
		const res = await actions.default(
			actionEvent(valid, { DB: {}, TURNSTILE_SECRET_KEY: 'sk' }) as never
		);
		expect(res).toMatchObject({ status: 400 });
		expect(contactMocks.createContactFormSubmission).not.toHaveBeenCalled();
	});

	it('creates when turnstile is enabled and verification passes', async () => {
		turnstileMocks.turnstileEnabled.mockReturnValue(true);
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
});
