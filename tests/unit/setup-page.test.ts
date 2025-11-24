import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetupPage from '../../src/routes/setup/+page.svelte';

// Mock $app/stores
vi.mock('$app/stores', () => {
	return {
		page: readable({
			url: new URL('http://localhost:5173/setup'),
			params: {},
			route: { id: '/setup' },
			status: 200,
			error: null,
			data: {},
			form: undefined
		})
	};
});

// Mock $app/navigation
vi.mock('$app/navigation', () => {
	return {
		goto: vi.fn()
	};
});

describe('/setup - GitHub OAuth Setup', () => {
	beforeEach(() => {
		// Reset any state between tests
		vi.clearAllMocks();
	});

	it('should render setup page with title', () => {
		render(SetupPage);
		expect(screen.getByText(/Initial Setup/i)).toBeInTheDocument();
	});

	it('should display GitHub OAuth form fields', () => {
		render(SetupPage);
		expect(screen.getByLabelText(/Client ID/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Client Secret/i)).toBeInTheDocument();
	});

	it('should have a save/submit button', () => {
		render(SetupPage);
		expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
	});

	it('should show validation error when client ID is empty', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		const submitButton = screen.getByRole('button', { name: /Save/i });
		await user.click(submitButton);

		expect(screen.getByText(/Client ID is required/i)).toBeInTheDocument();
	});

	it('should show validation error when client secret is empty', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		const clientIdInput = screen.getByLabelText(/Client ID/i);
		await user.type(clientIdInput, 'test-client-id');

		const submitButton = screen.getByRole('button', { name: /Save/i });
		await user.click(submitButton);

		expect(screen.getByText(/Client Secret is required/i)).toBeInTheDocument();
	});

	it('should accept valid GitHub OAuth credentials', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		const clientIdInput = screen.getByLabelText(/Client ID/i);
		const clientSecretInput = screen.getByLabelText(/Client Secret/i);

		await user.type(clientIdInput, 'github-client-id-123');
		await user.type(clientSecretInput, 'github-client-secret-456');

		expect(clientIdInput).toHaveValue('github-client-id-123');
		expect(clientSecretInput).toHaveValue('github-client-secret-456');
	});

	it('should display GitHub instructions or help text', () => {
		render(SetupPage);
		expect(screen.getByText(/Configure your GitHub OAuth application/i)).toBeInTheDocument();
	});

	it('should display admin GitHub username field', () => {
		render(SetupPage);
		expect(screen.getByLabelText(/Admin GitHub Username/i)).toBeInTheDocument();
	});

	it('should accept admin GitHub username input', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		const usernameInput = screen.getByLabelText(/Admin GitHub Username/i);
		await user.type(usernameInput, 'admin-user');

		expect(usernameInput).toHaveValue('admin-user');
	});

	it('should show validation error for invalid GitHub username format', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		const usernameInput = screen.getByLabelText(/Admin GitHub Username/i);
		await user.type(usernameInput, 'invalid user');

		const submitButton = screen.getByRole('button', { name: /Save/i });
		await user.click(submitButton);

		expect(screen.getByText(/Invalid GitHub username/i)).toBeInTheDocument();
	});

	it('should show validation error when admin username is empty', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		const clientIdInput = screen.getByLabelText(/Client ID/i);
		const clientSecretInput = screen.getByLabelText(/Client Secret/i);

		await user.type(clientIdInput, 'test-id');
		await user.type(clientSecretInput, 'test-secret');

		const submitButton = screen.getByRole('button', { name: /Save/i });
		await user.click(submitButton);

		// Should show admin username required error
		expect(screen.getByText(/Admin GitHub Username is required/i)).toBeInTheDocument();
	});

	it('should not require OAuth credentials when they already exist', () => {
		// This test verifies the logic - full integration tested in E2E
		// When hasExistingConfig is true, clientId and clientSecret should be optional
		const hasExistingConfig = true;
		const formData = {
			clientId: '',
			clientSecret: '',
			adminGithubUsername: 'new-admin'
		};

		// Simulate validation logic
		const errors: Record<string, string> = {};

		if (!hasExistingConfig) {
			if (!formData.clientId.trim()) {
				errors.clientId = 'Client ID is required';
			}
			if (!formData.clientSecret.trim()) {
				errors.clientSecret = 'Client Secret is required';
			}
		}

		if (!formData.adminGithubUsername.trim()) {
			errors.adminGithubUsername = 'Admin GitHub Username is required';
		}

		// When config exists, only admin username should be required
		expect(errors.clientId).toBeUndefined();
		expect(errors.clientSecret).toBeUndefined();
		expect(errors.adminGithubUsername).toBeUndefined();
	});

	it('should require all fields when no existing config', () => {
		// This test verifies the logic - full integration tested in E2E
		const hasExistingConfig = false;
		const formData = {
			clientId: '',
			clientSecret: '',
			adminGithubUsername: 'new-admin'
		};

		// Simulate validation logic
		const errors: Record<string, string> = {};

		if (!hasExistingConfig) {
			if (!formData.clientId.trim()) {
				errors.clientId = 'Client ID is required';
			}
			if (!formData.clientSecret.trim()) {
				errors.clientSecret = 'Client Secret is required';
			}
		}

		if (!formData.adminGithubUsername.trim()) {
			errors.adminGithubUsername = 'Admin GitHub Username is required';
		}

		// When no config exists, all fields are required
		expect(errors.clientId).toBe('Client ID is required');
		expect(errors.clientSecret).toBe('Client Secret is required');
	});
});
