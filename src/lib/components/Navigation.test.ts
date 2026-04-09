import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Navigation from './Navigation.svelte';

describe('Navigation', () => {
	const originalMatchMedia = window.matchMedia;
	const adminUser = {
		id: 'user-1',
		login: 'david',
		email: 'david@example.com',
		name: 'David Monaghan',
		avatarUrl: 'https://example.com/avatar.png',
		isOwner: false,
		isAdmin: true
	};

	beforeEach(() => {
		document.body.style.overflow = '';
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => true
			})
		});
	});

	afterEach(() => {
		document.body.style.overflow = '';
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: originalMatchMedia
		});
	});

	it('locks body scroll while the mobile menu is open and restores it when closed', async () => {
		const { container } = render(Navigation, {
			props: {
				user: adminUser
			}
		});

		const menuToggle = screen.getByRole('button', { name: 'Toggle menu' });
		const menu = container.querySelector('.nav-links');
		expect(menu).toBeTruthy();
		expect(document.body.style.overflow).toBe('');

		await fireEvent.click(menuToggle);
		await tick();

		expect(menu?.classList.contains('open')).toBe(true);

		const adminLink = screen.getByRole('link', { name: 'Admin' });
		await fireEvent.click(adminLink);
		await tick();

		expect(menu?.classList.contains('open')).toBe(false);
	});

	it('renders logged-in account controls directly in the mobile nav', async () => {
		render(Navigation, {
			props: {
				user: adminUser
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
		await tick();

		expect(screen.getByText('David Monaghan')).toBeInTheDocument();
		expect(screen.getByText('david@example.com')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Theme selector' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'User menu' })).not.toBeInTheDocument();
	});
});
