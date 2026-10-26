import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { getRegionalPricingSettings, saveRegionalPricingSettings } from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import * as pricingAdmin from '../../src/routes/admin/settings/pricing/+page.server';

const owner = { id: 'o', login: 'owner', email: 'o@x', isOwner: true };
// Regional pricing sits with Settings: owners and superadmins only.
const admin = {
	id: 'a',
	login: 'admin',
	email: 'a@x',
	isOwner: false,
	isAdmin: true,
	isSuperAdmin: true
};
const plainAdmin = { id: 'p', login: 'plain', email: 'p@x', isOwner: false, isAdmin: true };
const member = { id: 'm', login: 'member', email: 'm@x', isOwner: false };

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1();
});

function post(entries: Array<[string, string]>) {
	const data = new FormData();
	for (const [k, v] of entries) data.append(k, v);
	return new Request('https://shop.test/admin/settings/pricing', { method: 'POST', body: data });
}

function event(user: unknown, extra: Record<string, unknown> = {}, env: object = { DB: db }) {
	return {
		locals: { user },
		platform: { env },
		request: new Request('https://shop.test/admin/settings/pricing'),
		...extra
	} as never;
}

async function status(promise: unknown) {
	try {
		await promise;
		return 'resolved';
	} catch (err) {
		return (err as { status: number }).status;
	}
}

const valid: Array<[string, string]> = [
	['enabled', 'on'],
	['strength', '60'],
	['maxDiscount', '40'],
	['scope', 'all'],
	['overrides', 'IN 35\nCH 0']
];

describe('/admin/settings/pricing', () => {
	it('is admin-only and needs the database', async () => {
		expect(await status(pricingAdmin.load(event(member)))).toBe(403);
		expect(await status(pricingAdmin.load(event(plainAdmin)))).toBe(403);
		expect(await status(pricingAdmin.load(event(undefined)))).toBe(401);
		expect(await status(pricingAdmin.load(event(admin, {}, {})))).toBe(503);
		expect(await status(pricingAdmin.actions.save(event(member, { request: post(valid) })))).toBe(
			403
		);
		expect(
			await status(pricingAdmin.actions.save(event(admin, { request: post(valid) }, {})))
		).toBe(503);
		expect(await getRegionalPricingSettings(db)).toMatchObject({ enabled: false });
	});

	it('loads the stored settings, the index date and the visitor country', async () => {
		const data = (await pricingAdmin.load(
			event(owner, { platform: { env: { DB: db }, cf: { country: 'DE' } } })
		)) as { settings: { enabled: boolean }; priceLevelIndexUpdated: string; yourCountry: string };
		expect(data.settings.enabled).toBe(false);
		expect(data.priceLevelIndexUpdated).toMatch(/^\d{4}-/);
		expect(data.yourCountry).toBe('DE');
	});

	it('saves the form as fractions and per-country multipliers', async () => {
		const result = await pricingAdmin.actions.save(event(admin, { request: post(valid) }));
		expect(result).toEqual({ saved: true });
		expect(await getRegionalPricingSettings(db)).toEqual({
			enabled: true,
			strength: 0.6,
			maxDiscount: 0.4,
			scope: 'all',
			overrides: { IN: 0.65, CH: 1 }
		});
	});

	it('turns it off when the box is left unticked', async () => {
		await saveRegionalPricingSettings(db, {
			enabled: true,
			strength: 0.5,
			maxDiscount: 0.5,
			scope: 'digital',
			overrides: {}
		});
		const off = valid.filter(([k]) => k !== 'enabled');
		await pricingAdmin.actions.save(event(admin, { request: post(off) }));
		expect((await getRegionalPricingSettings(db)).enabled).toBe(false);
	});

	it('refuses bad input with reasons and saves nothing', async () => {
		const bad = (await pricingAdmin.actions.save(
			event(admin, {
				request: post([
					['strength', '150'],
					['maxDiscount', ''],
					['scope', 'weird'],
					['overrides', '']
				])
			})
		)) as { status: number; data: { errors: string[] } };
		expect(bad.status).toBe(400);
		expect(bad.data.errors.length).toBeGreaterThanOrEqual(3);
		const lines = (await pricingAdmin.actions.save(
			event(admin, {
				request: post([...valid.filter(([k]) => k !== 'overrides'), ['overrides', 'IN forty']])
			})
		)) as { status: number; data: { errors: string[] } };
		expect(lines.status).toBe(400);
		expect(lines.data.errors[0]).toContain('IN forty');
		expect(await getRegionalPricingSettings(db)).toMatchObject({ enabled: false, strength: 0.5 });
	});

	it('treats a form with no overrides field as no overrides', async () => {
		const noOverrides = valid.filter(([k]) => k !== 'overrides');
		expect(await pricingAdmin.actions.save(event(admin, { request: post(noOverrides) }))).toEqual({
			saved: true
		});
	});
});
