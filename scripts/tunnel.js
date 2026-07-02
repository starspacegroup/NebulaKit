#!/usr/bin/env node
/**
 * Cloudflare Tunnel helper for local development.
 *
 * Usage:
 *   bun run tunnel          # free quick tunnel (trycloudflare.com)
 *   npm run tunnel
 *
 * Custom domain (requires a configured Cloudflare named tunnel):
 *   TUNNEL_TOKEN=<token> bun run tunnel
 *
 * Override the local port (default: 4277):
 *   PORT=3000 bun run tunnel
 */

import { spawn } from 'child_process';

const PORT = process.env.PORT ?? '4277';
const TOKEN = process.env.TUNNEL_TOKEN;

let args;

if (TOKEN) {
	console.log('🌐 Starting named Cloudflare tunnel (custom domain)...');
	args = ['tunnel', '--no-autoupdate', 'run', '--token', TOKEN];
} else {
	console.log(`🚇 Starting free Cloudflare quick tunnel → http://localhost:${PORT}`);
	console.log('   Your public URL will appear below (trycloudflare.com).');
	console.log('   For a custom domain (e.g. myapp.davis9001.dev) set TUNNEL_TOKEN.\n');
	args = ['tunnel', '--url', `http://localhost:${PORT}`];
}

const proc = spawn('cloudflared', args, { stdio: 'inherit' });

proc.on('error', (err) => {
	if (err.code === 'ENOENT') {
		console.error('\n❌  cloudflared not found. Install it first:\n');
		console.error('   macOS:   brew install cloudflared');
		console.error('   Linux:   https://pkg.cloudflare.com/index.html');
		console.error('   Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n');
	} else {
		console.error('Tunnel error:', err.message);
	}
	process.exit(1);
});

proc.on('exit', (code) => {
	process.exit(code ?? 0);
});
