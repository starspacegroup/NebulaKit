import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
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
