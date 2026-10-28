#!/usr/bin/env bun
/**
 * external-checks.ts — run the public checks behind the trust badges and print
 * them as YAML, ready to paste into the `checks` array that feeds
 * <TrustBadges>. See docs/TRUST_BADGES.md.
 *
 * Usage:  bun run seo:external -- example.com
 * Env:    PSI_API_KEY (optional) — a PageSpeed Insights key; the keyless quota
 *         is small and often spent.
 *
 * It only measures. It never edits a file. `passed: false` rows are things to
 * fix, not to show.
 */
import { runExternalChecks } from '../src/lib/seo/external-checks';

const host = (process.argv[2] ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!host) {
	console.error('Usage: bun run seo:external -- <host>   (for example example.com)');
	process.exit(1);
}

console.error(`Checking ${host} (SSL Labs can take a few minutes)...`);
const checks = await runExternalChecks(host, { psiKey: process.env.PSI_API_KEY });
for (const c of checks) {
	console.log(`- label: ${JSON.stringify(c.label)}`);
	console.log(`  reportUrl: ${c.reportUrl}`);
	console.log(`  measuredOn: '${c.measuredOn}'`);
	console.log(`  passed: ${c.passed}`);
	console.log(`  # ${c.detail}`);
}
process.exit(checks.every((c) => c.passed) ? 0 : 2);
