/**
 * WebMCP — expose this site's real actions to an in-browser AI agent.
 *
 * When a WebMCP-capable browser agent visits the site, the page registers tools
 * through `navigator.modelContext.provideContext()`. The agent can then read
 * and navigate the site through a typed interface instead of scraping the DOM.
 *
 * Design rules for anything added here:
 *
 *  - **Read and navigate only.** Every tool below is safe to invoke without
 *    confirmation. Nothing writes data, spends money, or sends a message. If you
 *    add a tool with side effects, it must require explicit user confirmation
 *    first — an agent will call these speculatively.
 *  - **Same-origin only.** Path inputs are resolved against this site's origin
 *    and rejected if they escape it, so a tool can never be used to fetch an
 *    attacker-chosen URL with the user's cookies attached.
 *  - **No privilege escalation.** These run in the user's page with the user's
 *    session. They expose nothing an anonymous visitor could not already read.
 *
 * Dependencies are injected rather than imported so the tools can be unit
 * tested without a browser (see tests/unit/webmcp.test.ts).
 */

/** A content item surfaced in the command palette, reused for search. */
export interface WebMcpContentItem {
	label: string;
	description: string;
	href: string;
}

/** Everything the tools need from the page. */
export interface WebMcpDeps {
	/** This site's origin, e.g. `https://example.com`. */
	origin: string;
	/** Published content already loaded for the command palette. */
	items: () => WebMcpContentItem[];
	/** Client-side navigation (SvelteKit's `goto`). */
	navigate: (path: string) => void | Promise<unknown>;
	/** Apply a colour theme preference. */
	setTheme: (theme: 'light' | 'dark' | 'system') => void;
	/** Injected for tests; defaults to the global fetch. */
	fetch?: typeof fetch;
}

/** The tool shape WebMCP expects. */
export interface WebMcpTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (input: Record<string, unknown>) => Promise<{
		content: Array<{ type: 'text'; text: string }>;
	}>;
}

/** Minimal shape of the WebMCP browser API (no ambient types ship for it yet). */
interface ModelContextCapableNavigator {
	modelContext?: {
		provideContext: (context: { tools: WebMcpTool[] }) => void;
	};
}

/** Wrap a string as the tool result payload WebMCP expects. */
function text(value: string) {
	return { content: [{ type: 'text' as const, text: value }] };
}

/**
 * Resolve a caller-supplied path against this origin, rejecting anything that
 * leaves it.
 *
 * Absolute URLs pointing elsewhere, protocol-relative `//evil.example`, and
 * `javascript:` are all refused here rather than deeper in a tool.
 */
export function resolveSamePath(origin: string, path: unknown): string | null {
	if (typeof path !== 'string' || !path.trim()) return null;
	try {
		const resolved = new URL(path, origin);
		if (resolved.origin !== new URL(origin).origin) return null;
		return resolved.pathname + resolved.search;
	} catch {
		return null;
	}
}

/** Build the tool set. Pure — no browser globals touched at build time. */
export function buildWebMcpTools(deps: WebMcpDeps): WebMcpTool[] {
	const doFetch: typeof fetch = deps.fetch ?? ((...args) => fetch(...args));

	return [
		{
			name: 'search_site_content',
			description:
				'Search this site’s published articles and pages by title or description. Returns matching titles with their URLs.',
			inputSchema: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Words to match against titles and descriptions.' }
				},
				required: ['query']
			},
			execute: async (input) => {
				const query = String(input.query ?? '')
					.trim()
					.toLowerCase();
				if (!query) return text('Provide a non-empty query.');

				const matches = deps
					.items()
					.filter(
						(item) =>
							item.label.toLowerCase().includes(query) ||
							item.description.toLowerCase().includes(query)
					)
					.slice(0, 20);

				if (!matches.length) {
					return text(
						`No published content matched "${query}". Try list_site_pages for the full index.`
					);
				}
				return text(
					matches
						.map((item) => `- ${item.label} — ${item.description}\n  ${deps.origin}${item.href}`)
						.join('\n')
				);
			}
		},
		{
			name: 'list_site_pages',
			description:
				'List every publicly crawlable URL on this site, read from its sitemap. Use this to discover what exists before fetching pages.',
			inputSchema: { type: 'object', properties: {} },
			execute: async () => {
				const response = await doFetch(`${deps.origin}/sitemap.xml`, {
					headers: { Accept: 'application/xml' }
				});
				if (!response.ok) return text(`Could not read the sitemap (HTTP ${response.status}).`);

				const xml = await response.text();
				const locations = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1]);
				return locations.length
					? text(locations.join('\n'))
					: text('The sitemap contains no URLs.');
			}
		},
		{
			name: 'read_page_as_markdown',
			description:
				'Fetch a page on this site and return it as Markdown instead of HTML. Much cheaper to read than the rendered page.',
			inputSchema: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'A path on this site, for example "/" or "/blog/hello-world".'
					}
				},
				required: ['path']
			},
			execute: async (input) => {
				const path = resolveSamePath(deps.origin, input.path);
				if (!path) return text('Provide a path on this site, such as "/documentation".');

				const response = await doFetch(`${deps.origin}${path}`, {
					headers: { Accept: 'text/markdown' }
				});
				if (!response.ok) return text(`${path} returned HTTP ${response.status}.`);
				return text(await response.text());
			}
		},
		{
			name: 'navigate_to_page',
			description:
				'Move the browser to a page on this site, so the user sees it. Use read_page_as_markdown instead if you only need to read the content.',
			inputSchema: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'A path on this site, for example "/contact".' }
				},
				required: ['path']
			},
			execute: async (input) => {
				const path = resolveSamePath(deps.origin, input.path);
				if (!path) return text('Provide a path on this site, such as "/contact".');
				await deps.navigate(path);
				return text(`Navigated to ${path}.`);
			}
		},
		{
			name: 'set_color_theme',
			description:
				'Switch this site between its light and dark themes, or follow the operating system setting.',
			inputSchema: {
				type: 'object',
				properties: {
					theme: { type: 'string', enum: ['light', 'dark', 'system'] }
				},
				required: ['theme']
			},
			execute: async (input) => {
				const theme = input.theme;
				if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
					return text('Choose one of: light, dark, system.');
				}
				deps.setTheme(theme);
				return text(`Theme set to ${theme}.`);
			}
		}
	];
}

/**
 * Register the tools with the browser, if it supports WebMCP.
 *
 * Returns true when registration happened. Safe to call unconditionally: on a
 * browser without `navigator.modelContext` — which is most of them today — it
 * does nothing and costs one property lookup.
 */
export function registerWebMcpTools(deps: WebMcpDeps): boolean {
	if (typeof navigator === 'undefined') return false;

	const modelContext = (navigator as Navigator & ModelContextCapableNavigator).modelContext;
	if (!modelContext?.provideContext) return false;

	try {
		modelContext.provideContext({ tools: buildWebMcpTools(deps) });
		return true;
	} catch (error) {
		// A failed registration must never break the page for a human visitor.
		console.error('WebMCP: failed to register tools', error);
		return false;
	}
}
