import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// The builder, the shop and the security surface are packages inside this
		// repo (packages/*), versioned on their own so a site can take one update
		// without the others. See planning/BUILDER_AND_COMMERCE.md in the umbrella.
		alias: {
			'@nebulakit/commerce': 'packages/commerce/src',
			'@nebulakit/builder': 'packages/builder/src',
			'@nebulakit/security': 'packages/security/src'
		},
		typescript: {
			// packages/* sit outside src/, so add them to the generated tsconfig or
			// `bun run check` would only see the parts some route happens to import.
			config(tsconfig) {
				tsconfig.include.push('../packages/**/*.ts', '../packages/**/*.svelte');
			}
		},
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
		})
	}
};

export default config;
