import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../../src/routes/admin/settings/+page.svelte';

// Mock fetch
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

// The settings page also renders the setup summary; the key tests ignore it.
const setupInfo = {
	hasOAuthConfig: false,
	oauthProvider: null,
	oauthClientId: null,
	adminId: null,
	adminUsername: null,
	resetRouteDisabled: true
};

// Mock user data
const mockUser = {
	id: '1',
	login: 'testowner',
	email: 'owner@test.com',
	name: 'Test Owner',
	avatarUrl: 'https://example.com/avatar.jpg',
	isOwner: true
};

describe('Admin Settings Page — auth keys', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render the page title', () => {
		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const title = screen.getByText('Authentication Keys');
		expect(title).toBeTruthy();
	});

	it('should render an empty state when no keys exist', () => {
		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const emptyMessage = screen.getByText(/No authentication keys configured/i);
		expect(emptyMessage).toBeTruthy();
	});

	it('should render a list of existing keys', () => {
		const mockKeys = [
			{ id: '1', name: 'GitHub OAuth', provider: 'github', type: 'oauth', createdAt: '2024-01-01' },
			{ id: '2', name: 'Google OAuth', provider: 'google', type: 'oauth', createdAt: '2024-01-02' }
		];

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: mockKeys
				}
			}
		});

		expect(screen.getByText('GitHub OAuth')).toBeTruthy();
		expect(screen.getByText('Google OAuth')).toBeTruthy();
	});

	it('should show add key button', () => {
		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const addButton = screen.getByText(/Add Key/i);
		expect(addButton).toBeTruthy();
	});

	it('should open add key form when add button is clicked', async () => {
		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const addButton = screen.getByText(/Add Key/i);

		await fireEvent.click(addButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		expect(nameInput).toBeTruthy();
	});

	it('should validate required fields when adding a key', async () => {
		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const addButton = screen.getByText(/Add Key/i);
		await fireEvent.click(addButton);

		const saveButton = screen.getByText(/Save Key/i);
		await fireEvent.click(saveButton);

		const errorMessages = screen.getAllByText(/required/i);
		expect(errorMessages.length).toBeGreaterThan(0);
	});

	it('should successfully add a new key', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				key: {
					id: '3',
					name: 'GitHub OAuth',
					provider: 'github',
					type: 'oauth',
					createdAt: '2024-01-03'
				}
			})
		});

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const addButton = screen.getByText(/Add Key/i);
		await fireEvent.click(addButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		const clientIdInput = screen.getByLabelText(/Client ID/i);
		const clientSecretInput = screen.getByLabelText(/Client Secret/i);

		await fireEvent.input(nameInput, { target: { value: 'GitHub OAuth' } });
		await fireEvent.input(clientIdInput, { target: { value: 'client_123' } });
		await fireEvent.input(clientSecretInput, { target: { value: 'secret_456' } });

		const saveButton = screen.getByText(/Save Key/i);
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/auth-keys',
				expect.objectContaining({
					method: 'POST'
				})
			);
		});
	});

	it('should show edit form when edit button is clicked', async () => {
		const mockKeys = [
			{ id: '1', name: 'GitHub OAuth', provider: 'github', type: 'oauth', createdAt: '2024-01-01' }
		];

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: mockKeys
				}
			}
		});

		const editButton = screen.getByLabelText(/Edit GitHub OAuth/i);
		await fireEvent.click(editButton);

		const nameInput = screen.getByDisplayValue('GitHub OAuth');
		expect(nameInput).toBeTruthy();
	});

	it('should delete a key when delete button is clicked', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true })
		});

		const mockKeys = [
			{ id: '1', name: 'GitHub OAuth', provider: 'github', type: 'oauth', createdAt: '2024-01-01' }
		];

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: mockKeys
				}
			}
		});

		const deleteButton = screen.getByLabelText(/Delete GitHub OAuth/i);
		await fireEvent.click(deleteButton);

		// Confirm deletion
		const confirmButton = screen.getByRole('button', { name: /Confirm/i });
		await fireEvent.click(confirmButton);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/auth-keys/1',
				expect.objectContaining({
					method: 'DELETE'
				})
			);
		});
	});

	it('should mask sensitive values by default', () => {
		const mockKeys = [
			{
				id: '1',
				name: 'GitHub OAuth',
				provider: 'github',
				type: 'oauth',
				clientId: 'client_123',
				createdAt: '2024-01-01'
			}
		];

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: mockKeys
				}
			}
		});

		const maskedValue = screen.getByText(/••••••/i);
		expect(maskedValue).toBeTruthy();
	});

	it('should toggle visibility of sensitive values', async () => {
		const mockKeys = [
			{
				id: '1',
				name: 'GitHub OAuth',
				provider: 'github',
				type: 'oauth',
				clientId: 'client_123',
				createdAt: '2024-01-01'
			}
		];

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: mockKeys
				}
			}
		});

		const toggleButton = screen.getByLabelText(/Show value/i);
		await fireEvent.click(toggleButton);

		const visibleValue = screen.getByText('client_123');
		expect(visibleValue).toBeTruthy();
	});

	it('should include Discord in provider options', async () => {
		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: []
				}
			}
		});
		const addButton = screen.getByText(/Add Key/i);
		await fireEvent.click(addButton);

		const providerSelect = screen.getByLabelText(/Provider/i);
		expect(providerSelect).toBeTruthy();

		// Check that Discord option exists
		const discordOption = screen.getByRole('option', { name: 'Discord' });
		expect(discordOption).toBeTruthy();
	});

	it('should render Discord OAuth keys in the list', () => {
		const mockKeys = [
			{ id: '1', name: 'GitHub OAuth', provider: 'github', type: 'oauth', createdAt: '2024-01-01' },
			{
				id: '2',
				name: 'Discord OAuth',
				provider: 'discord',
				type: 'oauth',
				createdAt: '2024-01-02'
			}
		];

		render(SettingsPage, {
			props: {
				data: {
					user: mockUser,
					canRevealPii: false,
					canViewStats: false,
					canManageAnalytics: false,
					piiRevealed: false,
					hasAIProviders: false,
					cmsPaletteItems: [],
					gaMeasurementId: null,
					setupInfo,
					keys: mockKeys
				}
			}
		});

		expect(screen.getByText('GitHub OAuth')).toBeTruthy();
		expect(screen.getByText('Discord OAuth')).toBeTruthy();
	});
});
