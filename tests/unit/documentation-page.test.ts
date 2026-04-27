import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/documentation/+page.svelte';

describe('Documentation Page', () => {
	it('renders the primary documentation heading and intro', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /NebulaKit documentation/i })).toBeInTheDocument();
		expect(
			screen.getByText(/single source of truth for setup, development, and deployment/i)
		).toBeInTheDocument();
	});

	it('includes beginner-friendly start sections', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /Start Here/i })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /Quick Start/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /Deployment to Cloudflare Pages/i })
		).toBeInTheDocument();
	});

	it('documents migration workflow with immutable migration guidance', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /Database Migrations/i })).toBeInTheDocument();
		expect(screen.getByText(/never edit or delete existing migration files/i)).toBeInTheDocument();
		expect(screen.getAllByText(/npm run db:migrate:local/i).length).toBeGreaterThan(0);
	});

	it('contains links to key project docs and repository', () => {
		render(Page);

		expect(screen.getByRole('link', { name: /README/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/NebulaKit/blob/main/README.md'
		);
		expect(screen.getByRole('link', { name: /Contributing Guide/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/NebulaKit/blob/main/CONTRIBUTING.md'
		);
		expect(screen.getByRole('link', { name: /GitHub repository/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/NebulaKit'
		);
	});

	it('renders a main landmark and section navigation', () => {
		render(Page);
		expect(document.querySelector('main')).toBeInTheDocument();
		expect(
			screen.getByRole('navigation', { name: /documentation navigation/i })
		).toBeInTheDocument();
	});
});
