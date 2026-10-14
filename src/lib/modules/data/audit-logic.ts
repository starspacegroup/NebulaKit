/** Audit log: severities, filtering events and showing their details. */
import { toCsv } from './logic';
import { absoluteTimeText, dayKey, isoString } from './time-logic';

export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical';

export interface AuditEvent {
	id: string;
	/** ISO timestamp. */
	at: string;
	actor: string;
	action: string;
	target?: string;
	severity: AuditSeverity;
	ip?: string;
	details?: unknown;
}

export const AUDIT_SEVERITIES: readonly AuditSeverity[] = ['info', 'notice', 'warning', 'critical'];

const RANK: Record<AuditSeverity, number> = { info: 0, notice: 1, warning: 2, critical: 3 };

export function severityRank(severity: AuditSeverity): number {
	return RANK[severity];
}

export const SEVERITY_LABELS: Record<AuditSeverity, string> = {
	info: 'Info',
	notice: 'Notice',
	warning: 'Warning',
	critical: 'Critical'
};

// prettier-ignore
export function severityTone(severity: AuditSeverity): 'neutral' | 'info' | 'warning' | 'danger' {
	return { info: 'neutral', notice: 'info', warning: 'warning', critical: 'danger' }[severity] as
		'neutral' | 'info' | 'warning' | 'danger';
}

export interface AuditFilter {
	query?: string;
	/** Show only these severities; empty means all. */
	severities?: readonly AuditSeverity[];
	/** Show at least this severity. */
	minSeverity?: AuditSeverity;
	actor?: string;
	/** `YYYY-MM-DD`, inclusive, in `timeZone`. */
	from?: string;
	to?: string;
	timeZone?: string;
}

/** Events that pass every set filter, newest first. */
export function filterEvents(events: readonly AuditEvent[], f: AuditFilter): AuditEvent[] {
	const terms = (f.query ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	return events
		.filter((e) => {
			if (f.severities?.length && !f.severities.includes(e.severity)) return false;
			if (f.minSeverity && severityRank(e.severity) < severityRank(f.minSeverity)) return false;
			if (f.actor && e.actor !== f.actor) return false;
			const day = dayKey(e.at, f.timeZone ?? 'UTC');
			if (f.from && day < f.from) return false;
			if (f.to && day > f.to) return false;
			if (terms.length) {
				const hay = [e.actor, e.action, e.target, e.ip, e.severity, detailText(e.details)]
					.join('\n')
					.toLocaleLowerCase();
				return terms.every((t) => hay.includes(t));
			}
			return true;
		})
		.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function detailText(details: unknown): string {
	if (details === undefined || details === null) return '';
	return typeof details === 'string' ? details : JSON.stringify(details);
}

/** Pretty JSON for the expandable details; strings pass through, unserialisable values say so. */
export function prettyJson(details: unknown): string {
	if (details === undefined) return '';
	if (typeof details === 'string') return details;
	try {
		return JSON.stringify(details, null, 2) ?? '';
	} catch {
		return '[unserializable]';
	}
}

export function distinctActors(events: readonly AuditEvent[]): string[] {
	return [...new Set(events.map((e) => e.actor))].sort((a, b) => a.localeCompare(b));
}

/** CSV of the events, with ISO timestamps and flat JSON details. */
export function eventsToCsv(events: readonly AuditEvent[]): string {
	const rows = events.map((e) => ({
		at: isoString(e.at),
		severity: e.severity,
		actor: e.actor,
		action: e.action,
		target: e.target ?? '',
		ip: e.ip ?? '',
		details: detailText(e.details)
	}));
	return toCsv(rows, [
		{ key: 'at', label: 'Time' },
		{ key: 'severity', label: 'Severity' },
		{ key: 'actor', label: 'Actor' },
		{ key: 'action', label: 'Action' },
		{ key: 'target', label: 'Target' },
		{ key: 'ip', label: 'IP' },
		{ key: 'details', label: 'Details' }
	]);
}

export function eventTime(e: AuditEvent, locale = 'en-US', timeZone = 'UTC'): string {
	return absoluteTimeText(e.at, { locale, timeZone });
}
