import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthKeysPage from '../../src/routes/admin/auth-keys/+page.svelte';

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
	isOwner: true
};

describe('Admin Auth Keys Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render the page title', () => {
		render(AuthKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const title = screen.getByText('Authentication Keys');
		expect(title).toBeTruthy();
	});

	it('should render an empty state when no keys exist', () => {
		render(AuthKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const emptyMessage = screen.getByText(/No authentication keys configured/i);
		expect(emptyMessage).toBeTruthy();
	});

	it('should render a list of existing keys', () => {
		const mockKeys = [
			{ id: '1', name: 'GitHub OAuth', provider: 'github', type: 'oauth', createdAt: '2024-01-01' },
			{ id: '2', name: 'Google OAuth', provider: 'google', type: 'oauth', createdAt: '2024-01-02' }
		];

		render(AuthKeysPage, {
			props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } }
		});

		expect(screen.getByText('GitHub OAuth')).toBeTruthy();
		expect(screen.getByText('Google OAuth')).toBeTruthy();
	});

	it('should show add key button', () => {
		render(AuthKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add Key/i);
		expect(addButton).toBeTruthy();
	});

	it('should open add key form when add button is clicked', async () => {
		render(AuthKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add Key/i);

		await fireEvent.click(addButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		expect(nameInput).toBeTruthy();
	});

	it('should validate required fields when adding a key', async () => {
		render(AuthKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
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

		render(AuthKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
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

		render(AuthKeysPage, {
			props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } }
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

		render(AuthKeysPage, {
			props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } }
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

		render(AuthKeysPage, {
			props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } }
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

		render(AuthKeysPage, {
			props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } }
		});

		const toggleButton = screen.getByLabelText(/Show value/i);
		await fireEvent.click(toggleButton);

		const visibleValue = screen.getByText('client_123');
		expect(visibleValue).toBeTruthy();
	});
});
