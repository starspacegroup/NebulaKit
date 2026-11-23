import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	addDays,
	canonicalTimeZone,
	dayKey,
	describeZone,
	detectBrowserTimeZone,
	formatDate,
	formatDateTime,
	formatOffset,
	formatTime,
	hourKey,
	isValidTimeZone,
	monthKey,
	NO_DATE,
	resolveTimeZone,
	supportedTimeZones,
	timeZoneSource,
	toDate,
	zoneAbbreviation,
	zoneOffsetMinutes,
	zoneParts
} from '../../src/lib/utils/timezone';
import {
	bucketHourlyToDays,
	bucketTimestampsToMonths,
	fillHourlySeries,
	formatZonedHourLabel
} from '../../src/lib/utils/stats-timeseries';

const ZONES = supportedTimeZones();
const zone = fc.constantFrom(...ZONES);
const HOUR = 3_600_000;
const finiteDate = fc.integer({ min: -8.64e15, max: 8.64e15 }).map((ms) => new Date(ms));
const modernDate = fc
	.integer({ min: Date.UTC(1971, 0, 1), max: Date.UTC(2099, 11, 31) })
	.map((ms) => new Date(ms));

const hourKeyUtc = (ms: number) => {
	const iso = new Date(ms).toISOString();
	return `${iso.slice(0, 10)}T${iso.slice(11, 13)}`;
};

describe('isValidTimeZone / canonicalTimeZone', () => {
	it('accepts IANA names, case-insensitively, and canonicalises them', () => {
		expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
		expect(isValidTimeZone('UTC')).toBe(true);
		expect(canonicalTimeZone('europe/paris')).toBe('Europe/Paris');
		// An alias keeps its spelling (V8 would rewrite it to Asia/Calcutta).
		expect(canonicalTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
	});

	it.each([
		'',
		' ',
		'Nope/Zone',
		'+05:00',
		'../etc/passwd',
		'Asia/Kolkata; DROP TABLE x',
		'Asia/Kolkata\n',
		'<script>',
		'a'.repeat(200),
		'auto'
	])('rejects %j', (bad) => {
		expect(isValidTimeZone(bad)).toBe(false);
	});

	it('rejects non-strings', () => {
		for (const v of [null, undefined, 5, {}, [], ['UTC'], true])
			expect(isValidTimeZone(v)).toBe(false);
	});

	it('knows the runtime lists UTC and plenty of zones', () => {
		expect(ZONES).toContain('UTC');
		expect(ZONES.length).toBeGreaterThan(100);
		for (const z of ZONES) expect(isValidTimeZone(z)).toBe(true);
	});
});

describe('resolveTimeZone', () => {
	it('prefers an explicit setting, then a valid cookie, then UTC', () => {
		expect(resolveTimeZone('Asia/Tokyo', 'America/New_York')).toBe('Asia/Tokyo');
		expect(resolveTimeZone('auto', 'America/New_York')).toBe('America/New_York');
		expect(resolveTimeZone(undefined, 'America/New_York')).toBe('America/New_York');
		expect(resolveTimeZone('auto', undefined)).toBe('UTC');
		expect(resolveTimeZone(null, null)).toBe('UTC');
	});

	it('ignores an invalid setting and falls through to the cookie', () => {
		expect(resolveTimeZone('Not/AZone', 'Europe/Paris')).toBe('Europe/Paris');
		expect(resolveTimeZone('Not/AZone', 'also bad')).toBe('UTC');
	});

	it('property: never returns an invalid zone, whatever it is given', () => {
		const junk = fc.oneof(fc.string(), fc.constantFrom(...ZONES), fc.anything());
		fc.assert(
			fc.property(junk, junk, (setting, cookie) => {
				const resolved = resolveTimeZone(setting, cookie);
				expect(isValidTimeZone(resolved)).toBe(true);
				expect(() => new Intl.DateTimeFormat('en-US', { timeZone: resolved })).not.toThrow();
			}),
			{ numRuns: 500 }
		);
	});

	it('property: a hostile cookie never wins over a valid setting', () => {
		fc.assert(
			fc.property(zone, fc.string(), (setting, cookie) => {
				expect(resolveTimeZone(setting, cookie)).toBe(canonicalTimeZone(setting));
			})
		);
	});

	it('reports where the answer came from', () => {
		expect(timeZoneSource('Asia/Tokyo', 'Europe/Paris')).toBe('setting');
		expect(timeZoneSource('auto', 'Europe/Paris')).toBe('browser');
		expect(timeZoneSource('auto', 'junk')).toBe('default');
	});
});

describe('browser detection', () => {
	it('reads the runtime zone without asking', () => {
		expect(isValidTimeZone(detectBrowserTimeZone())).toBe(true);
	});
});

describe('toDate', () => {
	it('reads SQLite timestamps as UTC', () => {
		expect(toDate('2026-07-16 14:05:09')?.toISOString()).toBe('2026-07-16T14:05:09.000Z');
		expect(toDate('2026-07-16 14:05')?.toISOString()).toBe('2026-07-16T14:05:00.000Z');
	});
	it('reads ISO, epoch and Date, and refuses the rest', () => {
		expect(toDate('2026-07-16T14:05:09Z')?.getTime()).toBe(Date.UTC(2026, 6, 16, 14, 5, 9));
		expect(toDate(0)?.getTime()).toBe(0);
		expect(toDate(new Date(5))?.getTime()).toBe(5);
		for (const v of [null, undefined, '', 'garbage', Number.NaN, new Date('x')]) {
			expect(toDate(v as never)).toBeNull();
		}
	});
});

describe('formatting', () => {
	const t = new Date('2026-07-16T20:35:00Z');
	it('formats in the zone with a fixed locale', () => {
		expect(formatTime(t, 'Asia/Kolkata')).toBe('02:05');
		expect(formatDate(t, 'Asia/Kolkata')).toBe('Jul 17, 2026');
		expect(formatDate(t, 'America/New_York')).toBe('Jul 16, 2026');
		expect(formatDateTime(t, 'Asia/Kolkata')).toBe('Jul 17, 2026, 02:05');
	});
	it('prints a placeholder for things that are not moments', () => {
		expect(formatDateTime('garbage', 'UTC')).toBe(NO_DATE);
		expect(formatDate(null, 'UTC')).toBe(NO_DATE);
		expect(formatTime(undefined, 'UTC')).toBe(NO_DATE);
	});
	it('falls back to UTC for a bad zone instead of throwing', () => {
		expect(formatTime(t, 'Nope/Nope')).toBe('20:35');
	});
	it('shows midnight as 00, never 24', () => {
		expect(formatTime(new Date('2026-07-16T00:00:00Z'), 'UTC')).toBe('00:00');
		expect(zoneParts(new Date('2026-07-16T00:00:00Z'), 'UTC').hour).toBe(0);
	});

	it('property: formatting never throws for any valid zone and any finite date', () => {
		fc.assert(
			fc.property(zone, finiteDate, (z, d) => {
				expect(typeof formatDate(d, z)).toBe('string');
				expect(typeof formatTime(d, z)).toBe('string');
				expect(typeof formatDateTime(d, z)).toBe('string');
				expect(typeof dayKey(d, z)).toBe('string');
				expect(typeof describeZone(z, d)).toBe('string');
			}),
			{ numRuns: 400 }
		);
	});
});

describe('offsets', () => {
	it('knows fixed and DST offsets, including half and quarter hours', () => {
		const jan = new Date('2026-01-15T12:00:00Z');
		const jul = new Date('2026-07-15T12:00:00Z');
		expect(zoneOffsetMinutes(jan, 'Asia/Kolkata')).toBe(330);
		expect(zoneOffsetMinutes(jan, 'Asia/Kathmandu')).toBe(345);
		expect(zoneOffsetMinutes(jan, 'America/New_York')).toBe(-300);
		expect(zoneOffsetMinutes(jul, 'America/New_York')).toBe(-240);
		expect(zoneOffsetMinutes(jan, 'Australia/Lord_Howe')).toBe(660);
		expect(zoneOffsetMinutes(jul, 'Australia/Lord_Howe')).toBe(630);
		expect(zoneOffsetMinutes(jan, 'UTC')).toBe(0);
	});
	it('ignores milliseconds', () => {
		expect(zoneOffsetMinutes(new Date('2026-01-15T12:00:00.999Z'), 'Asia/Kolkata')).toBe(330);
		expect(zoneOffsetMinutes(new Date(-1), 'Asia/Kolkata')).toBe(330);
	});
	it('formats offsets and labels', () => {
		expect(formatOffset(345)).toBe('+05:45');
		expect(formatOffset(-300)).toBe('-05:00');
		expect(formatOffset(0)).toBe('+00:00');
		expect(describeZone('Asia/Kolkata', new Date('2026-01-15T12:00:00Z'))).toContain('UTC+05:30');
		expect(describeZone('UTC')).toContain('UTC');
		expect(zoneAbbreviation(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe('EST');
		expect(zoneAbbreviation(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata')).toBeNull();
	});
	it('property: the offset is within the real-world range and consistent with the parts', () => {
		fc.assert(
			fc.property(zone, modernDate, (z, d) => {
				const off = zoneOffsetMinutes(d, z);
				expect(off).toBeGreaterThanOrEqual(-12 * 60);
				expect(off).toBeLessThanOrEqual(14 * 60);
				const local = new Date(d.getTime() + off * 60000);
				const p = zoneParts(d, z);
				expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([
					local.getUTCFullYear(),
					local.getUTCMonth() + 1,
					local.getUTCDate(),
					local.getUTCHours(),
					local.getUTCMinutes()
				]);
			}),
			{ numRuns: 300 }
		);
	});
});

describe('day / hour / month keys', () => {
	it('property: stable, and the hour and month keys agree with the day key', () => {
		fc.assert(
			fc.property(zone, modernDate, (z, d) => {
				const day = dayKey(d, z);
				expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(dayKey(new Date(d.getTime()), z)).toBe(day);
				expect(hourKey(d, z).slice(0, 10)).toBe(day);
				expect(monthKey(d, z)).toBe(day.slice(0, 7));
			}),
			{ numRuns: 300 }
		);
	});

	it('property: monotone, a later instant never gets an earlier key', () => {
		fc.assert(
			fc.property(zone, modernDate, modernDate, (z, a, b) => {
				const [lo, hi] = a <= b ? [a, b] : [b, a];
				expect(dayKey(lo, z) <= dayKey(hi, z)).toBe(true);
				expect(
					hourKey(lo, z) <= hourKey(hi, z) || zoneOffsetMinutes(lo, z) !== zoneOffsetMinutes(hi, z)
				).toBe(true);
				expect(monthKey(lo, z) <= monthKey(hi, z)).toBe(true);
			}),
			{ numRuns: 400 }
		);
	});

	it('property: addDays is calendar arithmetic that round-trips', () => {
		fc.assert(
			fc.property(modernDate, fc.integer({ min: -4000, max: 4000 }), (d, n) => {
				const day = d.toISOString().slice(0, 10);
				expect(addDays(addDays(day, n), -n)).toBe(day);
			})
		);
	});

	it('puts the same instant on different days in different zones', () => {
		const t = new Date('2026-07-16T20:35:00Z');
		expect(dayKey(t, 'UTC')).toBe('2026-07-16');
		expect(dayKey(t, 'Asia/Kolkata')).toBe('2026-07-17');
		expect(dayKey(t, 'Pacific/Honolulu')).toBe('2026-07-16');
	});
});

/** Every UTC hour in [from, to) as a counter row of 1 view. */
function hourlyRows(from: number, to: number) {
	const rows = [];
	for (let ms = from; ms < to; ms += HOUR)
		rows.push({ hourKey: hourKeyUtc(ms), views: 1, signedIn: 0 });
	return rows;
}

describe('DST and odd offsets: bucketing loses and duplicates nothing', () => {
	const CASES: { z: string; from: string; to: string; lengths: Record<string, number> }[] = [
		{
			z: 'America/New_York',
			from: '2026-03-05T00:00:00Z',
			to: '2026-03-12T00:00:00Z',
			lengths: { '2026-03-08': 23 }
		},
		{
			z: 'America/New_York',
			from: '2026-10-29T00:00:00Z',
			to: '2026-11-04T00:00:00Z',
			lengths: { '2026-11-01': 25 }
		},
		{
			z: 'Australia/Lord_Howe',
			from: '2026-04-02T00:00:00Z',
			to: '2026-04-09T00:00:00Z',
			lengths: {}
		},
		{
			z: 'Australia/Lord_Howe',
			from: '2026-10-01T00:00:00Z',
			to: '2026-10-08T00:00:00Z',
			lengths: {}
		},
		{
			z: 'Asia/Kathmandu',
			from: '2026-06-01T00:00:00Z',
			to: '2026-06-08T00:00:00Z',
			lengths: { '2026-06-03': 24 }
		},
		{
			z: 'Asia/Kolkata',
			from: '2026-06-01T00:00:00Z',
			to: '2026-06-08T00:00:00Z',
			lengths: { '2026-06-03': 24 }
		}
	];

	for (const c of CASES) {
		it(`${c.z} ${c.from.slice(0, 10)}: every hour lands in exactly one day, in order, with no gap day`, () => {
			const from = Date.parse(c.from);
			const to = Date.parse(c.to);
			const rows = hourlyRows(from, to);
			const days = bucketHourlyToDays(rows, c.z);

			expect(days.reduce((s, d) => s + d.views, 0)).toBe(rows.length);
			const keys = days.map((d) => d.day);
			expect(new Set(keys).size).toBe(keys.length);
			expect([...keys].sort()).toEqual(keys);
			// No missing calendar day between the first and last.
			for (let i = 1; i < keys.length; i++) expect(keys[i]).toBe(addDays(keys[i - 1], 1));
			for (const [day, hours] of Object.entries(c.lengths)) {
				expect(days.find((d) => d.day === day)?.views).toBe(hours);
			}
			// Interior days are 23-25 hours, never 0 and never absurd.
			for (const d of days.slice(1, -1)) {
				expect(d.views).toBeGreaterThanOrEqual(23);
				expect(d.views).toBeLessThanOrEqual(25);
			}
		});
	}

	it('property: re-bucketing conserves totals for any zone and any sparse set of hours', () => {
		const row = fc.record({
			ms: fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
			views: fc.integer({ min: 0, max: 1e6 }),
			signedIn: fc.integer({ min: 0, max: 1e6 })
		});
		fc.assert(
			fc.property(zone, fc.array(row, { maxLength: 80 }), (z, input) => {
				const rows = input.map((r) => ({
					hourKey: hourKeyUtc(r.ms),
					views: r.views,
					signedIn: r.signedIn
				}));
				const days = bucketHourlyToDays(rows, z);
				expect(days.reduce((s, d) => s + d.views, 0)).toBe(rows.reduce((s, r) => s + r.views, 0));
				expect(days.reduce((s, d) => s + d.signedIn, 0)).toBe(
					rows.reduce((s, r) => s + r.signedIn, 0)
				);
				const keys = days.map((d) => d.day);
				expect(new Set(keys).size).toBe(keys.length);
				expect([...keys].sort()).toEqual(keys);
			}),
			{ numRuns: 300 }
		);
	});

	it('skips rows with an unreadable hour key', () => {
		expect(bucketHourlyToDays([{ hourKey: 'garbage', views: 5, signedIn: 0 }], 'UTC')).toEqual([]);
	});
});

describe('month bucketing', () => {
	it('decides the month in the zone, not in UTC', () => {
		const rows = [
			{ ts: '2026-07-31T20:00:00Z', count: 2 },
			{ ts: '2026-08-01T01:00:00Z', count: 3 },
			{ ts: null, count: 9 },
			{ ts: 'garbage', count: 9 }
		];
		const utc = bucketTimestampsToMonths(rows, 'UTC');
		expect(utc).toEqual(
			expect.arrayContaining([
				{ ym: '2026-07', count: 2 },
				{ ym: '2026-08', count: 3 }
			])
		);
		expect(bucketTimestampsToMonths(rows, 'Asia/Kolkata')).toEqual([{ ym: '2026-08', count: 5 }]);
		expect(bucketTimestampsToMonths(rows, 'Pacific/Honolulu')).toEqual([
			{ ym: '2026-07', count: 5 }
		]);
	});
});

describe('hourly chart labels', () => {
	it('labels UTC hour buckets in the zone and keeps the buckets themselves UTC', () => {
		const series = fillHourlySeries([], '2026-07-16T23', 24, 'Asia/Kolkata');
		expect(series).toHaveLength(24);
		expect(series[23].ym).toBe('2026-07-16T23');
		// 23:00 UTC is 04:30 the next morning in Kolkata.
		expect(series[23].label).toBe('04:30');
		expect(series.map((p) => p.ym)).toEqual([...series.map((p) => p.ym)].sort());
	});
	it('without a zone it keeps the old UTC labels', () => {
		expect(fillHourlySeries([], '2026-07-16T23', 2)[1].label).toBe('23:00');
	});
	it('names the day at local midnight', () => {
		expect(formatZonedHourLabel(new Date('2026-07-16T04:00:00Z'), 'America/New_York')).toBe(
			'Jul 16'
		);
		expect(formatZonedHourLabel(new Date('2026-07-16T05:00:00Z'), 'America/New_York')).toBe(
			'01:00'
		);
	});
	it('property: always 24 distinct, ordered buckets and never throws', () => {
		fc.assert(
			fc.property(zone, modernDate, (z, d) => {
				const series = fillHourlySeries([], hourKeyUtc(d.getTime()), 24, z);
				expect(series).toHaveLength(24);
				expect(new Set(series.map((p) => p.ym)).size).toBe(24);
				for (const p of series) expect(p.label.length).toBeGreaterThan(0);
			}),
			{ numRuns: 200 }
		);
	});
});
