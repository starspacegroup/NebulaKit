import { describe, expect, it, vi, beforeEach } from 'vitest';

const contactMocks = vi.hoisted(() => ({
	getContactFormSubmission: vi.fn(),
	resolveContactFormSubmission: vi.fn()
}));
vi.mock('$lib/services/contact', () => contactMocks);

import { load, actions } from './+page.server';

const submission = {
	id: 'id-1',
	slug: 's',
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	message: 'Hi',
	isResolved: false,
	createdAt: '2026-01-01'
};

function loadEvent(opts: {
	user?: { isOwner?: boolean; isAdmin?: boolean };
	cookie?: string;
	db?: unknown;
}) {
	return {
		locals: { user: opts.user },
		platform: { env: { DB: 'db' in opts ? opts.db : {} } },
		params: { id: 'id-1' },
		cookies: { get: () => opts.cookie }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	contactMocks.getContactFormSubmission.mockResolvedValue(submission);
});

describe('admin submission detail load', () => {
	it('throws 500 without a database', async () => {
		await expect(
			load(loadEvent({ user: { isOwner: true }, db: null }) as never)
		).rejects.toMatchObject({ status: 500 });
	});

	it('throws 404 when the submission is missing', async () => {
		contactMocks.getContactFormSubmission.mockResolvedValue(null);
		await expect(load(loadEvent({ user: { isOwner: true } }) as never)).rejects.toMatchObject({
			status: 404
		});
	});

	it('masks name/email by default', async () => {
		const data = (await load(loadEvent({ user: { isAdmin: true } }) as never)) as {
			submission: { name: string; email: string };
		};
		expect(data.submission.name).toBe('A** L*******');
		expect(data.submission.email).toBe('a**@example.com');
	});

	it('reveals for an owner with the cookie set', async () => {
		const data = (await load(loadEvent({ user: { isOwner: true }, cookie: '1' }) as never)) as {
			submission: { name: string };
		};
		expect(data.submission.name).toBe('Ada Lovelace');
	});
});

describe('resolve action', () => {
	it('resolves then redirects to the inbox', async () => {
		await expect(
			actions.resolve({ platform: { env: { DB: {} } }, params: { id: 'id-1' } } as never)
		).rejects.toMatchObject({ status: 302, location: '/admin/contact-form-submissions' });
		expect(contactMocks.resolveContactFormSubmission).toHaveBeenCalledWith({}, 'id-1');
	});

	it('throws 500 without a database', async () => {
		await expect(
			actions.resolve({ platform: { env: { DB: null } }, params: { id: 'id-1' } } as never)
		).rejects.toMatchObject({ status: 500 });
	});
});
