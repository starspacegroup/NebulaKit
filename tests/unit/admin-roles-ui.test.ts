import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL('http://localhost/admin'),
			params: {},
			status: 200,
			error: null
		}),
		navigating: writable(null),
		updated: { check: () => Promise.resolve(false), subscribe: writable(false).subscribe }
	};
});

import AdminLayout from '../../src/routes/admin/+layout.svelte';
import UsersPage from '../../src/routes/admin/users/+page.svelte';

const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

const base = {
	hasAIProviders: false,
	cmsPaletteItems: [],
	gaMeasurementId: null,
	canRevealPii: false,
	piiRevealed: true,
	canViewStats: false,
	canManageAnalytics: false
};
const user = (extra: Record<string, unknown>) => ({
	id: 'me',
	login: 'me',
	email: 'me@x.test',
	isOwner: false,
	isAdmin: true,
	...extra
});

describe('admin nav follows the permission list', () => {
	const links = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

	it('shows an admin only the areas they hold', () => {
		render(AdminLayout, {
			props: { data: { ...base, user: user({ role: 'admin', permissions: ['cms', 'contact'] }) } }
		});
		expect(links()).toEqual(['/admin', '/admin/cms', '/admin/contact-form-submissions']);
	});

	it('shows nothing but the dashboard to an admin with no grants', () => {
		render(AdminLayout, {
			props: { data: { ...base, user: user({ role: 'admin', permissions: [] }) } }
		});
		expect(links()).toEqual(['/admin']);
	});

	it('shows an owner everything, including the owner-only entries', () => {
		render(AdminLayout, {
			props: { data: { ...base, canManageAnalytics: true, user: user({ isOwner: true }) } }
		});
		const hrefs = links();
		for (const href of [
			'/admin/settings',
			'/admin/analytics',
			'/admin/ai-keys',
			'/admin/users',
			'/admin/cms',
			'/admin/pages',
			'/admin/api-keys',
			'/admin/contact-form-submissions',
			'/admin/lighthouse'
		]) {
			expect(hrefs).toContain(href);
		}
	});
});

const rows = [
	{
		id: 'me',
		name: 'Me',
		email: 'me@x.test',
		is_admin: 1,
		effective_role: 'admin',
		created_at: '2024-01-01'
	},
	{
		id: 'peer',
		name: 'Peer',
		email: 'p@x.test',
		is_admin: 1,
		effective_role: 'admin',
		created_at: '2024-01-01'
	},
	{
		id: 'low',
		name: 'Low',
		email: 'l@x.test',
		is_admin: 0,
		effective_role: 'user',
		created_at: '2024-01-01'
	},
	{
		id: 'boss',
		name: 'Boss',
		email: 'b@x.test',
		is_admin: 1,
		effective_role: 'owner',
		created_at: '2024-01-01'
	},
	{
		id: 'sa',
		name: 'Sally',
		email: 'sa@x.test',
		is_admin: 1,
		effective_role: 'superadmin',
		created_at: '2024-01-01'
	},
	{
		id: 'ad',
		name: 'Ada',
		email: 'ad@x.test',
		is_admin: 1,
		effective_role: 'admin',
		permissions: ['cms', 'stats'],
		created_at: '2024-01-01'
	}
];
const page = (u: Record<string, unknown>, piiRevealed = true) => ({
	props: { data: { ...base, piiRevealed, user: u, users: rows } as never }
});

describe('users page: role-aware actions', () => {
	beforeEach(() => mockFetch.mockReset());

	const manage = (name: string) =>
		screen.getByRole('button', { name: `Manage access for ${name}` });

	it('an admin with users-manage can only act on people below them', () => {
		render(UsersPage, page(user({ role: 'admin', permissions: ['users', 'users-manage'] })));
		expect(manage('Low')).toBeEnabled();
		for (const name of ['Peer', 'Boss', 'Sally', 'Me']) expect(manage(name)).toBeDisabled();
		expect(manage('Peer').title).toMatch(/below your own role/i);
		expect(manage('Boss').title).toMatch(/owner cannot be changed/i);
		expect(manage('Me').title).toMatch(/your own role/i);
		// They cannot promote anyone (nobody is below admin but users, and admin is not below them).
		expect(screen.getAllByLabelText('Promote to admin')[0]).toBeDisabled();
	});

	it('disables everything with a reason when the admin lacks users-manage', () => {
		render(UsersPage, page(user({ role: 'admin', permissions: ['users'] })));
		expect(manage('Low')).toBeDisabled();
		expect(manage('Low').title).toMatch(/do not have permission/i);
	});

	it('disables everything while ids are masked', () => {
		render(UsersPage, page(user({ isOwner: true }), false));
		expect(manage('Low')).toBeDisabled();
		expect(manage('Low').title).toMatch(/reveal identifiers/i);
	});

	it('a superadmin cannot touch the owner or a peer, but can touch an admin', () => {
		render(UsersPage, page(user({ role: 'superadmin' })));
		expect(manage('Boss')).toBeDisabled();
		expect(manage('Sally')).toBeDisabled();
		expect(manage('Ada')).toBeEnabled();
	});

	it('labels roles in text, not colour alone, and counts an admin areas', () => {
		render(UsersPage, page(user({ isOwner: true })));
		expect(screen.getByText('Owner')).toBeInTheDocument();
		expect(screen.getByText('Superadmin')).toBeInTheDocument();
		expect(screen.getByText('2 of 9 areas')).toBeInTheDocument();
	});
});

describe('users page: access dialog', () => {
	beforeEach(() => mockFetch.mockReset());

	it('lets the owner set an admin role and areas, and posts them', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) });
		render(UsersPage, page(user({ isOwner: true })));
		await fireEvent.click(screen.getByRole('button', { name: 'Manage access for Ada' }));

		const dialog = screen.getByRole('dialog', { name: /Access for Ada/ });
		const roles = within(dialog).getAllByRole('radio');
		expect(roles.map((r) => (r as HTMLInputElement).value)).toEqual([
			'user',
			'admin',
			'superadmin'
		]);
		expect(within(dialog).getByRole('radio', { name: 'Admin' })).toBeChecked();
		expect(within(dialog).getByRole('checkbox', { name: /Content/ })).toBeChecked();
		expect(within(dialog).getByRole('checkbox', { name: /Pages/ })).not.toBeChecked();

		await fireEvent.click(within(dialog).getByRole('checkbox', { name: /Pages/ }));
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save access' }));

		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe('/api/admin/users/ad');
		expect(init.method).toBe('PATCH');
		expect(JSON.parse(init.body)).toEqual({
			role: 'admin',
			permissions: expect.arrayContaining(['cms', 'stats', 'pages'])
		});
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('offers a superadmin only roles below theirs and explains why permissions are locked', async () => {
		render(UsersPage, page(user({ role: 'superadmin' })));
		await fireEvent.click(screen.getByRole('button', { name: 'Manage access for Ada' }));
		const dialog = screen.getByRole('dialog');
		expect(within(dialog).queryByRole('radio', { name: 'Superadmin' })).not.toBeInTheDocument();
		// Choosing "User" makes the permissions section explain itself.
		await fireEvent.click(within(dialog).getByRole('radio', { name: 'User' }));
		expect(within(dialog).getByText(/Make them an admin first/i)).toBeInTheDocument();
		expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save access' }));
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());
		// A role change without a permission list.
		expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ role: 'user' });
	});

	it('shows the server rule message when the change is refused, and stays open', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			json: async () => ({ message: 'You cannot grant a role at or above your own.' })
		});
		render(UsersPage, page(user({ isOwner: true })));
		await fireEvent.click(screen.getByRole('button', { name: 'Manage access for Low' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save access' }));
		expect(await screen.findByText(/at or above your own/i)).toBeInTheDocument();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('falls back to a generic message on a network failure and closes on Escape or Cancel', async () => {
		mockFetch.mockRejectedValueOnce(new Error('offline'));
		render(UsersPage, page(user({ isOwner: true })));
		await fireEvent.click(screen.getByRole('button', { name: 'Manage access for Low' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save access' }));
		expect(await screen.findByText('Failed to update access')).toBeInTheDocument();
		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Manage access for Low' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});
});
