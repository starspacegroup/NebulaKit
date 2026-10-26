import { describe, expect, it } from 'vitest';
import { isValidCron, nextCronRun, parseCron } from '../../src/lib/server/scheduler/cron';

const at = (iso: string) => new Date(iso);
const next = (expr: string, from: string) => nextCronRun(expr, at(from))?.toISOString() ?? null;

describe('parseCron', () => {
	it('accepts stars, numbers, lists, ranges and steps', () => {
		expect(isValidCron('*/15 * * * *')).toBe(true);
		expect(isValidCron('0 9 * * 1-5')).toBe(true);
		expect(isValidCron('5,35 6,18 1 */3 *')).toBe(true);
		expect(isValidCron('5/20 * * * *')).toBe(true);
		expect(parseCron('0 0 * * 7')?.dayOfWeek.has(0)).toBe(true);
	});

	it('rejects what it cannot evaluate rather than guessing', () => {
		for (const bad of [
			'',
			'* * * *',
			'* * * * * *',
			'60 * * * *',
			'* 24 * * *',
			'* * 0 * *',
			'* * * 13 *',
			'* * * * 8',
			'5-2 * * * *',
			'*/0 * * * *',
			'*/x * * * *',
			'1//2 * * * *',
			'1,,2 * * * *',
			'MON * * * *',
			'* * * * MON'
		]) {
			expect(isValidCron(bad), bad).toBe(false);
		}
	});
});

describe('nextCronRun', () => {
	it('returns the next daily time, strictly after the instant given', () => {
		expect(next('17 3 * * *', '2026-10-25T00:00:00Z')).toBe('2026-10-25T03:17:00.000Z');
		expect(next('17 3 * * *', '2026-10-25T03:17:00Z')).toBe('2026-10-26T03:17:00.000Z');
		expect(next('17 3 * * *', '2026-10-25T03:16:59.999Z')).toBe('2026-10-25T03:17:00.000Z');
	});

	it('handles steps and hour rollover', () => {
		expect(next('*/15 * * * *', '2026-10-25T10:50:30Z')).toBe('2026-10-25T11:00:00.000Z');
		expect(next('0 */6 * * *', '2026-10-25T18:00:00Z')).toBe('2026-10-26T00:00:00.000Z');
	});

	it('handles weekdays, months and month days', () => {
		// 2026-10-25 is a Sunday.
		expect(next('0 9 * * 1', '2026-10-25T12:00:00Z')).toBe('2026-10-26T09:00:00.000Z');
		expect(next('0 0 1 1 *', '2026-10-25T12:00:00Z')).toBe('2027-01-01T00:00:00.000Z');
		expect(next('30 8 15 * *', '2026-10-25T12:00:00Z')).toBe('2026-11-15T08:30:00.000Z');
	});

	it('treats day-of-month and day-of-week as either-or when both are set', () => {
		// The 1st or any Monday: Mon 26 Oct comes before 1 Nov.
		expect(next('0 0 1 * 1', '2026-10-25T12:00:00Z')).toBe('2026-10-26T00:00:00.000Z');
	});

	it('finds Feb 29 in the next leap year', () => {
		expect(next('0 0 29 2 *', '2026-10-25T00:00:00Z')).toBe('2028-02-29T00:00:00.000Z');
	});

	it('returns null for an expression that never fires or is invalid', () => {
		expect(next('0 0 31 2 *', '2026-10-25T00:00:00Z')).toBeNull();
		expect(next('nonsense', '2026-10-25T00:00:00Z')).toBeNull();
	});
});
