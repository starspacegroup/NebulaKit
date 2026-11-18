/**
 * The rules behind the public status page. Pure: no database, no clock of its own, so every
 * rule here can be tested directly. `src/lib/server/status.ts` applies them to D1.
 *
 * Ported from SpaceBot's status page, which has run this design in production: only measured
 * things are listed, a change needs two checks in a row, and a page whose checks stopped says
 * so instead of showing an all-clear.
 *
 * Times are SQL UTC strings ("2026-11-17 00:25:05"), the form D1 stores everywhere else.
 */

export type Status = 'operational' | 'degraded' | 'down';
export type Impact = 'minor' | 'major' | 'critical' | 'maintenance';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export const STATUSES: Status[] = ['operational', 'degraded', 'down'];
export const IMPACTS: Impact[] = ['minor', 'major', 'critical', 'maintenance'];
export const INCIDENT_STATUSES: IncidentStatus[] = [
	'investigating',
	'identified',
	'monitoring',
	'resolved'
];

export interface ComponentInfo {
	id: string;
	name: string;
	description: string;
}

/**
 * What the page lists, in order. Only things that are really measured belong here: a row with
 * no check behind it is a promise nobody is keeping.
 *
 * Every site gets these two. To add one (a payment provider, a search index), add it here, add
 * its check to `STATUS_CHECKS` in `src/lib/server/status-checks.ts`, and say what "down" means in
 * docs/STATUS_PAGE.md.
 */
export const COMPONENTS: ComponentInfo[] = [
	{
		id: 'website',
		name: 'Website',
		description: 'The public pages, the admin area and the API.'
	},
	{
		id: 'database',
		name: 'Database',
		description: 'Where this site keeps its content, accounts and orders.'
	}
];

export const COMPONENT_IDS = COMPONENTS.map((c) => c.id);

// --- reading one check ------------------------------------------------------------------

export interface Reading {
	status: Status;
	latencyMs: number | null;
	/** One plain sentence for the public page. Never an internal address or an error dump. */
	detail: string;
}

/** A page or query slower than this is "degraded", not "down". */
export const SLOW_WEBSITE_MS = 3000;
export const SLOW_DATABASE_MS = 1500;

/** What the outside probe saw of the website (the cron Worker fetches the ping route). */
export interface WebsiteProbe {
	ok: boolean;
	ms: number | null;
	httpStatus?: number | null;
}

export function readWebsite(probe: WebsiteProbe | null | undefined): Reading {
	if (!probe) {
		// No outside view this round, but the check itself just ran inside the site.
		return { status: 'operational', latencyMs: null, detail: 'Serving this page.' };
	}
	if (!probe.ok) {
		return {
			status: 'down',
			latencyMs: probe.ms ?? null,
			detail: 'The website did not answer a check from outside.'
		};
	}
	if ((probe.ms ?? 0) >= SLOW_WEBSITE_MS) {
		return { status: 'degraded', latencyMs: probe.ms, detail: 'The website is responding slowly.' };
	}
	return { status: 'operational', latencyMs: probe.ms, detail: 'Responding normally.' };
}

export function readDatabase(r: { ok: boolean; ms: number | null }): Reading {
	if (!r.ok) return { status: 'down', latencyMs: null, detail: 'The database did not answer.' };
	if ((r.ms ?? 0) >= SLOW_DATABASE_MS) {
		return { status: 'degraded', latencyMs: r.ms, detail: 'The database is responding slowly.' };
	}
	return { status: 'operational', latencyMs: r.ms, detail: 'Responding normally.' };
}

/** Seconds from a SQL UTC time to `now`. */
export function ageSeconds(sql: string, now: Date): number {
	const t = Date.parse(sql.replace(' ', 'T') + 'Z');
	return Number.isFinite(t) ? Math.max(0, Math.round((now.getTime() - t) / 1000)) : Infinity;
}

// --- turning checks into a confirmed status ---------------------------------------------

/** How many checks in a row must disagree before the page changes. One check a minute. */
export const CONFIRM_WORSE = 2;
export const CONFIRM_BETTER = 2;

export const severity = (s: Status) => STATUSES.indexOf(s);

export interface ComponentState {
	status: Status;
	/** When the confirmed status began (for a worsening, when the first bad check was seen). */
	since: string;
	pendingStatus: Status | null;
	pendingCount: number;
	pendingSince: string | null;
}

export interface Advance {
	state: ComponentState;
	changed: boolean;
	from: Status;
}

/**
 * Feed one check in. The confirmed status moves only when the same different status is seen
 * on enough checks in a row, so one failed probe or a 30-second blip never shows.
 */
export function advance(state: ComponentState, reading: Status, now: string): Advance {
	if (reading === state.status) {
		return {
			state: { ...state, pendingStatus: null, pendingCount: 0, pendingSince: null },
			changed: false,
			from: state.status
		};
	}
	const same = state.pendingStatus === reading;
	const count = same ? state.pendingCount + 1 : 1;
	const since = same ? (state.pendingSince ?? now) : now;
	const worse = severity(reading) > severity(state.status);
	const needed = worse ? CONFIRM_WORSE : CONFIRM_BETTER;
	if (count >= needed) {
		return {
			state: {
				status: reading,
				since: worse ? since : now,
				pendingStatus: null,
				pendingCount: 0,
				pendingSince: null
			},
			changed: true,
			from: state.status
		};
	}
	return {
		state: { ...state, pendingStatus: reading, pendingCount: count, pendingSince: since },
		changed: false,
		from: state.status
	};
}

/** The worst status wins. */
export function overall(statuses: Status[]): Status {
	return statuses.reduce<Status>((w, s) => (severity(s) > severity(w) ? s : w), 'operational');
}

export function overallHeadline(s: Status, anyOpenIncident: boolean): string {
	if (s === 'operational') {
		return anyOpenIncident
			? 'Systems are running. An incident is being tracked.'
			: 'All systems operational';
	}
	return s === 'degraded' ? 'Some systems are slow' : 'Some systems are down';
}

// --- daily history ----------------------------------------------------------------------

export interface DayCounts {
	day: string;
	checks: number;
	operational: number;
	degraded: number;
	down: number;
}

export type DayLevel = 'none' | 'operational' | 'degraded' | 'down';

/** A day is red after five checks (about five minutes) down; any other trouble is amber. */
export const DOWN_DAY_CHECKS = 5;

export function dayLevel(d: DayCounts | undefined): DayLevel {
	if (!d || d.checks <= 0) return 'none';
	if (d.down >= DOWN_DAY_CHECKS) return 'down';
	if (d.down > 0 || d.degraded > 0) return 'degraded';
	return 'operational';
}

/**
 * Share of checks that were not "down", cut (never rounded up) to two decimals, so a day with
 * an outage cannot show 100.00%. Null when there is nothing to count.
 */
export function uptimePercent(days: DayCounts[]): number | null {
	let checks = 0;
	let down = 0;
	for (const d of days) {
		checks += d.checks;
		down += d.down;
	}
	if (checks <= 0) return null;
	const pct = ((checks - down) / checks) * 100;
	const cut = Math.floor(pct * 100) / 100;
	return down > 0 && cut >= 100 ? 99.99 : cut;
}

/** The UTC day, as the rollup stores it. */
export const dayOf = (sql: string) => sql.slice(0, 10);

/** The last `count` UTC days ending on `today`, oldest first. */
export function lastDays(today: string, count: number): string[] {
	const end = Date.parse(today + 'T00:00:00Z');
	const out: string[] = [];
	for (let i = count - 1; i >= 0; i--) {
		out.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
	}
	return out;
}

// --- incidents the checks open and close ------------------------------------------------

const NAME = Object.fromEntries(COMPONENTS.map((c) => [c.id, c.name])) as Record<string, string>;

export function componentName(id: string): string {
	return NAME[id] ?? id;
}

export function autoIncidentTitle(component: string, status: Status): string {
	const name = componentName(component);
	return status === 'down' ? `${name} is unavailable` : `${name} is slow`;
}

export const autoImpact = (status: Status): Impact => (status === 'down' ? 'major' : 'minor');

export const OPENING_NOTE =
	'Our automatic checks found a problem. We are looking into it. This update was posted by the checks, not by a person.';
export const RESOLVED_NOTE =
	'The automatic checks are passing again, so this is marked resolved. A person may add more detail below.';

export function parseComponents(json: string | null | undefined): string[] {
	try {
		const v = JSON.parse(json || '[]');
		return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

/** Strip control characters, trim, and cap a piece of text a person typed. */
export function cleanText(raw: unknown, max: number): string {
	return String(raw ?? '')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.trim()
		.slice(0, max);
}
