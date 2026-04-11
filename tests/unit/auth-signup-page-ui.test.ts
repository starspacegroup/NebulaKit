import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignupPage from '../../src/routes/auth/signup/+page.svelte';

const layoutData = {
	user: null,
	hasAIProviders: false,
	cmsPaletteItems: []
};

describe('Auth Signup Page UI', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('shows only configured OAuth providers', () => {
		render(SignupPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: {
						github: true,
						discord: false
					}
				}
			}
		});

		expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /continue with discord/i })
		).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
	});

	it('shows a fallback message when no OAuth providers are configured', () => {
		render(SignupPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: {
						github: false,
						discord: false
					}
				}
			}
		});

		expect(
			screen.getByText(/no oauth providers configured\. please contact the administrator\./i)
		).toBeInTheDocument();
	});

	it('redirects to the GitHub auth flow when GitHub signup is selected', async () => {
		const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

		render(SignupPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: {
						github: true,
						discord: false
					}
				}
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));

		expect(assignSpy).toHaveBeenCalledWith('/api/auth/github');
	});
});
