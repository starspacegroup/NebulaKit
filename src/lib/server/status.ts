/**
 * The public status page, on D1: record one round of checks, open and close the incidents the
 * checks find, take incidents from a person, and read it all back for the page and the feed.
 * The rules (what counts as down, how many checks confirm a change) are in
 * `$lib/status/logic.ts`; what is measured is in `./status-checks.ts`.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { deleteInBatches } from './bounded-delete';
import { STATUS_CHECKS } from './status-checks';
import {
	COMPONENTS,
	COMPONENT_IDS,
	IMPACTS,
	INCIDENT_STATUSES,
	OPENING_NOTE,
	RESOLVED_NOTE,
	advance,
	autoImpact,
	autoIncidentTitle,
	cleanText,
	dayLevel,
	dayOf,
	lastDays,
	overall,
	overallHeadline,
	parseComponents,
	uptimePercent,
	type ComponentState,
	type DayCounts,
	type Impact,
	type IncidentStatus,
	type Reading,
	type Status,
	type WebsiteProbe
} from '$lib/status/logic';

type Row = Record<string, unknown>;

const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export const HISTORY_DAYS = 90;
/** The page says checks are late when the newest one is older than this. */
export const STALE_CHECK_SECONDS = 300;
export const KEEP_DAILY_DAYS = 400;
const RECENT_INCIDENT_DAYS = 30;

// --- recording --------------------------------------------------------------------------

async function openAutoIncident(db: D1Database, component: string) {
	return db
		.prepare(
			`SELECT id, impact, title FROM status_incidents
			  WHERE auto = 1 AND resolved_at IS NULL AND components LIKE ?
			  ORDER BY id DESC LIMIT 1`
		)
		.bind(`%"${component}"%`)
		.first<{ id: number; impact: string; title: string }>();
}

async function addUpdate(
	db: D1Database,
	incidentId: number,
	status: IncidentStatus,
	body: string,
	at: string,
	by: string | null
) {
	await db
		.prepare(
			`INSERT INTO status_incident_updates (incident_id, status, body, created_at, created_by)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(incidentId, status, body, at, by)
		.run();
}

/** The checks changed a component's confirmed status: open, change or close its incident. */
async function followIncident(
	db: D1Database,
	component: string,
	from: Status,
	to: Status,
	since: string,
	detail: string,
	now: string
) {
	const open = await openAutoIncident(db, component);
	if (to === 'operational') {
		if (!open) return;
		await db
			.prepare(`UPDATE status_incidents SET status = 'resolved', resolved_at = ? WHERE id = ?`)
			.bind(now, open.id)
			.run();
		await addUpdate(db, open.id, 'resolved', RESOLVED_NOTE, now, null);
		return;
	}
	const title = autoIncidentTitle(component, to);
	const impact = autoImpact(to);
	if (!open) {
		const res = await db
			.prepare(
				`INSERT INTO status_incidents (title, impact, status, components, auto, started_at)
				 VALUES (?, ?, 'investigating', ?, 1, ?)`
			)
			.bind(title, impact, JSON.stringify([component]), since)
			.run();
		const id = Number(res.meta?.last_row_id);
		if (id) {
			await addUpdate(db, id, 'investigating', `${OPENING_NOTE} ${detail}`.trim(), now, null);
		}
		return;
	}
	if (from !== to) {
		await db
			.prepare(`UPDATE status_incidents SET title = ?, impact = ? WHERE id = ?`)
			.bind(title, impact, open.id)
			.run();
		await addUpdate(
			db,
			open.id,
			'investigating',
			to === 'down' ? `It got worse. ${detail}`.trim() : `Partly recovered. ${detail}`.trim(),
			now,
			null
		);
	}
}

async function loadState(db: D1Database, id: string, now: string): Promise<ComponentState> {
	const row = await db
		.prepare(
			`SELECT status, since, pending_status, pending_count, pending_since
			   FROM status_components WHERE id = ?`
		)
		.bind(id)
		.first<Row>();
	if (!row) {
		return {
			status: 'operational',
			since: now,
			pendingStatus: null,
			pendingCount: 0,
			pendingSince: null
		};
	}
	return {
		status: row.status as Status,
		since: row.since as string,
		pendingStatus: (row.pending_status as Status | null) ?? null,
		pendingCount: Number(row.pending_count) || 0,
		pendingSince: (row.pending_since as string | null) ?? null
	};
}

export interface RecordResult {
	checkedAt: string;
	components: Record<string, { status: Status; raw: Status; changed: boolean }>;
}

/**
 * One round of checks, once a minute. `website` is what an outside probe saw (the cron
 * Worker); when it is missing the website counts as up, because the check just ran inside it.
 * A check that throws counts as a down component, never as a failed round: the round is the
 * one thing that must finish, since its absence is what tells the page the checks stopped.
 */
export async function recordStatus(
	db: D1Database,
	input: { website?: WebsiteProbe | null } = {},
	now: Date = new Date()
): Promise<RecordResult> {
	const at = sqlTime(now);
	const ctx = { db, website: input.website ?? null };

	const result: RecordResult['components'] = {};
	for (const id of COMPONENT_IDS) {
		let reading: Reading;
		try {
			const check = STATUS_CHECKS[id];
			reading = check
				? await check(ctx)
				: { status: 'down', latencyMs: null, detail: 'This check is not set up.' };
		} catch {
			reading = { status: 'down', latencyMs: null, detail: 'This check could not run.' };
		}
		const before = await loadState(db, id, at);
		const step = advance(before, reading.status, at);
		const s = step.state;
		await db
			.prepare(
				`INSERT INTO status_components
				   (id, status, since, last_checked, latency_ms, detail, pending_status, pending_count, pending_since)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET
				   status = excluded.status, since = excluded.since, last_checked = excluded.last_checked,
				   latency_ms = excluded.latency_ms, detail = excluded.detail,
				   pending_status = excluded.pending_status, pending_count = excluded.pending_count,
				   pending_since = excluded.pending_since`
			)
			.bind(
				id,
				s.status,
				s.since,
				at,
				reading.latencyMs,
				reading.detail,
				s.pendingStatus,
				s.pendingCount,
				s.pendingSince
			)
			.run();
		// The column name comes from the fixed status set, never from input.
		const column = s.status;
		await db
			.prepare(
				`INSERT INTO status_daily (component, day, checks, ${column})
				 VALUES (?, ?, 1, 1)
				 ON CONFLICT(component, day) DO UPDATE SET
				   checks = checks + 1, ${column} = ${column} + 1`
			)
			.bind(id, dayOf(at))
			.run();
		if (step.changed) {
			await followIncident(db, id, step.from, s.status, s.since, reading.detail, at);
		}
		result[id] = { status: s.status, raw: reading.status, changed: step.changed };
	}

	// Once a day, drop history older than the page can show. In bounded batches, like every
	// retention delete here.
	if (now.getUTCHours() === 3 && now.getUTCMinutes() === 0) {
		const cutoff = dayOf(sqlTime(new Date(now.getTime() - KEEP_DAILY_DAYS * 86_400_000)));
		await deleteInBatches(db, { table: 'status_daily', where: 'day < ?', binds: [cutoff] });
	}
	return { checkedAt: at, components: result };
}

// --- incidents from a person ------------------------------------------------------------

const asImpact = (v: unknown): Impact =>
	(IMPACTS as string[]).includes(String(v)) ? (v as Impact) : 'minor';
const asIncidentStatus = (v: unknown): IncidentStatus =>
	(INCIDENT_STATUSES as string[]).includes(String(v)) ? (v as IncidentStatus) : 'investigating';

export interface NewIncident {
	title: string;
	impact?: string;
	status?: string;
	components?: string[];
	message?: string;
	by?: string | null;
}

export async function createIncident(db: D1Database, input: NewIncident, now: Date = new Date()) {
	const title = cleanText(input.title, 120);
	if (!title) return { ok: false as const, error: 'Give the incident a title.' };
	const status = asIncidentStatus(input.status);
	const components = (input.components ?? []).filter((c) => COMPONENT_IDS.includes(c));
	const at = sqlTime(now);
	const res = await db
		.prepare(
			`INSERT INTO status_incidents (title, impact, status, components, auto, started_at, resolved_at, created_by)
			 VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
		)
		.bind(
			title,
			asImpact(input.impact),
			status,
			JSON.stringify(components),
			at,
			status === 'resolved' ? at : null,
			input.by ?? null
		)
		.run();
	const id = Number(res.meta?.last_row_id);
	const message = cleanText(input.message, 2000) || 'We are looking into this.';
	await addUpdate(db, id, status, message, at, input.by ?? null);
	return { ok: true as const, id };
}

export async function addIncidentUpdate(
	db: D1Database,
	input: { incidentId: number; status: string; message: string; by?: string | null },
	now: Date = new Date()
) {
	const message = cleanText(input.message, 2000);
	if (!message) return { ok: false as const, error: 'Write what changed.' };
	const incident = await db
		.prepare(`SELECT id FROM status_incidents WHERE id = ?`)
		.bind(input.incidentId)
		.first();
	if (!incident) return { ok: false as const, error: 'That incident does not exist.' };
	const status = asIncidentStatus(input.status);
	const at = sqlTime(now);
	await db
		.prepare(`UPDATE status_incidents SET status = ?, resolved_at = ? WHERE id = ?`)
		.bind(status, status === 'resolved' ? at : null, input.incidentId)
		.run();
	await addUpdate(db, input.incidentId, status, message, at, input.by ?? null);
	return { ok: true as const };
}

// --- reading it back --------------------------------------------------------------------

export interface IncidentUpdate {
	id: number;
	status: IncidentStatus;
	body: string;
	createdAt: string;
	byPerson: boolean;
}

export interface Incident {
	id: number;
	title: string;
	impact: Impact;
	status: IncidentStatus;
	components: string[];
	auto: boolean;
	startedAt: string;
	resolvedAt: string | null;
	updates: IncidentUpdate[];
}

async function loadIncidents(db: D1Database, where: string, bind: unknown[], limit: number) {
	const { results: rows } = await db
		.prepare(
			`SELECT id, title, impact, status, components, auto, started_at, resolved_at
			   FROM status_incidents WHERE ${where} ORDER BY started_at DESC, id DESC LIMIT ?`
		)
		.bind(...bind, limit)
		.all<Row>();
	if (!rows.length) return [] as Incident[];
	const ids = rows.map((r) => r.id as number);
	const { results: updates } = await db
		.prepare(
			`SELECT id, incident_id, status, body, created_at, created_by
			   FROM status_incident_updates
			  WHERE incident_id IN (${ids.map(() => '?').join(',')})
			  ORDER BY id DESC`
		)
		.bind(...ids)
		.all<Row>();
	return rows.map((r): Incident => ({
		id: r.id as number,
		title: r.title as string,
		impact: r.impact as Impact,
		status: r.status as IncidentStatus,
		components: parseComponents(r.components as string),
		auto: Boolean(r.auto),
		startedAt: r.started_at as string,
		resolvedAt: (r.resolved_at as string | null) ?? null,
		updates: updates
			.filter((u) => u.incident_id === r.id)
			.map((u) => ({
				id: u.id as number,
				status: u.status as IncidentStatus,
				body: u.body as string,
				createdAt: u.created_at as string,
				byPerson: Boolean(u.created_by)
			}))
	}));
}

export interface ComponentView {
	id: string;
	name: string;
	description: string;
	status: Status;
	since: string | null;
	detail: string | null;
	latencyMs: number | null;
	uptimePercent: number | null;
	days: { day: string; level: ReturnType<typeof dayLevel> }[];
}

export interface StatusSnapshot {
	generatedAt: string;
	overall: Status;
	headline: string;
	/** True when no check has run lately: the page must not claim everything is fine. */
	stale: boolean;
	lastChecked: string | null;
	components: ComponentView[];
	openIncidents: Incident[];
	recentIncidents: Incident[];
}

export async function getStatusSnapshot(
	db: D1Database,
	now: Date = new Date()
): Promise<StatusSnapshot> {
	const at = sqlTime(now);
	const days = lastDays(dayOf(at), HISTORY_DAYS);

	const [compRows, dayRows, open, recent] = await Promise.all([
		db
			.prepare(`SELECT id, status, since, last_checked, latency_ms, detail FROM status_components`)
			.all<Row>(),
		db
			.prepare(
				`SELECT component, day, checks, operational, degraded, down
				   FROM status_daily WHERE day >= ?`
			)
			.bind(days[0])
			.all<Row>(),
		loadIncidents(db, `resolved_at IS NULL`, [], 20),
		loadIncidents(
			db,
			`resolved_at IS NOT NULL AND resolved_at >= ?`,
			[sqlTime(new Date(now.getTime() - RECENT_INCIDENT_DAYS * 86_400_000))],
			30
		)
	]);

	const stateById = new Map<string, Row>(compRows.results.map((r) => [r.id as string, r]));
	const byComponent = new Map<string, Map<string, DayCounts>>();
	for (const r of dayRows.results) {
		const component = r.component as string;
		if (!byComponent.has(component)) byComponent.set(component, new Map());
		byComponent.get(component)!.set(r.day as string, {
			day: r.day as string,
			checks: Number(r.checks),
			operational: Number(r.operational),
			degraded: Number(r.degraded),
			down: Number(r.down)
		});
	}

	const components: ComponentView[] = COMPONENTS.map((c) => {
		const state = stateById.get(c.id);
		const counts = byComponent.get(c.id) ?? new Map<string, DayCounts>();
		return {
			id: c.id,
			name: c.name,
			description: c.description,
			status: (state?.status as Status) ?? 'operational',
			since: (state?.since as string | null) ?? null,
			detail: (state?.detail as string | null) ?? null,
			latencyMs: state?.latency_ms == null ? null : Number(state.latency_ms),
			uptimePercent: uptimePercent([...counts.values()]),
			days: days.map((day) => ({ day, level: dayLevel(counts.get(day)) }))
		};
	});

	const checkedTimes = components
		.map((c) => stateById.get(c.id)?.last_checked as string | undefined)
		.filter((t): t is string => Boolean(t));
	// Every listed component must have been checked, or the page cannot vouch for all of them.
	const lastChecked = checkedTimes.length === COMPONENTS.length ? checkedTimes.sort()[0] : null;
	const stale =
		!lastChecked ||
		now.getTime() - Date.parse(lastChecked.replace(' ', 'T') + 'Z') > STALE_CHECK_SECONDS * 1000;

	const worst = overall(components.map((c) => c.status));
	return {
		generatedAt: at,
		overall: worst,
		headline: stale ? 'Status checks are delayed' : overallHeadline(worst, open.length > 0),
		stale,
		lastChecked,
		components,
		openIncidents: open,
		recentIncidents: recent
	};
}
