import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { site } from '../../src/lib/site.config';
import { fieldName, fieldPrefix } from '../../src/lib/utils/form-fields';

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
	hasAIProviders: false,
	cmsPaletteItems: [],
	simulatedProviders: { github: false, discord: false },
	devAuthSimulationEnabled: false,
	configuredProviders: { github: false, discord: false }
};

/**
 * Two sites built from this template must not share credential field
 * identifiers, or a password manager that matches on host rather than origin
 * (localhost, or sibling subdomains of one domain) offers the wrong login.
 */
describe('Credential field identifiers are site-unique', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('prefixes field identifiers with the site slug', () => {
		expect(fieldPrefix).toBe(site.slug);
		expect(fieldName('password')).toBe(`${site.slug}-password`);
	});

	it('gives the login form prefixed ids and names, and keeps the autocomplete tokens', async () => {
		const LoginPage = (await import('../../src/routes/auth/login/+page.svelte')).default;
		render(LoginPage, { props: { data: layoutData } });

		const email = screen.getByLabelText(/email/i) as HTMLInputElement;
		const password = screen.getByLabelText(/password/i) as HTMLInputElement;

		expect(email.id).toBe(fieldName('email'));
		expect(email.name).toBe(fieldName('email'));
		expect(email.autocomplete).toBe('email');

		expect(password.id).toBe(fieldName('password'));
		expect(password.name).toBe(fieldName('password'));
		expect(password.autocomplete).toBe('current-password');
	});

	it('gives the signup form prefixed ids and names, and keeps the autocomplete tokens', async () => {
		const SignupPage = (await import('../../src/routes/auth/signup/+page.svelte')).default;
		render(SignupPage, { props: { data: layoutData } });

		const fields: Array<[RegExp, string, string]> = [
			[/^name$/i, 'name', 'name'],
			[/email/i, 'email', 'email'],
			[/^password$/i, 'password', 'new-password'],
			[/confirm password/i, 'confirm-password', 'new-password']
		];

		for (const [label, base, autocomplete] of fields) {
			const input = screen.getByLabelText(label) as HTMLInputElement;
			expect(input.id).toBe(fieldName(base));
			expect(input.name).toBe(fieldName(base));
			expect(input.autocomplete).toBe(autocomplete);
		}
	});

	/**
	 * Every route that collects a credential or a secret. A hardcoded `id`/`name`
	 * here is the regression this suite exists to catch — add the route when you
	 * add a form, and use `fieldName()` rather than a string literal.
	 */
	const CREDENTIAL_ROUTES = [
		'src/routes/auth/login/+page.svelte',
		'src/routes/auth/signup/+page.svelte',
		'src/routes/profile/+page.svelte',
		'src/routes/setup/+page.svelte',
		'src/routes/admin/ai-keys/+page.svelte',
		'src/routes/admin/auth-keys/+page.svelte'
	];

	it.each(CREDENTIAL_ROUTES)('%s hardcodes no field identifier', (route) => {
		const source = readFileSync(resolve(process.cwd(), route), 'utf8');
		const markup = source.slice(source.indexOf('</script>'));
		const hardcoded = markup.match(/\b(?:id|name|for)="[^"]*"/g) ?? [];

		expect(hardcoded).toEqual([]);
	});

	it('never leaves a bare identifier on a credential input', async () => {
		const LoginPage = (await import('../../src/routes/auth/login/+page.svelte')).default;
		const { container } = render(LoginPage, { props: { data: layoutData } });

		for (const input of container.querySelectorAll('input')) {
			expect(input.id.startsWith(`${fieldPrefix}-`)).toBe(true);
			expect(input.name.startsWith(`${fieldPrefix}-`)).toBe(true);
		}
	});
});
