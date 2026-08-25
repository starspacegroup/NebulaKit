// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type {
	D1Database,
	IncomingRequestCfProperties,
	KVNamespace,
	Queue,
	R2Bucket
} from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			user?: {
				id: string;
				login: string;
				githubLogin?: string;
				simulatedConnections?: string[];
				email: string;
				name?: string;
				avatarUrl?: string;
				isOwner: boolean;
				isAdmin?: boolean;
				/** Extension point for downstream apps that add a tier ABOVE owner.
				 *  NebulaKit never sets it; both `auth-guards.ts` and `stats-guard.ts`
				 *  honour it, and they must agree — see the note in `auth-guards.ts`. */
				isSuperAdmin?: boolean;
				canViewStats?: boolean;
				isPretend?: boolean;
			};
		}
		interface Platform {
			env: {
				DB: D1Database;
				KV: KVNamespace;
				BUCKET: R2Bucket;
				QUEUE: Queue;
				TURNSTILE_SECRET_KEY?: string;
				TURNSTILE_SITE_KEY?: string;
				GITHUB_CLIENT_ID?: string;
				GITHUB_CLIENT_SECRET?: string;
				GITHUB_OWNER_ID?: string;
				DISCORD_CLIENT_ID?: string;
				DISCORD_CLIENT_SECRET?: string;
				SESSION_SECRET?: string;
				SETUP_SECRET?: string;
				DEV_AUTH_BYPASS?: string;
				/** Shared bearer secret for /api/cron/* scheduler endpoints. */
				CRON_SECRET?: string;
			};
			/** Cloudflare request metadata. `cf.country` is the edge-provided ISO
			 *  3166-1 alpha-2 code used by page-view stats — undefined locally. */
			cf?: IncomingRequestCfProperties;
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
