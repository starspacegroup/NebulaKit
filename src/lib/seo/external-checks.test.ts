import { describe, expect, it, vi } from 'vitest';
import {
	gradeAtLeast,
	hstsPreloadCheck,
	observatoryCheck,
	pageSpeedChecks,
	runExternalChecks,
	securityTxtCheck,
	sslLabsCheck
} from './external-checks';

const NOW = new Date('2026-10-27T12:00:00Z');
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const text = (body: string, status = 200) => new Response(body, { status });
const fetcher = (...rs: (Response | Error)[]) =>
	vi.fn(async () => {
		const r = rs.shift()!;
		if (r instanceof Error) throw r;
		return r;
	}) as unknown as typeof fetch;

describe('gradeAtLeast', () => {
	it('orders letter grades and rejects unknown ones', () => {
		expect(gradeAtLeast('A+', 'A')).toBe(true);
		expect(gradeAtLeast('B', 'B')).toBe(true);
		expect(gradeAtLeast('C', 'B')).toBe(false);
		expect(gradeAtLeast('?', 'B')).toBe(false);
		expect(gradeAtLeast('A', '?')).toBe(false);
	});
});

describe('observatoryCheck', () => {
	it('passes at B or better and says what it measured', async () => {
		const c = await observatoryCheck(
			'x.com',
			NOW,
			fetcher(json({ grade: 'A+', score: 110, tests_passed: 12, tests_quantity: 12, error: null }))
		);
		expect(c).toMatchObject({
			label: 'Mozilla HTTP Observatory A+',
			measuredOn: '2026-10-27',
			passed: true,
			detail: '110 points, 12 of 12 tests'
		});
		expect(c.reportUrl).toContain('host=x.com');
	});

	it('fails below the bar', async () => {
		const c = await observatoryCheck('x.com', NOW, fetcher(json({ grade: 'D', score: 30 })));
		expect(c.passed).toBe(false);
	});

	it('never passes when the scan errors or the network fails', async () => {
		expect(
			(await observatoryCheck('x.com', NOW, fetcher(json({ error: 'bad host' }, 400)))).passed
		).toBe(false);
		const c = await observatoryCheck('x.com', NOW, fetcher(new Error('offline')));
		expect(c.passed).toBe(false);
		expect(c.detail).toBe('could not measure: offline');
	});

	it('reports a non-Error failure', async () => {
		const f = vi.fn(async () => {
			throw 'boom';
		}) as unknown as typeof fetch;
		expect((await observatoryCheck('x.com', NOW, f)).detail).toBe('could not measure: boom');
	});
});

describe('sslLabsCheck', () => {
	const opts = { pollMs: 0, sleep: async () => {} };

	it('polls until READY and uses the worst endpoint grade', async () => {
		const c = await sslLabsCheck(
			'x.com',
			NOW,
			fetcher(
				json({ status: 'IN_PROGRESS' }),
				json({ status: 'READY', endpoints: [{ grade: 'A+' }, { grade: 'B' }] })
			),
			opts
		);
		expect(c).toMatchObject({ label: 'SSL Labs B', passed: false });
		expect(c.detail).toBe('2 endpoint(s), worst grade B');
	});

	it('passes when every endpoint is at the bar', async () => {
		const c = await sslLabsCheck(
			'x.com',
			NOW,
			fetcher(json({ status: 'READY', endpoints: [{ grade: 'A' }, { grade: 'A+' }] })),
			opts
		);
		expect(c.passed).toBe(true);
	});

	it('fails on an error status, no grades, or a timeout', async () => {
		expect(
			(
				await sslLabsCheck(
					'x.com',
					NOW,
					fetcher(json({ status: 'ERROR', statusMessage: 'nope' })),
					opts
				)
			).detail
		).toBe('could not measure: nope');
		expect(
			(await sslLabsCheck('x.com', NOW, fetcher(json({ status: 'ERROR' })), opts)).detail
		).toBe('could not measure: SSL Labs error');
		expect(
			(await sslLabsCheck('x.com', NOW, fetcher(json({ status: 'READY', endpoints: [] })), opts))
				.detail
		).toBe('could not measure: no graded endpoints');
		expect(
			(await sslLabsCheck('x.com', NOW, fetcher(json({ status: 'READY' })), opts)).passed
		).toBe(false);
		const slow = await sslLabsCheck(
			'x.com',
			NOW,
			vi.fn(async () => json({ status: 'IN_PROGRESS' })) as unknown as typeof fetch,
			{ ...opts, maxPolls: 2 }
		);
		expect(slow.detail).toBe('could not measure: timed out waiting for the scan');
	});

	it('uses the real timer when no sleep is given', async () => {
		const c = await sslLabsCheck(
			'x.com',
			NOW,
			fetcher(json({ status: 'DNS' }), json({ status: 'READY', endpoints: [{ grade: 'A' }] })),
			{ pollMs: 1 }
		);
		expect(c.passed).toBe(true);
	});
});

describe('hstsPreloadCheck', () => {
	it('passes only when preloaded', async () => {
		expect(
			(await hstsPreloadCheck('x.com', NOW, fetcher(json({ status: 'preloaded' })))).passed
		).toBe(true);
		const c = await hstsPreloadCheck('x.com', NOW, fetcher(json({})));
		expect(c).toMatchObject({ passed: false, detail: 'status: unknown' });
	});

	it('fails when the API cannot be reached', async () => {
		expect((await hstsPreloadCheck('x.com', NOW, fetcher(new Error('x')))).passed).toBe(false);
	});
});

describe('securityTxtCheck', () => {
	it('passes with a Contact and a future Expires', async () => {
		const c = await securityTxtCheck(
			'x.com',
			NOW,
			fetcher(text('Contact: mailto:a@x.com\nExpires: 2027-01-01T00:00:00Z\n'))
		);
		expect(c).toMatchObject({ passed: true, detail: 'has Contact, expires 2027-01-01T00:00:00Z' });
	});

	it('fails when expired, missing Contact, missing Expires, or absent', async () => {
		const expired = await securityTxtCheck(
			'x.com',
			NOW,
			fetcher(text('Contact: a\nExpires: 2020-01-01T00:00:00Z'))
		);
		expect(expired).toMatchObject({
			passed: false,
			detail: 'has Contact, expired 2020-01-01T00:00:00Z'
		});
		const noContact = await securityTxtCheck(
			'x.com',
			NOW,
			fetcher(text('Expires: 2027-01-01T00:00:00Z'))
		);
		expect(noContact.detail).toBe('no Contact, expires 2027-01-01T00:00:00Z');
		const noExpires = await securityTxtCheck('x.com', NOW, fetcher(text('Contact: a')));
		expect(noExpires.detail).toBe('has Contact, no Expires');
		const missing = await securityTxtCheck('x.com', NOW, fetcher(text('', 404)));
		expect(missing).toMatchObject({ passed: false, detail: 'could not measure: HTTP 404' });
	});
});

describe('pageSpeedChecks', () => {
	const lh = (s: number[]) => ({
		lighthouseResult: {
			categories: {
				performance: { score: s[0] },
				accessibility: { score: s[1] },
				'best-practices': { score: s[2] },
				seo: { score: s[3] }
			}
		}
	});

	it('scores phone and desktop and needs every category at the bar', async () => {
		const f = fetcher(json(lh([0.95, 0.97, 1, 1])), json(lh([1, 0.85, 1, 1])));
		const [phone, desktop] = await pageSpeedChecks('https://x.com/', NOW, f, { key: 'k' });
		expect(phone).toMatchObject({
			label: 'Lighthouse, on a phone',
			passed: true,
			detail: 'performance 95, accessibility 97, best practices 100, SEO 100'
		});
		expect(desktop.passed).toBe(false);
		expect(desktop.reportUrl).toContain('form_factor=desktop');
		const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
		expect(url).toContain('key=k');
	});

	it('treats a missing category score as zero', async () => {
		const f = fetcher(
			json({ lighthouseResult: { categories: { performance: { score: null } } } }),
			json(lh([1, 1, 1, 1]))
		);
		const [phone] = await pageSpeedChecks('https://x.com/', NOW, f);
		expect(phone.passed).toBe(false);
	});

	it('fails, with the reason, when the quota is spent or the call breaks', async () => {
		const f = fetcher(
			json({ error: { message: 'Quota exceeded for metric. Details here' } }, 429),
			json({}, 500)
		);
		const [a, b] = await pageSpeedChecks('https://x.com/', NOW, f);
		expect(a.detail).toBe('could not measure: Quota exceeded for metric');
		expect(b.detail).toBe('could not measure: HTTP 500');
	});
});

describe('runExternalChecks', () => {
	it('runs every check and returns them in badge order', async () => {
		const f = vi.fn(async (input: RequestInfo | URL) => {
			const u = String(input);
			if (u.includes('ssllabs')) return json({ status: 'READY', endpoints: [{ grade: 'A' }] });
			if (u.includes('pagespeedonline'))
				return json({
					lighthouseResult: {
						categories: {
							performance: { score: 1 },
							accessibility: { score: 1 },
							'best-practices': { score: 1 },
							seo: { score: 1 }
						}
					}
				});
			if (u.includes('observatory'))
				return json({ grade: 'A', score: 100, tests_passed: 12, tests_quantity: 12 });
			if (u.includes('hstspreload')) return json({ status: 'unknown' });
			return text('Contact: a\nExpires: 2027-01-01T00:00:00Z');
		}) as unknown as typeof fetch;
		const all = await runExternalChecks('x.com', { now: NOW, f });
		expect(all.map((c) => c.label)).toEqual([
			'SSL Labs A',
			'Lighthouse, on a phone',
			'Lighthouse, on a desktop',
			'Mozilla HTTP Observatory A',
			'security.txt',
			'HSTS preload'
		]);
		expect(all.filter((c) => !c.passed).map((c) => c.label)).toEqual(['HSTS preload']);
	});
});
