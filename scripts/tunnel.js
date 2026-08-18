#!/usr/bin/env node
/**
 * Cloudflare Tunnel helper for local development.
 *
 * Two modes:
 *
 *   Free quick tunnel (no account required):
 *     bun run tunnel          # → random URL on trycloudflare.com
 *
 *   Named tunnel on your own domain (requires a pre-configured cloudflared tunnel
 *   token from Cloudflare Zero Trust → Networks → Tunnels):
 *     TUNNEL_TOKEN=<token> bun run tunnel
 *
 * Override the local port (default: 4277, matches the dev server):
 *   PORT=3000 bun run tunnel
 *
 * Run dev server + tunnel together (two processes, one terminal):
 *   bun run dev:tunnel
 *
 * Tip: The dev server (vite.config.ts) is pre-configured to:
 *   - Accept connections from .trycloudflare.com hostnames (allowedHosts)
 *   - Disable HMR by default to avoid WebSocket hangs over tunnels
 *   - Fix stale dep-hash 504s via the staleDepsFix plugin
 * If you use a custom domain, add it to vite.config.ts > server.allowedHosts.
 */

import { spawn } from 'child_process';

const PORT = process.env.PORT ?? '4277';
const TOKEN = process.env.TUNNEL_TOKEN;

let args;

if (TOKEN) {
	console.log('Starting named Cloudflare tunnel (custom domain)...');
	args = ['tunnel', '--no-autoupdate', 'run', '--token', TOKEN];
} else {
	console.log(`Starting free Cloudflare quick tunnel -> http://localhost:${PORT}`);
	console.log('  Your public URL will appear below (trycloudflare.com).');
	console.log('  For a custom domain set TUNNEL_TOKEN=<your-token>.\n');
	args = ['tunnel', '--url', `http://localhost:${PORT}`];
}

const proc = spawn('cloudflared', args, { stdio: 'inherit' });

proc.on('error', (err) => {
	if (err.code === 'ENOENT') {
		console.error('\ncloudflared not found. Install it first:\n');
		console.error('  macOS:   brew install cloudflared');
		console.error('  Linux:   https://pkg.cloudflare.com/index.html');
		console.error(
			'  Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n'
		);
	} else {
		console.error('Tunnel error:', err.message);
	}
	process.exit(1);
});

proc.on('exit', (code) => {
	process.exit(code ?? 0);
});
