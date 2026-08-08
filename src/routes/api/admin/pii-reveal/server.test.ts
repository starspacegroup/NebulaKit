import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

function makeEvent(opts: {
	user?: { isOwner?: boolean; isAdmin?: boolean } | null;
	reveal?: boolean;
}) {
	const cookies = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
	const event = {
		locals: { user: opts.user ?? undefined },
		cookies,
		request: { json: async () => ({ reveal: opts.reveal }) }
	};
	return { event, cookies };
}

describe('POST /api/admin/pii-reveal', () => {
	it('forbids users who cannot reveal (no user)', async () => {
		const { event } = makeEvent({ user: null, reveal: true });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 403 });
	});

	it('forbids plain admins', async () => {
		const { event } = makeEvent({ user: { isAdmin: true }, reveal: true });
		await expect(POST(event as never)).rejects.toMatchObject({ status: 403 });
	});

	it('sets the pii_reveal cookie for an owner opting in', async () => {
		const { event, cookies } = makeEvent({ user: { isOwner: true }, reveal: true });
		const res = await POST(event as never);
		expect(res.status).toBe(200);
		expect(cookies.set).toHaveBeenCalledWith(
			'pii_reveal',
			'1',
			expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'strict' })
		);
	});

	it('deletes the cookie for an owner opting out', async () => {
		const { event, cookies } = makeEvent({ user: { isOwner: true }, reveal: false });
		await POST(event as never);
		expect(cookies.delete).toHaveBeenCalledWith('pii_reveal', { path: '/' });
	});
});
