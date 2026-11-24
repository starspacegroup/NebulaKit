import { describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	centsToDollars,
	dollarsToCents,
	parseProductValues,
	productToFormValues,
	readProductForm,
	type ProductFormValues
} from '../../src/lib/server/admin-products';
import { actions, load } from '../../src/routes/admin/products/+page.server';
import { createProduct, getProduct, listProducts } from '@nebulakit/commerce';

const good: ProductFormValues = {
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

describe('dollars and cents', () => {
	it('reads what an admin types', () => {
		expect(dollarsToCents('12')).toBe(1200);
		expect(dollarsToCents('12.5')).toBe(1250);
		expect(dollarsToCents('$12.05')).toBe(1205);
		expect(dollarsToCents(' 0.99 ')).toBe(99);
		expect(dollarsToCents('0')).toBe(0);
	});
	it.each(['', 'abc', '-1', '1.234', '1,000', '12.', '.5', '1e3', '99999999'])(
		'refuses %j',
		(input) => {
			expect(dollarsToCents(input)).toBeNull();
		}
	);
	it('round-trips whole cents, including the edges', () => {
		const samples = [0, 1, 9, 10, 99, 100, 101, 999, 1000, 99_999, 999_999_999];
		for (let cents = 0; cents < 5000; cents += 7) samples.push(cents);
		for (const cents of samples) expect(dollarsToCents(centsToDollars(cents))).toBe(cents);
	});
	it('never produces a float', () => {
		for (const dollars of [0, 1, 7, 19, 100, 4999, 99_999]) {
			for (let c = 0; c < 100; c++) {
				const cents = dollarsToCents(`${dollars}.${String(c).padStart(2, '0')}`);
				expect(Number.isSafeInteger(cents)).toBe(true);
				expect(cents).toBe(dollars * 100 + c);
			}
		}
	});
});

describe('parseProductValues', () => {
	it('turns good values into a product input', () => {
		const parsed = parseProductValues({
			...good,
			printfulVariantId: '4242',
			imageUrl: 'https://x.test/a.png'
		});
		expect(parsed).toEqual({
			ok: true,
			value: expect.objectContaining({
				slug: 'blue-mug',
				priceCents: 1250,
				printfulVariantId: 4242,
				imageUrl: 'https://x.test/a.png',
				active: true
			})
		});
	});
	it('says what is wrong, in the admin’s words', () => {
		const parsed = parseProductValues({
			...good,
			name: '',
			slug: 'Bad Slug',
			price: 'free',
			printfulVariantId: 'x1',
			imageUrl: 'javascript:alert(1)'
		});
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.errors).toContain('Price must be dollars and cents, like 12.50.');
		expect(parsed.errors).toContain('Printful variant id must be a whole number.');
		expect(parsed.errors.some((e) => e.startsWith('slug'))).toBe(true);
		expect(parsed.errors.some((e) => e.startsWith('name'))).toBe(true);
		expect(parsed.errors.some((e) => e.startsWith('imageUrl'))).toBe(true);
		expect(parsed.errors.some((e) => e.startsWith('priceCents'))).toBe(false);
	});
	it('refuses a zero or negative variant id', () => {
		expect(parseProductValues({ ...good, printfulVariantId: '0' }).ok).toBe(false);
	});
	it('reads the form with sensible defaults', () => {
		const body = new FormData();
		body.set('name', '  Tote ');
		body.set('slug', 'TOTE');
		body.set('price', '5');
		const values = readProductForm(body);
		expect(values).toMatchObject({
			name: 'Tote',
			slug: 'tote',
			currency: 'usd',
			type: 'physical',
			active: false
		});
		body.set('active', 'on');
		expect(readProductForm(body).active).toBe(true);
	});
});

describe('/admin/products', () => {
	const owner = { isOwner: true } as never;
	const shopAdmin = { isAdmin: true, permissions: ['shop'] } as never;
	const base = (db: unknown, locals: unknown, fields: Record<string, string> = {}) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		return {
			locals,
			platform: db ? { env: { DB: db } } : undefined,
			request: new Request('https://site.test/admin/products', { method: 'POST', body })
		} as never;
	};
	const run = (name: keyof typeof actions) =>
		actions[name] as (e: never) => Promise<Record<string, unknown>>;
	const fields = (v: ProductFormValues) => ({
		name: v.name,
		slug: v.slug,
		description: v.description,
		price: v.price,
		currency: v.currency,
		image_url: v.imageUrl,
		type: v.type,
		printful_variant_id: v.printfulVariantId,
		...(v.active ? { active: 'on' } : {})
	});

	it('needs the shop permission for the load and every action', async () => {
		const db = createSqliteD1();
		await expect(load(base(db, {}))).rejects.toMatchObject({ status: 401 });
		await expect(
			load(base(db, { user: { isAdmin: true, permissions: ['pages'] } }))
		).rejects.toMatchObject({ status: 403 });
		for (const name of ['create', 'update', 'archive', 'restore', 'delete'] as const) {
			await expect(run(name)(base(db, {}))).rejects.toMatchObject({ status: 401 });
		}
	});

	it('reports a missing database', async () => {
		const locals = { user: shopAdmin };
		await expect(load(base(null, locals))).rejects.toMatchObject({ status: 503 });
		for (const name of ['create', 'update', 'archive', 'restore', 'delete'] as const) {
			await expect(run(name)(base(null, locals, { id: 'x' }))).rejects.toMatchObject({
				status: 503
			});
		}
	});

	it('creates, lists with archived products, edits, archives, restores and deletes', async () => {
		const db = createSqliteD1();
		const locals = { user: shopAdmin };

		expect(await run('create')(base(db, locals, fields(good)))).toMatchObject({
			message: 'Added Blue mug.'
		});
		const [mug] = await listProducts(db, { includeInactive: true });
		expect(mug).toMatchObject({ slug: 'blue-mug', priceCents: 1250, active: true });

		// An update changes the price, in cents.
		const edited = { ...good, price: '15', name: 'Blue mug, large' };
		expect(await run('update')(base(db, locals, { id: mug.id, ...fields(edited) }))).toMatchObject({
			message: 'Saved Blue mug, large.'
		});
		expect((await getProduct(db, mug.id))?.priceCents).toBe(1500);

		// Archive hides it from the shop and keeps it in the admin.
		expect(await run('archive')(base(db, locals, { id: mug.id }))).toMatchObject({
			action: 'archive'
		});
		expect(await listProducts(db)).toHaveLength(0);
		const loaded = (await load(base(db, locals))) as {
			products: Array<{ active: boolean; price: string; values: { price: string } }>;
		};
		expect(loaded.products).toHaveLength(1);
		expect(loaded.products[0]).toMatchObject({
			active: false,
			price: '$15.00',
			values: { price: '15.00' }
		});

		expect(await run('restore')(base(db, locals, { id: mug.id }))).toMatchObject({
			action: 'restore'
		});
		expect(await listProducts(db)).toHaveLength(1);

		// A live product cannot be deleted; an archived one can.
		expect(await run('delete')(base(db, locals, { id: mug.id }))).toMatchObject({
			status: 409,
			data: { problems: ['Archive the product before deleting it.'] }
		});
		await run('archive')(base(db, locals, { id: mug.id }));
		expect(await run('delete')(base(db, locals, { id: mug.id }))).toMatchObject({
			action: 'delete'
		});
		expect(await getProduct(db, mug.id)).toBeNull();
	});

	it('shows a rejected form back as typed', async () => {
		const db = createSqliteD1();
		const locals = { user: owner };
		const result = await run('create')(base(db, locals, fields({ ...good, price: 'free' })));
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'create',
				values: { name: 'Blue mug', price: 'free' },
				problems: ['Price must be dollars and cents, like 12.50.']
			}
		});
		expect(await listProducts(db, { includeInactive: true })).toHaveLength(0);
	});

	it('refuses a slug another product already has', async () => {
		const db = createSqliteD1();
		const locals = { user: owner };
		await run('create')(base(db, locals, fields(good)));
		expect(await run('create')(base(db, locals, fields(good)))).toMatchObject({
			status: 409,
			data: { problems: ['That slug is already used by another product.'] }
		});

		const other = await createProduct(db, { slug: 'tote', name: 'Tote', priceCents: 500 });
		expect(await run('update')(base(db, locals, { id: other.id, ...fields(good) }))).toMatchObject({
			status: 409,
			data: { id: other.id, problems: ['That slug is already used by another product.'] }
		});
	});

	it('handles a missing id and a vanished product', async () => {
		const db = createSqliteD1();
		const locals = { user: owner };
		for (const name of ['update', 'archive', 'restore', 'delete'] as const) {
			expect(await run(name)(base(db, locals, fields(good)))).toMatchObject({
				status: 400,
				data: { problems: ['Missing product.'] }
			});
			expect(await run(name)(base(db, locals, { id: 'nope', ...fields(good) }))).toMatchObject({
				status: 404
			});
		}
		expect(
			await run('update')(base(db, locals, { id: 'x', ...fields({ ...good, name: '' }) }))
		).toMatchObject({ status: 400 });
	});

	it('round-trips a product through the form values', async () => {
		const db = createSqliteD1();
		const made = await createProduct(db, {
			slug: 'print',
			name: 'Print',
			priceCents: 2005,
			imageUrl: 'https://x.test/p.png',
			printfulVariantId: 77,
			active: false
		});
		expect(productToFormValues(made)).toMatchObject({
			price: '20.05',
			imageUrl: 'https://x.test/p.png',
			printfulVariantId: '77',
			active: false
		});
	});
});
