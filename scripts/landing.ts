/**
 * Landing pages CLI (docs/SEO_LANDING_PAGES.md).
 *
 *   bun run landing new <who|where|what|when|why> <slug>   empty draft stub with TODO markers
 *   bun run landing index                                  rebuild content/pages/index.ts
 *   bun run landing report                                 audit errors + open TODOs
 *
 * It never writes page prose. Stubs are empty on purpose.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FAMILY_KEYS, isFamilyKey, pageStub, pagesIndex } from '../src/lib/landing/scaffold';

const PAGES_DIR = resolve(import.meta.dir, '../src/lib/landing/content/pages');

function rebuildIndex() {
	const entries = FAMILY_KEYS.flatMap((family) => {
		const dir = join(PAGES_DIR, family);
		if (!existsSync(dir)) return [];
		return readdirSync(dir)
			.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
			.map((f) => `${family}/${f.slice(0, -3)}`);
	});
	writeFileSync(join(PAGES_DIR, 'index.ts'), pagesIndex(entries));
	console.log(`index: ${entries.length} page(s)`);
}

const [command, family, slug] = process.argv.slice(2);

if (command === 'new') {
	if (!family || !isFamilyKey(family) || !slug) {
		console.error(`usage: bun run landing new <${FAMILY_KEYS.join('|')}> <slug>`);
		process.exit(1);
	}
	const file = join(PAGES_DIR, family, `${slug}.ts`);
	if (existsSync(file)) {
		console.error(`${file} already exists`);
		process.exit(1);
	}
	mkdirSync(join(PAGES_DIR, family), { recursive: true });
	writeFileSync(file, pageStub(family, slug));
	rebuildIndex();
	console.log(
		`created ${file} (draft). If "${family}" is not in defineFamilies in content/site.ts, add it.`
	);
} else if (command === 'index') {
	rebuildIndex();
} else if (command === 'report') {
	const { LANDING } = await import('../src/lib/landing/content/site');
	const { auditLanding, formatAudit } = await import('../src/lib/landing/audit');
	const report = auditLanding(LANDING);
	console.log(formatAudit(report));
	process.exit(report.errors.length ? 1 : 0);
} else {
	console.error('usage: bun run landing <new|index|report>');
	process.exit(1);
}
