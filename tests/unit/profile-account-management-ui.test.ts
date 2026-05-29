import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('http://localhost/profile'),
		params: {},
		status: 200,
		error: null,
		data: {},
		state: {},
		form: null
	})
}));

const layoutData = {
	hasAIProviders: false,
	cmsPaletteItems: [],
	devAuthSimulationEnabled: false
};

describe('Profile Account Management UI', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('renders login emails and password management state', async () => {
		const ProfilePage = (await import('../../src/routes/profile/+page.svelte')).default;

		render(ProfilePage, {
			props: {
				data: {
					...layoutData,
					user: {
						id: 'user-1',
						login: 'user',
						email: 'primary@example.com',
						name: 'User',
						isOwner: false,
						isAdmin: false
					},
					connectedAccounts: [],
					configuredProviders: { github: true, discord: true },
					hasPassword: true,
					loginEmails: ['primary@example.com', 'alias@example.com']
				}
			}
		});

		expect(
			screen.getByText('Manage password access and merged email aliases for this account.')
		).toBeInTheDocument();
		expect(screen.getByText(/configured/i)).toBeInTheDocument();
		expect(screen.getByText('alias@example.com')).toBeInTheDocument();
	});

	it('updates password from the profile page', async () => {
		const ProfilePage = (await import('../../src/routes/profile/+page.svelte')).default;
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: true, hasPassword: true }), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);

		render(ProfilePage, {
			props: {
				data: {
					...layoutData,
					user: {
						id: 'user-1',
						login: 'user',
						email: 'primary@example.com',
						name: 'User',
						isOwner: false,
						isAdmin: false
					},
					connectedAccounts: [],
					configuredProviders: { github: true, discord: false },
					hasPassword: false,
					loginEmails: ['primary@example.com']
				}
			}
		});

		await fireEvent.input(screen.getByLabelText(/^new password$/i), {
			target: { value: 'UpdatedPass123!' }
		});
		await fireEvent.input(screen.getByLabelText(/confirm new password/i), {
			target: { value: 'UpdatedPass123!' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /set password/i }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/auth/password',
				expect.objectContaining({ method: 'POST' })
			);
			expect(screen.getByText(/password updated/i)).toBeInTheDocument();
		});
	});

	it('merges another account from the profile page', async () => {
		const ProfilePage = (await import('../../src/routes/profile/+page.svelte')).default;
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					success: true,
					hasPassword: true,
					loginEmails: ['primary@example.com', 'merged@example.com'],
					connectedAccounts: [
						{ provider: 'github', provider_account_id: '123', created_at: '2024-01-01' }
					]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		render(ProfilePage, {
			props: {
				data: {
					...layoutData,
					user: {
						id: 'user-1',
						login: 'user',
						email: 'primary@example.com',
						name: 'User',
						isOwner: false,
						isAdmin: false
					},
					connectedAccounts: [],
					configuredProviders: { github: true, discord: false },
					hasPassword: true,
					loginEmails: ['primary@example.com']
				}
			}
		});

		await fireEvent.input(screen.getByLabelText(/account email to merge/i), {
			target: { value: 'merged@example.com' }
		});
		await fireEvent.input(screen.getByLabelText(/account password to merge/i), {
			target: { value: 'MergePass123!' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /merge account/i }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/auth/merge',
				expect.objectContaining({ method: 'POST' })
			);
			expect(screen.getByText('merged@example.com')).toBeInTheDocument();
			expect(screen.getByText(/account merged successfully/i)).toBeInTheDocument();
		});
	});

	it('shows connect options for pretend users in dev simulation even when providers are unconfigured', async () => {
		const ProfilePage = (await import('../../src/routes/profile/+page.svelte')).default;

		render(ProfilePage, {
			props: {
				data: {
					...layoutData,
					user: {
						id: 'dev-user-1',
						login: 'pretend-user',
						email: 'pretend@example.dev',
						name: 'Pretend User',
						isOwner: false,
						isAdmin: false,
						isPretend: true
					},
					connectedAccounts: [],
					configuredProviders: { github: false, discord: false },
					devAuthSimulationEnabled: true,
					hasPassword: false,
					loginEmails: ['pretend@example.dev']
				}
			}
		});

		expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(2);
	});
});
