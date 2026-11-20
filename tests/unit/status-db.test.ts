import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	HISTORY_DAYS,
	KEEP_DAILY_DAYS,
	STALE_CHECK_SECONDS,
	addIncidentUpdate,
	createIncident,
	getStatusSnapshot,
	recordStatus
} from '../../src/lib/server/status';
import { COMPONENT_IDS, OPENING_NOTE, RESOLVED_NOTE } from '../../src/lib/status/logic';

const START = Date.parse('2026-11-17T10:00:00Z');
const at = (minutes: number) => new Date(START + minutes * 60_000);
const down = { ok: false, ms: null };
const up = { ok: true, ms: 120 };

/** A database whose `SELECT 1` health query fails, like a D1 outage. */
function brokenDatabase(db: D1Database): D1Database {
	return {
		...db,
		prepare: (sql: string) =>
			sql.startsWith('SELECT 1')
				? ({
						first: async () => {
							throw new Error('D1_ERROR: boom, connection string secret=abc');
						}
					} as never)
				: db.prepare(sql),
		batch: db.batch.bind(db),
		exec: db.exec.bind(db)
	} as unknown as D1Database;
}

async function rounds(
	db: D1Database,
	count: number,
	website: typeof up | typeof down | null,
	from = 0
) {
	for (let i = 0; i < count; i++) await recordStatus(db, { website }, at(from + i));
}

describe('recording a round', () => {
	it('records every listed component, up, on the first round', async () => {
		const db = createSqliteD1();
		const result = await recordStatus(db, { website: up }, at(0));
		expect(Object.keys(result.components)).toEqual(COMPONENT_IDS);
		for (const c of Object.values(result.components)) {
			expect(c).toMatchObject({ status: 'operational', changed: false });
		}
		const snap = await getStatusSnapshot(db, at(0));
		expect(snap.components.map((c) => c.status)).toEqual(['operational', 'operational']);
		expect(snap.stale).toBe(false);
		expect(snap.headline).toBe('All systems operational');
	});

	it('counts the round in the day, by confirmed status', async () => {
		const db = createSqliteD1();
		await rounds(db, 3, up);
		const row = await db
			.prepare(
				"SELECT checks, operational, degraded, down FROM status_daily WHERE component = 'website'"
			)
			.first();
		expect(row).toEqual({ checks: 3, operational: 3, degraded: 0, down: 0 });
	});

	it('treats a missing outside view as the website being up', async () => {
		const db = createSqliteD1();
		await rounds(db, 3, null);
		const snap = await getStatusSnapshot(db, at(2));
		expect(snap.components[0]).toMatchObject({ id: 'website', status: 'operational' });
	});

	it('measures the database itself', async () => {
		const db = createSqliteD1();
		const result = await recordStatus(db, { website: up }, at(0));
		expect(result.components.database.raw).toBe('operational');
		const snap = await getStatusSnapshot(db, at(0));
		expect(snap.components[1].latencyMs).not.toBeNull();
	});

	it('survives a check that throws: that component is down, the round still finishes', async () => {
		const db = createSqliteD1();
		const broken = brokenDatabase(db);
		const result = await recordStatus(broken, { website: up }, at(0));
		expect(result.components.database.raw).toBe('down');
		expect(result.components.website.raw).toBe('operational');
		const snap = await getStatusSnapshot(db, at(0));
		expect(snap.components[1].detail).toBe('The database did not answer.');
		// and the public sentence leaks nothing from the failure
		expect(JSON.stringify(snap)).not.toMatch(/boom|secret|connection/i);
	});
});

describe('confirming and incidents', () => {
	it('does not show one bad check', async () => {
		const db = createSqliteD1();
		await rounds(db, 3, up);
		await recordStatus(db, { website: down }, at(3));
		const snap = await getStatusSnapshot(db, at(3));
		expect(snap.components[0].status).toBe('operational');
		expect(snap.openIncidents).toEqual([]);
		// a good check after it clears the doubt
		await recordStatus(db, { website: up }, at(4));
		await recordStatus(db, { website: down }, at(5));
		expect((await getStatusSnapshot(db, at(5))).openIncidents).toEqual([]);
	});

	it('opens one incident when two checks in a row fail, dated to the first', async () => {
		const db = createSqliteD1();
		await rounds(db, 3, up);
		await recordStatus(db, { website: down }, at(3));
		const second = await recordStatus(db, { website: down }, at(4));
		expect(second.components.website).toMatchObject({ status: 'down', changed: true });
		const snap = await getStatusSnapshot(db, at(4));
		expect(snap.overall).toBe('down');
		expect(snap.headline).toBe('Some systems are down');
		expect(snap.openIncidents).toHaveLength(1);
		const incident = snap.openIncidents[0];
		expect(incident).toMatchObject({
			title: 'Website is unavailable',
			impact: 'major',
			status: 'investigating',
			components: ['website'],
			auto: true,
			startedAt: '2026-11-17 10:03:00'
		});
		expect(incident.updates[0].body).toContain(OPENING_NOTE);
		expect(incident.updates[0].byPerson).toBe(false);
		expect(snap.components[0]).toMatchObject({ since: '2026-11-17 10:03:00' });
	});

	it('keeps one incident however long it lasts, and resolves it when two checks pass', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		await rounds(db, 10, down, 2);
		expect((await getStatusSnapshot(db, at(12))).openIncidents).toHaveLength(1);

		await recordStatus(db, { website: up }, at(12));
		expect((await getStatusSnapshot(db, at(12))).openIncidents).toHaveLength(1); // not yet
		await recordStatus(db, { website: up }, at(13));
		const snap = await getStatusSnapshot(db, at(13));
		expect(snap.openIncidents).toEqual([]);
		expect(snap.recentIncidents).toHaveLength(1);
		expect(snap.recentIncidents[0]).toMatchObject({
			status: 'resolved',
			resolvedAt: '2026-11-17 10:13:00'
		});
		expect(snap.recentIncidents[0].updates[0]).toMatchObject({
			status: 'resolved',
			body: RESOLVED_NOTE
		});
		expect(snap.headline).toBe('All systems operational');
	});

	it('escalates the same incident from slow to down instead of opening a second', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		await rounds(db, 2, { ok: true, ms: 5000 }, 2);
		let snap = await getStatusSnapshot(db, at(4));
		expect(snap.openIncidents).toHaveLength(1);
		expect(snap.openIncidents[0]).toMatchObject({ title: 'Website is slow', impact: 'minor' });
		expect(snap.headline).toBe('Some systems are slow');

		await rounds(db, 2, down, 4);
		snap = await getStatusSnapshot(db, at(6));
		expect(snap.openIncidents).toHaveLength(1);
		expect(snap.openIncidents[0]).toMatchObject({
			title: 'Website is unavailable',
			impact: 'major'
		});
		expect(snap.openIncidents[0].updates[0].body).toMatch(/^It got worse\./);
	});

	it('opens a separate incident for each component', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		const broken = brokenDatabase(db);
		await recordStatus(broken, { website: down }, at(2));
		await recordStatus(broken, { website: down }, at(3));
		const snap = await getStatusSnapshot(db, at(3));
		expect(snap.openIncidents.map((i) => i.components[0]).sort()).toEqual(['database', 'website']);
	});

	it('counts the outage in the day and keeps uptime under 100', async () => {
		const db = createSqliteD1();
		await rounds(db, 4, up);
		await rounds(db, 3, down, 4);
		const snap = await getStatusSnapshot(db, at(7));
		const website = snap.components[0];
		expect(website.uptimePercent).toBeLessThan(100);
		expect(website.days).toHaveLength(HISTORY_DAYS);
		expect(website.days.at(-1)!.level).toBe('degraded'); // under five down checks in the day
	});
});

describe('when the checks stop', () => {
	it('says checks are delayed, not all clear, when none has ever run', async () => {
		const db = createSqliteD1();
		const snap = await getStatusSnapshot(db, at(0));
		expect(snap.stale).toBe(true);
		expect(snap.lastChecked).toBeNull();
		expect(snap.headline).toBe('Status checks are delayed');
	});

	it('says so when the newest check is older than five minutes, and not before', async () => {
		const db = createSqliteD1();
		await rounds(db, 3, up);
		const edge = at(2).getTime() + STALE_CHECK_SECONDS * 1000;
		expect((await getStatusSnapshot(db, new Date(edge))).stale).toBe(false);
		const late = await getStatusSnapshot(db, new Date(edge + 1000));
		expect(late.stale).toBe(true);
		expect(late.headline).toBe('Status checks are delayed');
	});

	it('says so when a listed component was never checked', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		await db.prepare("DELETE FROM status_components WHERE id = 'database'").run();
		expect((await getStatusSnapshot(db, at(1))).stale).toBe(true);
	});
});

describe('incidents from a person', () => {
	it('posts one, public at once, and takes updates that move the stage', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		const made = await createIncident(
			db,
			{
				title: '  Planned database maintenance ',
				impact: 'maintenance',
				status: 'monitoring',
				components: ['database', 'nonsense'],
				message: 'Tonight at 02:00 UTC.',
				by: 'u-owner'
			},
			at(2)
		);
		expect(made.ok).toBe(true);
		let snap = await getStatusSnapshot(db, at(2));
		expect(snap.openIncidents[0]).toMatchObject({
			title: 'Planned database maintenance',
			impact: 'maintenance',
			status: 'monitoring',
			components: ['database'],
			auto: false
		});
		expect(snap.openIncidents[0].updates[0]).toMatchObject({
			body: 'Tonight at 02:00 UTC.',
			byPerson: true
		});
		expect(snap.headline).toBe('Systems are running. An incident is being tracked.');

		const id = snap.openIncidents[0].id;
		const done = await addIncidentUpdate(
			db,
			{ incidentId: id, status: 'resolved', message: 'Done.', by: 'u-owner' },
			at(30)
		);
		expect(done.ok).toBe(true);
		snap = await getStatusSnapshot(db, at(30));
		expect(snap.openIncidents).toEqual([]);
		expect(snap.recentIncidents[0]).toMatchObject({
			status: 'resolved',
			resolvedAt: '2026-11-17 10:30:00'
		});
		expect(snap.recentIncidents[0].updates.map((u) => u.body)).toEqual([
			'Done.',
			'Tonight at 02:00 UTC.'
		]);
	});

	it('refuses an empty title or update, and an unknown incident', async () => {
		const db = createSqliteD1();
		expect(await createIncident(db, { title: '   ' })).toEqual({
			ok: false,
			error: 'Give the incident a title.'
		});
		expect(
			await addIncidentUpdate(db, { incidentId: 1, status: 'resolved', message: ' ' })
		).toMatchObject({
			ok: false,
			error: 'Write what changed.'
		});
		expect(
			await addIncidentUpdate(db, { incidentId: 999, status: 'resolved', message: 'x' })
		).toEqual({
			ok: false,
			error: 'That incident does not exist.'
		});
	});

	it('falls back to safe values for a bad impact or stage, and caps long text', async () => {
		const db = createSqliteD1();
		const made = await createIncident(db, {
			title: 'x'.repeat(500),
			impact: 'catastrophic',
			status: 'whatever',
			message: 'y'.repeat(5000)
		});
		expect(made.ok).toBe(true);
		const snap = await getStatusSnapshot(db);
		const incident = snap.openIncidents[0];
		expect(incident.title).toHaveLength(120);
		expect(incident).toMatchObject({ impact: 'minor', status: 'investigating' });
		expect(incident.updates[0].body).toHaveLength(2000);
	});

	it('does not let a check resolve an incident a person opened', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		await createIncident(db, { title: 'Provider outage', components: ['website'] }, at(2));
		await rounds(db, 4, up, 2); // checks stay healthy throughout
		const snap = await getStatusSnapshot(db, at(5));
		expect(snap.openIncidents).toHaveLength(1);
		expect(snap.openIncidents[0].auto).toBe(false);
	});

	it('does not let a person incident stop the checks opening their own', async () => {
		const db = createSqliteD1();
		await rounds(db, 2, up);
		await createIncident(db, { title: 'Provider outage', components: ['website'] }, at(2));
		await rounds(db, 2, down, 2);
		const snap = await getStatusSnapshot(db, at(4));
		expect(snap.openIncidents.map((i) => i.auto).sort()).toEqual([false, true]);
	});
});

describe('keeping history small', () => {
	it('deletes daily rows past the window once a day at 03:00 UTC, and only then', async () => {
		const db = createSqliteD1();
		const old = '2024-01-01';
		const keep = new Date(Date.parse('2026-11-17T00:00:00Z') - (KEEP_DAILY_DAYS - 10) * 86_400_000)
			.toISOString()
			.slice(0, 10);
		for (const day of [old, keep]) {
			await db
				.prepare(
					"INSERT INTO status_daily (component, day, checks, operational) VALUES ('website', ?, 5, 5)"
				)
				.bind(day)
				.run();
		}
		await recordStatus(db, { website: up }, new Date('2026-11-17T02:59:00Z'));
		expect(
			(await db
				.prepare('SELECT COUNT(*) AS n FROM status_daily WHERE day = ?')
				.bind(old)
				.first<{ n: number }>())!.n
		).toBe(1);
		await recordStatus(db, { website: up }, new Date('2026-11-17T03:00:00Z'));
		const days = (
			await db
				.prepare("SELECT day FROM status_daily WHERE component = 'website' ORDER BY day")
				.all<{ day: string }>()
		).results.map((r) => r.day);
		expect(days).not.toContain(old);
		expect(days).toContain(keep);
	});
});
