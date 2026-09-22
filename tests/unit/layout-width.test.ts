import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import aiKeysPage from '../../src/routes/admin/ai-keys/+page.svelte?raw';
import authKeysPage from '../../src/routes/admin/auth-keys/+page.svelte?raw';
import cmsDashboard from '../../src/routes/admin/cms/+page.svelte?raw';
import cmsManage from '../../src/routes/admin/cms/[type]/+page.svelte?raw';
import usersPage from '../../src/routes/admin/users/+page.svelte?raw';
import cmsItemPage from '../../src/routes/[contentType]/[slug]/+page.svelte?raw';
import cmsListPage from '../../src/routes/[contentType]/+page.svelte?raw';
import docsPage from '../../src/routes/documentation/+page.svelte?raw';
import privacyPage from '../../src/routes/privacy/+page.svelte?raw';
import termsPage from '../../src/routes/terms/+page.svelte?raw';

// app.css is read from disk: Vitest resolves `?raw` on a stylesheet to an empty
// string, so importing it the way the .svelte sources are imported asserts nothing.
const appCss = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');

function block(source: string, selector: string) {
	const match = source.match(
		new RegExp(`\\n\\t${selector.replace('.', '\\.')} \\{[\\s\\S]*?\\n\\t\\}`)
	);
	return match?.[0] ?? '';
}

/**
 * The page shell fills the viewport up to a 2K screen. These assertions exist so
 * a new page cannot quietly reintroduce a narrow hardcoded cap and leave a wide
 * monitor half empty, which is what `--layout-page-max-width` replaced.
 */
describe('layout widths', () => {
	it('defines the page and prose width tokens', () => {
		expect(appCss).toMatch(/--layout-page-max-width:\s*2560px;/);
		expect(appCss).toMatch(/--layout-prose-max-width:\s*\d+px;/);
	});

	it('points the shared container and chrome at the page width', () => {
		expect(appCss).toMatch(/\.container\s*\{[\s\S]*?max-width:\s*var\(--layout-page-max-width\);/);
		expect(appCss).toMatch(/--layout-chrome-max-width:\s*var\(--layout-page-max-width\);/);
		expect(appCss).toMatch(/--layout-feature-grid-max-width:\s*var\(--layout-page-max-width\);/);
	});

	it('grows the container gutter past the old 1280px cap', () => {
		expect(appCss).toMatch(
			/@media \(min-width:\s*1440px\)\s*\{[\s\S]*?\.container\s*\{[\s\S]*?padding:\s*0 clamp\(/
		);
	});

	it.each([
		['cms list', cmsListPage, '.cms-list-page'],
		['admin users', usersPage, '.users-page'],
		['cms dashboard', cmsDashboard, '.cms-dashboard'],
		['cms manage', cmsManage, '.cms-manage'],
		['ai keys', aiKeysPage, '.ai-keys-page'],
		['auth keys', authKeysPage, '.auth-keys-page']
	])('the %s shell fills the page width', (_name, source, selector) => {
		const declarations = block(source, selector);
		expect(declarations, `${selector} block not found`).not.toBe('');
		expect(declarations).toContain('max-width: var(--layout-page-max-width)');
	});

	it('the documentation page fills the shell but caps its own body text', () => {
		expect(block(docsPage, '.docs-container')).toContain('max-width: var(--layout-page-max-width)');
		// Child combinators, so text inside a callout card still fills its track.
		expect(docsPage).toMatch(
			/\.docs-section > p,\n\t\.docs-section > ul,\n\t\.docs-section > ol,\n\t\.docs-section > pre \{\n\t\tmax-width: var\(--layout-prose-max-width\);/
		);
	});

	it.each([
		['terms', termsPage, '.legal-container'],
		['privacy', privacyPage, '.legal-container'],
		['cms item', cmsItemPage, '.cms-item-page']
	])('the %s page keeps a reading measure', (_name, source, selector) => {
		const declarations = block(source, selector);
		expect(declarations, `${selector} block not found`).not.toBe('');
		expect(declarations).toContain('max-width: var(--layout-prose-max-width)');
	});

	/**
	 * Filling the page is the DEFAULT, and this is what keeps it that way.
	 *
	 * A shell with no max-width fills, so a new page is wide unless someone
	 * writes a cap. Writing one is allowed — a sign-in card and a column of
	 * hero copy both want a measure — but it has to be a decision somebody
	 * made on purpose, with the reason here, rather than a number that
	 * arrived with a snippet and quietly left a 2K monitor half empty.
	 *
	 * This matters more in the template than anywhere: every app generated
	 * from it inherits whatever these pages do.
	 *
	 * Add a page with a hardcoded shell cap and this fails until it is listed.
	 */
	const NARROW_ON_PURPOSE: Record<string, string> = {
		'+page.svelte': 'Centred hero copy. Full-width headline and subtitle would be unreadable.',
		'auth/login/+page.svelte': 'A single sign-in card; a 2K-wide login form is not a login form.',
		'auth/signup/+page.svelte': 'Same card as the sign-in page.',
		'documentation/+page.svelte': 'The quickstart card alone; .docs-container fills the shell.',
		'profile/+page.svelte': 'One settings card. Stretching it to 2K would strand every label.'
	};

	/** A class named like a page shell rather than a card or a control. */
	const SHELLISH = /^\.[a-zA-Z0-9_-]*(container|shell|wrap|layout|grid|page)[a-zA-Z0-9_-]*$/;

	function pageFiles(dir: string, root: string, out: string[] = []): string[] {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) pageFiles(full, root, out);
			else if (entry.name === '+page.svelte') out.push(relative(root, full));
		}
		return out;
	}

	function hardcodedShellCaps(source: string): string[] {
		const found: string[] = [];
		for (const rule of source.matchAll(/\n\t(\.[a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\n\t\}/g)) {
			const [, selector, body] = rule;
			if (!SHELLISH.test(selector)) continue;
			const width = body.match(/max-width:\s*([^;]+);/);
			if (width && !width[1].includes('var(--layout-'))
				found.push(`${selector} = ${width[1].trim()}`);
		}
		return found;
	}

	it('caps a page shell only where someone wrote down why', () => {
		const root = resolve(process.cwd(), 'src/routes');
		const offenders: string[] = [];

		for (const file of pageFiles(root, root)) {
			const caps = hardcodedShellCaps(readFileSync(join(root, file), 'utf-8'));
			if (caps.length && !NARROW_ON_PURPOSE[file]) offenders.push(`${file} — ${caps.join('; ')}`);
		}

		expect(offenders, 'hardcoded shell width with no reason in NARROW_ON_PURPOSE').toEqual([]);
	});

	it('keeps the narrow list honest about what is still narrow', () => {
		// The other direction: a page that has since been widened should drop off
		// the list rather than sit there implying a cap that is no longer in it.
		const root = resolve(process.cwd(), 'src/routes');
		for (const [file, reason] of Object.entries(NARROW_ON_PURPOSE)) {
			expect(reason.length, `${file} needs a real reason`).toBeGreaterThan(20);
			const caps = hardcodedShellCaps(readFileSync(join(root, file), 'utf-8'));
			expect(caps, `${file} is listed as narrow but caps nothing`).not.toEqual([]);
		}
	});
});
