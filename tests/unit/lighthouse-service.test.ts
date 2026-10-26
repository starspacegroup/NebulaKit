/**
 * The PageSpeed Insights client.
 *
 * The parser is the part that breaks when Google renames a field, and it is
 * the part a live test would cover slowest and least reliably — so it is
 * exercised against a recorded shape rather than the network. Everything here
 * runs without a request.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	auditPath,
	auditablePaths,
	isStrategy,
	listAudits,
	listFindings,
	parsePsiResponse,
	psiUrl,
	runLighthouseSweep
} from '../../src/lib/server/lighthouse';
import { SITEMAP_ROUTES } from '../../src/lib/agent-discovery';

/** A PSI payload with one clean category and one that fails two audits. */
function payload() {
	return {
		lighthouseResult: {
			lighthouseVersion: '12.0.0',
			categories: {
				performance: { score: 0.72, auditRefs: [{ id: 'lcp' }, { id: 'unused-css' }] },
				accessibility: { score: 1, auditRefs: [{ id: 'color-contrast' }] },
				'best-practices': { score: 1, auditRefs: [] },
				seo: { score: 0.9, auditRefs: [{ id: 'meta-description' }] }
			},
			audits: {
				lcp: {
					score: 0.4,
					title: 'Largest Contentful Paint',
					description: 'Marks the time…',
					displayValue: '4.1 s'
				},
				'unused-css': { score: 0.5, title: 'Reduce unused CSS', description: 'Trim rules…' },
				'color-contrast': { score: 1, title: 'Contrast is sufficient' },
				// score null is Lighthouse's marker for informative/manual audits.
				'meta-description': { score: null, title: 'Document has a meta description' }
			}
		}
	};
}

describe('parsePsiResponse', () => {
	it('rounds the 0-1 scores to the 0-100 people talk in', () => {
		const parsed = parsePsiResponse(payload());
		expect(parsed.performance).toBe(72);
		expect(parsed.accessibility).toBe(100);
		expect(parsed.bestPractices).toBe(100);
		expect(parsed.seo).toBe(90);
		expect(parsed.lighthouseVersion).toBe('12.0.0');
		expect(parsed.error).toBeNull();
	});

	it('collects only the audits that actually fail', () => {
		const parsed = parsePsiResponse(payload());
		expect(parsed.findings.map((f) => f.auditId).sort()).toEqual(['lcp', 'unused-css']);
	});

	it('does not report a passing audit as a finding', () => {
		expect(parsePsiResponse(payload()).findings.map((f) => f.auditId)).not.toContain(
			'color-contrast'
		);
	});

	it('ignores an audit scored null rather than calling it a failure', () => {
		// null means informative, manual or not-applicable. Treating it as 0
		// would bury the real findings under a list of things that cannot fail.
		expect(parsePsiResponse(payload()).findings.map((f) => f.auditId)).not.toContain(
			'meta-description'
		);
	});

	it('keeps the detail that makes a finding actionable', () => {
		const lcp = parsePsiResponse(payload()).findings.find((f) => f.auditId === 'lcp');
		expect(lcp).toMatchObject({
			category: 'performance',
			title: 'Largest Contentful Paint',
			score: 40,
			displayValue: '4.1 s'
		});
		expect(lcp?.description).toContain('Marks the time');
	});

	it('reports a payload with no lighthouseResult as an error, not as zeros', () => {
		// A zero is a real score and would look like a catastrophic page. A
		// missing result is a failed measurement and has to read differently.
		const parsed = parsePsiResponse({ error: { message: 'quota' } });
		expect(parsed.performance).toBeNull();
		expect(parsed.error).toContain('no lighthouseResult');
		expect(parsed.findings).toEqual([]);
	});
});

describe('psiUrl', () => {
	it('asks for all four categories', () => {
		const url = new URL(psiUrl('https://example.test/', 'mobile'));
		expect(url.searchParams.getAll('category').sort()).toEqual(
			['accessibility', 'best-practices', 'performance', 'seo'].sort()
		);
		expect(url.searchParams.get('strategy')).toBe('mobile');
		expect(url.searchParams.get('url')).toBe('https://example.test/');
	});

	it('omits the key entirely when there is none', () => {
		expect(psiUrl('https://example.test/', 'mobile')).not.toContain('key=');
		expect(psiUrl('https://example.test/', 'mobile', 'abc123')).toContain('key=abc123');
	});
});

describe('isStrategy', () => {
	it('accepts the two form factors and nothing else', () => {
		expect(isStrategy('mobile')).toBe(true);
		expect(isStrategy('desktop')).toBe(true);
		for (const probe of ['tablet', '', null, undefined, 0]) expect(isStrategy(probe)).toBe(false);
	});
});

describe('auditablePaths', () => {
	it('audits exactly what the sitemap calls public', () => {
		// Derived rather than listed, so a new public page is audited without
		// anyone remembering, and a page kept out of the sitemap is not sent to
		// Google either.
		expect(auditablePaths()).toEqual(SITEMAP_ROUTES.map((r) => r.path));
	});
});

describe('auditPath', () => {
	it('records an HTTP failure against the path instead of throwing', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 429 });
		const audit = await auditPath('/', 'mobile', {
			fetcher: fetcher as never,
			origin: 'https://x.test'
		});
		expect(audit.error).toContain('429');
		expect(audit.performance).toBeNull();
		expect(audit.path).toBe('/');
	});

	it('records a thrown network error the same way', async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error('connection reset'));
		const audit = await auditPath('/contact', 'mobile', {
			fetcher: fetcher as never,
			origin: 'https://x.test'
		});
		expect(audit.error).toBe('connection reset');
		expect(audit.findings).toEqual([]);
	});

	it('does not double the slash on an origin with a trailing one', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
		await auditPath('/terms', 'mobile', { fetcher: fetcher as never, origin: 'https://x.test/' });
		const called = new URL(fetcher.mock.calls[0][0] as string);
		expect(called.searchParams.get('url')).toBe('https://x.test/terms');
	});
});

describe('runLighthouseSweep', () => {
	function fakeDb() {
		const batch = vi.fn().mockResolvedValue([]);
		return {
			batch,
			prepare: () => ({ bind: () => ({}) })
		} as never;
	}

	it('keeps going after a page it could not reach', async () => {
		// One unreachable page must not abandon the rest of the sweep.
		let call = 0;
		const fetcher = vi.fn().mockImplementation(async () => {
			call += 1;
			if (call === 1) return { ok: false, status: 500 };
			return { ok: true, json: async () => payload() };
		});

		const result = await runLighthouseSweep(fakeDb(), {
			fetcher: fetcher as never,
			origin: 'https://x.test'
		});

		expect(result.audited).toBe(auditablePaths().length);
		expect(result.failed).toBe(1);
		expect(fetcher).toHaveBeenCalledTimes(auditablePaths().length);
	});

	it('requests one page at a time', async () => {
		// PSI rate limits hard without a key, and a burst of parallel requests is
		// the reliable way to get 429s on all of them.
		let inFlight = 0;
		let peak = 0;
		const fetcher = vi.fn().mockImplementation(async () => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight -= 1;
			return { ok: true, json: async () => payload() };
		});

		await runLighthouseSweep(fakeDb(), { fetcher: fetcher as never, origin: 'https://x.test' });
		expect(peak).toBe(1);
	});
});

describe('parsePsiResponse — sparse payloads', () => {
	it('reads a result with no categories or audits as all-null with no findings', () => {
		const parsed = parsePsiResponse({ lighthouseResult: {} });

		expect(parsed).toMatchObject({
			performance: null,
			accessibility: null,
			bestPractices: null,
			seo: null,
			lighthouseVersion: null,
			error: null,
			findings: []
		});
	});

	it('skips a referenced audit that is missing, and falls back for bare fields', () => {
		const parsed = parsePsiResponse({
			lighthouseResult: {
				categories: {
					// A score that is not a number reads as null, not as zero.
					performance: { score: 'n/a', auditRefs: [{ id: 'gone' }, { id: 'bare' }] },
					// A category with no auditRefs contributes nothing.
					seo: { score: 0.5 }
				},
				audits: { bare: { score: 0 } }
			}
		});

		expect(parsed.performance).toBeNull();
		expect(parsed.seo).toBe(50);
		expect(parsed.findings).toEqual([
			{
				category: 'performance',
				auditId: 'bare',
				title: 'bare',
				description: null,
				score: 0,
				displayValue: null
			}
		]);
	});
});

describe('auditPath — defaults', () => {
	it('records a thrown non-Error with a generic reason', async () => {
		const audit = await auditPath('/', 'mobile', {
			origin: 'https://example.com',
			fetcher: vi.fn().mockRejectedValue('offline') as unknown as typeof fetch
		});

		expect(audit.error).toBe('PageSpeed Insights request failed');
	});

	it('uses the site origin and the global fetch when given neither', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 }));
		try {
			const audit = await auditPath('/about', 'desktop');

			expect(audit.error).toBeNull();
			const requested = new URL(String(fetchSpy.mock.calls[0][0]));
			expect(requested.searchParams.get('url')).toMatch(/^https?:\/\/[^/]+\/about$/);
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

describe('listAudits / listFindings', () => {
	function dbReturning(results: unknown) {
		return {
			prepare: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results }) })
		} as unknown as Parameters<typeof listAudits>[0];
	}

	it('return the stored rows', async () => {
		const rows = [{ path: '/' }];
		expect(await listAudits(dbReturning(rows))).toEqual(rows);
		expect(await listFindings(dbReturning(rows))).toEqual(rows);
	});

	it('return an empty list when D1 gives back no results array', async () => {
		expect(await listAudits(dbReturning(undefined))).toEqual([]);
		expect(await listFindings(dbReturning(undefined))).toEqual([]);
	});
});
