import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Allow Cloudflare dev tunnels on the starspace.group domain to reach the
		// Vite dev server (e.g. dev-nebulakit-<hash>.starspace.group).
		allowedHosts: ['.starspace.group'],
		// Never let dev assets be cached. Vite dev serves generated modules
		// (e.g. .svelte-kit/generated/client/nodes/*.js) from query-less URLs; when
		// this dev server is reached through a Cloudflare-proxied tunnel, Cloudflare
		// otherwise stamps a browser-cache TTL on them. After routes change (which
		// renumbers those node modules), a browser holding stale copies renders the
		// wrong page. `no-store` keeps dev module URLs from ever being cached.
		headers: {
			'Cache-Control': 'no-store'
		}
	},
	test: {
		name: 'unit',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['node_modules', 'tests/e2e/**'],
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
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
				// Svelte components contain UI logic that's hard to unit test branches
				// These are tested via E2E tests for user interaction flows
				'**/*.svelte',
				// Page route type files that just define load types
				'src/routes/**/+page.ts',
				// Hooks are tested implicitly through integration tests
				'src/hooks.server.ts'
			],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90
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
