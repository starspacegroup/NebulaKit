import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
	return readFileSync(resolve(relativePath), 'utf-8');
}

describe('admin responsive layout contracts', () => {
	it('keeps the admin shell sticky on desktop and horizontally scrollable on mobile', () => {
		const source = readSource('src/routes/admin/+layout.svelte');

		expect(source).toContain('position: sticky;');
		expect(source).toContain('top: calc(64px + var(--spacing-lg));');
		expect(source).toContain('grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);');
		expect(source).toContain('overflow-x: auto;');
		expect(source).toContain('min-width: 0;');
	});

	it('adds a dedicated mobile layout fallback for the users admin page', () => {
		const source = readSource('src/routes/admin/users/+page.svelte');

		expect(source).toContain('@media (max-width: 768px)');
		expect(source).toContain('flex-direction: column-reverse;');
		expect(source).toContain('width: 100%;');
		expect(source).toContain('align-items: stretch;');
	});

	it('adds a dedicated mobile layout fallback for the auth keys page', () => {
		const source = readSource('src/routes/admin/auth-keys/+page.svelte');

		expect(source).toContain('@media (max-width: 768px)');
		expect(source).toContain('.key-header');
		expect(source).toContain('flex-direction: column;');
		expect(source).toContain('border-radius: var(--radius-lg) var(--radius-lg) 0 0;');
	});

	it('keeps AI keys cards and modal actions usable on narrow screens', () => {
		const source = readSource('src/routes/admin/ai-keys/+page.svelte');

		expect(source).toContain('@media (max-width: 768px)');
		expect(source).toContain('.key-header');
		expect(source).toContain('flex-wrap: wrap;');
		expect(source).toContain('min-width: 0;');
	});
});
