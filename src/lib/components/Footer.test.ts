import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Footer from './Footer.svelte';
import { site, repoUrl } from '$lib/site.config';

describe('Footer', () => {
	it('should render the footer element', () => {
		render(Footer);
		const footer = document.querySelector('footer');
		expect(footer).toBeInTheDocument();
	});

	it('should display the app brand', () => {
		render(Footer);
		expect(screen.getByText(site.name)).toBeInTheDocument();
	});

	it('should display the tagline', () => {
		render(Footer);
		expect(screen.getByText(site.tagline)).toBeInTheDocument();
	});

	it('should have navigation links section', () => {
		render(Footer);
		expect(screen.getByRole('heading', { name: /navigation/i })).toBeInTheDocument();
	});

	it('should have resources links section', () => {
		render(Footer);
		expect(screen.getByRole('heading', { name: /resources/i })).toBeInTheDocument();
	});

	it('should have legal links section', () => {
		render(Footer);
		expect(screen.getByRole('heading', { name: /legal/i })).toBeInTheDocument();
	});

	it('should contain home link', () => {
		render(Footer);
		const homeLink = screen.getByRole('link', { name: /^home$/i });
		expect(homeLink).toHaveAttribute('href', '/');
	});

	it('should contain chat link', () => {
		render(Footer);
		const chatLink = screen.getByRole('link', { name: /^chat$/i });
		expect(chatLink).toHaveAttribute('href', '/chat');
	});

	it('should contain sign in link', () => {
		render(Footer);
		const loginLink = screen.getByRole('link', { name: /sign in/i });
		expect(loginLink).toHaveAttribute('href', '/auth/login');
	});

	it('should contain sign up link', () => {
		render(Footer);
		const signupLink = screen.getByRole('link', { name: /sign up/i });
		expect(signupLink).toHaveAttribute('href', '/auth/signup');
	});

	it('should contain documentation link pointing to /documentation', () => {
		render(Footer);
		const docsLink = screen.getByRole('link', { name: /documentation/i });
		expect(docsLink).toHaveAttribute('href', '/documentation');
	});

	it('should contain GitHub link in resources', () => {
		render(Footer);
		const githubLinks = screen.getAllByRole('link', { name: /github/i });
		// At least one should be the text link in resources
		const resourcesLink = githubLinks.find((link) =>
			link.textContent?.toLowerCase().includes('github')
		);
		expect(resourcesLink).toHaveAttribute('href', repoUrl);
	});

	it('should contain privacy policy link', () => {
		render(Footer);
		const privacyLink = screen.getByRole('link', { name: /privacy/i });
		expect(privacyLink).toHaveAttribute('href', '/privacy');
	});

	it('should contain terms of service link', () => {
		render(Footer);
		const termsLink = screen.getByRole('link', { name: /terms/i });
		expect(termsLink).toHaveAttribute('href', '/terms');
	});

	it('should display copyright with current year', () => {
		render(Footer);
		const currentYear = new Date().getFullYear();
		expect(screen.getByText(new RegExp(`© ${currentYear}`, 'i'))).toBeInTheDocument();
	});

	it('should display the author attribution link', () => {
		render(Footer);
		const authorLink = screen.getByRole('link', { name: site.author });
		expect(authorLink).toHaveAttribute('href', site.authorUrl);
		expect(authorLink).toHaveAttribute('target', '_blank');
		expect(authorLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('should have proper accessibility structure with navigation landmark', () => {
		render(Footer);
		const nav = document.querySelector('footer nav');
		expect(nav).toBeInTheDocument();
		expect(nav).toHaveAttribute('aria-label', 'Footer navigation');
	});

	it('should have GitHub external link open in new tab', () => {
		render(Footer);
		const githubLinks = screen.getAllByRole('link', { name: /github/i });
		const resourcesLink = githubLinks.find((link) =>
			link.textContent?.toLowerCase().includes('github')
		);
		expect(resourcesLink).toHaveAttribute('target', '_blank');
		expect(resourcesLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('should render Cloudflare badge', () => {
		render(Footer);
		expect(screen.getByText('Powered by Cloudflare')).toBeInTheDocument();
	});
});
