import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { site } from './src/lib/site.config';

/**
 * Vite plugin that fixes stale dep hash 504s when serving through cloudflared.
 *
 * Problem: Vite optimizes deps and tags them with a browser hash (?v=abc123).
 * When the hash changes (e.g. after a restart or re-optimization), browsers
 * with cached modules still request the OLD hash. Vite returns 504 for hash
 * mismatches, which breaks hydration entirely — no client-side JS works.
 *
 * Fix: Intercept requests for optimized dep files and strip the ?v= parameter
 * so Vite always serves the current version regardless of what hash the browser
 * is requesting.
 */
function staleDepsFix() {
	return {
		name: 'stale-deps-fix',
		configureServer(server: {
			middlewares: {
				use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void;
			};
		}) {
			server.middlewares.use((req, _res, next) => {
				if (req.url?.includes('/node_modules/.vite/deps/') && req.url.includes('?v=')) {
					req.url = req.url.replace(/\?v=[a-f0-9]+/, '');
				}
				next();
			});
		}
	};
}

export default defineConfig({
	plugins: [staleDepsFix(), sveltekit()],
	// Preview (vite preview) reuses the dev port so local URLs stay stable.
	preview: {
		port: site.devPort,
		host: true
	},
	server: {
		port: site.devPort,
		host: true, // listen on all interfaces so cloudflared can reach the dev server
		// Allow any subdomain of the project's custom domain (set TUNNEL_HOSTNAME in .env)
		// plus the free trycloudflare.com hostnames and localhost.
		// Leading "." matches any subdomain, so per-dev tunnels work without editing this.
		// CUSTOMIZE: replace '.example.com' with your project's tunnel domain, or remove it
		// if you only ever use the free trycloudflare.com quick tunnels.
		allowedHosts: ['.trycloudflare.com', '.starspace.group', 'localhost'],
		// Disable HMR when running through a tunnel — WebSocket connections over cloudflared
		// are unreliable and cause the page to hang. Set VITE_HMR=true to re-enable for
		// purely local (no tunnel) development if you find watch-mode useful.
		hmr: process.env.VITE_HMR === 'true' ? { timeout: 5000 } : false,
		// Prevent stale 304s when HMR is off — without HMR the only update path is a
		// full reload, so cached modules produce "flash then revert" styling bugs.
		headers:
			process.env.VITE_HMR !== 'true'
				? {
						'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
						Pragma: 'no-cache',
						Expires: '0'
					}
				: {}
	},
	optimizeDeps: {
		// Pre-bundle Svelte runtime deps at startup so they're ready on first request.
		// Without this, Vite optimizes lazily and the first page load through a cloudflared
		// tunnel can 504 while the optimization runs.
		include: ['svelte', 'svelte/store', 'svelte/transition', 'svelte/animate', 'svelte/easing']
	},
	test: {
		name: 'unit',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['node_modules', 'tests/e2e/**'],
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		// Restore anything vi.stubGlobal() replaced once a test finishes.
		//
		// Several suites stub `crypto` with a bare `{ randomUUID }` to make IDs
		// deterministic. Without this flag that object outlives the test — and
		// because the pool is single-threaded (below), it leaks into every later
		// FILE too, so unrelated code calling `crypto.subtle` blows up depending on
		// which tests ran first. Symptom: a suite that passes alone and fails in a
		// full run.
		unstubGlobals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			exclude: [
				'node_modules/',
				'tests/',
				'*.config.{js,ts}',
				'**/*.d.ts',
				'**/*.test.{js,ts}',
				'**/*.spec.{js,ts}',
				'.svelte-kit/',
				'build/',
				'scripts/',
				// Dependency-free config data — nothing to unit test.
				'src/lib/site.config.ts',
				// Svelte components contain UI logic that's hard to unit test branches
				// These are tested via E2E tests for user interaction flows
				'**/*.svelte',
				// Page route type files that just define load types
				'src/routes/**/+page.ts',
				// Hooks are tested implicitly through integration tests
				'src/hooks.server.ts'
			],
			// AGENTS.md §1 calls 95% a hard floor. These were left at 90, so the
			// documented rule was never the enforced one and coverage drifted to
			// 94.28% without anything failing. Keep these and AGENTS.md in step.
			thresholds: {
				lines: 95,
				functions: 95,
				branches: 95,
				statements: 95
			}
		},
		poolOptions: {
			threads: {
				singleThread: true
			}
		},
		teardownTimeout: 5000
	}
});
