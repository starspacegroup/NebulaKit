import { describe, expect, it, vi, beforeEach } from 'vitest';

const contactMocks = vi.hoisted(() => ({
	listContactFormSubmissions: vi.fn(),
	countContactFormSubmissions: vi.fn()
}));
vi.mock('$lib/services/contact', () => contactMocks);

import { load } from './+page.server';

function event(opts: {
	user?: { isOwner?: boolean; isAdmin?: boolean };
	cookie?: string;
	query?: Record<string, string>;
	db?: unknown;
}) {
	const search = new URLSearchParams(opts.query ?? {});
	return {
		locals: { user: opts.user },
		platform: { env: { DB: 'db' in opts ? opts.db : {} } },
		url: new URL(`http://localhost/admin/contact-form-submissions?${search}`),
		cookies: { get: () => opts.cookie }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	contactMocks.countContactFormSubmissions.mockResolvedValue(1);
	contactMocks.listContactFormSubmissions.mockResolvedValue([
		{ id: '1', name: 'Ada Lovelace', email: 'ada@example.com', isResolved: false }
	]);
});

describe('admin contact submissions load', () => {
	it('throws 500 without a database', async () => {
		await expect(load(event({ user: { isOwner: true }, db: null }) as never)).rejects.toMatchObject(
			{ status: 500 }
		);
	});

	it('masks name/email by default', async () => {
		const data = (await load(event({ user: { isAdmin: true } }) as never)) as {
			submissions: Array<{ name: string; email: string }>;
		};
		expect(data.submissions[0].name).toBe('A** L*******');
		expect(data.submissions[0].email).toBe('a**@example.com');
	});

	it('reveals real data for an owner with the cookie set', async () => {
		const data = (await load(event({ user: { isOwner: true }, cookie: '1' }) as never)) as {
			submissions: Array<{ name: string }>;
		};
		expect(data.submissions[0].name).toBe('Ada Lovelace');
	});

	it('passes the unresolved filter through and computes pages', async () => {
		await load(event({ user: { isOwner: true }, query: { unresolved: '1', page: '2' } }) as never);
		expect(contactMocks.listContactFormSubmissions).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ unresolvedOnly: true, offset: 50 })
		);
	});
});
