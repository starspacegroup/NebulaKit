import { describe, expect, it } from 'vitest';
import {
	addCalendarEvent,
	addDayKey,
	addMonthKey,
	dayCellLabel,
	dayLabelLong,
	eventsInMonth,
	eventsOn,
	formatDayKey,
	monthGrid,
	monthLabel,
	moveDayFocus,
	parseDayKey,
	removeCalendarEvent,
	sameMonthKey,
	startOfMonthKey,
	timeRange,
	updateCalendarEvent,
	validateEvent,
	weekdayNames,
	weekdayOfKey,
	type CalendarEvent
} from './calendar-logic';

describe('day keys', () => {
	it('parses and rejects', () => {
		expect(parseDayKey('2026-10-13')).toEqual({ y: 2026, m: 10, d: 13 });
		expect(parseDayKey('2026-02-30')).toBeNull();
		expect(parseDayKey('2026-13-01')).toBeNull();
		expect(parseDayKey('2026-1-1')).toBeNull();
		expect(parseDayKey('')).toBeNull();
		expect(parseDayKey('2024-02-29')).not.toBeNull();
		expect(parseDayKey('2025-02-29')).toBeNull();
	});
	it('formats with padding', () => {
		expect(formatDayKey(2026, 3, 4)).toBe('2026-03-04');
		expect(formatDayKey(12, 1, 1)).toBe('0012-01-01');
	});
	it('adds days across boundaries', () => {
		expect(addDayKey('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDayKey('2026-01-01', -1)).toBe('2025-12-31');
		expect(addDayKey('2024-02-28', 2)).toBe('2024-03-01');
		expect(addDayKey('garbage', 1)).toBe('1970-01-02');
	});
	it('adds months, clamping the day', () => {
		expect(addMonthKey('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonthKey('2024-01-31', 1)).toBe('2024-02-29');
		expect(addMonthKey('2026-12-15', 1)).toBe('2027-01-15');
		expect(addMonthKey('2026-01-15', -1)).toBe('2025-12-15');
		expect(addMonthKey('2026-03-15', -14)).toBe('2025-01-15');
		expect(addMonthKey('bad', 1)).toBe('1970-02-01');
	});
	it('knows weekdays and months', () => {
		expect(weekdayOfKey('2026-10-13')).toBe(2);
		expect(startOfMonthKey('2026-10-13')).toBe('2026-10-01');
		expect(startOfMonthKey('bad')).toBe('1970-01-01');
		expect(sameMonthKey('2026-10-01', '2026-10-31')).toBe(true);
		expect(sameMonthKey('2026-10-01', '2025-10-01')).toBe(false);
	});
});

describe('monthGrid', () => {
	it('draws complete weeks starting on Sunday', () => {
		const g = monthGrid('2026-10-13');
		expect(g).toHaveLength(5);
		expect(g.every((w) => w.length === 7)).toBe(true);
		expect(g[0][0].key).toBe('2026-09-27');
		expect(g[0][4]).toMatchObject({ key: '2026-10-01', day: 1, inMonth: true, weekday: 4 });
		expect(g[0][0].inMonth).toBe(false);
		expect(g[4][6].key).toBe('2026-10-31');
	});
	it('honours a Monday start', () => {
		const g = monthGrid('2026-10-13', 1);
		expect(g[0][0].key).toBe('2026-09-28');
		expect(g[0][0].weekday).toBe(1);
	});
	it('adds a sixth week when needed and a fourth when it fits', () => {
		expect(monthGrid('2026-05-01')).toHaveLength(6);
		expect(monthGrid('2026-02-01')).toHaveLength(4);
	});
	it('names weekdays from the start day', () => {
		expect(weekdayNames()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
		expect(weekdayNames(1, 'en-US', 'long')[0]).toBe('Monday');
		expect(weekdayNames(6, 'en-US', 'narrow')).toHaveLength(7);
	});
});

describe('labels', () => {
	it('words months and days', () => {
		expect(monthLabel('2026-10-13')).toBe('October 2026');
		expect(dayLabelLong('2026-10-13')).toBe('Tuesday, October 13, 2026');
		expect(dayCellLabel('2026-10-13', 0)).toBe('Tuesday, October 13, 2026');
		expect(dayCellLabel('2026-10-13', 1)).toBe('Tuesday, October 13, 2026, 1 event');
		expect(dayCellLabel('2026-10-13', 3)).toContain('3 events');
		expect(monthLabel('2026-10-13', 'de-DE')).toBe('Oktober 2026');
	});
	it('words time ranges', () => {
		expect(timeRange({})).toBe('All day');
		expect(timeRange({}, 'Todo el día')).toBe('Todo el día');
		expect(timeRange({ start: '09:00' })).toBe('09:00');
		expect(timeRange({ start: '09:00', end: '10:30' })).toBe('09:00 – 10:30');
	});
});

describe('moveDayFocus', () => {
	it('moves by key', () => {
		const k = '2026-10-13';
		expect(moveDayFocus(k, 'ArrowLeft')).toBe('2026-10-12');
		expect(moveDayFocus(k, 'ArrowRight')).toBe('2026-10-14');
		expect(moveDayFocus(k, 'ArrowUp')).toBe('2026-10-06');
		expect(moveDayFocus(k, 'ArrowDown')).toBe('2026-10-20');
		expect(moveDayFocus(k, 'PageUp')).toBe('2026-09-13');
		expect(moveDayFocus(k, 'PageDown')).toBe('2026-11-13');
		expect(moveDayFocus(k, 'Home')).toBe('2026-10-11');
		expect(moveDayFocus(k, 'End')).toBe('2026-10-17');
		expect(moveDayFocus(k, 'Home', 1)).toBe('2026-10-12');
		expect(moveDayFocus(k, 'End', 1)).toBe('2026-10-18');
		expect(moveDayFocus('2026-10-11', 'Home', 1)).toBe('2026-10-05');
		expect(moveDayFocus(k, 'x')).toBeNull();
	});
});

describe('events', () => {
	const events: CalendarEvent[] = [
		{ id: '1', title: 'Standup', date: '2026-10-13', start: '09:00', end: '09:15' },
		{ id: '2', title: 'Offsite', date: '2026-10-12', endDate: '2026-10-14' },
		{ id: '3', title: 'Lunch', date: '2026-10-13', start: '12:00' },
		{ id: '4', title: 'Alpha', date: '2026-10-13' },
		{ id: '5', title: 'Next month', date: '2026-11-02' },
		{ id: '6', title: 'Spans in', date: '2026-09-29', endDate: '2026-10-02' }
	];
	it('lists a day, all-day first, then by time', () => {
		expect(eventsOn(events, '2026-10-13').map((e) => e.id)).toEqual(['4', '2', '1', '3']);
		expect(eventsOn(events, '2026-10-15')).toEqual([]);
	});
	it('lists a month including spans', () => {
		expect(eventsInMonth(events, '2026-10-20').map((e) => e.id)).toEqual(['6', '2', '4', '1', '3']);
		expect(eventsInMonth(events, '2026-11-01').map((e) => e.id)).toEqual(['5']);
		const same = [
			{ id: 'b', title: 'B', date: '2026-10-05', start: '10:00' },
			{ id: 'a', title: 'A', date: '2026-10-05', start: '08:00' }
		];
		expect(eventsInMonth(same, '2026-10-01').map((e) => e.id)).toEqual(['a', 'b']);
	});
	it('validates', () => {
		const ok = { title: 'x', date: '2026-10-13' };
		expect(validateEvent(ok)).toEqual({});
		expect(validateEvent({ ...ok, title: ' ' }).title).toBeTruthy();
		expect(validateEvent({ ...ok, date: '2026-02-31' }).date).toBeTruthy();
		expect(validateEvent({ ...ok, endDate: '2026-10-12' }).endDate).toBeTruthy();
		expect(validateEvent({ ...ok, endDate: 'zzz' }).endDate).toBeTruthy();
		expect(validateEvent({ ...ok, endDate: '2026-10-14', start: '10:00', end: '09:00' })).toEqual(
			{}
		);
		expect(validateEvent({ ...ok, start: '10:00', end: '09:00' }).end).toBeTruthy();
		expect(
			validateEvent({ ...ok, endDate: '2026-10-13', start: '10:00', end: '09:00' }).end
		).toBeTruthy();
		expect(validateEvent({ ...ok, start: '10:00' })).toEqual({});
		expect(validateEvent({ title: '', date: 'x' }, { title: 'T', date: 'D', range: 'R' })).toEqual({
			title: 'T',
			date: 'D'
		});
	});
	it('adds, updates, removes', () => {
		const e: CalendarEvent = { id: '9', title: 'New', date: '2026-10-13' };
		expect(addCalendarEvent(events, e)).toHaveLength(7);
		expect(updateCalendarEvent(events, { ...events[0], title: 'Renamed' })[0].title).toBe(
			'Renamed'
		);
		expect(removeCalendarEvent(events, '1')).toHaveLength(5);
	});
});
