/**
 * Tests for the WebMCP tool surface (AGENTS.md §8).
 *
 * The security-relevant assertion is same-origin enforcement: these tools run
 * in the user's page with the user's cookies, so a path input that can escape
 * the origin would turn a site tool into a credentialed fetch primitive for
 * whatever URL an agent was talked into using.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildWebMcpTools,
	registerWebMcpTools,
	resolveSamePath,
	type WebMcpDeps
} from '../../src/lib/webmcp';

const ORIGIN = 'https://example.test';

function createDeps(overrides: Partial<WebMcpDeps> = {}): WebMcpDeps {
	return {
		origin: ORIGIN,
		items: () => [
			{ label: 'Hello World', description: 'Blog Posts: a greeting', href: '/blog/hello-world' },
			{ label: 'Pricing', description: 'Pages: what it costs', href: '/pages/pricing' }
		],
		navigate: vi.fn(),
		setTheme: vi.fn(),
		fetch: vi.fn(),
		...overrides
	};
}

function tool(name: string, deps: WebMcpDeps) {
	const found = buildWebMcpTools(deps).find((candidate) => candidate.name === name);
	if (!found) throw new Error(`no such tool: ${name}`);
	return found;
}

/** First text payload from a tool result. */
async function run(name: string, deps: WebMcpDeps, input: Record<string, unknown> = {}) {
	const result = await tool(name, deps).execute(input);
	return result.content[0].text;
}

describe('resolveSamePath', () => {
	it('accepts paths on this origin', () => {
		expect(resolveSamePath(ORIGIN, '/docs')).toBe('/docs');
		expect(resolveSamePath(ORIGIN, '/docs?a=1')).toBe('/docs?a=1');
		expect(resolveSamePath(ORIGIN, `${ORIGIN}/docs`)).toBe('/docs');
	});

	it('rejects other origins', () => {
		expect(resolveSamePath(ORIGIN, 'https://evil.test/steal')).toBeNull();
		// Protocol-relative URLs resolve against the current scheme — still off-origin.
		expect(resolveSamePath(ORIGIN, '//evil.test/steal')).toBeNull();
	});

	it('rejects non-http schemes', () => {
		expect(resolveSamePath(ORIGIN, 'javascript:alert(1)')).toBeNull();
		expect(resolveSamePath(ORIGIN, 'data:text/html,x')).toBeNull();
	});

	it('rejects empty and non-string input', () => {
		expect(resolveSamePath(ORIGIN, '')).toBeNull();
		expect(resolveSamePath(ORIGIN, '   ')).toBeNull();
		expect(resolveSamePath(ORIGIN, 42)).toBeNull();
		expect(resolveSamePath(ORIGIN, undefined)).toBeNull();
	});
});

describe('tool surface', () => {
	it('exposes only read and navigate tools', () => {
		// Anything with side effects needs explicit user confirmation; an agent
		// calls these speculatively.
		expect(buildWebMcpTools(createDeps()).map((t) => t.name)).toEqual([
			'search_site_content',
			'list_site_pages',
			'read_page_as_markdown',
			'navigate_to_page',
			'set_color_theme'
		]);
	});

	it('gives every tool a description and an object schema', () => {
		for (const candidate of buildWebMcpTools(createDeps())) {
			expect(candidate.description.length).toBeGreaterThan(20);
			expect(candidate.inputSchema).toMatchObject({ type: 'object' });
		}
	});
});

describe('search_site_content', () => {
	it('matches on title', async () => {
		expect(await run('search_site_content', createDeps(), { query: 'hello' })).toContain(
			`${ORIGIN}/blog/hello-world`
		);
	});

	it('matches on description', async () => {
		expect(await run('search_site_content', createDeps(), { query: 'costs' })).toContain('Pricing');
	});

	it('reports no matches usefully', async () => {
		const text = await run('search_site_content', createDeps(), { query: 'zzz' });
		expect(text).toContain('No published content matched');
		expect(text).toContain('list_site_pages');
	});

	it('rejects an empty query', async () => {
		expect(await run('search_site_content', createDeps(), { query: '  ' })).toContain(
			'non-empty query'
		);
	});

	it('reads items lazily, so later navigation sees fresh data', async () => {
		const items = vi.fn().mockReturnValue([]);
		const deps = createDeps({ items });
		const built = tool('search_site_content', deps);
		expect(items).not.toHaveBeenCalled();
		await built.execute({ query: 'x' });
		expect(items).toHaveBeenCalled();
	});
});

describe('list_site_pages', () => {
	it('extracts locations from the sitemap', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(
					`<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/terms</loc></url></urlset>`,
					{ status: 200 }
				)
			);
		const text = await run('list_site_pages', createDeps({ fetch: fetchMock }));
		expect(text).toBe(`${ORIGIN}/\n${ORIGIN}/terms`);
		expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/sitemap.xml`, {
			headers: { Accept: 'application/xml' },
			credentials: 'omit'
		});
	});

	it('reports a failed fetch', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
		expect(await run('list_site_pages', createDeps({ fetch: fetchMock }))).toContain('HTTP 500');
	});

	it('reports an empty sitemap', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('<urlset></urlset>', { status: 200 }));
		expect(await run('list_site_pages', createDeps({ fetch: fetchMock }))).toContain('no URLs');
	});

	it('uses the browser fetch when no fetch dependency is supplied', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('<urlset></urlset>', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const deps = createDeps();
		delete deps.fetch;

		expect(await run('list_site_pages', deps)).toContain('no URLs');
		expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/sitemap.xml`, expect.any(Object));
	});
});

describe('read_page_as_markdown', () => {
	it('requests markdown without visitor credentials for a sitemap-listed path', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(`<urlset><url><loc>${ORIGIN}/docs</loc></url></urlset>`, { status: 200 })
			)
			.mockResolvedValueOnce(new Response('# Title', { status: 200 }));
		const text = await run('read_page_as_markdown', createDeps({ fetch: fetchMock }), {
			path: '/docs'
		});
		expect(text).toBe('# Title');
		expect(fetchMock).toHaveBeenNthCalledWith(1, `${ORIGIN}/sitemap.xml`, {
			headers: { Accept: 'application/xml' },
			credentials: 'omit'
		});
		expect(fetchMock).toHaveBeenNthCalledWith(2, `${ORIGIN}/docs`, {
			headers: { Accept: 'text/markdown' },
			credentials: 'omit'
		});
	});

	it('refuses an off-origin path without fetching', async () => {
		const fetchMock = vi.fn();
		const text = await run('read_page_as_markdown', createDeps({ fetch: fetchMock }), {
			path: 'https://evil.test/steal'
		});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(text).toContain('a path on this site');
	});

	it('refuses private and undiscovered paths without fetching them', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(`<urlset><url><loc>${ORIGIN}/documentation</loc></url></urlset>`, {
				status: 200
			})
		);
		const text = await run('read_page_as_markdown', createDeps({ fetch: fetchMock }), {
			path: '/admin/users'
		});
		expect(text).toContain('not listed as public');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('fails closed when the public sitemap cannot be read', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
		const text = await run('read_page_as_markdown', createDeps({ fetch: fetchMock }), {
			path: '/documentation'
		});
		expect(text).toContain('public page index');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reports a non-OK status', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(`<urlset><url><loc>${ORIGIN}/nope</loc></url></urlset>`, { status: 200 })
			)
			.mockResolvedValueOnce(new Response('', { status: 404 }));
		expect(
			await run('read_page_as_markdown', createDeps({ fetch: fetchMock }), { path: '/nope' })
		).toContain('HTTP 404');
	});

	it('ignores malformed and foreign sitemap locations', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					`<urlset><url><loc>not a URL</loc></url><url><loc>https://other.test/docs</loc></url></urlset>`,
					{ status: 200 }
				)
			);

		const text = await run('read_page_as_markdown', createDeps({ fetch: fetchMock }), {
			path: '/docs'
		});

		expect(text).toContain('not listed as public');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('navigate_to_page', () => {
	it('navigates to a same-origin path', async () => {
		const navigate = vi.fn();
		const text = await run('navigate_to_page', createDeps({ navigate }), { path: '/contact' });
		expect(navigate).toHaveBeenCalledWith('/contact');
		expect(text).toContain('/contact');
	});

	it('refuses to navigate off-origin', async () => {
		const navigate = vi.fn();
		await run('navigate_to_page', createDeps({ navigate }), { path: 'https://evil.test' });
		expect(navigate).not.toHaveBeenCalled();
	});
});

describe('set_color_theme', () => {
	it.each(['light', 'dark', 'system'] as const)('applies the %s theme', async (theme) => {
		const setTheme = vi.fn();
		await run('set_color_theme', createDeps({ setTheme }), { theme });
		expect(setTheme).toHaveBeenCalledWith(theme);
	});

	it('rejects an unknown theme', async () => {
		const setTheme = vi.fn();
		const text = await run('set_color_theme', createDeps({ setTheme }), { theme: 'neon' });
		expect(setTheme).not.toHaveBeenCalled();
		expect(text).toContain('light, dark, system');
	});
});

describe('registerWebMcpTools', () => {
	const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

	function restoreNavigator() {
		if (original) {
			Object.defineProperty(globalThis, 'navigator', original);
			return;
		}
		// No own descriptor means the real `navigator` comes from the prototype,
		// so there is nothing to redefine — the stub has to be deleted for it to
		// show through again. Without this, the last stub in this block leaks into
		// every later file in the run (the pool is single-threaded), and anything
		// reading `navigator.platform` on mount dies a long way from here.
		delete (globalThis as { navigator?: Navigator }).navigator;
	}

	beforeEach(restoreNavigator);
	afterAll(restoreNavigator);

	it('does nothing on a browser without WebMCP', () => {
		// Which is almost every browser today — this must never throw.
		expect(registerWebMcpTools(createDeps())).toBe(false);
	});

	it('does nothing outside a browser', () => {
		vi.stubGlobal('navigator', undefined);
		expect(registerWebMcpTools(createDeps())).toBe(false);
	});

	it('registers the tools when the API exists', () => {
		const provideContext = vi.fn();
		Object.defineProperty(globalThis, 'navigator', {
			value: { modelContext: { provideContext } },
			configurable: true
		});

		expect(registerWebMcpTools(createDeps())).toBe(true);
		expect(provideContext).toHaveBeenCalledWith({ tools: expect.any(Array) });
	});

	it('survives a registration failure without breaking the page', () => {
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				modelContext: {
					provideContext: () => {
						throw new Error('nope');
					}
				}
			},
			configurable: true
		});

		expect(registerWebMcpTools(createDeps())).toBe(false);
	});
});
