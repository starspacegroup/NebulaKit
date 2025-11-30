import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersPage from '../../src/routes/admin/users/+page.svelte';

// Mock fetch
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

// Mock user data
const mockUser = {
	id: '1',
	login: 'testowner',
	email: 'owner@test.com',
	name: 'Test Owner',
	avatarUrl: 'https://example.com/avatar.jpg',
	isOwner: true,
	isAdmin: true
};

describe('Admin Users Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render the page title', () => {
		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const title = screen.getByText('User Management');
		expect(title).toBeTruthy();
	});

	it('should render an empty state when no users exist', () => {
		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const emptyMessage = screen.getByText(/No users yet/i);
		expect(emptyMessage).toBeTruthy();
	});

	it('should render a list of existing users', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'User One',
				email: 'user1@test.com',
				github_login: 'user1',
				github_avatar_url: 'https://example.com/user1.jpg',
				is_admin: 0,
				created_at: '2024-01-01'
			},
			{
				id: '2',
				name: 'User Two',
				email: 'user2@test.com',
				github_login: 'user2',
				github_avatar_url: 'https://example.com/user2.jpg',
				is_admin: 1,
				created_at: '2024-01-02'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });

		expect(screen.getByText('User One')).toBeTruthy();
		expect(screen.getByText('User Two')).toBeTruthy();
	});

	it('should display user count', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'User One',
				email: 'user1@test.com',
				github_login: 'user1',
				is_admin: 0,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		expect(screen.getByText(/Registered Users \(1\)/i)).toBeTruthy();
	});

	it('should show search input for GitHub users', () => {
		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const searchInput = screen.getByPlaceholderText(/Search GitHub username/i);
		expect(searchInput).toBeTruthy();
	});

	it('should search GitHub users when typing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				users: [
					{
						login: 'octocat',
						id: 1,
						avatar_url: 'https://github.com/octocat.png',
						html_url: 'https://github.com/octocat'
					}
				]
			})
		});

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const searchInput = screen.getByPlaceholderText(/Search GitHub username/i);

		await fireEvent.input(searchInput, { target: { value: 'octocat' } });

		// Wait for debounced search
		await waitFor(
			() => {
				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining('/api/admin/users/search?q=octocat')
				);
			},
			{ timeout: 500 }
		);
	});

	it('should display search results', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				users: [
					{
						login: 'octocat',
						id: 1,
						avatar_url: 'https://github.com/octocat.png',
						html_url: 'https://github.com/octocat'
					}
				]
			})
		});

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const searchInput = screen.getByPlaceholderText(/Search GitHub username/i);

		await fireEvent.input(searchInput, { target: { value: 'octocat' } });

		await waitFor(
			() => {
				expect(screen.getByText('octocat')).toBeTruthy();
			},
			{ timeout: 500 }
		);
	});

	it('should open invite modal when clicking search result', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				users: [
					{
						login: 'octocat',
						id: 1,
						avatar_url: 'https://github.com/octocat.png',
						html_url: 'https://github.com/octocat'
					}
				]
			})
		});

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const searchInput = screen.getByPlaceholderText(/Search GitHub username/i);

		await fireEvent.input(searchInput, { target: { value: 'octocat' } });

		await waitFor(
			() => {
				expect(screen.getByText('octocat')).toBeTruthy();
			},
			{ timeout: 500 }
		);

		const searchResult = screen.getByText('octocat').closest('button');
		if (searchResult) {
			await fireEvent.click(searchResult);
			const modal = screen.getByRole('heading', { name: /Invite GitHub User/i });
			expect(modal).toBeTruthy();
		}
	});

	it('should validate email when inviting user', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				users: [
					{
						login: 'octocat',
						id: 1,
						avatar_url: 'https://github.com/octocat.png',
						html_url: 'https://github.com/octocat'
					}
				]
			})
		});

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const searchInput = screen.getByPlaceholderText(/Search GitHub username/i);

		await fireEvent.input(searchInput, { target: { value: 'octocat' } });

		await waitFor(
			() => {
				expect(screen.getByText('octocat')).toBeTruthy();
			},
			{ timeout: 500 }
		);

		const searchResult = screen.getByText('octocat').closest('button');
		if (searchResult) {
			await fireEvent.click(searchResult);
		}

		const sendInviteButton = screen.getByText('Send Invite');
		await fireEvent.click(sendInviteButton);

		expect(screen.getByText(/Valid email is required/i)).toBeTruthy();
	});

	it('should successfully invite a user', async () => {
		// Mock search
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				users: [
					{
						login: 'octocat',
						id: 1,
						avatar_url: 'https://github.com/octocat.png',
						html_url: 'https://github.com/octocat'
					}
				]
			})
		});

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: [] } } });
		const searchInput = screen.getByPlaceholderText(/Search GitHub username/i);

		await fireEvent.input(searchInput, { target: { value: 'octocat' } });

		await waitFor(
			() => {
				expect(screen.getByText('octocat')).toBeTruthy();
			},
			{ timeout: 500 }
		);

		const searchResult = screen.getByText('octocat').closest('button');
		if (searchResult) {
			await fireEvent.click(searchResult);
		}

		// Mock invite
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true })
		});

		// Mock users reload
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ users: [] })
		});

		const emailInput = screen.getByLabelText(/Email Address/i);
		await fireEvent.input(emailInput, { target: { value: 'octocat@github.com' } });

		const sendInviteButton = screen.getByText('Send Invite');
		await fireEvent.click(sendInviteButton);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/users',
				expect.objectContaining({
					method: 'POST'
				})
			);
		});
	});

	it('should show admin badge for admin users', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'Admin User',
				email: 'admin@test.com',
				github_login: 'adminuser',
				is_admin: 1,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		expect(screen.getByText('Admin')).toBeTruthy();
	});

	it('should show user badge for regular users', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'Regular User',
				email: 'user@test.com',
				github_login: 'regularuser',
				is_admin: 0,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const userBadges = screen.getAllByText('User');
		expect(userBadges.length).toBeGreaterThan(0);
	});

	it('should show GitHub link for users with connected accounts', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'GitHub User',
				email: 'user@test.com',
				github_login: 'githubuser',
				is_admin: 0,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const githubLink = screen.getByText('@githubuser');
		expect(githubLink).toBeTruthy();
		expect(githubLink.closest('a')?.href).toContain('github.com/githubuser');
	});

	it('should have promote button for regular users', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'Regular User',
				email: 'user@test.com',
				github_login: 'regularuser',
				is_admin: 0,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const promoteButton = screen.getByLabelText(/Promote to admin/i);
		expect(promoteButton).toBeTruthy();
	});

	it('should have demote button for admin users', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'Admin User',
				email: 'admin@test.com',
				github_login: 'adminuser',
				is_admin: 1,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const demoteButton = screen.getByLabelText(/Demote from admin/i);
		expect(demoteButton).toBeTruthy();
	});

	it('should have delete button for all users', () => {
		const mockUsers = [
			{
				id: '1',
				name: 'Test User',
				email: 'user@test.com',
				github_login: 'testuser',
				is_admin: 0,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const deleteButton = screen.getByLabelText(/Delete user/i);
		expect(deleteButton).toBeTruthy();
	});

	it('should disable promote/demote button for current user', () => {
		const mockUsers = [
			{
				id: '1', // Same as mockUser.id
				name: 'Test Owner',
				email: 'owner@test.com',
				github_login: 'testowner',
				is_admin: 1,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const promoteButton = screen.getByLabelText(/Demote from admin/i);
		expect(promoteButton).toBeTruthy();
		expect(promoteButton.hasAttribute('disabled')).toBe(true);
		expect(promoteButton.getAttribute('title')).toContain('Cannot modify your own role');
	});

	it('should disable delete button for current user', () => {
		const mockUsers = [
			{
				id: '1', // Same as mockUser.id
				name: 'Test Owner',
				email: 'owner@test.com',
				github_login: 'testowner',
				is_admin: 1,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const deleteButton = screen.getByLabelText(/Delete user/i);
		expect(deleteButton).toBeTruthy();
		expect(deleteButton.hasAttribute('disabled')).toBe(true);
		expect(deleteButton.getAttribute('title')).toContain('Cannot delete your own account');
	});

	it('should enable buttons for other users', () => {
		const mockUsers = [
			{
				id: '2', // Different from mockUser.id
				name: 'Other User',
				email: 'other@test.com',
				github_login: 'otheruser',
				is_admin: 0,
				created_at: '2024-01-01'
			}
		];

		render(UsersPage, { props: { data: { user: mockUser, hasAIProviders: false, users: mockUsers } } });
		const promoteButton = screen.getByLabelText(/Promote to admin/i);
		const deleteButton = screen.getByLabelText(/Delete user/i);

		expect(promoteButton.hasAttribute('disabled')).toBe(false);
		expect(deleteButton.hasAttribute('disabled')).toBe(false);
	});
});

