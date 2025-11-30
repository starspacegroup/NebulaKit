import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIKeysPage from '../../src/routes/admin/ai-keys/+page.svelte';

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

describe('Admin AI Keys Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render the page title', () => {
		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const title = screen.getByText('AI Provider Keys');
		expect(title).toBeTruthy();
	});

	it('should render an empty state when no keys exist', () => {
		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const emptyMessage = screen.getByText(/No AI provider keys configured/i);
		expect(emptyMessage).toBeTruthy();
	});

	it('should render a list of existing AI keys', () => {
		const mockKeys = [
			{ id: '1', name: 'OpenAI', provider: 'openai', createdAt: '2024-01-01' },
			{ id: '2', name: 'Anthropic', provider: 'anthropic', createdAt: '2024-01-02' }
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		expect(screen.getByText('OpenAI')).toBeTruthy();
		expect(screen.getByText('Anthropic')).toBeTruthy();
	});

	it('should show add key button', () => {
		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add AI Key/i);
		expect(addButton).toBeTruthy();
	});

	it('should open add key form when add button is clicked', async () => {
		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add AI Key/i);

		await fireEvent.click(addButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		expect(nameInput).toBeTruthy();
	});

	it('should validate required fields when adding a key', async () => {
		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add AI Key/i);
		await fireEvent.click(addButton);

		const saveButton = screen.getByText(/Save Key/i);
		await fireEvent.click(saveButton);

		const errorMessages = screen.getAllByText(/required/i);
		expect(errorMessages.length).toBeGreaterThan(0);
	});

	it('should successfully add a new AI key', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true, key: { id: '3', name: 'Test AI', provider: 'openai' } })
		});

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add AI Key/i);
		await fireEvent.click(addButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		const apiKeyInput = screen.getByLabelText(/API Key/i);

		await fireEvent.input(nameInput, { target: { value: 'OpenAI Production' } });
		await fireEvent.input(apiKeyInput, { target: { value: 'sk-test123' } });

		const saveButton = screen.getByText(/Save Key/i);
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/ai-keys',
				expect.objectContaining({
					method: 'POST'
				})
			);
		});
	});

	it('should show edit form when edit button is clicked', async () => {
		const mockKeys = [{ id: '1', name: 'OpenAI', provider: 'openai', createdAt: '2024-01-01' }];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const editButton = screen.getByLabelText(/Edit OpenAI/i);
		await fireEvent.click(editButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		expect(nameInput).toHaveValue('OpenAI');
	});

	it('should delete a key when delete button is clicked', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true })
		});

		const mockKeys = [{ id: '1', name: 'OpenAI', provider: 'openai', createdAt: '2024-01-01' }];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const deleteButton = screen.getByLabelText(/Delete OpenAI/i);
		await fireEvent.click(deleteButton);

		const confirmButton = screen.getByRole('button', { name: /Confirm/i });
		await fireEvent.click(confirmButton);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/ai-keys/1',
				expect.objectContaining({
					method: 'DELETE'
				})
			);
		});
	});

	it('should mask API keys by default', () => {
		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test123',
				createdAt: '2024-01-01'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const maskedValue = screen.getByText(/••••••/i);
		expect(maskedValue).toBeTruthy();
	});

	it('should toggle visibility of API keys', async () => {
		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test123',
				createdAt: '2024-01-01'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const toggleButton = screen.getByLabelText(/Show value/i);
		await fireEvent.click(toggleButton);

		const visibleValue = screen.getByText('sk-test123');
		expect(visibleValue).toBeTruthy();
	});

	it('should display available AI providers', async () => {
		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add AI Key/i);
		await fireEvent.click(addButton);

		const providerSelect = screen.getByLabelText(/Provider/i);
		expect(providerSelect).toBeTruthy();

		// Check if common providers are available
		const options = providerSelect.querySelectorAll('option');
		const providerValues = Array.from(options).map((opt) => (opt as HTMLOptionElement).value);

		expect(providerValues).toContain('openai');
		expect(providerValues).toContain('anthropic');
	});

	it('should display toggle switch for each AI key', () => {
		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI',
				provider: 'openai',
				enabled: true,
				createdAt: '2024-01-01'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const toggleSwitch = screen.getByLabelText(/Toggle OpenAI/i);
		expect(toggleSwitch).toBeTruthy();
	});

	it('should show enabled state correctly on toggle switch', () => {
		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI Enabled',
				provider: 'openai',
				enabled: true,
				createdAt: '2024-01-01'
			},
			{
				id: '2',
				name: 'Anthropic Disabled',
				provider: 'anthropic',
				enabled: false,
				createdAt: '2024-01-02'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const enabledToggle = screen.getByLabelText(/Toggle OpenAI Enabled/i);
		const disabledToggle = screen.getByLabelText(/Toggle Anthropic Disabled/i);

		expect(enabledToggle).toBeChecked();
		expect(disabledToggle).not.toBeChecked();
	});

	it('should call API to disable key when toggle is clicked', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true })
		});

		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI',
				provider: 'openai',
				enabled: true,
				createdAt: '2024-01-01'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const toggleSwitch = screen.getByLabelText(/Toggle OpenAI/i);
		await fireEvent.click(toggleSwitch);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/ai-keys/1/toggle',
				expect.objectContaining({
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ enabled: false })
				})
			);
		});
	});

	it('should call API to enable key when toggle is clicked on disabled key', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true })
		});

		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI',
				provider: 'openai',
				enabled: false,
				createdAt: '2024-01-01'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const toggleSwitch = screen.getByLabelText(/Toggle OpenAI/i);
		await fireEvent.click(toggleSwitch);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/ai-keys/1/toggle',
				expect.objectContaining({
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ enabled: true })
				})
			);
		});
	});

	it('should update UI optimistically when toggle is clicked', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true })
		});

		const mockKeys = [
			{
				id: '1',
				name: 'OpenAI',
				provider: 'openai',
				enabled: true,
				createdAt: '2024-01-01'
			}
		];

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: mockKeys } } });

		const toggleSwitch = screen.getByLabelText(/Toggle OpenAI/i);
		expect(toggleSwitch).toBeChecked();

		await fireEvent.click(toggleSwitch);

		// UI should update optimistically
		expect(toggleSwitch).not.toBeChecked();
	});

	it('should set enabled to true by default when creating new key', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				key: { id: '3', name: 'Test AI', provider: 'openai', enabled: true }
			})
		});

		render(AIKeysPage, { props: { data: { user: mockUser, hasAIProviders: false, keys: [] } } });
		const addButton = screen.getByText(/Add AI Key/i);
		await fireEvent.click(addButton);

		const nameInput = screen.getByLabelText(/Key Name/i);
		const apiKeyInput = screen.getByLabelText(/API Key/i);

		await fireEvent.input(nameInput, { target: { value: 'OpenAI Production' } });
		await fireEvent.input(apiKeyInput, { target: { value: 'sk-test123' } });

		const saveButton = screen.getByText(/Save Key/i);
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/ai-keys',
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('"enabled":true')
				})
			);
		});
	});
});

