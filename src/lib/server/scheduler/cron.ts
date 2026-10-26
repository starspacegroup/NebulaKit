/**
 * Just enough cron to answer "when is this job next due?".
 *
 * Cloudflare evaluates the real schedule; this exists so the admin page can
 * show a next expected run, and so the registry test can reject an expression
 * that nothing could ever satisfy. Five fields, UTC, numbers only: `*`, `a`,
 * `a-b`, `a,b`, and `/n` steps. Names (`MON`) and `L`/`#` extensions are not
 * supported and parse as invalid, which is the safe answer for a display.
 */

interface Field {
	min: number;
	max: number;
}

const FIELDS: Field[] = [
	{ min: 0, max: 59 }, // minute
	{ min: 0, max: 23 }, // hour
	{ min: 1, max: 31 }, // day of month
	{ min: 1, max: 12 }, // month
	{ min: 0, max: 7 } // day of week; 0 and 7 are both Sunday
];

export interface ParsedCron {
	minute: Set<number>;
	hour: Set<number>;
	dayOfMonth: Set<number>;
	month: Set<number>;
	dayOfWeek: Set<number>;
	/** A restricted field matches on its own; both restricted means either may. */
	dayOfMonthRestricted: boolean;
	dayOfWeekRestricted: boolean;
}

function parseField(text: string, { min, max }: Field): Set<number> | null {
	const values = new Set<number>();
	for (const part of text.split(',')) {
		const [range, step, extra] = part.split('/');
		if (extra !== undefined || range === '') return null;
		let stride = 1;
		if (step !== undefined) {
			if (!/^\d+$/.test(step)) return null;
			stride = Number(step);
			if (stride < 1) return null;
		}
		let from: number;
		let to: number;
		if (range === '*') {
			from = min;
			to = max;
		} else {
			const match = /^(\d+)(?:-(\d+))?$/.exec(range);
			if (!match) return null;
			from = Number(match[1]);
			// `5/10` means from 5 to the end of the field in steps of 10.
			to = match[2] !== undefined ? Number(match[2]) : step !== undefined ? max : from;
		}
		if (from < min || to > max || from > to) return null;
		for (let value = from; value <= to; value += stride) values.add(value);
	}
	return values;
}

export function parseCron(expression: string): ParsedCron | null {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) return null;
	const sets = parts.map((part, index) => parseField(part, FIELDS[index]));
	if (sets.some((set) => set === null)) return null;
	const [minute, hour, dayOfMonth, month, dayOfWeek] = sets as Set<number>[];
	if (dayOfWeek.has(7)) dayOfWeek.add(0);
	return {
		minute,
		hour,
		dayOfMonth,
		month,
		dayOfWeek,
		dayOfMonthRestricted: parts[2] !== '*',
		dayOfWeekRestricted: parts[4] !== '*'
	};
}

export function isValidCron(expression: string): boolean {
	return parseCron(expression) !== null;
}

function dayMatches(cron: ParsedCron, date: Date): boolean {
	const byMonthDay = cron.dayOfMonth.has(date.getUTCDate());
	const byWeekDay = cron.dayOfWeek.has(date.getUTCDay());
	if (cron.dayOfMonthRestricted && cron.dayOfWeekRestricted) return byMonthDay || byWeekDay;
	return byMonthDay && byWeekDay;
}

/** Look no further than a year ahead; Feb 29 is the longest legitimate gap. */
const HORIZON_DAYS = 366 * 4;

/**
 * The first minute strictly after `after` that the expression fires on, or
 * null for an invalid expression or one that never fires (`0 0 31 2 *`).
 */
export function nextCronRun(expression: string, after: Date): Date | null {
	const cron = parseCron(expression);
	if (!cron) return null;

	const cursor = new Date(after.getTime());
	cursor.setUTCSeconds(0, 0);
	cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

	const end = cursor.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000;
	while (cursor.getTime() < end) {
		if (!cron.month.has(cursor.getUTCMonth() + 1) || !dayMatches(cron, cursor)) {
			// Wrong day: skip to the start of the next one.
			cursor.setUTCHours(24, 0, 0, 0);
			continue;
		}
		if (!cron.hour.has(cursor.getUTCHours())) {
			cursor.setUTCHours(cursor.getUTCHours() + 1, 0, 0, 0);
			continue;
		}
		if (cron.minute.has(cursor.getUTCMinutes())) return cursor;
		cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
	}
	return null;
}
