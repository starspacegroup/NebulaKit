#!/usr/bin/env node
/**
 * Print a fresh ENCRYPTION_KEY: base64 of 32 random bytes (AES-256 root key).
 *
 *   bun run generate:encryption-key          # the key alone, for piping
 *   bun run generate:encryption-key --env    # ENCRYPTION_KEY=... for .dev.vars
 *
 * Nothing is written to disk. Store it as a Worker secret:
 *   bunx wrangler pages secret put ENCRYPTION_KEY
 * To rotate, move the old value to ENCRYPTION_KEY_PREVIOUS first. See
 * docs/ZERO_ENV_SETUP.md.
 */
import { randomBytes } from 'node:crypto';

export function generateKey() {
	return randomBytes(32).toString('base64');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	const key = generateKey();
	console.log(process.argv.includes('--env') ? `ENCRYPTION_KEY=${key}` : key);
}
