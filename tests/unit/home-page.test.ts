import { goto } from '$app/navigation';
import { showCommandPalette } from '$lib/stores/commandPalette';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../src/routes/+page.svelte';

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

describe('Home Page Hero', () => {
	beforeEach(() => {
		// Reset the command palette store before each test
		showCommandPalette.set(false);
	});

	afterEach(() => {
		showCommandPalette.set(false);
	});

	it('should render the main title', () => {
		render(Page);
		const title = screen.getByText('NebulaKit');
		expect(title).toBeTruthy();
	});

	it('should render the subtitle with correct text', () => {
		render(Page);
		const subtitle = screen.getByText(/A full-stack SvelteKit \+ Cloudflare starter/i);
		expect(subtitle).toBeTruthy();
	});

	it('should render the search input with placeholder', () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText('Start typing or ask something...');
		expect(searchInput).toBeTruthy();
	});

	it('should render all command options', () => {
		render(Page);
		expect(screen.getByText('Log in')).toBeTruthy();
		expect(screen.getByText('Sign up')).toBeTruthy();
		expect(screen.getByText('Ask something...')).toBeTruthy();
	});

	it('should navigate to login page when Log in is clicked', async () => {
		render(Page);
		const loginButton = screen.getByText('Log in').closest('button');
		expect(loginButton).toBeTruthy();

		if (loginButton) {
			await fireEvent.click(loginButton);
			expect(goto).toHaveBeenCalledWith('/auth/login');
		}
	});

	it('should navigate to signup page when Sign up is clicked', async () => {
		render(Page);
		const signupButton = screen.getByText('Sign up').closest('button');
		expect(signupButton).toBeTruthy();

		if (signupButton) {
			await fireEvent.click(signupButton);
			expect(goto).toHaveBeenCalledWith('/auth/signup');
		}
	});

	it('should navigate to chat page when Ask something is clicked', async () => {
		render(Page);
		const askButton = screen.getByText('Ask something...').closest('button');
		expect(askButton).toBeTruthy();

		if (askButton) {
			await fireEvent.click(askButton);
			expect(goto).toHaveBeenCalledWith('/chat');
		}
	});

	it('should open command palette when search input is clicked', async () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText(
			'Start typing or ask something...'
		) as HTMLInputElement;

		await fireEvent.click(searchInput);

		// Check if command palette store is set to true
		expect(get(showCommandPalette)).toBe(true);
	});

	it('should open command palette when search input is focused', async () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText('Start typing or ask something...');

		await fireEvent.focus(searchInput);

		// Check if command palette store is set to true
		expect(get(showCommandPalette)).toBe(true);
	});

	it('should open command palette when typing in search input', async () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText('Start typing or ask something...');

		await fireEvent.keyDown(searchInput, { key: 'a' });

		// Check if command palette store is set to true
		expect(get(showCommandPalette)).toBe(true);
	});

	it('should render cosmic background elements', () => {
		const { container } = render(Page);

		// Check for cosmic background
		const cosmicBg = container.querySelector('.cosmic-bg');
		expect(cosmicBg).toBeTruthy();

		// Check for stars
		const stars = container.querySelector('.stars-layer');
		expect(stars).toBeTruthy();

		// Check for planets
		const planets = container.querySelectorAll('.planet');
		expect(planets.length).toBeGreaterThan(0);
	});

	it('should render AI indicator with animation bars', () => {
		const { container } = render(Page);
		const bars = container.querySelectorAll('.bar');
		expect(bars.length).toBe(3);
	});

	it('should have accessible search input', () => {
		render(Page);
		const searchInput = screen.getByLabelText('Search or ask a question');
		expect(searchInput).toBeTruthy();
	});
});
