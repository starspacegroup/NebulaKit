import type { PlaywrightTestConfig } from '@playwright/test';
import { site } from './src/lib/site.config';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'bun run dev',
		// Wait for a real page, not just an open port. The first request starts
		// workerd's local D1; two workers hitting it cold can crash it with
		// SQLITE_BUSY (CI runs 45866686480 and 46021443973), after which every
		// test fails against a dead server.
		url: `http://localhost:${site.devPort}/`,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'tests/e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	use: {
		baseURL: `http://localhost:${site.devPort}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list'
};

export default config;
