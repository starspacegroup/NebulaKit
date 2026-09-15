import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
});
