import { describe, expect, it } from 'vitest';
import {
	addDays,
	addMonths,
	addTags,
	addYears,
	calendarKeyTarget,
	canCreate,
	clampDate,
	clampNumber,
	compareDates,
	dayOfWeek,
	daysInMonth,
	decimalPlaces,
	endOfWeek,
	fillOtp,
	filterOptions,
	fold,
	formatBytes,
	formatISODate,
	fromDayNumber,
	fullDateLabel,
	initialFocusDate,
	isDateDisabled,
	isLeapYear,
	isToggled,
	matchesAccept,
	monthGrid,
	monthLabel,
	otpCells,
	otpPasteStart,
	otpTyped,
	otpValue,
	parseAccept,
	parseISODate,
	parseNumber,
	sameDay,
	sanitizeOtp,
	snapToStep,
	startOfWeek,
	stepNumber,
	toDayNumber,
	todayYMD,
	toggleGroupValue,
	validateFiles,
	weekdayNames,
	weekdayOrder,
	type YMD
} from './form-logic';

const d = (text: string): YMD => parseISODate(text)!;
const iso = formatISODate;

describe('combobox filtering', () => {
	const options = [
		{ value: 'ber', label: 'Berlin' },
		{ value: 'zur', label: 'Zürich' },
		{ value: 'lis', label: 'Lisbon' },
		{ value: 'alb', label: 'Albury' }
	];

	it('folds case and accents', () => {
		expect(fold('  ZÜRICH ')).toBe('zurich');
	});

	it('returns everything for an empty query, as a copy', () => {
		const all = filterOptions(options, '  ');
		expect(all).toEqual(options);
		expect(all).not.toBe(options);
	});

	it('puts prefix matches before substring matches', () => {
		expect(filterOptions(options, 'b').map((o) => o.value)).toEqual(['ber', 'lis', 'alb']);
		expect(filterOptions(options, 'zur').map((o) => o.value)).toEqual(['zur']);
		expect(filterOptions(options, 'xyz')).toEqual([]);
	});

	it('offers to create only a new, non-empty label', () => {
		expect(canCreate(options, '')).toBe(false);
		expect(canCreate(options, 'zurich')).toBe(false);
		expect(canCreate(options, 'Paris')).toBe(true);
	});
});

describe('calendar arithmetic', () => {
	it('knows leap years, including the century rules', () => {
		expect(isLeapYear(2024)).toBe(true);
		expect(isLeapYear(2023)).toBe(false);
		expect(isLeapYear(1900)).toBe(false);
		expect(isLeapYear(2000)).toBe(true);
	});

	it('knows month lengths', () => {
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2023, 2)).toBe(28);
		expect(daysInMonth(2023, 4)).toBe(30);
		expect(daysInMonth(2023, 12)).toBe(31);
	});

	it('round-trips day numbers, before and after the epoch', () => {
		expect(toDayNumber({ year: 1970, month: 1, day: 1 })).toBe(0);
		expect(toDayNumber({ year: 2000, month: 3, day: 1 })).toBe(11017);
		for (const n of [-800000, -1, 0, 59, 60, 11016, 20000, 2932896]) {
			expect(toDayNumber(fromDayNumber(n))).toBe(n);
		}
		expect(fromDayNumber(-1)).toEqual({ year: 1969, month: 12, day: 31 });
	});

	it('adds days across month, year and leap-day boundaries', () => {
		expect(iso(addDays(d('2024-02-28'), 1))).toBe('2024-02-29');
		expect(iso(addDays(d('2023-02-28'), 1))).toBe('2023-03-01');
		expect(iso(addDays(d('2023-12-31'), 1))).toBe('2024-01-01');
		expect(iso(addDays(d('2024-03-01'), -1))).toBe('2024-02-29');
	});

	it('adds months, holding the day to a shorter month', () => {
		expect(iso(addMonths(d('2024-01-31'), 1))).toBe('2024-02-29');
		expect(iso(addMonths(d('2023-01-31'), 1))).toBe('2023-02-28');
		expect(iso(addMonths(d('2024-01-15'), -1))).toBe('2023-12-15');
		expect(iso(addMonths(d('2024-03-31'), -13))).toBe('2023-02-28');
		expect(iso(addYears(d('2024-02-29'), 1))).toBe('2025-02-28');
		expect(iso(addYears(d('2024-02-29'), 4))).toBe('2028-02-29');
	});

	it('finds the weekday and the week around a date', () => {
		expect(dayOfWeek(d('1970-01-01'))).toBe(4);
		expect(dayOfWeek(d('2026-10-03'))).toBe(6);
		expect(dayOfWeek(d('1969-12-28'))).toBe(0);
		expect(iso(startOfWeek(d('2026-10-03')))).toBe('2026-09-27');
		expect(iso(startOfWeek(d('2026-10-03'), 1))).toBe('2026-09-28');
		expect(iso(startOfWeek(d('2026-09-28'), 1))).toBe('2026-09-28');
		expect(iso(endOfWeek(d('2026-10-03')))).toBe('2026-10-03');
		expect(iso(endOfWeek(d('2026-10-03'), 1))).toBe('2026-10-04');
	});

	it('compares and matches dates', () => {
		expect(compareDates(d('2024-01-01'), d('2024-01-02'))).toBeLessThan(0);
		expect(sameDay(d('2024-01-01'), d('2024-01-01'))).toBe(true);
		expect(sameDay(d('2024-01-01'), null)).toBe(false);
		expect(sameDay(null, d('2024-01-01'))).toBe(false);
	});
});

describe('ISO dates', () => {
	it('formats with padding', () => {
		expect(formatISODate({ year: 987, month: 3, day: 4 })).toBe('0987-03-04');
	});

	it('parses real days only', () => {
		expect(parseISODate(' 2024-02-29 ')).toEqual({ year: 2024, month: 2, day: 29 });
		expect(parseISODate('2023-02-29')).toBeNull();
		expect(parseISODate('2023-13-01')).toBeNull();
		expect(parseISODate('2023-00-01')).toBeNull();
		expect(parseISODate('2023-01-00')).toBeNull();
		expect(parseISODate('2023-1-1')).toBeNull();
		expect(parseISODate('')).toBeNull();
		expect(parseISODate(null)).toBeNull();
		expect(parseISODate(undefined)).toBeNull();
	});
});

describe('bounds', () => {
	const min = d('2024-01-10');
	const max = d('2024-01-20');

	it('clamps to either bound, or neither', () => {
		expect(iso(clampDate(d('2024-01-01'), min, max))).toBe('2024-01-10');
		expect(iso(clampDate(d('2024-02-01'), min, max))).toBe('2024-01-20');
		expect(iso(clampDate(d('2024-01-15'), min, max))).toBe('2024-01-15');
		expect(iso(clampDate(d('2024-01-15')))).toBe('2024-01-15');
	});

	it('disables outside the range and by predicate', () => {
		const weekends = (date: YMD) => dayOfWeek(date) % 6 === 0;
		expect(isDateDisabled(d('2024-01-01'), min, max)).toBe(true);
		expect(isDateDisabled(d('2024-02-01'), min, max)).toBe(true);
		expect(isDateDisabled(d('2024-01-15'), min, max)).toBe(false);
		expect(isDateDisabled(d('2024-01-13'), min, max, weekends)).toBe(true);
		expect(isDateDisabled(d('2024-01-13'))).toBe(false);
	});

	it('starts focus on the selection, else today, held to bounds', () => {
		expect(iso(initialFocusDate(d('2024-01-12'), d('2024-01-15'), min, max))).toBe('2024-01-12');
		expect(iso(initialFocusDate(null, d('2024-03-01'), min, max))).toBe('2024-01-20');
	});

	it('reads today from a Date in local time', () => {
		expect(todayYMD(new Date(2026, 9, 3, 23, 59))).toEqual({ year: 2026, month: 10, day: 3 });
		expect(todayYMD().year).toBeGreaterThan(2000);
	});
});

describe('month grid', () => {
	it('is whole weeks covering the month', () => {
		// February 2026 starts on a Sunday and has exactly four weeks.
		const feb = monthGrid(2026, 2, 0);
		expect(feb).toHaveLength(4);
		expect(iso(feb[0][0])).toBe('2026-02-01');
		expect(iso(feb[3][6])).toBe('2026-02-28');
	});

	it('fills from neighbouring months and honours the week start', () => {
		const may = monthGrid(2026, 5, 1);
		expect(iso(may[0][0])).toBe('2026-04-27');
		expect(may.every((week) => week.length === 7)).toBe(true);
		expect(iso(may[may.length - 1][6])).toBe('2026-05-31');
		// August 2026 with Sunday weeks runs to six rows.
		expect(monthGrid(2026, 8)).toHaveLength(6);
	});

	it('orders weekdays from the week start', () => {
		expect(weekdayOrder()).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
	});
});

describe('date grid keys', () => {
	const at = d('2024-01-31');

	it('moves by day and week', () => {
		expect(iso(calendarKeyTarget(at, 'ArrowLeft', false)!)).toBe('2024-01-30');
		expect(iso(calendarKeyTarget(at, 'ArrowRight', false)!)).toBe('2024-02-01');
		expect(iso(calendarKeyTarget(at, 'ArrowUp', false)!)).toBe('2024-01-24');
		expect(iso(calendarKeyTarget(at, 'ArrowDown', false)!)).toBe('2024-02-07');
	});

	it('moves by month and, with Shift, by year', () => {
		expect(iso(calendarKeyTarget(at, 'PageDown', false)!)).toBe('2024-02-29');
		expect(iso(calendarKeyTarget(at, 'PageUp', false)!)).toBe('2023-12-31');
		expect(iso(calendarKeyTarget(d('2024-02-29'), 'PageDown', true)!)).toBe('2025-02-28');
		expect(iso(calendarKeyTarget(at, 'PageUp', true)!)).toBe('2023-01-31');
	});

	it('jumps to the week start and end', () => {
		expect(iso(calendarKeyTarget(at, 'Home', false)!)).toBe('2024-01-28');
		expect(iso(calendarKeyTarget(at, 'End', false, 1)!)).toBe('2024-02-04');
	});

	it('holds to bounds and ignores other keys', () => {
		expect(iso(calendarKeyTarget(at, 'ArrowRight', false, 0, null, at)!)).toBe('2024-01-31');
		expect(calendarKeyTarget(at, 'a', false)).toBeNull();
	});
});

describe('localized names', () => {
	it('names the month and weekdays', () => {
		expect(monthLabel(2026, 3)).toBe('March 2026');
		expect(monthLabel(2026, 3, 'de-DE')).toBe('März 2026');
		expect(weekdayNames()[0]).toBe('Sun');
		expect(weekdayNames('en-US', 1, 'long')).toEqual([
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
			'Sunday'
		]);
	});

	it('gives a full date for a cell, whatever the year', () => {
		expect(fullDateLabel(d('2026-03-03'))).toBe('Tuesday, March 3, 2026');
		expect(fullDateLabel({ year: 50, month: 1, day: 1 })).toContain('50');
	});
});

describe('one-time code', () => {
	it('keeps only usable characters', () => {
		expect(sanitizeOtp('12 a-3')).toBe('123');
		expect(sanitizeOtp('ab-12 c', 'alphanumeric')).toBe('AB12C');
	});

	it('splits into a fixed number of cells', () => {
		expect(otpCells('12', 4)).toEqual(['1', '2', '', '']);
		expect(otpCells('123456', 4)).toEqual(['1', '2', '3', '4']);
	});

	it('fills from an index and says where focus goes', () => {
		const blank = otpCells('', 4);
		expect(fillOtp(blank, 0, '7')).toEqual({ cells: ['7', '', '', ''], focus: 1 });
		expect(fillOtp(blank, 1, '1-2')).toEqual({ cells: ['', '1', '2', ''], focus: 3 });
		expect(fillOtp(blank, 0, '123456')).toEqual({ cells: ['1', '2', '3', '4'], focus: 3 });
		expect(fillOtp(blank, 2, 'x')).toEqual({ cells: blank, focus: 2 });
		expect(fillOtp(blank, 0, 'ab', 'alphanumeric').cells).toEqual(['A', 'B', '', '']);
	});

	it('finds what was typed beside an old character', () => {
		expect(otpTyped('', '5')).toBe('5');
		expect(otpTyped('5', '5')).toBe('5');
		expect(otpTyped('5', '57')).toBe('7');
		expect(otpTyped('5', '75')).toBe('7');
		expect(otpTyped('5', '78')).toBe('78');
	});

	it('pastes a whole code from the first cell', () => {
		expect(otpPasteStart(3, '123-456', 6)).toBe(0);
		expect(otpPasteStart(3, '12', 6)).toBe(3);
		expect(otpPasteStart(2, 'abcdef', 6, 'alphanumeric')).toBe(0);
	});

	it('joins up to the first blank', () => {
		expect(otpValue(['1', '2', '', '4'])).toBe('12');
		expect(otpValue(['1', '2', '3'])).toBe('123');
	});
});

describe('numbers', () => {
	it('counts decimal places as written', () => {
		expect(decimalPlaces(1)).toBe(0);
		expect(decimalPlaces(0.25)).toBe(2);
		expect(decimalPlaces(1e-7)).toBe(7);
		expect(decimalPlaces(1.5e-7)).toBe(8);
		expect(decimalPlaces(1e21)).toBe(0);
		expect(decimalPlaces(Infinity)).toBe(0);
	});

	it('clamps', () => {
		expect(clampNumber(5, 0, 3)).toBe(3);
		expect(clampNumber(-5, 0, 3)).toBe(0);
		expect(clampNumber(5)).toBe(5);
	});

	it('snaps to the step from min, at the step precision', () => {
		expect(snapToStep(0.30000000000000004, 0.1)).toBe(0.3);
		expect(snapToStep(7, 5, 1)).toBe(6);
		expect(snapToStep(12, 5, 1, 10)).toBe(10);
		expect(snapToStep(3.3, 0)).toBe(3.3);
		expect(snapToStep(1.4, 0.25, 0.5)).toBe(1.5);
	});

	it('steps from a value, or from min or zero when empty', () => {
		expect(stepNumber(0.1, 2, 0.1)).toBe(0.3);
		expect(stepNumber(9, 1, 1, 0, 9)).toBe(9);
		expect(stepNumber(null, 1, 1, 5)).toBe(6);
		expect(stepNumber(null, -1)).toBe(-1);
	});

	it('parses typed text', () => {
		expect(parseNumber(' 4.5 ')).toBe(4.5);
		expect(parseNumber('')).toBeNull();
		expect(parseNumber('abc')).toBeNull();
	});
});

describe('toggle groups', () => {
	const order = ['b', 'i', 'u'];

	it('single selection keeps the pressed item, or clears when allowed', () => {
		expect(toggleGroupValue('single', 'b', 'i')).toBe('i');
		expect(toggleGroupValue('single', 'b', 'b')).toBe('b');
		expect(toggleGroupValue('single', 'b', 'b', order, true)).toBe('');
	});

	it('multiple selection adds and removes in item order', () => {
		expect(toggleGroupValue('multiple', ['u'], 'b', order)).toEqual(['b', 'u']);
		expect(toggleGroupValue('multiple', ['b', 'u'], 'b', order)).toEqual(['u']);
		expect(toggleGroupValue('multiple', 'u', 'x', order)).toEqual(['u', 'x']);
		expect(toggleGroupValue('multiple', '', 'i')).toEqual(['i']);
	});

	it('reports whether an item is on', () => {
		expect(isToggled(['a'], 'a')).toBe(true);
		expect(isToggled('a', 'a')).toBe(true);
		expect(isToggled('a', 'b')).toBe(false);
	});
});

describe('tags', () => {
	it('adds comma-separated tags, skipping blanks', () => {
		expect(addTags(['a'], ' b, ,c ')).toEqual({ tags: ['a', 'b', 'c'], error: '' });
	});

	it('refuses duplicates, case-insensitively by default', () => {
		expect(addTags(['Svelte'], 'svelte').error).toBe('“svelte” is already added.');
		expect(addTags(['Svelte'], 'svelte', { ignoreCase: false }).tags).toEqual(['Svelte', 'svelte']);
	});

	it('stops at max and reports the first refusal', () => {
		expect(addTags(['a'], 'b,c,a', { max: 2 })).toEqual({
			tags: ['a', 'b'],
			error: 'No more than 2 allowed.'
		});
	});

	it('runs the validator', () => {
		const validate = (t: string) => (t.length > 3 ? 'Too long' : undefined);
		expect(addTags([], 'abcd,ab', { validate })).toEqual({ tags: ['ab'], error: 'Too long' });
	});
});

describe('files', () => {
	const file = (name: string, type: string, size = 100) => ({ name, type, size });

	it('formats sizes', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(-5)).toBe('0 B');
		expect(formatBytes(NaN)).toBe('0 B');
		expect(formatBytes(Infinity)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
		expect(formatBytes(2 * 1024 ** 5)).toBe('2048 TB');
	});

	it('parses and matches accept lists', () => {
		expect(parseAccept(' .PDF , image/* ,')).toEqual(['.pdf', 'image/*']);
		expect(matchesAccept(file('a.png', 'image/png'), '')).toBe(true);
		expect(matchesAccept(file('a.png', 'image/png'), 'image/*')).toBe(true);
		expect(matchesAccept(file('A.PDF', ''), '.pdf')).toBe(true);
		expect(matchesAccept(file('a.csv', 'text/csv'), 'text/csv')).toBe(true);
		expect(matchesAccept(file('a.txt', 'text/plain'), 'image/*,.pdf,text/csv')).toBe(false);
	});

	it('sorts files into accepted and rejected with reasons', () => {
		const result = validateFiles(
			[file('a.png', 'image/png'), file('b.txt', 'text/plain'), file('c.png', 'image/png', 5000)],
			{ accept: 'image/*', maxSize: 1024, multiple: true }
		);
		expect(result.accepted.map((f) => f.name)).toEqual(['a.png']);
		expect(result.rejected.map((r) => r.reason)).toEqual([
			'b.txt is not an accepted file type.',
			'c.png is 4.9 KB; the limit is 1 KB.'
		]);
	});

	it('keeps one file unless multiple, and notices duplicates', () => {
		expect(validateFiles([file('a', ''), file('b', '')]).rejected[0].reason).toBe(
			'Only one file can be added.'
		);
		const dupes = validateFiles([file('a', ''), file('a', ''), file('b', '')], {
			multiple: true,
			existing: [file('b', '')]
		});
		expect(dupes.accepted.map((f) => f.name)).toEqual(['a']);
		expect(dupes.rejected.map((r) => r.reason)).toEqual([
			'a is already added.',
			'b is already added.'
		]);
	});
});
