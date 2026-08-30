import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	GA4_MEASUREMENT_ID,
	GTAG_SCRIPT_ID,
	gtagScriptUrl,
	installGtag,
	isAnalyticsExcludedPath,
	parseMeasurementId,
	sendPageView
} from '../../src/lib/utils/analytics';
import {
	ANALYTICS_CONFIG_KEY,
	buildAnalyticsConfig,
	clearAnalyticsConfig,
	getActiveMeasurementId,
	readAnalyticsConfig,
	writeAnalyticsConfig
} from '../../src/lib/server/analytics-config';

function createKv(initial: string | null = null) {
	const store = { value: initial };
	return {
		store,
		kv: {
			get: vi.fn(async () => store.value),
			put: vi.fn(async (_key: string, value: string) => {
				store.value = value;
			}),
			delete: vi.fn(async () => {
				store.value = null;
			})
		} as unknown as Parameters<typeof writeAnalyticsConfig>[0]
	};
}

/**
 * A stand-in for `Document` that records what was appended.
 *
 * Appending a real `<script src>` makes the test environment try to FETCH it —
 * happy-dom 12 does so over the network, happy-dom 20 refuses and prints a
 * DOMException. Neither belongs in a unit test, and the difference is exactly
 * the kind of thing that passes here and fails in another repo running an older
 * pin. Nothing below depends on real append semantics.
 */
function fakeDocument({ head = true }: { head?: boolean } = {}) {
	const inHead: Record<string, unknown>[] = [];
	const inBody: Record<string, unknown>[] = [];

	return {
		inHead,
		inBody,
		appended: () => [...inHead, ...inBody],
		getElementById: (id: string) =>
			[...inHead, ...inBody].find((element) => element.id === id) ?? null,
		createElement: () => ({ id: '', async: false, src: '' }),
		head: head ? { appendChild: (element: Record<string, unknown>) => inHead.push(element) } : null,
		body: { appendChild: (element: Record<string, unknown>) => inBody.push(element) }
	};
}

/** The fake above satisfies only the four members `installGtag` touches. */
const asDocument = (doc: ReturnType<typeof fakeDocument>) => doc as unknown as Document;

describe('parseMeasurementId', () => {
	it('accepts a bare measurement ID and upper-cases it', () => {
		expect(parseMeasurementId('  g-abcd123456 ')).toEqual({
			ok: true,
			measurementId: 'G-ABCD123456'
		});
	});

	// The admin field takes one input because Google hands people the ID in some
	// places and the whole <script> block in others.
	it('extracts the ID from a pasted gtag.js snippet', () => {
		const snippet = `
			<!-- Google tag (gtag.js) -->
			<script async src="https://www.googletagmanager.com/gtag/js?id=G-XYZ7654321"></script>
			<script>
				window.dataLayer = window.dataLayer || [];
				function gtag(){dataLayer.push(arguments);}
				gtag('js', new Date());
				gtag('config', 'G-XYZ7654321');
			</script>`;

		expect(parseMeasurementId(snippet)).toEqual({ ok: true, measurementId: 'G-XYZ7654321' });
	});

	it('rejects an empty field', () => {
		const result = parseMeasurementId('   ');
		expect(result.ok).toBe(false);
		expect(!result.ok && result.reason).toMatch(/Enter a GA4 Measurement ID/i);
	});

	// A GTM container ID has no "G-" run in it, so it would otherwise fall through
	// to the generic message and leave the admin guessing.
	it('names the mistake when given a Tag Manager container ID', () => {
		const result = parseMeasurementId('GTM-ABC1234');
		expect(result.ok).toBe(false);
		expect(!result.ok && result.reason).toMatch(/Tag Manager/i);
	});

	it('names the mistake when given a Universal Analytics ID', () => {
		const result = parseMeasurementId('UA-123456-1');
		expect(result.ok).toBe(false);
		expect(!result.ok && result.reason).toMatch(/Universal Analytics/i);
	});

	it('rejects unrelated text', () => {
		const result = parseMeasurementId('my analytics account');
		expect(result.ok).toBe(false);
		expect(!result.ok && result.reason).toMatch(/G-ABCD123456/);
	});

	it('only matches the saved shape in the strict pattern', () => {
		expect(GA4_MEASUREMENT_ID.test('G-ABCD123456')).toBe(true);
		expect(GA4_MEASUREMENT_ID.test('G-abc')).toBe(false);
		expect(GA4_MEASUREMENT_ID.test('prefix G-ABCD123456')).toBe(false);
	});
});

describe('isAnalyticsExcludedPath', () => {
	// The exclusions match the first-party page-view hook: the owner's own admin
	// traffic must not skew the numbers, and /api and /setup are not pages.
	it.each(['/admin', '/admin/stats', '/api', '/api/health', '/setup', '/setup/oauth'])(
		'excludes %s',
		(path) => {
			expect(isAnalyticsExcludedPath(path)).toBe(true);
		}
	);

	it.each(['/', '/blog', '/blog/admin-guide', '/administrators', '/setupguide'])(
		'tracks %s',
		(path) => {
			expect(isAnalyticsExcludedPath(path)).toBe(false);
		}
	);
});

describe('installGtag', () => {
	it('injects the tag once and configures it with automatic page views off', () => {
		const doc = fakeDocument();
		const win: Window = {} as Window;

		expect(installGtag(win, asDocument(doc), 'G-ABCD123456')).toBe(true);

		const script = doc.getElementById(GTAG_SCRIPT_ID);
		expect(script?.src).toBe(gtagScriptUrl('G-ABCD123456'));
		expect(script?.async).toBe(true);

		// SvelteKit routes on the client, so gtag's own page_view would count the
		// first document only. The component sends views itself instead.
		const commands = (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
		expect(commands[0]?.[0]).toBe('js');
		expect(commands[1]).toEqual(['config', 'G-ABCD123456', { send_page_view: false }]);

		expect(installGtag(win, asDocument(doc), 'G-ABCD123456')).toBe(false);
		expect(doc.appended().length).toBe(1);
	});

	it('reuses an existing dataLayer rather than replacing it', () => {
		const win = { dataLayer: ['existing'] } as unknown as Window;

		installGtag(win, asDocument(fakeDocument()), 'G-ABCD123456');

		expect(win.dataLayer?.[0]).toBe('existing');
		expect(win.dataLayer?.length).toBe(3);
	});

	// Defence in depth: a value edited straight into KV must never reach a
	// <script src>, even though the write path is owner-only.
	it('refuses an ID that does not match the strict pattern', () => {
		const doc = fakeDocument();
		const win: Window = {} as Window;

		expect(installGtag(win, asDocument(doc), 'G-<script>')).toBe(false);
		expect(doc.appended()).toEqual([]);
		expect(win.gtag).toBeUndefined();
	});

	it('falls back to the body when a document has no head', () => {
		const doc = fakeDocument({ head: false });

		expect(installGtag({} as Window, asDocument(doc), 'G-ABCD123456')).toBe(true);
		expect(doc.inHead).toEqual([]);
		expect(doc.inBody.length).toBe(1);
	});

	it('percent-encodes the ID in the script URL', () => {
		expect(gtagScriptUrl('G-ABCD123456')).toBe(
			'https://www.googletagmanager.com/gtag/js?id=G-ABCD123456'
		);
	});
});

describe('sendPageView', () => {
	it('sends a page_view for the current route', () => {
		const gtag = vi.fn();
		const win = { gtag } as unknown as Window;

		expect(
			sendPageView(win, 'G-ABCD123456', {
				path: '/blog?page=2',
				title: 'Blog',
				location: 'https://example.com/blog?page=2'
			})
		).toBe(true);

		expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
			send_to: 'G-ABCD123456',
			page_path: '/blog?page=2',
			page_title: 'Blog',
			page_location: 'https://example.com/blog?page=2'
		});
	});

	it('no-ops before the tag is installed', () => {
		expect(sendPageView({} as Window, 'G-ABCD123456', { path: '/' })).toBe(false);
	});
});

describe('buildAnalyticsConfig', () => {
	it('builds a stored config from admin input', () => {
		const result = buildAnalyticsConfig(
			'gtag/js?id=G-ABCD123456',
			true,
			new Date('2026-08-28T10:00:00.000Z')
		);

		expect(result).toEqual({
			ok: true,
			config: {
				provider: 'ga4',
				measurementId: 'G-ABCD123456',
				enabled: true,
				updatedAt: '2026-08-28T10:00:00.000Z'
			}
		});
	});

	it('stamps the current time when none is supplied', () => {
		const result = buildAnalyticsConfig('G-ABCD123456', false);
		expect(result.ok && result.config.enabled).toBe(false);
		expect(result.ok && Number.isNaN(Date.parse(result.config.updatedAt))).toBe(false);
	});

	// The form and the API share one parser, so a string can never be accepted in
	// one place and rejected in the other.
	it('rejects what the form rejects', () => {
		expect(buildAnalyticsConfig('nonsense', true)).toEqual({
			ok: false,
			reason: expect.stringContaining('G-ABCD123456')
		});
	});
});

describe('readAnalyticsConfig', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('returns null without a KV binding', async () => {
		expect(await readAnalyticsConfig(undefined)).toBeNull();
		expect(await readAnalyticsConfig(null)).toBeNull();
	});

	it('returns null when nothing is stored', async () => {
		const { kv } = createKv(null);
		expect(await readAnalyticsConfig(kv)).toBeNull();
	});

	// The root layout calls this on every request, so a KV outage must degrade to
	// "not connected" rather than break every page.
	it('returns null and logs when KV throws', async () => {
		const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = {
			get: vi.fn().mockRejectedValue(new Error('kv down'))
		} as unknown as Parameters<typeof readAnalyticsConfig>[0];

		expect(await readAnalyticsConfig(kv)).toBeNull();
		expect(warn).toHaveBeenCalled();
	});

	it('returns null on unparseable JSON', async () => {
		const { kv } = createKv('{not json');
		expect(await readAnalyticsConfig(kv)).toBeNull();
	});

	it('returns null when the stored value has no measurement ID', async () => {
		expect(await readAnalyticsConfig(createKv('null').kv)).toBeNull();
		expect(await readAnalyticsConfig(createKv('{"enabled":true}').kv)).toBeNull();
	});

	it('rejects a stored ID that fails validation', async () => {
		const { kv } = createKv(JSON.stringify({ measurementId: 'G-"></script>', enabled: true }));
		expect(await readAnalyticsConfig(kv)).toBeNull();
	});

	it('defaults enabled to true and updatedAt to empty for older rows', async () => {
		const { kv } = createKv(JSON.stringify({ measurementId: 'G-ABCD123456' }));
		expect(await readAnalyticsConfig(kv)).toEqual({
			provider: 'ga4',
			measurementId: 'G-ABCD123456',
			enabled: true,
			updatedAt: ''
		});
	});

	it('round-trips a written config', async () => {
		const { kv, store } = createKv();
		const config = {
			provider: 'ga4' as const,
			measurementId: 'G-ABCD123456',
			enabled: false,
			updatedAt: '2026-08-28T10:00:00.000Z'
		};

		await writeAnalyticsConfig(kv, config);
		expect(JSON.parse(store.value as string)).toEqual(config);
		expect(await readAnalyticsConfig(kv)).toEqual(config);
	});

	it('clears the stored config', async () => {
		const { kv, store } = createKv(JSON.stringify({ measurementId: 'G-ABCD123456' }));
		await clearAnalyticsConfig(kv);
		expect(store.value).toBeNull();
		expect(kv.delete).toHaveBeenCalledWith(ANALYTICS_CONFIG_KEY);
	});
});

describe('getActiveMeasurementId', () => {
	it('returns the ID when the connection is enabled', async () => {
		const { kv } = createKv(JSON.stringify({ measurementId: 'G-ABCD123456', enabled: true }));
		expect(await getActiveMeasurementId(kv)).toBe('G-ABCD123456');
	});

	// Pausing has to stop the tag loading, not merely hide it in the admin UI.
	it('returns null while the connection is paused', async () => {
		const { kv } = createKv(JSON.stringify({ measurementId: 'G-ABCD123456', enabled: false }));
		expect(await getActiveMeasurementId(kv)).toBeNull();
	});

	it('returns null when nothing is connected', async () => {
		expect(await getActiveMeasurementId(createKv(null).kv)).toBeNull();
	});
});
