import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/stores', () => ({
	page: writable({
		url: new URL('http://localhost/auth/login'),
		params: {},
		status: 200,
		error: null
	})
}));

const layoutData = {
	user: null,
	hasAIProviders: false
};

describe('Password Auth Pages', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('submits the login form to the password auth endpoint', async () => {
		const LoginPage = (await import('../../src/routes/auth/login/+page.svelte')).default;
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ success: true, redirectTo: '/' }), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);
		const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

		render(LoginPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: { github: false, discord: false }
				}
			}
		});

		await fireEvent.input(screen.getByLabelText(/email/i), {
			target: { value: 'user@example.com' }
		});
		await fireEvent.input(screen.getByLabelText(/password/i), {
			target: { value: 'StrongPass123!' }
		});
		await fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/auth/login',
				expect.objectContaining({ method: 'POST' })
			);
			expect(assignSpy).toHaveBeenCalledWith('/');
		});
	});

	it('submits the signup form to the password auth endpoint', async () => {
		const SignupPage = (await import('../../src/routes/auth/signup/+page.svelte')).default;
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ success: true, redirectTo: '/' }), { status: 201 })
			);
		vi.stubGlobal('fetch', fetchMock);
		const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

		render(SignupPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: { github: false, discord: false }
				}
			}
		});

		await fireEvent.input(screen.getByLabelText(/^name$/i), {
			target: { value: 'New User' }
		});
		await fireEvent.input(screen.getByLabelText(/email/i), {
			target: { value: 'new@example.com' }
		});
		await fireEvent.input(screen.getByLabelText(/^password$/i), {
			target: { value: 'StrongPass123!' }
		});
		await fireEvent.input(screen.getByLabelText(/confirm password/i), {
			target: { value: 'StrongPass123!' }
		});
		await fireEvent.submit(screen.getByRole('button', { name: /sign up/i }).closest('form')!);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/auth/signup',
				expect.objectContaining({ method: 'POST' })
			);
			expect(assignSpy).toHaveBeenCalledWith('/');
		});
	});
});
