import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_API_OPERATIONS } from '../../src/lib/server/site-openapi';
import commercePkg from '../../packages/commerce/package.json';
import builderPkg from '../../packages/builder/package.json';
import securityPkg from '../../packages/security/package.json';
import { COMMERCE_VERSION } from '@nebulakit/commerce';
import { BUILDER_VERSION } from '@nebulakit/builder';
import { SECURITY_VERSION } from '@nebulakit/security';

const ROOT = join(process.cwd(), 'src/routes/api/v1');

function routeFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return routeFiles(path);
		return name === '+server.ts' ? [path] : [];
	});
}

describe('site API surface', () => {
	it('describes exactly the methods the routes export', () => {
		const actual = new Set<string>();
		for (const file of routeFiles(ROOT)) {
			const dir = relative(ROOT, file).replace(/\/?\+server\.ts$/, '');
			if (dir === 'openapi.json') continue;
			const path = `/api/v1/${dir}`.replace(/\[(\w+)\]/g, '{$1}');
			const source = readFileSync(file, 'utf8');
			for (const [, method] of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)) {
				actual.add(`${method.toLowerCase()} ${path}`);
			}
		}
		const documented = new Set(
			Object.entries(SITE_API_OPERATIONS).flatMap(([path, ops]) =>
				Object.keys(ops).map((method) => `${method} ${path}`)
			)
		);
		expect([...actual].sort()).toEqual([...documented].sort());
	});
});

describe('nebulakit packages', () => {
	it('keeps exported versions in step with each package.json', () => {
		expect(COMMERCE_VERSION).toBe(commercePkg.version);
		expect(BUILDER_VERSION).toBe(builderPkg.version);
		expect(SECURITY_VERSION).toBe(securityPkg.version);
	});

	it('marks security as the forced update channel and the rest opt-in', () => {
		expect(securityPkg.nebulakit.updateChannel).toBe('forced');
		expect(commercePkg.nebulakit.updateChannel).toBe('opt-in');
		expect(builderPkg.nebulakit.updateChannel).toBe('opt-in');
	});
});
