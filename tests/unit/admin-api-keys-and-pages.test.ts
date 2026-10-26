import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createApiKey, listApiKeys, logApiCall } from '@nebulakit/security';
import { emptyPage, getPage, savePage } from '@nebulakit/builder';
import { createProduct } from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import * as apiKeys from '../../src/routes/admin/api-keys/+page.server';
import * as pagesAdmin from '../../src/routes/admin/pages/+page.server';
import * as pageEdit from '../../src/routes/admin/pages/[slug]/+page.server';
import * as publicPage from '../../src/routes/p/[slug]/+page.server';

const owner = { id: 'o', login: 'owner', email: 'o@x', isOwner: true };
const admin = {
	id: 'a',
	login: 'admin',
	email: 'a@x',
	isOwner: false,
	isAdmin: true,
	permissions: ['pages']
};

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1();
});

function form(entries: Array<[string, string]>) {
	const data = new FormData();
	for (const [k, v] of entries) data.append(k, v);
	return new Request('https://shop.test/admin', { method: 'POST', body: data });
}

function event(
	user: unknown,
	extra: Record<string, unknown> = {},
	env: Record<string, unknown> = { DB: db }
) {
	return { locals: { user }, platform: { env }, ...extra } as never;
}

async function status(promise: unknown) {
	try {
		await promise;
		return 'resolved';
	} catch (err) {
		return (err as { status: number }).status;
	}
}

describe('/admin/api-keys', () => {
	it('is owner-only and needs the database', async () => {
		expect(await status(apiKeys.load(event(admin)))).toBe(403);
		expect(await status(apiKeys.load(event(undefined)))).toBe(401);
		expect(await status(apiKeys.load(event(owner, {}, {})))).toBe(503);
		expect(await status(apiKeys.actions.create(event(admin, { request: form([]) })))).toBe(403);
	});

	it('lists keys, calls and the orchestrator connection', async () => {
		const { record } = await createApiKey(db, { name: 'k', scopes: ['site:read'] });
		await logApiCall(db, { keyId: record.id, method: 'GET', path: '/api/v1/site', status: 200 });
		const data = (await apiKeys.load(
			event(owner, {}, { DB: db, ORCHESTRATOR_KEY_SHA256: 'abc' })
		)) as {
			keys: unknown[];
			calls: unknown[];
			orchestratorConnected: boolean;
			scopes: string[];
		};
		expect(data.keys).toHaveLength(1);
		expect(data.calls).toHaveLength(1);
		expect(data.orchestratorConnected).toBe(true);
		expect(data.scopes).toContain('pages:write');
	});

	it('creates a key once, with scopes and expiry, and revokes it', async () => {
		const created = (await apiKeys.actions.create(
			event(owner, {
				request: form([
					['name', 'Agent'],
					['scopes', 'pages:write'],
					['scopes', 'pages:read'],
					['expiry', '30']
				])
			})
		)) as { created: { key: string; name: string } };
		expect(created.created.key).toMatch(/^nk_[0-9a-f]{64}$/);
		const [record] = await listApiKeys(db);
		expect(record.scopes).toEqual(['pages:read', 'pages:write']);
		expect(record.createdBy).toBe('o');
		const days = (Date.parse(record.expiresAt!) - Date.now()) / 86_400_000;
		expect(days).toBeGreaterThan(29);

		const never = (await apiKeys.actions.create(
			event(owner, {
				request: form([
					['name', 'Forever'],
					['scopes', 'site:read'],
					['expiry', 'never']
				])
			})
		)) as { created: { key: string } };
		expect(never.created.key).toBeTruthy();
		expect((await listApiKeys(db)).find((k) => k.name === 'Forever')?.expiresAt).toBeNull();

		const revoked = await apiKeys.actions.revoke(
			event(owner, { request: form([['id', record.id]]) })
		);
		expect(revoked).toEqual({ revoked: record.id });
		const again = (await apiKeys.actions.revoke(
			event(owner, { request: form([['id', record.id]]) })
		)) as {
			status: number;
		};
		expect(again.status).toBe(404);
	});

	it.each([
		[[['scopes', 'site:read']], 'name'],
		[
			[
				['name', 'x'.repeat(101)],
				['scopes', 'site:read']
			],
			'name'
		],
		[[['name', 'k']], 'scope'],
		[
			[
				['name', 'k'],
				['scopes', 'root']
			],
			'scope'
		],
		[
			[
				['name', 'k'],
				['scopes', 'site:read'],
				['expiry', '2']
			],
			'expiry'
		]
	])('refuses a bad create %#', async (entries, word) => {
		const result = (await apiKeys.actions.create(
			event(owner, { request: form(entries as Array<[string, string]>) })
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error.toLowerCase()).toContain(word);
	});
});

describe('/admin/pages', () => {
	it('is admin-only and needs the database', async () => {
		expect(await status(pagesAdmin.load(event({ ...admin, isAdmin: false })))).toBe(403);
		expect(await status(pagesAdmin.load(event(admin, {}, {})))).toBe(503);
		expect(await status(pagesAdmin.actions.create(event(admin, { request: form([]) }, {})))).toBe(
			503
		);
		expect(await status(pageEdit.load(event(admin, { params: { slug: 'x' } }, {})))).toBe(503);
	});

	it('creates a page and redirects to its editor', async () => {
		const result = await status(
			pagesAdmin.actions.create(
				event(admin, {
					request: form([
						['slug', 'About'],
						['title', 'About us']
					])
				})
			)
		);
		expect(result).toBe(303);
		expect((await getPage(db, 'about'))?.title).toBe('About us');
		expect(((await pagesAdmin.load(event(admin))) as { pages: unknown[] }).pages).toHaveLength(1);
		const editor = (await pageEdit.load(event(admin, { params: { slug: 'about' } }))) as {
			page: { slug: string };
		};
		expect(editor.page.slug).toBe('about');
		expect(await status(pageEdit.load(event(admin, { params: { slug: 'nope' } })))).toBe(404);

		const dupe = (await pagesAdmin.actions.create(
			event(admin, {
				request: form([
					['slug', 'about'],
					['title', 'Again']
				])
			})
		)) as { status: number };
		expect(dupe.status).toBe(409);
	});

	it('refuses a bad slug or title', async () => {
		const badSlug = (await pagesAdmin.actions.create(
			event(admin, {
				request: form([
					['slug', 'a b'],
					['title', 'T']
				])
			})
		)) as { status: number };
		expect(badSlug.status).toBe(400);
		const badTitle = (await pagesAdmin.actions.create(
			event(admin, { request: form([['slug', 'ok']]) })
		)) as { status: number };
		expect(badTitle.status).toBe(400);
	});
});

describe('/p/[slug]', () => {
	const grid = {
		version: 2 as const,
		blocks: [
			{ id: 'g', type: 'product-grid' as const, props: { heading: 'Shop', limit: 2 } },
			{ id: 't', type: 'text' as const, props: { text: 'Hi', align: 'start' as const } }
		]
	};

	it('shows published pages with their products, and drafts to admins only', async () => {
		await createProduct(db, { slug: 'tee', name: 'Tee', priceCents: 2500 });
		await savePage(db, { slug: 'shop', title: 'Shop', document: grid, published: true });
		await savePage(db, { slug: 'draft', title: 'Draft', document: emptyPage(), published: false });

		const shop = (await publicPage.load(event(undefined, { params: { slug: 'shop' } }))) as {
			products: Array<{ price: string }>;
		};
		expect(shop.products).toEqual([{ slug: 'tee', name: 'Tee', price: '$25.00', imageUrl: null }]);

		expect(await status(publicPage.load(event(undefined, { params: { slug: 'draft' } })))).toBe(
			404
		);
		const preview = (await publicPage.load(event(admin, { params: { slug: 'draft' } }))) as {
			products: unknown[];
		};
		expect(preview.products).toEqual([]);
		expect(await status(publicPage.load(event(owner, { params: { slug: 'none' } })))).toBe(404);
		expect(await status(publicPage.load(event(owner, { params: { slug: 'x' } }, {})))).toBe(503);
	});
});
