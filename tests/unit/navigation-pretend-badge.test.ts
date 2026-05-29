import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Navigation from '../../src/lib/components/Navigation.svelte';

describe('Navigation pretend badge', () => {
	it('shows PRETEND badge for simulated sessions', () => {
		render(Navigation, {
			props: {
				onCommandPaletteClick: () => {},
				user: {
					id: 'dev-user',
					login: 'dev-github-1234',
					email: 'dev@example.dev',
					name: 'Dev User',
					isOwner: false,
					isAdmin: false,
					isPretend: true
				}
			}
		});

		expect(screen.getByLabelText('Pretend login session')).toBeInTheDocument();
		expect(screen.getAllByText('PRETEND').length).toBeGreaterThanOrEqual(1);
	});

	it('does not show PRETEND badge for normal sessions', () => {
		render(Navigation, {
			props: {
				onCommandPaletteClick: () => {},
				user: {
					id: 'real-user',
					login: 'real-user',
					email: 'real@example.com',
					name: 'Real User',
					isOwner: false,
					isAdmin: false
				}
			}
		});

		expect(screen.queryByText('PRETEND')).not.toBeInTheDocument();
	});
});
