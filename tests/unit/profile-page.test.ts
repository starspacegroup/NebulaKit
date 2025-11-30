import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

describe('Profile Page', () => {
	describe('Server Load Function', () => {
		it('should redirect to login if user is not authenticated', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost:5173/profile')
			};

			// Import dynamically to test server load
			const { load } = await import('../../src/routes/profile/+page.server');

			try {
				await load(mockEvent as any);
				expect.fail('Should have thrown redirect error');
			} catch (error: any) {
				expect(error.status).toBe(302);
				expect(error.location).toBe('/auth/login');
			}
		});

		it('should return user data when authenticated', async () => {
			const mockUser = {
				id: 'test-user-id',
				login: 'testuser',
				email: 'test@example.com',
				name: 'Test User',
				avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
				isOwner: false,
				isAdmin: false
			};

			const mockEvent = {
				locals: {
					user: mockUser
				},
				url: new URL('http://localhost:5173/profile')
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = await load(mockEvent as any);

			expect(result).toEqual({
				user: mockUser
			});
		});

		it('should handle user without optional fields', async () => {
			const mockUser = {
				id: 'test-user-id',
				login: 'testuser',
				email: 'test@example.com',
				isOwner: false
			};

			const mockEvent = {
				locals: {
					user: mockUser
				},
				url: new URL('http://localhost:5173/profile')
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result).toBeDefined();
			expect(result.user).toBeDefined();
			expect(result.user.name).toBeUndefined();
			expect(result.user.avatarUrl).toBeUndefined();
		});
	});

	describe('Profile Page UI', () => {
		it('should display user information', async () => {
			const ProfilePage = await import('../../src/routes/profile/+page.svelte');

			const mockData = {
				user: {
					id: 'test-user-id',
					login: 'testuser',
					email: 'test@example.com',
					name: 'Test User',
					avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
					isOwner: false,
					isAdmin: false
				},
				hasAIProviders: false
			};

			const { container, getByText } = render(ProfilePage.default, {
				props: { data: mockData }
			});

			// Check for user information
			expect(getByText('Test User')).toBeTruthy();
			expect(container.textContent).toContain('testuser');
			expect(getByText('test@example.com')).toBeTruthy();

			// Check for avatar image
			const avatar = container.querySelector('img[alt="Test User"]');
			expect(avatar).toBeTruthy();
			expect(avatar?.getAttribute('src')).toBe('https://avatars.githubusercontent.com/u/123456');
		});

		it('should display login name when name is not available', async () => {
			const ProfilePage = await import('../../src/routes/profile/+page.svelte');

			const mockData = {
				user: {
					id: 'test-user-id',
					login: 'testuser',
					email: 'test@example.com',
					isOwner: false
				},
				hasAIProviders: false
			};

			const { container } = render(ProfilePage.default, {
				props: { data: mockData }
			});

			// Check h1 contains the login name
			const heading = container.querySelector('h1');
			expect(heading?.textContent).toBe('testuser');
		});

		it('should display default avatar when avatarUrl is not available', async () => {
			const ProfilePage = await import('../../src/routes/profile/+page.svelte');

			const mockData = {
				user: {
					id: 'test-user-id',
					login: 'testuser',
					email: 'test@example.com',
					name: 'Test User',
					isOwner: false
				},
				hasAIProviders: false
			};

			const { container } = render(ProfilePage.default, {
				props: { data: mockData }
			});

			// Check for avatar placeholder div
			const avatarPlaceholder = container.querySelector('.avatar-placeholder');
			expect(avatarPlaceholder).toBeTruthy();
		});

		it('should display admin badge when user is admin', async () => {
			const ProfilePage = await import('../../src/routes/profile/+page.svelte');

			const mockData = {
				user: {
					id: 'test-user-id',
					login: 'testuser',
					email: 'test@example.com',
					name: 'Test User',
					avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
					isOwner: false,
					isAdmin: true
				},
				hasAIProviders: false
			};

			const { getByText } = render(ProfilePage.default, {
				props: { data: mockData }
			});

			expect(getByText('Admin')).toBeTruthy();
		});

		it('should display owner badge when user is owner', async () => {
			const ProfilePage = await import('../../src/routes/profile/+page.svelte');

			const mockData = {
				user: {
					id: 'test-user-id',
					login: 'testuser',
					email: 'test@example.com',
					name: 'Test User',
					avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
					isOwner: true
				},
				hasAIProviders: false
			};

			const { getByText } = render(ProfilePage.default, {
				props: { data: mockData }
			});

			expect(getByText('Owner')).toBeTruthy();
		});

		it('should display GitHub profile link', async () => {
			const ProfilePage = await import('../../src/routes/profile/+page.svelte');

			const mockData = {
				user: {
					id: 'test-user-id',
					login: 'testuser',
					email: 'test@example.com',
					name: 'Test User',
					isOwner: false
				},
				hasAIProviders: false
			};

			const { container } = render(ProfilePage.default, {
				props: { data: mockData }
			});

			const githubLink = container.querySelector('a[href="https://github.com/testuser"]');
			expect(githubLink).toBeTruthy();
		});
	});
});
