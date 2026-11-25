import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
// happy-dom reports no form method, which SvelteKit's enhance refuses; the action is not under test.
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import {
	createProduct,
	getFeedFetch,
	getGoogleListingSettings,
	getProduct,
	recordFeedFetch
} from '@nebulakit/commerce';
import {
	BLANK_GOOGLE_VALUES,
	cmToMm,
	googleToFormValues,
	isoToUtcInput,
	mmToCm,
	parseGoogleValues,
	readGoogleForm,
	utcInputToIso
} from '../../src/lib/shop/google-form';
import {
	parseProductValues,
	readProductForm,
	productToFormValues
} from '../../src/lib/server/admin-products';
import { actions as productActions } from '../../src/routes/admin/products/+page.server';
import { actions, load } from '../../src/routes/admin/products/google/+page.server';
import { getMerchantSettings, SERVICE_ACCOUNT_KV_KEY } from '../../src/lib/server/google-merchant';
import GoogleListingFields from '../../src/lib/components/GoogleListingFields.svelte';
import GooglePage from '../../src/routes/admin/products/google/+page.svelte';
import { createFakeKV, TEST_ENCRYPTION_KEY } from '../helpers/fake-kv';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { generateKeyPairSync } from 'node:crypto';

const MIGRATIONS = [
	'0016_commerce.sql',
	'0022_commerce_settings.sql',
	'0026_commerce_auctions.sql',
	'0027_commerce_auction_deadlines.sql',
	'0037_google_listings.sql'
];

describe('the Google fields of the product form', () => {
	it('round-trips every field through the form and back', () => {
		const typed = {
			...BLANK_GOOGLE_VALUES,
			brand: 'Acme',
			gtin: '036000291452',
			mpn: 'AC-1',
			condition: 'used',
			googleProductCategory: '1604',
			productType: 'Home > Mugs',
			availability: 'preorder',
			availabilityDate: '2026-12-20',
			salePrice: '9.99',
			saleStartsAt: '2026-12-01T00:00',
			saleEndsAt: '2026-12-31T23:59',
			additionalImages: 'https://a.example/1.jpg\nhttps://a.example/2.jpg',
			color: 'Blue',
			size: 'M',
			material: 'Ceramic',
			gender: 'female',
			ageGroup: 'adult',
			itemGroupId: 'g1',
			identifierExists: 'no',
			weightGrams: '350',
			lengthCm: '12.5',
			widthCm: '8',
			heightCm: '9.5',
			adult: true,
			excluded: true,
			customLabel0: 'a',
			customLabel4: 'e'
		};
		const parsed = parseGoogleValues(typed);
		expect(parsed.ok).toBe(true);
		const g = (parsed as { value: Record<string, unknown> }).value;
		expect(g).toMatchObject({
			salePriceCents: 999,
			saleStartsAt: '2026-12-01T00:00:00Z',
			saleEndsAt: '2026-12-31T23:59:00Z',
			lengthMm: 125,
			widthMm: 80,
			heightMm: 95,
			weightGrams: 350,
			identifierExists: false,
			adult: true,
			excluded: true,
			additionalImages: ['https://a.example/1.jpg', 'https://a.example/2.jpg']
		});
		const again = googleToFormValues({ ...(g as never) });
		expect(again).toEqual(typed);
	});

	it('clears a column when its field is emptied', () => {
		const parsed = parseGoogleValues(BLANK_GOOGLE_VALUES) as {
			ok: true;
			value: Record<string, unknown>;
		};
		expect(parsed.ok).toBe(true);
		expect(parsed.value.brand).toBeNull();
		expect(parsed.value.salePriceCents).toBeNull();
		expect(parsed.value.additionalImages).toEqual([]);
	});

	it.each([
		[{ salePrice: 'cheap' }, /Sale price/],
		[{ weightGrams: '1.5kg' }, /Weight/],
		[{ lengthCm: '12.55' }, /Length/],
		[{ widthCm: 'wide' }, /Width/],
		[{ heightCm: '-1' }, /Height/],
		[{ gtin: '123' }, /gtin/],
		[{ saleStartsAt: '2026-12-01T00:00' }, /both/],
		[{ additionalImages: 'http://a.example/x.jpg' }, /additionalImages/]
	])('says what is wrong with %j', (patch, message) => {
		const parsed = parseGoogleValues({ ...BLANK_GOOGLE_VALUES, ...patch });
		expect(parsed.ok).toBe(false);
		expect((parsed as { errors: string[] }).errors.join()).toMatch(message);
	});

	it('converts units without floats', () => {
		expect(cmToMm('12.5')).toBe(125);
		expect(cmToMm('3')).toBe(30);
		expect(cmToMm('0.5')).toBe(5);
		expect(cmToMm('12.55')).toBeNull();
		expect(mmToCm(125)).toBe('12.5');
		expect(mmToCm(120)).toBe('12');
		expect(mmToCm(null)).toBe('');
		expect(utcInputToIso('2026-12-01T10:30')).toBe('2026-12-01T10:30:00Z');
		expect(utcInputToIso('2026-12-01')).toBe('2026-12-01');
		expect(utcInputToIso('')).toBeNull();
		expect(isoToUtcInput('2026-12-01T10:30:00Z')).toBe('2026-12-01T10:30');
		expect(isoToUtcInput(null)).toBe('');
	});

	it('reads the g_ fields from a posted form', () => {
		const f = new FormData();
		f.set('g_brand', ' Acme ');
		f.set('g_adult', 'on');
		f.set('g_additionalImages', ' https://a.example/1.jpg ');
		const v = readGoogleForm(f);
		expect(v).toMatchObject({ brand: 'Acme', adult: true, excluded: false });
		expect(v.additionalImages).toBe('https://a.example/1.jpg');
	});

	it('a product form with bad Google fields is refused as a whole', () => {
		const form = new FormData();
		for (const [k, v] of Object.entries({ name: 'M', slug: 'm', price: '5', g_gtin: '12' }))
			form.set(k, v);
		const parsed = parseProductValues(readProductForm(form));
		expect(parsed.ok).toBe(false);
	});
});

describe('admin products saves the Google fields', () => {
	const owner = { user: { isOwner: true } } as never;
	const post = (db: unknown, fields: Record<string, string>) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		return {
			locals: owner,
			platform: { env: { DB: db } },
			request: new Request('https://site.test/admin/products', { method: 'POST', body })
		} as never;
	};

	it('creates and updates a product with its Google attributes', async () => {
		const db = createSqliteD1(MIGRATIONS);
		await (productActions.create as (e: never) => Promise<unknown>)(
			post(db, {
				name: 'Mug',
				slug: 'mug',
				price: '12.50',
				description: 'd',
				image_url: 'https://cdn.example.com/a.jpg',
				active: 'on',
				g_brand: 'Acme',
				g_gtin: '036000291452',
				g_salePrice: '9.00',
				g_saleStartsAt: '2026-12-01T00:00',
				g_saleEndsAt: '2026-12-31T00:00',
				g_lengthCm: '12.5',
				g_adult: 'on'
			})
		);
		const mug = (await getProduct(db, 'mug'))!;
		expect(mug.google).toMatchObject({
			brand: 'Acme',
			gtin: '036000291452',
			salePriceCents: 900,
			saleStartsAt: '2026-12-01T00:00:00Z',
			lengthMm: 125,
			adult: true
		});
		expect(productToFormValues(mug).google.salePrice).toBe('9.00');

		// saving the form again with the fields blanked clears them
		await (productActions.update as (e: never) => Promise<unknown>)(
			post(db, { id: mug.id, name: 'Mug', slug: 'mug', price: '12.50', active: 'on' })
		);
		expect((await getProduct(db, 'mug'))!.google).toMatchObject({
			brand: null,
			gtin: null,
			salePriceCents: null,
			lengthMm: null,
			adult: false
		});
	});

	it('shows a rejected Google field back to the admin without saving', async () => {
		const db = createSqliteD1(MIGRATIONS);
		const result = (await (
			productActions.create as (e: never) => Promise<{ data: { problems: string[] } }>
		)(post(db, { name: 'Mug', slug: 'mug', price: '12.50', g_gtin: '123' }))) as {
			status: number;
			data: { problems: string[]; values: { google: { gtin: string } } };
		};
		expect(result.status).toBe(400);
		expect(result.data.values.google.gtin).toBe('123');
		expect(await getProduct(db, 'mug')).toBeNull();
	});
});

describe('GoogleListingFields', () => {
	it('renders the grouped section with every field and the values given', () => {
		render(GoogleListingFields, {
			values: { ...BLANK_GOOGLE_VALUES, brand: 'Acme', gtin: '1' },
			open: true
		});
		expect(screen.getByText('Google listing')).toBeTruthy();
		for (const name of [
			'g_brand',
			'g_gtin',
			'g_mpn',
			'g_salePrice',
			'g_saleStartsAt',
			'g_additionalImages',
			'g_customLabel4',
			'g_weightGrams',
			'g_adult',
			'g_excluded'
		]) {
			expect(document.querySelector(`[name="${name}"]`), name).toBeTruthy();
		}
		expect((document.querySelector('[name="g_brand"]') as HTMLInputElement).value).toBe('Acme');
		expect(screen.getByText(/Dates and times are UTC/)).toBeTruthy();
	});

	it('copes with no values at all', () => {
		render(GoogleListingFields, {});
		expect((document.querySelector('[name="g_brand"]') as HTMLInputElement).value).toBe('');
	});
});

describe('/admin/products/google', () => {
	const owner = { user: { isOwner: true } } as never;
	const shopAdmin = { user: { isAdmin: true, permissions: ['shop'] } } as never;
	const post = (
		locals: unknown,
		db: unknown,
		fields: Record<string, string | string[]>,
		kv?: unknown
	) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, x);
		return {
			locals,
			platform: { env: { DB: db, KV: kv, ENCRYPTION_KEY: TEST_ENCRYPTION_KEY } },
			request: new Request('https://site.test/admin/products/google', { method: 'POST', body })
		} as never;
	};
	const act = (name: keyof typeof actions) =>
		actions[name] as (e: never) => Promise<Record<string, any>>;

	it('needs the shop permission to look, and the owner to touch credentials', async () => {
		const db = createSqliteD1(MIGRATIONS);
		await expect(load(post({}, db, {}))).rejects.toMatchObject({ status: 401 });
		await expect(
			load(post({ user: { isAdmin: true, permissions: ['pages'] } }, db, {}))
		).rejects.toMatchObject({ status: 403 });
		await expect(
			act('settings')(post({ user: { isAdmin: true, permissions: ['pages'] } }, db, {}))
		).rejects.toMatchObject({ status: 403 });
		for (const name of ['sync', 'key', 'clearKey'] as const) {
			await expect(act(name)(post(shopAdmin, db, {}))).rejects.toMatchObject({ status: 403 });
		}
		await expect(load(post(owner, null, {}))).rejects.toMatchObject({ status: 503 });
		await expect(act('settings')(post(owner, null, {}))).rejects.toMatchObject({ status: 503 });
	});

	it('shows counts, the first problems with links to fix them, and the feed address', async () => {
		const db = createSqliteD1(MIGRATIONS);
		const ok = await createProduct(db, {
			slug: 'ok',
			name: 'Ok',
			description: 'd',
			priceCents: 100,
			imageUrl: 'https://cdn.example.com/a.jpg',
			google: { brand: 'B', gtin: '036000291452' }
		});
		const bad = await createProduct(db, {
			slug: 'bad',
			name: 'Bad',
			description: 'd',
			priceCents: 100
		});
		await recordFeedFetch(db, 'Googlebot', '2026-11-25T12:00:00.000Z');
		const data = (await load(post(shopAdmin, db, {}))) as Record<string, any>;
		expect(data.audit).toMatchObject({ checked: 2, valid: 1, invalid: 1 });
		expect(data.audit.problems[0]).toMatchObject({ productId: bad.id, severity: 'error' });
		expect(data.feedUrls.rss).toMatch(/\/feeds\/google-products\.xml$/);
		expect(data.lastFetched).toEqual({ at: '2026-11-25T12:00:00.000Z', by: 'Googlebot' });
		expect(data.isOwner).toBe(false);
		expect(ok.id).toBeTruthy();
	});

	it('saves shipping, return policy and default brand, or says why not', async () => {
		const db = createSqliteD1(MIGRATIONS);
		const saved = await act('settings')(
			post(shopAdmin, db, {
				defaultBrand: 'House',
				contentLanguage: 'EN',
				shipCountries: 'us, ca',
				handlingDaysMin: '0',
				handlingDaysMax: '1',
				transitDaysMin: '2',
				transitDaysMax: '5',
				returnCategory: 'finite',
				returnDays: '30',
				returnFees: 'shipping_fee',
				returnFeeAmount: '5.00',
				returnMethods: ['mail', 'store'],
				returnCountries: ''
			})
		);
		expect(saved.message).toMatch(/saved/);
		expect(await getGoogleListingSettings(db)).toMatchObject({
			defaultBrand: 'House',
			shipCountries: ['US', 'CA'],
			transitDaysMax: 5,
			returns: {
				category: 'finite',
				days: 30,
				fees: 'shipping_fee',
				shippingFeeCents: 500,
				methods: ['mail', 'store']
			}
		});
		const form = ((await load(post(shopAdmin, db, {}))) as Record<string, any>).settings;
		expect(form).toMatchObject({
			shipCountries: 'US, CA',
			returnFeeAmount: '5.00',
			returnCategory: 'finite'
		});

		for (const bad of [
			{ shipCountries: 'USA' },
			{ handlingDaysMin: 'x' },
			{ returnCategory: 'finite' },
			{ returnFeeAmount: 'free', returnCategory: 'finite', returnDays: '3' }
		]) {
			const r = await act('settings')(post(shopAdmin, db, bad));
			expect(r.status).toBe(400);
		}
		const cleared = await act('settings')(post(shopAdmin, db, { returnCategory: '' }));
		expect(cleared.message).toBeTruthy();
		expect((await getGoogleListingSettings(db)).returns).toBeNull();
	});

	describe('the sync (owner only)', () => {
		const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
		const keyFile = JSON.stringify({
			client_email: 'sync@p.iam.gserviceaccount.com',
			private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
		});

		it('will not switch on without a key, then stores one sealed and switches on', async () => {
			const db = createSqliteD1(MIGRATIONS);
			const kv = createFakeKV();
			const ids = { accountId: '1', dataSourceId: '2', feedLabel: 'us', enabled: 'on' };
			expect((await act('sync')(post(owner, db, ids, kv))).status).toBe(400);
			expect(
				(await act('sync')(post(owner, db, { enabled: 'on', accountId: 'x' }, kv))).status
			).toBe(400);

			expect((await act('key')(post(owner, db, { serviceAccountJson: 'nope' }, kv))).status).toBe(
				400
			);
			const stored = await act('key')(post(owner, db, { serviceAccountJson: keyFile }, kv));
			expect(stored.message).toContain('sync@p.iam.gserviceaccount.com');
			expect(kv.data.get(SERVICE_ACCOUNT_KV_KEY)).not.toContain('BEGIN PRIVATE KEY');

			expect((await act('sync')(post(owner, db, ids, kv))).message).toMatch(/on/);
			expect(await getMerchantSettings(db)).toMatchObject({
				enabled: true,
				accountId: '1',
				feedLabel: 'US'
			});
			const data = (await load(post(owner, db, {}, kv))) as Record<string, any>;
			expect(data.serviceAccount).toEqual({
				configured: true,
				clientEmail: 'sync@p.iam.gserviceaccount.com'
			});
			expect(JSON.stringify(data)).not.toContain('PRIVATE KEY');
			expect(data.isOwner).toBe(true);

			expect((await act('clearKey')(post(owner, db, {}, kv))).message).toMatch(/off/);
			expect(kv.data.has(SERVICE_ACCOUNT_KV_KEY)).toBe(false);
			expect((await getMerchantSettings(db)).enabled).toBe(false);
		});

		it('turns the sync off', async () => {
			const db = createSqliteD1(MIGRATIONS);
			const r = await act('sync')(post(owner, db, { accountId: '1' }, createFakeKV()));
			expect(r.message).toMatch(/off/);
		});

		it('says so when there is nowhere to keep a key', async () => {
			const db = createSqliteD1(MIGRATIONS);
			await expect(
				act('key')(post(owner, db, { serviceAccountJson: keyFile }, undefined))
			).rejects.toMatchObject({ status: 503 });
		});
	});

	describe('page', () => {
		const data = (over: Record<string, unknown> = {}) =>
			({
				audit: {
					checked: 3,
					valid: 1,
					invalid: 1,
					withWarnings: 1,
					capped: false,
					problems: [
						{
							severity: 'error',
							attribute: 'image_link',
							message: 'The product has no image',
							productId: 'p1',
							slug: 'bad',
							name: 'Bad mug'
						}
					],
					site: [
						{ severity: 'warning', attribute: 'tax', message: 'Set US tax in Merchant Center' }
					]
				},
				feedUrls: {
					rss: 'https://shop.example/feeds/google-products.xml',
					tsv: 'https://shop.example/feeds/google-products.tsv'
				},
				lastFetched: { at: '2026-11-25T12:00:00.000Z', by: 'Googlebot' },
				settings: {
					defaultBrand: '',
					contentLanguage: 'en',
					shipCountries: 'US',
					handlingDaysMin: '',
					handlingDaysMax: '',
					transitDaysMin: '',
					transitDaysMax: '',
					returnCategory: '',
					returnDays: '',
					returnFees: 'customer',
					returnFeeAmount: '',
					returnMethods: ['mail'],
					returnCountries: ''
				},
				merchant: { enabled: false, accountId: '', dataSourceId: '', feedLabel: '', lastRun: null },
				serviceAccount: { configured: false, clientEmail: null },
				isOwner: true,
				problemLimit: 40,
				...over
			}) as never;

		it('shows the feed address, counts, and a link to fix each problem', () => {
			render(GooglePage, { data: data(), form: null });
			expect(screen.getByTestId('feed-url').textContent).toBe(
				'https://shop.example/feeds/google-products.xml'
			);
			expect(screen.getByTestId('count-valid').textContent).toBe('1');
			expect(screen.getByTestId('count-invalid').textContent).toBe('1');
			expect(screen.getByTestId('last-fetched').textContent).toBe('2026-11-25 12:00 UTC');
			const link = screen.getByRole('link', { name: 'Bad mug' });
			expect(link.getAttribute('href')).toBe('/admin/products#product-p1');
			expect(screen.getByText('Set US tax in Merchant Center')).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Store key' })).toBeTruthy();
		});

		it('says never fetched, nothing to fix, capped, and hides the credentials from non-owners', () => {
			render(GooglePage, {
				data: data({
					lastFetched: null,
					isOwner: false,
					audit: {
						checked: 5,
						valid: 5,
						invalid: 0,
						withWarnings: 0,
						capped: true,
						problems: [],
						site: []
					},
					merchant: {
						enabled: true,
						accountId: '1',
						dataSourceId: '2',
						feedLabel: 'US',
						lastRun: {
							at: '2026-11-25T12:00:00.000Z',
							sent: 2,
							deleted: 1,
							failed: 0,
							unchanged: 3,
							error: null
						}
					}
				}),
				form: { action: 'settings', message: 'Saved' } as never
			});
			expect(screen.getByTestId('last-fetched').textContent).toBe('never');
			expect(screen.getByText('Nothing to fix.')).toBeTruthy();
			expect(screen.getByText(/Only the first 5 products/)).toBeTruthy();
			expect(screen.getByText('Only the owner can change the sync.')).toBeTruthy();
			expect(screen.queryByRole('button', { name: 'Store key' })).toBeNull();
			expect(screen.getByText('Saved')).toBeTruthy();
			const sync = screen.getByRole('heading', { name: /Merchant API sync/ }).parentElement!;
			expect(within(sync).getByText(/sent 2, deleted/)).toBeTruthy();
		});

		it('offers to remove a stored key', () => {
			render(GooglePage, {
				data: data({ serviceAccount: { configured: true, clientEmail: 'a@b.c' } }),
				form: { problems: ['Nope'] } as never
			});
			expect(screen.getByRole('button', { name: 'Remove key' })).toBeTruthy();
			expect(screen.getByText(/A key is stored for a@b.c/)).toBeTruthy();
			expect(screen.getByText('Nope')).toBeTruthy();
		});
	});
});

describe('feed fetch marker is visible to the page', () => {
	it('reads back what the feed recorded', async () => {
		const db = createSqliteD1(MIGRATIONS);
		expect(await getFeedFetch(db)).toBeNull();
	});
});
