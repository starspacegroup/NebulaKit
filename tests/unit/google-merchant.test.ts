import { generateKeyPairSync, createPublicKey, createVerify } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createProduct,
	countSynced,
	saveGoogleListingSettings,
	type GoogleAttributes
} from '@nebulakit/commerce';
import { listingContext } from '../../src/lib/server/google-feed';
import {
	MERCHANT_API_BASE,
	MerchantApiError,
	MerchantClient,
	SERVICE_ACCOUNT_KV_KEY,
	getMerchantSettings,
	loadServiceAccount,
	parseMerchantSettings,
	parseServiceAccountJson,
	runMerchantSync,
	saveMerchantSettings,
	saveServiceAccount,
	serviceAccountStatus,
	signServiceAccountJwt,
	validateMerchantInput,
	type FetchLike,
	type ServiceAccount
} from '../../src/lib/server/google-merchant';
import { GOOGLE_MERCHANT_SYNC_JOB } from '../../src/lib/server/scheduler/jobs/google-merchant-sync';
import { SCHEDULED_JOBS } from '../../src/lib/server/scheduler/registry';
import { createFakeKV, TEST_ENCRYPTION_KEY } from '../helpers/fake-kv';
import { createSqliteD1 } from '../helpers/sqlite-d1';

const MIGRATIONS = [
	'0016_commerce.sql',
	'0022_commerce_settings.sql',
	'0026_commerce_auctions.sql',
	'0027_commerce_auction_deadlines.sql',
	'0037_google_listings.sql'
];
const NOW = Date.parse('2026-11-25T12:00:00Z');

let account: ServiceAccount;
let publicPem: string;
beforeAll(() => {
	const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	account = {
		clientEmail: 'sync@project.iam.gserviceaccount.com',
		privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
	};
	publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
});

let db: D1Database;
let kv: ReturnType<typeof createFakeKV>;
let platform: App.Platform;
beforeEach(async () => {
	db = createSqliteD1(MIGRATIONS);
	kv = createFakeKV();
	platform = { env: { DB: db, KV: kv, ENCRYPTION_KEY: TEST_ENCRYPTION_KEY } } as never;
});

const b64urlDecode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** A fake Google: records every call, answers token + product requests. */
function fakeGoogle(handler?: (url: string, init: RequestInit) => Response | undefined) {
	const calls: { url: string; method: string; headers: Record<string, string>; body: string }[] =
		[];
	const fetchLike: FetchLike = async (url, init = {}) => {
		const headers = Object.fromEntries(
			Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
				k.toLowerCase(),
				String(v)
			])
		);
		calls.push({ url, method: init.method ?? 'GET', headers, body: String(init.body ?? '') });
		const custom = handler?.(url, init);
		if (custom) return custom;
		if (url === 'https://oauth2.googleapis.com/token')
			return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }));
		return new Response('{}');
	};
	return { calls, fetchLike, products: () => calls.filter((c) => !c.url.includes('oauth2')) };
}

async function add(slug: string, google: Partial<GoogleAttributes> = {}, patch = {}) {
	return createProduct(db, {
		slug,
		name: `Product ${slug}`,
		description: 'About it.',
		priceCents: 1000,
		imageUrl: 'https://cdn.example.com/a.jpg',
		google: { brand: 'Acme', gtin: '036000291452', ...google },
		...patch
	});
}

async function configure(extra = {}) {
	await saveServiceAccount(platform, account);
	await saveMerchantSettings(db, {
		...(await getMerchantSettings(db)),
		enabled: true,
		accountId: '123',
		dataSourceId: '456',
		feedLabel: 'US',
		...extra
	});
}

const run = async (fetchLike: FetchLike, extra: Record<string, unknown> = {}) =>
	runMerchantSync({
		db,
		platform,
		fetch: fetchLike,
		ctx: await listingContext(db, {}, NOW),
		nowMs: NOW,
		...extra
	});

describe('service-account JWT', () => {
	it('is a valid RS256 JWT with the claims Google documents', async () => {
		const jwt = await signServiceAccountJwt(account, 1_700_000_000);
		const [h, c, s] = jwt.split('.');
		expect(JSON.parse(b64urlDecode(h).toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
		expect(JSON.parse(b64urlDecode(c).toString())).toEqual({
			iss: account.clientEmail,
			scope: 'https://www.googleapis.com/auth/content',
			aud: 'https://oauth2.googleapis.com/token',
			iat: 1_700_000_000,
			exp: 1_700_003_600
		});
		const verify = createVerify('RSA-SHA256').update(`${h}.${c}`);
		expect(verify.verify(createPublicKey(publicPem), b64urlDecode(s))).toBe(true);
	});

	it('refuses a key that is not PKCS#8', async () => {
		await expect(signServiceAccountJwt({ ...account, privateKey: 'nope' }, 1)).rejects.toThrow();
	});
});

describe('credentials storage', () => {
	it('seals the private key in KV and never in D1', async () => {
		await saveServiceAccount(platform, account);
		const stored = kv.data.get(SERVICE_ACCOUNT_KV_KEY)!;
		expect(stored).not.toContain('BEGIN PRIVATE KEY');
		expect(JSON.parse(stored).privateKey).toMatch(/^v1\./);
		expect(await loadServiceAccount(platform)).toEqual(account);
		expect(await serviceAccountStatus(platform)).toEqual({
			configured: true,
			clientEmail: account.clientEmail
		});
		const everything = await db
			.prepare('SELECT group_concat(value) AS v FROM commerce_settings')
			.first<{ v: string }>();
		expect(String(everything?.v ?? '')).not.toContain('PRIVATE KEY');
	});

	it('reports nothing configured, and a damaged record as not configured', async () => {
		expect(await loadServiceAccount(platform)).toBeNull();
		expect(await serviceAccountStatus(platform)).toEqual({ configured: false, clientEmail: null });
		kv.data.set(SERVICE_ACCOUNT_KV_KEY, '{oops');
		expect(await serviceAccountStatus(platform)).toEqual({ configured: false, clientEmail: null });
	});

	it('reads only the two fields it needs from a key file', () => {
		const file = JSON.stringify({
			type: 'service_account',
			client_email: account.clientEmail,
			private_key: account.privateKey,
			private_key_id: 'abc',
			token_uri: 'https://evil.example/token'
		});
		expect(parseServiceAccountJson(file)).toEqual({ ok: true, value: account });
		for (const bad of [
			'not json',
			'{}',
			JSON.stringify({ client_email: 'x@y.z' }),
			JSON.stringify({ client_email: 'nope', private_key: account.privateKey })
		]) {
			expect(parseServiceAccountJson(bad)).toMatchObject({ ok: false });
		}
	});
});

describe('settings', () => {
	it('defaults to off and reads damage as off', async () => {
		expect((await getMerchantSettings(db)).enabled).toBe(false);
		for (const raw of ['{oops', '[]', 'null', 42, undefined])
			expect(parseMerchantSettings(raw).enabled).toBe(false);
		expect(parseMerchantSettings({ enabled: 'yes' }).enabled).toBe(false);
		expect(parseMerchantSettings({ accountId: 'abc', feedLabel: 'us' })).toMatchObject({
			accountId: null,
			feedLabel: null
		});
	});

	it('will not switch on without every id', () => {
		expect(validateMerchantInput({ enabled: true, accountId: '1' })).toMatchObject({ ok: false });
		expect(
			validateMerchantInput({ enabled: true, accountId: 'a1', dataSourceId: '2', feedLabel: 'US' })
		).toMatchObject({ ok: false });
		expect(
			validateMerchantInput({ enabled: true, accountId: '1', dataSourceId: '2', feedLabel: 'us' })
		).toMatchObject({
			ok: true,
			value: { feedLabel: 'US', enabled: true }
		});
		expect(validateMerchantInput({ enabled: false })).toMatchObject({ ok: true });
		expect(validateMerchantInput({ feedLabel: 'x'.repeat(21) })).toMatchObject({ ok: false });
	});
});

describe('MerchantClient', () => {
	function client(fetchLike: FetchLike) {
		return new MerchantClient({
			fetch: fetchLike,
			account,
			accountId: '123',
			dataSourceId: '456',
			feedLabel: 'US',
			contentLanguage: 'en',
			nowSec: () => 1_700_000_000
		});
	}

	it('signs in once, then inserts to productInputs:insert with the data source', async () => {
		const g = fakeGoogle();
		const c = client(g.fetchLike);
		await c.insert('sku-1', { title: 'T' });
		await c.insert('sku-2', { title: 'U' });
		const token = g.calls.filter((x) => x.url.includes('oauth2'));
		expect(token).toHaveLength(1);
		const form = new URLSearchParams(token[0].body);
		expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
		expect(form.get('assertion')!.split('.')).toHaveLength(3);
		const [first] = g.products();
		expect(first.method).toBe('POST');
		expect(first.url).toBe(
			`${MERCHANT_API_BASE}/accounts/123/productInputs:insert?dataSource=${encodeURIComponent('accounts/123/dataSources/456')}`
		);
		expect(first.headers.authorization).toBe('Bearer tok-123');
		expect(JSON.parse(first.body)).toEqual({
			offerId: 'sku-1',
			contentLanguage: 'en',
			feedLabel: 'US',
			productAttributes: { title: 'T' }
		});
	});

	it('deletes by the base64url of language~label~offer', async () => {
		const g = fakeGoogle();
		await client(g.fetchLike).remove('sku/1');
		const [call] = g.products();
		expect(call.method).toBe('DELETE');
		expect(call.url).toContain(
			`/productInputs/${Buffer.from('en~US~sku/1').toString('base64url')}?dataSource=`
		);
	});

	it('treats an already-deleted product as success, and any other failure as an error', async () => {
		const gone = fakeGoogle((u) =>
			u.includes('productInputs/') ? new Response('{}', { status: 404 }) : undefined
		);
		await expect(client(gone.fetchLike).remove('x')).resolves.toBeUndefined();
		const bad = fakeGoogle((u) =>
			u.includes('productInputs')
				? new Response(JSON.stringify({ error: { message: 'Invalid value' } }), { status: 400 })
				: undefined
		);
		await expect(client(bad.fetchLike).insert('x', {})).rejects.toMatchObject({
			status: 400,
			message: expect.stringContaining('Invalid value')
		});
	});

	it('names a failed sign-in without leaking the assertion or the key', async () => {
		const g = fakeGoogle((u) =>
			u.includes('oauth2')
				? new Response(JSON.stringify({ error: { message: 'invalid_grant' } }), { status: 400 })
				: undefined
		);
		const err = await client(g.fetchLike)
			.insert('x', {})
			.catch((e) => e);
		expect(err).toBeInstanceOf(MerchantApiError);
		expect(err.message).toContain('Google sign-in failed');
		expect(err.message).not.toContain('PRIVATE KEY');
		expect(err.message).not.toContain(g.calls[0].body);
		const empty = fakeGoogle((u) => (u.includes('oauth2') ? new Response('{}') : undefined));
		await expect(client(empty.fetchLike).insert('x', {})).rejects.toThrow(/no token/);
	});
});

describe('runMerchantSync', () => {
	it('does nothing, and calls nothing, while off', async () => {
		await add('a');
		const g = fakeGoogle();
		expect(await run(g.fetchLike)).toEqual({ skipped: 'disabled' });
		expect(g.calls).toEqual([]);
	});

	it('does nothing when on but incomplete or without a key', async () => {
		await saveMerchantSettings(db, { ...(await getMerchantSettings(db)), enabled: true });
		const g = fakeGoogle();
		expect(await run(g.fetchLike)).toEqual({ skipped: 'not-configured' });
		await saveMerchantSettings(db, {
			...(await getMerchantSettings(db)),
			accountId: '1',
			dataSourceId: '2',
			feedLabel: 'US'
		});
		expect(await run(g.fetchLike)).toEqual({ skipped: 'no-credentials' });
		expect(g.calls).toEqual([]);
	});

	it('sends new products once, then nothing until one changes', async () => {
		await configure();
		const a = await add('a');
		await add('b');
		const g = fakeGoogle();
		expect(await run(g.fetchLike)).toMatchObject({ sent: 2, unchanged: 0, failed: 0, error: null });
		expect(await countSynced(db)).toBe(2);
		expect(g.products()).toHaveLength(2);

		const again = fakeGoogle();
		expect(await run(again.fetchLike)).toMatchObject({ sent: 0, unchanged: 2 });
		expect(again.calls).toEqual([]);

		await db
			.prepare('UPDATE commerce_products SET price_cents = 1100 WHERE id = ?')
			.bind(a.id)
			.run();
		const third = fakeGoogle();
		expect(await run(third.fetchLike)).toMatchObject({ sent: 1, unchanged: 1 });
		const body = JSON.parse(third.products()[0].body);
		expect(body.offerId).toBe(a.id);
		expect(body.productAttributes.price).toEqual({ amountMicros: '11000000', currencyCode: 'USD' });
	});

	it('removes what should no longer be listed: archived, excluded, deleted, invalid', async () => {
		await configure();
		const keep = await add('keep');
		const archived = await add('archived');
		const excluded = await add('excluded');
		const broken = await add('broken');
		const removed = await add('removed');
		await run(fakeGoogle().fetchLike);
		expect(await countSynced(db)).toBe(5);

		await db
			.prepare('UPDATE commerce_products SET active = 0 WHERE id = ?')
			.bind(archived.id)
			.run();
		await db
			.prepare('UPDATE commerce_products SET google_excluded = 1 WHERE id = ?')
			.bind(excluded.id)
			.run();
		await db
			.prepare('UPDATE commerce_products SET image_url = NULL WHERE id = ?')
			.bind(broken.id)
			.run();
		await db.prepare('DELETE FROM commerce_products WHERE id = ?').bind(removed.id).run();
		const g = fakeGoogle();
		const result = await run(g.fetchLike);
		expect(result).toMatchObject({ deleted: 4, sent: 0 });
		const deleted = g
			.products()
			.filter((c) => c.method === 'DELETE')
			.map((c) => b64urlDecode(c.url.split('/productInputs/')[1].split('?')[0]).toString());
		expect(deleted.sort()).toEqual(
			[archived.id, broken.id, excluded.id, removed.id].map((id) => `en~US~${id}`).sort()
		);
		expect(await countSynced(db)).toBe(1);
		expect(keep.id).toBeTruthy();
	});

	it('is bounded: a batch of writes per run, resuming from a cursor until the catalog is done', async () => {
		await configure();
		for (let i = 0; i < 7; i++) await add(`p${i}`);
		const g = fakeGoogle();
		const first = await run(g.fetchLike, { batch: 3, scan: 4 });
		expect(first).toMatchObject({ sent: 3 });
		expect((await getMerchantSettings(db)).cursor).not.toBe('');
		let total = 3;
		for (let i = 0; i < 6 && total < 7; i++) {
			total += ((await run(g.fetchLike, { batch: 3, scan: 4 })) as { sent: number }).sent;
		}
		expect(total).toBe(7);
		expect(await countSynced(db)).toBe(7);
		expect(g.products().length).toBe(7);
	});

	it('skips a product Google rejects, and stops on a rate limit or an outage', async () => {
		await configure();
		await add('a');
		await add('b');
		await add('c');
		let n = 0;
		const rejecting = fakeGoogle((u) =>
			u.includes('productInputs') && ++n === 1
				? new Response(JSON.stringify({ error: { message: 'bad' } }), { status: 400 })
				: undefined
		);
		expect(await run(rejecting.fetchLike)).toMatchObject({ sent: 2, failed: 1 });
		expect(await countSynced(db)).toBe(2);

		const limited = fakeGoogle((u) =>
			u.includes('productInputs') ? new Response('{}', { status: 429 }) : undefined
		);
		const result = (await run(limited.fetchLike)) as { error: string; failed: number };
		expect(result.failed).toBe(1);
		expect(result.error).toContain('429');
		expect(limited.products()).toHaveLength(1);
	});

	it('honours an aborted signal', async () => {
		await configure();
		await add('a');
		const controller = new AbortController();
		controller.abort();
		const g = fakeGoogle();
		expect(await run(g.fetchLike, { signal: controller.signal })).toMatchObject({ sent: 0 });
	});

	it('records the last run, and keeps the secret out of it', async () => {
		await configure();
		await add('a');
		await run(fakeGoogle().fetchLike);
		const settings = await getMerchantSettings(db);
		expect(settings.lastRun).toMatchObject({ sent: 1, at: '2026-11-25T12:00:00.000Z' });
		expect(JSON.stringify(settings)).not.toContain('PRIVATE KEY');
	});

	it('uses the content language from the listing settings', async () => {
		await configure();
		await saveGoogleListingSettings(db, { contentLanguage: 'de' });
		await add('a');
		const g = fakeGoogle();
		await run(g.fetchLike);
		expect(JSON.parse(g.products()[0].body).contentLanguage).toBe('de');
	});
});

describe('the scheduled job', () => {
	it('is registered, on a cron the worker maps, and a no-op while disabled', async () => {
		expect(SCHEDULED_JOBS).toContain(GOOGLE_MERCHANT_SYNC_JOB);
		expect(GOOGLE_MERCHANT_SYNC_JOB.path).toBe('/api/cron/google-merchant-sync');
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const detail = await GOOGLE_MERCHANT_SYNC_JOB.run({
			db,
			env: { DB: db, KV: kv } as never,
			now: NOW / 1000,
			signal: new AbortController().signal,
			params: new URLSearchParams(),
			origin: 'https://x.test'
		});
		expect(detail).toEqual({ skipped: 'disabled' });
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it('sends through the real fetch binding when on', async () => {
		await configure();
		await add('a');
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation(async (input) =>
				String(input).includes('oauth2')
					? new Response(JSON.stringify({ access_token: 't' }))
					: new Response('{}')
			);
		const detail = await GOOGLE_MERCHANT_SYNC_JOB.run({
			db,
			env: { DB: db, KV: kv, ENCRYPTION_KEY: TEST_ENCRYPTION_KEY } as never,
			now: NOW / 1000,
			signal: new AbortController().signal,
			params: new URLSearchParams(),
			origin: 'https://x.test'
		});
		expect(detail).toMatchObject({ sent: 1 });
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		fetchSpy.mockRestore();
	});
});
