import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { load as layoutLoad } from '../../src/routes/admin/+layout.server';
import { GET, PUT } from '../../src/routes/api/admin/settings/timezone/+server';
import {
	readAdminTimeZoneSetting,
	saveAdminTimeZoneSetting,
	writeSiteSetting
} from '../../src/lib/server/site-settings';
import { loadStatsSummary } from '../../src/lib/server/stats-summary';
import { AUDIT_RULES } from '../../src/lib/server/audit';

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1();
});

const OWNER = { id: 'u1', isOwner: true };
const ADMIN = { id: 'u2', isAdmin: true };
const NOBODY = { id: 'u3' };

function layoutEvent(opts: { user?: unknown; tz?: string; env?: object | null }) {
	return {
		locals: { user: opts.user ?? OWNER },
		cookies: { get: (name: string) => (name === 'tz' ? opts.tz : undefined) },
		platform: opts.env === null ? undefined : { env: opts.env ?? { DB: db } }
	} as never;
}

async function layout(opts: Parameters<typeof layoutEvent>[0]) {
	return (await layoutLoad(layoutEvent(opts))) as {
		timeZone: string;
		timeZoneSetting: string;
		timeZoneSource: string;
		timeZoneLabel: string;
	};
}

describe('admin layout load: which clock', () => {
	it('is UTC with no setting and no cookie', async () => {
		const data = await layout({});
		expect(data).toMatchObject({
			timeZone: 'UTC',
			timeZoneSetting: 'auto',
			timeZoneSource: 'default'
		});
		expect(data.timeZoneLabel).toContain('UTC');
	});

	it('uses a valid browser cookie when the setting is auto', async () => {
		const data = await layout({ tz: 'Asia/Kolkata' });
		expect(data).toMatchObject({ timeZone: 'Asia/Kolkata', timeZoneSource: 'browser' });
		expect(data.timeZoneLabel).toContain('UTC+05:30');
	});

	it('lets the explicit site setting beat the cookie', async () => {
		await saveAdminTimeZoneSetting(db, 'America/New_York');
		const data = await layout({ tz: 'Asia/Kolkata' });
		expect(data).toMatchObject({
			timeZone: 'America/New_York',
			timeZoneSetting: 'America/New_York',
			timeZoneSource: 'setting'
		});
	});

	it.each([
		'Nope/Zone',
		'../../etc/passwd',
		'<img src=x onerror=alert(1)>',
		"Asia/Kolkata'; DROP TABLE users;--",
		'a'.repeat(5000),
		'%00',
		'+05:00',
		''
	])('treats the hostile cookie %j as absent', async (tz) => {
		const data = await layout({ tz });
		expect(data).toMatchObject({ timeZone: 'UTC', timeZoneSource: 'default' });
		expect(JSON.stringify(data)).not.toContain('DROP TABLE');
		expect(JSON.stringify(data)).not.toContain('<img');
	});

	it('survives a database without the settings table, and no database at all', async () => {
		const noTable = {
			prepare: () => {
				throw new Error('no such table');
			}
		};
		expect((await layout({ env: { DB: noTable }, tz: 'Europe/Paris' })).timeZone).toBe(
			'Europe/Paris'
		);
		expect((await layout({ env: null })).timeZone).toBe('UTC');
	});

	it('ignores a garbage stored value rather than breaking every admin page', async () => {
		await writeSiteSetting(db, 'admin_timezone', 'Mars/Olympus');
		expect(await readAdminTimeZoneSetting(db)).toBe('auto');
		expect((await layout({ tz: 'Europe/Paris' })).timeZone).toBe('Europe/Paris');
	});

	it('still guards the admin area', async () => {
		await expect(layoutLoad(layoutEvent({ user: NOBODY }))).rejects.toMatchObject({ status: 302 });
	});
});

function put(user: unknown, body: unknown, env: object | null = { DB: db }) {
	return PUT({
		locals: { user },
		platform: env ? { env } : undefined,
		request: new Request('https://x.test/api/admin/settings/timezone', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		})
	} as never);
}

async function statusOf(p: Response | Promise<Response>) {
	try {
		return (await p).status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}

describe('PUT /api/admin/settings/timezone', () => {
	it('requires sign-in and the owner', async () => {
		expect(await statusOf(put(null, { timeZone: 'UTC' }))).toBe(401);
		expect(await statusOf(put(ADMIN, { timeZone: 'UTC' }))).toBe(403);
		expect(await statusOf(put(NOBODY, { timeZone: 'UTC' }))).toBe(403);
		expect(await readAdminTimeZoneSetting(db)).toBe('auto');
	});

	it('saves a valid zone and reads it back', async () => {
		const res = await put(OWNER, { timeZone: 'Asia/Kolkata' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, timeZone: 'Asia/Kolkata' });
		expect(await readAdminTimeZoneSetting(db)).toBe('Asia/Kolkata');
		const got = await GET({ locals: { user: ADMIN }, platform: { env: { DB: db } } } as never);
		expect(await got.json()).toEqual({ timeZone: 'Asia/Kolkata' });
	});

	it('accepts auto and normalises case', async () => {
		await put(OWNER, { timeZone: 'europe/paris' });
		expect(await readAdminTimeZoneSetting(db)).toBe('Europe/Paris');
		await put(OWNER, { timeZone: 'auto' });
		expect(await readAdminTimeZoneSetting(db)).toBe('auto');
	});

	it.each([
		{ timeZone: 'Nope/Zone' },
		{ timeZone: '' },
		{ timeZone: 5 },
		{ timeZone: null },
		{ timeZone: '+05:00' },
		{ timeZone: "UTC'; DROP TABLE site_settings;--" },
		{},
		[]
	])('rejects %j and stores nothing', async (body) => {
		await put(OWNER, { timeZone: 'Asia/Tokyo' });
		expect(await statusOf(put(OWNER, body))).toBe(400);
		expect(await readAdminTimeZoneSetting(db)).toBe('Asia/Tokyo');
	});

	it('rejects a body that is not JSON', async () => {
		expect(await statusOf(put(OWNER, 'not json'))).toBe(400);
	});

	it('reports a missing database and a failing write', async () => {
		expect(await statusOf(put(OWNER, { timeZone: 'UTC' }, null))).toBe(503);
		const broken = {
			prepare: () => {
				throw new Error('boom');
			}
		};
		expect(await statusOf(put(OWNER, { timeZone: 'UTC' }, { DB: broken }))).toBe(500);
	});

	it('is audited, recording the zone and nothing else', () => {
		expect(AUDIT_RULES['PUT /api/admin/settings/timezone']).toMatchObject({
			action: 'settings.admin_timezone',
			body: ['timeZone']
		});
	});
});

describe('stats are bucketed in the admin zone', () => {
	it('re-buckets user growth by month in the zone and returns the day anchors', async () => {
		await db
			.prepare(
				`INSERT INTO users (id, email, created_at) VALUES ('a','a@x.test','2026-07-31 20:00:00'), ('b','b@x.test','2026-08-01 01:00:00')`
			)
			.run();
		const now = new Date('2026-08-02T20:00:00Z');
		const utc = await loadStatsSummary(db, 30, now, 'UTC');
		const ist = await loadStatsSummary(db, 30, now, 'Asia/Kolkata');
		expect(utc.stats.totalUsers).toBe(2);
		expect(utc.stats.usersByMonth.map((m) => [m.ym, m.count])).toEqual([
			['2026-07', 1],
			['2026-08', 1]
		]);
		expect(ist.stats.usersByMonth.map((m) => [m.ym, m.count])).toEqual([['2026-08', 2]]);
		expect(utc.trafficToday).toBe('2026-08-02');
		expect(ist.trafficToday).toBe('2026-08-03');
		expect(ist.usageToday).toBe('2026-08-02');
		expect(ist.bucketZone).toBe('Asia/Kolkata');
	});

	it('serves day buckets of the zone from the hourly counters, and says what it did', async () => {
		// 20:00 UTC on Jul 16 is already Jul 17 in Kolkata (UTC+5:30).
		for (const [day, hour, views] of [
			['2026-07-16', 20, 4],
			['2026-07-16', 10, 1]
		] as const) {
			await db
				.prepare('INSERT INTO page_view_hourly (day, hour, views, signed_in) VALUES (?, ?, ?, 0)')
				.bind(day, hour, views)
				.run();
		}
		const now = new Date('2026-07-17T12:00:00Z');
		const utc = await loadStatsSummary(db, 7, now, 'UTC');
		const ist = await loadStatsSummary(db, 7, now, 'Asia/Kolkata');
		// UTC reads the daily table only (the hourly rows are not fetched for it).
		expect(utc.traffic?.hourly).toEqual([]);
		expect(ist.traffic?.hourly.reduce((s, h) => s + h.views, 0)).toBe(5);
	});
});

/** Guard: raw machine-zone formatting must not creep back into admin code. */
function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (/\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
	}
	return out;
}

describe('admin date and time formatting goes through the timezone helpers', () => {
	const files = [
		...walk(join(process.cwd(), 'src/routes/admin')),
		...walk(join(process.cwd(), 'src/lib/components/admin'))
	];

	it('finds the admin sources', () => {
		expect(files.length).toBeGreaterThan(20);
	});

	it('has no bare toLocale*String() in src/routes/admin or src/lib/components/admin', () => {
		const offenders: string[] = [];
		for (const file of files) {
			const text = readFileSync(file, 'utf8');
			const re = /\.toLocale(?:Date|Time)?String\(([^)]*)\)/g;
			for (const m of text.matchAll(re)) {
				if (!/timeZone/.test(m[1])) {
					const line = text.slice(0, m.index).split('\n').length;
					offenders.push(`${file.replace(process.cwd() + '/', '')}:${line}  ${m[0]}`);
				}
			}
		}
		expect(
			offenders,
			'Use formatDate/formatTime/formatDateTime from $lib/utils/timezone (dates) or formatNumber from $lib/utils/format-number (numbers). A bare toLocale*String() uses the machine zone and locale.'
		).toEqual([]);
	});

	it('does not format admin dates with Intl.DateTimeFormat or toLocale* and no zone', () => {
		const offenders: string[] = [];
		for (const file of files) {
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(/new Intl\.DateTimeFormat\(([^)]*)\)/g)) {
				if (!/timeZone/.test(m[0])) offenders.push(`${file}: ${m[0]}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
