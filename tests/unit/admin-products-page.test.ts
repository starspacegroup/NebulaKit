import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
// happy-dom reports no form method, which SvelteKit's enhance refuses; the action is not under test.
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import Page from '../../src/routes/admin/products/+page.svelte';

const values = {
	name: 'Blue mug',
	slug: 'blue-mug',
	description: 'Holds coffee.',
	price: '12.50',
	currency: 'usd',
	imageUrl: '',
	type: 'physical',
	printfulVariantId: '',
	active: true
};
const product = (over: Record<string, unknown> = {}, v: Record<string, unknown> = {}) => ({
	id: 'p1',
	slug: 'blue-mug',
	active: true,
	price: '$12.50',
	values: { ...values, ...v },
	...over
});

describe('/admin/products page', () => {
	it('invites the first product', () => {
		render(Page, { data: { products: [] } as never, form: null });
		expect(screen.getByRole('heading', { name: 'Products' })).toBeTruthy();
		expect(screen.getByText('No products yet.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Add product' })).toBeTruthy();
	});

	it('lists a live product with Archive, and an archived one with Restore and Delete', () => {
		render(Page, {
			data: {
				products: [
					product(),
					product({ id: 'p2', slug: 'old', active: false }, { name: 'Old tote', slug: 'old' })
				]
			} as never,
			form: null
		});
		const list = screen.getByRole('list', { name: 'Products' });
		expect(within(list).getByRole('button', { name: 'Archive Blue mug' })).toBeTruthy();
		expect(within(list).queryByRole('button', { name: 'Delete Blue mug' })).toBeNull();
		expect(within(list).getByRole('button', { name: 'Restore Old tote' })).toBeTruthy();
		expect(within(list).getByRole('button', { name: 'Delete Old tote' })).toBeTruthy();
		expect(within(list).getByText('Archived')).toBeTruthy();
	});

	it('shows problems and a rejected create as typed', () => {
		render(Page, {
			data: { products: [] } as never,
			form: {
				action: 'create',
				problems: ['Price must be dollars and cents, like 12.50.'],
				values: { ...values, price: 'free' }
			} as never
		});
		expect(screen.getByRole('alert').textContent).toContain('Price must be dollars and cents');
		expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('free');
	});

	it('shows a rejected edit on its own product only', () => {
		render(Page, {
			data: {
				products: [product(), product({ id: 'p2' }, { name: 'Tote', slug: 'tote' })]
			} as never,
			form: {
				action: 'update',
				id: 'p2',
				problems: ['x'],
				values: { ...values, name: 'Tote typed', slug: 'tote' }
			} as never
		});
		const names = screen.getAllByLabelText('Name') as HTMLInputElement[];
		// the create form comes first, then one field per product
		expect(names.map((n) => n.value)).toEqual(['', 'Blue mug', 'Tote typed']);
	});

	it('shows a success message', () => {
		render(Page, {
			data: { products: [] } as never,
			form: { action: 'create', message: 'Added Blue mug.' } as never
		});
		expect(screen.getByText('Added Blue mug.')).toBeTruthy();
	});
});
