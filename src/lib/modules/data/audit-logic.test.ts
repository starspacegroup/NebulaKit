import { describe, expect, it } from 'vitest';
import {
	AUDIT_SEVERITIES,
	SEVERITY_LABELS,
	distinctActors,
	eventTime,
	eventsToCsv,
	filterEvents,
	prettyJson,
	severityRank,
	severityTone,
	type AuditEvent
} from './audit-logic';

const events: AuditEvent[] = [
	{
		id: '1',
		at: '2026-10-10T10:00:00Z',
		actor: 'ada',
		action: 'user.login',
		severity: 'info',
		ip: '10.0.0.1'
	},
	{
		id: '2',
		at: '2026-10-12T09:00:00Z',
		actor: 'alan',
		action: 'role.change',
		target: 'grace',
		severity: 'warning',
		details: { from: 'member', to: 'admin' }
	},
	{
		id: '3',
		at: '2026-10-13T23:30:00Z',
		actor: 'ada',
		action: 'key.delete',
		severity: 'critical',
		details: 'revoked all'
	},
	{ id: '4', at: '2026-10-11T12:00:00Z', actor: 'zed', action: 'export', severity: 'notice' }
];

describe('severity', () => {
	it('ranks, labels and tones every level', () => {
		expect(AUDIT_SEVERITIES.map(severityRank)).toEqual([0, 1, 2, 3]);
		expect(AUDIT_SEVERITIES.map(severityTone)).toEqual(['neutral', 'info', 'warning', 'danger']);
		expect(SEVERITY_LABELS.critical).toBe('Critical');
	});
});

describe('filterEvents', () => {
	const ids = (f: Parameters<typeof filterEvents>[1]) => filterEvents(events, f).map((e) => e.id);
	it('sorts newest first with no filters', () => {
		expect(ids({})).toEqual(['3', '2', '4', '1']);
	});
	it('filters by severities and minimum', () => {
		expect(ids({ severities: ['info', 'critical'] })).toEqual(['3', '1']);
		expect(ids({ severities: [] })).toHaveLength(4);
		expect(ids({ minSeverity: 'warning' })).toEqual(['3', '2']);
	});
	it('filters by actor and date range in the zone', () => {
		expect(ids({ actor: 'ada' })).toEqual(['3', '1']);
		expect(ids({ from: '2026-10-11', to: '2026-10-12' })).toEqual(['2', '4']);
		expect(ids({ from: '2026-10-14' })).toEqual([]);
		expect(ids({ to: '2026-10-13', timeZone: 'America/Phoenix' })).toEqual(['3', '2', '4', '1']);
		expect(ids({ from: '2026-10-14', timeZone: 'Asia/Tokyo' })).toEqual(['3']);
	});
	it('searches every field, including details', () => {
		expect(ids({ query: 'grace' })).toEqual(['2']);
		expect(ids({ query: 'admin member' })).toEqual(['2']);
		expect(ids({ query: 'revoked' })).toEqual(['3']);
		expect(ids({ query: '10.0.0.1' })).toEqual(['1']);
		expect(ids({ query: 'CRITICAL' })).toEqual(['3']);
		expect(ids({ query: 'nothing here' })).toEqual([]);
		expect(ids({ query: '  ' })).toHaveLength(4);
	});
});

describe('helpers', () => {
	it('pretty-prints details', () => {
		expect(prettyJson(undefined)).toBe('');
		expect(prettyJson('plain')).toBe('plain');
		expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
		const loop: Record<string, unknown> = {};
		loop.self = loop;
		expect(prettyJson(loop)).toBe('[unserializable]');
		expect(prettyJson(() => 1)).toBe('');
	});
	it('lists distinct actors sorted', () => {
		expect(distinctActors(events)).toEqual(['ada', 'alan', 'zed']);
	});
	it('exports CSV with ISO times and flat details', () => {
		const csv = eventsToCsv([events[1], events[0]]);
		const lines = csv.split('\r\n');
		expect(lines[0]).toBe('Time,Severity,Actor,Action,Target,IP,Details');
		expect(lines[1]).toBe(
			'2026-10-12T09:00:00.000Z,warning,alan,role.change,grace,,"{""from"":""member"",""to"":""admin""}"'
		);
		expect(lines[2]).toBe('2026-10-10T10:00:00.000Z,info,ada,user.login,,10.0.0.1,');
	});
	it('formats the event time', () => {
		expect(eventTime(events[0])).toBe('Oct 10, 2026, 10:00 AM');
		expect(eventTime(events[0], 'en-US', 'America/Phoenix')).toBe('Oct 10, 2026, 3:00 AM');
	});
});
