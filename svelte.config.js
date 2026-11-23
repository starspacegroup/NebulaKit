import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// The builder, the shop and the security surface are packages inside this
		// repo (packages/*), versioned on their own so a site can take one update
		// without the others. See planning/BUILDER_AND_COMMERCE.md in the umbrella.
		// Enforces what is safe for every site (see src/lib/server/security-headers.ts).
		csp: {
			mode: 'auto',
			directives: {
				'object-src': ['none'],
				'base-uri': ['self'],
				'frame-ancestors': ['self'],
				// The cart's card form (docs/CHECKOUT.md) is Stripe's frames: the Payment Element from
				// js.stripe.com and 3-D Secure from hooks.stripe.com. Exactly those, nothing wider.
				// script-src / connect-src stay open (security-headers.ts says why); a site that
				// tightens them must add https://js.stripe.com and https://api.stripe.com.
				'frame-src': ['self', 'https://js.stripe.com', 'https://hooks.stripe.com']
			}
		},
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
