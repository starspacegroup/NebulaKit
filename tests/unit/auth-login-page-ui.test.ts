import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../../src/routes/auth/login/+page.svelte';

const layoutData = {
	user: null,
	hasAIProviders: false,
	cmsPaletteItems: []
};

describe('Auth Login Page UI', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('shows a three-way pretend role toggle in development simulation mode', () => {
		render(LoginPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: {
						github: false,
						discord: false
					},
					simulatedProviders: {
						github: true,
						discord: true
					},
					devAuthSimulationEnabled: true
				}
			}
		});

		expect(
			screen.getByRole('group', { name: /pretend login role selection/i })
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Superadmin' })).toBeInTheDocument();
	});

	it('passes selected role through simulated provider login', async () => {
		const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

		render(LoginPage, {
			props: {
				data: {
					...layoutData,
					configuredProviders: {
						github: false,
						discord: false
					},
					simulatedProviders: {
						github: true,
						discord: true
					},
					devAuthSimulationEnabled: true
				}
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Superadmin' }));
		await fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));

		expect(assignSpy).toHaveBeenCalledWith('/api/auth/github?role=superadmin');
	});
});
