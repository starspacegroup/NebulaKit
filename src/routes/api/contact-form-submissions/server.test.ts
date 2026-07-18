import { describe, expect, it, vi, beforeEach } from 'vitest';

const contactMocks = vi.hoisted(() => ({
	createContactFormSubmission: vi.fn(),
	listContactFormSubmissions: vi.fn(),
	countContactFormSubmissions: vi.fn()
}));
const turnstileMocks = vi.hoisted(() => ({
	verifyTurnstile: vi.fn(),
	turnstileEnabled: vi.fn()
}));

vi.mock('$lib/services/contact', () => contactMocks);
vi.mock('$lib/server/turnstile', () => turnstileMocks);

import { GET, POST } from './+server';

const DB = {} as never;

function getEvent(opts: {
	user?: { isOwner?: boolean; isAdmin?: boolean } | null;
	cookie?: string;
	params?: Record<string, string>;
}) {
	const search = new URLSearchParams(opts.params ?? {});
	return {
		locals: { user: opts.user ?? undefined },
		platform: { env: { DB } },
		url: new URL(`http://localhost/api/contact-form-submissions?${search.toString()}`),
		cookies: { get: () => opts.cookie }
	};
}

function postEvent(body: Record<string, unknown>, env: Record<string, unknown> = { DB }) {
	return {
		request: {
			json: async () => body,
			headers: { get: () => null }
		},
		platform: { env }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	turnstileMocks.turnstileEnabled.mockReturnValue(false);
});

describe('GET /api/contact-form-submissions', () => {
	it('rejects anonymous requests', async () => {
		await expect(GET(getEvent({ user: null }) as never)).rejects.toMatchObject({ status: 401 });
	});

	it('rejects non-admins', async () => {
		await expect(GET(getEvent({ user: {} }) as never)).rejects.toMatchObject({ status: 403 });
	});

	it('masks name/email when PII is not revealed', async () => {
		contactMocks.listContactFormSubmissions.mockResolvedValue([
			{ id: '1', name: 'Ada Lovelace', email: 'ada@example.com', isResolved: false }
		]);
		contactMocks.countContactFormSubmissions.mockResolvedValue(1);
		const res = await GET(getEvent({ user: { isAdmin: true } }) as never);
		const data = (await res.json()) as { values: Array<{ name: string; email: string }> };
		expect(data.values[0].name).toBe('A** L*******');
		expect(data.values[0].email).toBe('a**@example.com');
	});

	it('returns real values when the owner has PII revealed', async () => {
		contactMocks.listContactFormSubmissions.mockResolvedValue([
			{ id: '1', name: 'Ada Lovelace', email: 'ada@example.com', isResolved: false }
		]);
		contactMocks.countContactFormSubmissions.mockResolvedValue(1);
		const res = await GET(getEvent({ user: { isOwner: true }, cookie: '1' }) as never);
		const data = (await res.json()) as { values: Array<{ name: string }> };
		expect(data.values[0].name).toBe('Ada Lovelace');
	});
});

describe('POST /api/contact-form-submissions', () => {
	it('500s when the database is unavailable', async () => {
		await expect(POST(postEvent({}, {}) as never)).rejects.toMatchObject({ status: 500 });
	});

	it('400s on invalid input', async () => {
		await expect(POST(postEvent({ name: 'x' }) as never)).rejects.toMatchObject({ status: 400 });
	});

	it('creates a submission when valid and turnstile is disabled', async () => {
		contactMocks.createContactFormSubmission.mockResolvedValue({ id: 'new' });
		const res = await POST(
			postEvent({ name: 'Ada', email: 'ada@example.com', message: 'hello world' }) as never
		);
		expect(res.status).toBe(201);
		expect(contactMocks.createContactFormSubmission).toHaveBeenCalled();
	});

	it('rejects when turnstile is enabled and verification fails', async () => {
		turnstileMocks.turnstileEnabled.mockReturnValue(true);
		turnstileMocks.verifyTurnstile.mockResolvedValue(false);
		await expect(
			POST(
				postEvent(
					{ name: 'Ada', email: 'ada@example.com', message: 'hello world' },
					{ DB, TURNSTILE_SECRET_KEY: 'sk' }
				) as never
			)
		).rejects.toMatchObject({ status: 400 });
		expect(contactMocks.createContactFormSubmission).not.toHaveBeenCalled();
	});

	it('creates when turnstile is enabled and verification passes', async () => {
		turnstileMocks.turnstileEnabled.mockReturnValue(true);
		turnstileMocks.verifyTurnstile.mockResolvedValue(true);
		contactMocks.createContactFormSubmission.mockResolvedValue({ id: 'new' });
		const res = await POST(
			postEvent(
				{
					name: 'Ada',
					email: 'ada@example.com',
					message: 'hello world',
					'cf-turnstile-response': 'tok'
				},
				{ DB, TURNSTILE_SECRET_KEY: 'sk' }
			) as never
		);
		expect(res.status).toBe(201);
	});
});
