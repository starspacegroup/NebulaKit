import { describe, expect, it } from 'vitest';
import {
	absoluteTimeText,
	clockTimeText,
	dayDiff,
	dayHeading,
	dayKey,
	groupByDay,
	isValidDateInput,
	isoString,
	relativeTimeText,
	toDateValue
} from './time-logic';

const NOW = '2026-10-13T15:00:00Z';

describe('dayKey', () => {
	it('uses the time zone', () => {
		expect(dayKey('2026-10-13T02:00:00Z', 'UTC')).toBe('2026-10-13');
		expect(dayKey('2026-10-13T02:00:00Z', 'America/Phoenix')).toBe('2026-10-12');
		expect(dayKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
	});
	it('counts days between keys', () => {
		expect(dayDiff('2026-10-13', '2026-10-12')).toBe(-1);
		expect(dayDiff('2026-10-13', '2026-10-13')).toBe(0);
		expect(dayDiff('2026-02-27', '2026-03-02')).toBe(3);
	});
});

describe('dates', () => {
	it('converts and validates', () => {
		expect(toDateValue(0).getTime()).toBe(0);
		const d = new Date(5);
		expect(toDateValue(d)).toBe(d);
		expect(isValidDateInput('nope')).toBe(false);
		expect(isValidDateInput(NOW)).toBe(true);
		expect(isoString('2026-10-13T15:00:00Z')).toBe('2026-10-13T15:00:00.000Z');
	});
});

describe('dayHeading', () => {
	it('names today and yesterday, with translatable labels', () => {
		expect(dayHeading('2026-10-13', NOW)).toBe('Today');
		expect(dayHeading('2026-10-12', NOW)).toBe('Yesterday');
		expect(dayHeading('2026-10-13', NOW, { labels: { today: 'Hoy', yesterday: 'Ayer' } })).toBe(
			'Hoy'
		);
	});
	it('writes other days, with the year only when it differs', () => {
		expect(dayHeading('2026-10-06', NOW)).toBe('Tuesday, October 6');
		expect(dayHeading('2025-12-31', NOW)).toBe('Wednesday, December 31, 2025');
		expect(dayHeading('2026-10-06', NOW, { locale: 'de-DE' })).toContain('Oktober');
	});
	it('honours the zone for "today"', () => {
		expect(dayHeading('2026-10-12', '2026-10-13T02:00:00Z', { timeZone: 'America/Phoenix' })).toBe(
			'Today'
		);
	});
});

describe('groupByDay', () => {
	const items = [
		{ id: 'a', at: '2026-10-13T09:00:00Z' },
		{ id: 'b', at: '2026-10-13T14:00:00Z' },
		{ id: 'c', at: '2026-10-12T23:00:00Z' },
		{ id: 'd', at: 'garbage' },
		{ id: 'e', at: '2026-10-01T10:00:00Z' },
		{ id: 'f', at: '2026-10-13T14:00:00Z' }
	];
	it('groups newest day first, newest item first, skipping bad dates', () => {
		const g = groupByDay(items, (i) => i.at, NOW);
		expect(g.map((x) => x.label)).toEqual(['Today', 'Yesterday', 'Thursday, October 1']);
		expect(g[0].items.map((i) => i.id)).toEqual(['b', 'f', 'a']);
		expect(g.flatMap((x) => x.items).some((i) => i.id === 'd')).toBe(false);
	});
	it('splits by zone', () => {
		const g = groupByDay(items, (i) => i.at, NOW, { timeZone: 'America/Phoenix' });
		expect(g[0].key).toBe('2026-10-13');
		expect(groupByDay([], (i: { at: string }) => i.at, NOW)).toEqual([]);
	});
});

describe('relativeTimeText', () => {
	const rel = (iso: string) => relativeTimeText(iso, NOW);
	it('says just now inside 45 seconds either way', () => {
		expect(rel('2026-10-13T14:59:30Z')).toBe('just now');
		expect(rel('2026-10-13T15:00:20Z')).toBe('just now');
		expect(relativeTimeText(NOW, NOW, { justNow: 'ahora' })).toBe('ahora');
	});
	it('picks the largest fitting unit', () => {
		expect(rel('2026-10-13T14:58:00Z')).toBe('2 minutes ago');
		expect(rel('2026-10-13T14:59:00Z')).toBe('1 minute ago');
		expect(rel('2026-10-13T12:00:00Z')).toBe('3 hours ago');
		expect(rel('2026-10-12T15:00:00Z')).toBe('yesterday');
		expect(rel('2026-10-06T15:00:00Z')).toBe('last week');
		expect(rel('2026-08-13T15:00:00Z')).toBe('2 months ago');
		expect(rel('2024-10-13T15:00:00Z')).toBe('2 years ago');
		expect(rel('2026-10-13T17:00:00Z')).toBe('in 2 hours');
	});
	it('rounds a sub-minute-but-over-45s gap up to a minute', () => {
		expect(rel('2026-10-13T14:59:10Z')).toBe('1 minute ago');
	});
	it('rounds a sub-minute future gap up to a minute too', () => {
		expect(rel('2026-10-13T15:00:50Z')).toBe('in 1 minute');
	});
	it('localises', () => {
		expect(relativeTimeText('2026-10-13T12:00:00Z', NOW, { locale: 'es' })).toContain('3');
	});
});

describe('absolute times', () => {
	it('formats date and time in the zone', () => {
		expect(absoluteTimeText(NOW)).toBe('Oct 13, 2026, 3:00 PM');
		expect(absoluteTimeText(NOW, { timeZone: 'America/Phoenix' })).toBe('Oct 13, 2026, 8:00 AM');
		expect(clockTimeText(NOW)).toBe('3:00 PM');
		expect(clockTimeText(NOW, { locale: 'de-DE', timeZone: 'Europe/Berlin' })).toContain('17:00');
	});
});
