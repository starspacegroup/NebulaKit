import { describe, expect, it } from 'vitest';
import {
	CONFIRM_BETTER,
	CONFIRM_WORSE,
	COMPONENTS,
	DOWN_DAY_CHECKS,
	STATUSES,
	advance,
	ageSeconds,
	autoImpact,
	autoIncidentTitle,
	cleanText,
	componentName,
	dayLevel,
	dayOf,
	lastDays,
	overall,
	overallHeadline,
	parseComponents,
	readDatabase,
	readWebsite,
	severity,
	uptimePercent,
	type ComponentState,
	type Status
} from '../../src/lib/status/logic';

const fresh = (status: Status = 'operational'): ComponentState => ({
	status,
	since: '2026-11-17 00:00:00',
	pendingStatus: null,
	pendingCount: 0,
	pendingSince: null
});
const t = (n: number) => `2026-11-17 00:${String(n).padStart(2, '0')}:00`;

describe('what is listed', () => {
	it('is the website and the database, each with a name and a plain description', () => {
		expect(COMPONENTS.map((c) => c.id)).toEqual(['website', 'database']);
		for (const c of COMPONENTS) {
			expect(c.name.length).toBeGreaterThan(2);
			expect(c.description.endsWith('.')).toBe(true);
		}
		expect(componentName('website')).toBe('Website');
		expect(componentName('other')).toBe('other');
	});
});

describe('reading a check', () => {
	it('calls the website up when there is no outside view (the check ran inside it)', () => {
		expect(readWebsite(null)).toMatchObject({ status: 'operational', latencyMs: null });
		expect(readWebsite(undefined).detail).toBe('Serving this page.');
	});
	it('calls the website down, slow or fine from what the probe saw', () => {
		expect(readWebsite({ ok: false, ms: null })).toMatchObject({ status: 'down', latencyMs: null });
		expect(readWebsite({ ok: false, ms: 8000 })).toMatchObject({ status: 'down', latencyMs: 8000 });
		expect(readWebsite({ ok: true, ms: 2999 }).status).toBe('operational');
		expect(readWebsite({ ok: true, ms: 3000 }).status).toBe('degraded');
		expect(readWebsite({ ok: true, ms: 120 })).toMatchObject({ latencyMs: 120 });
	});
	it('calls the database down, slow or fine', () => {
		expect(readDatabase({ ok: false, ms: null }).status).toBe('down');
		expect(readDatabase({ ok: true, ms: 1499 }).status).toBe('operational');
		expect(readDatabase({ ok: true, ms: 1500 }).status).toBe('degraded');
	});
	it('never puts an address or an error in the public sentence', () => {
		const sentences = [
			readWebsite({ ok: false, ms: null }),
			readWebsite({ ok: true, ms: 9000 }),
			readDatabase({ ok: false, ms: null }),
			readDatabase({ ok: true, ms: 9000 })
		].map((r) => r.detail);
		for (const s of sentences) expect(s).not.toMatch(/https?:|error|exception|\d+\.\d+\.\d+/i);
	});
});

describe('confirming a change', () => {
	it('needs two checks in a row to get worse, and dates it to the first bad one', () => {
		let s = fresh();
		let step = advance(s, 'down', t(1));
		expect(step.changed).toBe(false);
		expect(step.state).toMatchObject({
			status: 'operational',
			pendingStatus: 'down',
			pendingCount: 1
		});
		s = step.state;
		step = advance(s, 'down', t(2));
		expect(step.changed).toBe(true);
		expect(step.from).toBe('operational');
		expect(step.state).toMatchObject({ status: 'down', since: t(1), pendingStatus: null });
	});

	it('needs two good checks to recover, and dates it to the one that confirmed it', () => {
		let s = fresh('down');
		s = advance(s, 'operational', t(5)).state;
		expect(s.status).toBe('down');
		const step = advance(s, 'operational', t(6));
		expect(step.changed).toBe(true);
		expect(step.state).toMatchObject({ status: 'operational', since: t(6) });
	});

	it('forgets a blip: one bad check, then a good one, changes nothing', () => {
		let s = advance(fresh(), 'down', t(1)).state;
		const step = advance(s, 'operational', t(2));
		expect(step.changed).toBe(false);
		expect(step.state).toMatchObject({
			status: 'operational',
			pendingStatus: null,
			pendingCount: 0
		});
	});

	it('restarts the count when the disagreeing status itself changes', () => {
		let s = advance(fresh(), 'degraded', t(1)).state;
		s = advance(s, 'down', t(2)).state;
		expect(s).toMatchObject({ status: 'operational', pendingStatus: 'down', pendingCount: 1 });
		const step = advance(s, 'down', t(3));
		expect(step.state).toMatchObject({ status: 'down', since: t(2) });
	});

	it('says how many it takes', () => {
		expect(CONFIRM_WORSE).toBe(2);
		expect(CONFIRM_BETTER).toBe(2);
	});

	it('never changes on a sequence with no two equal readings in a row, whatever the order', () => {
		const alternating: Status[][] = [
			['down', 'operational', 'down', 'operational', 'down'],
			['degraded', 'down', 'degraded', 'down', 'degraded', 'down'],
			['down', 'degraded', 'operational', 'down', 'degraded', 'operational']
		];
		for (const readings of alternating) {
			let s = fresh();
			readings.forEach((r, i) => {
				const step = advance(s, r, t(i + 1));
				// operational readings reset the count; the others never repeat back to back
				expect(step.changed).toBe(false);
				s = step.state;
			});
			expect(s.status).toBe('operational');
		}
	});

	it('holds its invariants over thousands of random checks', () => {
		let seed = 7;
		const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
		for (let run = 0; run < 40; run++) {
			let s = fresh(STATUSES[Math.floor(next() * 3)]);
			let streakStatus: Status | null = null;
			let streak = 0;
			for (let i = 0; i < 200; i++) {
				const reading = STATUSES[Math.floor(next() * 3)];
				const before = s;
				const step = advance(s, reading, t(i % 60));
				s = step.state;
				streak = reading === streakStatus ? streak + 1 : 1;
				streakStatus = reading;
				if (step.changed) {
					// a change is only ever to a status seen on enough checks in a row
					expect(reading).not.toBe(before.status);
					expect(streak).toBeGreaterThanOrEqual(
						severity(reading) > severity(before.status) ? CONFIRM_WORSE : CONFIRM_BETTER
					);
					expect(s.status).toBe(reading);
				} else {
					expect(s.status).toBe(before.status);
				}
				// the pending run is never the confirmed status, and is empty when there is none
				if (s.pendingStatus === null) expect(s.pendingCount).toBe(0);
				else expect(s.pendingStatus).not.toBe(s.status);
			}
		}
	});
});

describe('the headline', () => {
	it('takes the worst status', () => {
		expect(overall([])).toBe('operational');
		expect(overall(['operational', 'degraded'])).toBe('degraded');
		expect(overall(['degraded', 'down', 'operational'])).toBe('down');
	});
	it('says what is going on, and never "all systems operational" with an incident open', () => {
		expect(overallHeadline('operational', false)).toBe('All systems operational');
		expect(overallHeadline('operational', true)).not.toMatch(/all systems operational/i);
		expect(overallHeadline('degraded', false)).toBe('Some systems are slow');
		expect(overallHeadline('down', true)).toBe('Some systems are down');
	});
});

describe('daily history', () => {
	const day = (over: Partial<{ checks: number; degraded: number; down: number }> = {}) => ({
		day: '2026-11-17',
		checks: 1440,
		operational: 1440,
		degraded: 0,
		down: 0,
		...over
	});
	it('colours a day', () => {
		expect(dayLevel(undefined)).toBe('none');
		expect(dayLevel(day({ checks: 0 }))).toBe('none');
		expect(dayLevel(day())).toBe('operational');
		expect(dayLevel(day({ degraded: 1 }))).toBe('degraded');
		expect(dayLevel(day({ down: DOWN_DAY_CHECKS - 1 }))).toBe('degraded');
		expect(dayLevel(day({ down: DOWN_DAY_CHECKS }))).toBe('down');
	});
	it('cuts uptime to two decimals and never shows 100.00% for a day with an outage', () => {
		expect(uptimePercent([])).toBeNull();
		expect(uptimePercent([day({ checks: 0 })])).toBeNull();
		expect(uptimePercent([day()])).toBe(100);
		expect(uptimePercent([day({ checks: 1000, down: 1 })])).toBe(99.9);
		expect(uptimePercent([day({ checks: 100_000, down: 1 })])).toBe(99.99);
		expect(uptimePercent([day({ checks: 10_000_000, down: 1 })])).toBe(99.99);
		expect(uptimePercent([day({ checks: 3, down: 1 })])).toBe(66.66); // cut, not rounded to .67
	});
	it('never reports more uptime than there was, however the counts fall', () => {
		for (let checks = 1; checks <= 200; checks += 7) {
			for (let down = 0; down <= checks; down += 3) {
				const p = uptimePercent([day({ checks, down })])!;
				expect(p).toBeLessThanOrEqual(((checks - down) / checks) * 100 + 1e-9);
				if (down > 0) expect(p).toBeLessThan(100);
			}
		}
	});
	it('lists the last N UTC days, oldest first', () => {
		expect(lastDays('2026-03-01', 3)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
		expect(lastDays('2026-11-17', 90)).toHaveLength(90);
		expect(dayOf('2026-11-17 03:04:05')).toBe('2026-11-17');
	});
	it('measures age from a SQL time', () => {
		const now = new Date('2026-11-17T00:10:00Z');
		expect(ageSeconds('2026-11-17 00:05:00', now)).toBe(300);
		expect(ageSeconds('2026-11-17 00:20:00', now)).toBe(0);
		expect(ageSeconds('nonsense', now)).toBe(Infinity);
	});
});

describe('incidents', () => {
	it('titles and grades the ones the checks open', () => {
		expect(autoIncidentTitle('website', 'down')).toBe('Website is unavailable');
		expect(autoIncidentTitle('database', 'degraded')).toBe('Database is slow');
		expect(autoImpact('down')).toBe('major');
		expect(autoImpact('degraded')).toBe('minor');
	});
	it('reads a component list back safely', () => {
		expect(parseComponents('["website","database"]')).toEqual(['website', 'database']);
		expect(parseComponents('["a",3,null]')).toEqual(['a']);
		for (const bad of ['', 'nope', '{"a":1}', null, undefined]) {
			expect(parseComponents(bad as never)).toEqual([]);
		}
	});
	it('cleans what a person typed', () => {
		expect(cleanText('  hello \u0000world\u0007 ', 50)).toBe('hello world');
		expect(cleanText('x'.repeat(500), 120)).toHaveLength(120);
		expect(cleanText(null, 10)).toBe('');
		expect(cleanText('line one\nline two', 50)).toBe('line one\nline two');
	});
});
