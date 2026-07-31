import type { PlaywrightTestConfig } from '@playwright/test';
import { site } from './src/lib/site.config';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run dev',
		port: site.devPort,
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
