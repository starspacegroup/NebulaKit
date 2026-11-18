import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRAWLER_DISALLOW } from '../../src/lib/agent-discovery';
import { site } from '../../src/lib/site.config';

const root = process.cwd();
const sha256 = (path: string) =>
	createHash('sha256')
		.update(readFileSync(join(root, path)))
		.digest('hex');

/** The NebulaKit artwork this template ships. A site that is not NebulaKit must not ship it. */
const STOCK = {
	'static/og-image.png': '9c3bf763d6f3a74567611832d101b5f421a8a130abb652ff57b2829181140afb',
	'static/og-image.svg': '358d99eb2e52e3d2bf865893a7446b3c21df6287dfce96e0578018cd6d80825d'
};

describe('the default share image', () => {
	const file = `static${site.ogImage.src}`;
	const png = () => readFileSync(join(root, file));

	it('is a root-relative PNG or JPEG, never an SVG (platforms do not render those)', () => {
		expect(site.ogImage.src).toMatch(/^\/[^/].*\.(png|jpe?g)$/i);
	});

	it('exists, and its real size is the size the config declares', () => {
		const bytes = png();
		expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
		expect(bytes.readUInt32BE(16), 'width').toBe(site.ogImage.width);
		expect(bytes.readUInt32BE(20), 'height').toBe(site.ogImage.height);
	});

	it('is the 1.91:1 card every platform shows without cropping the middle', () => {
		expect(site.ogImage.width / site.ogImage.height).toBeCloseTo(1200 / 630, 2);
		expect(site.ogImage.width).toBeGreaterThanOrEqual(1200);
	});

	it('is small enough for every platform (X accepts 5 MB, Facebook 8 MB)', () => {
		expect(statSync(join(root, file)).size).toBeLessThan(5 * 1024 * 1024);
	});

	it('is opaque RGB, so no crawler draws its own colour behind it', () => {
		expect(png()[25], 'PNG colour type 2 is RGB without alpha').toBe(2);
	});

	it('has alt text', () => {
		expect(site.ogImage.alt.trim().length).toBeGreaterThan(10);
	});

	it('is not blocked from the crawlers that fetch it', () => {
		for (const blocked of CRAWLER_DISALLOW) {
			expect(site.ogImage.src.startsWith(blocked), `robots.txt disallows ${blocked}`).toBe(false);
		}
	});

	it("is about this site: a site that is not the template does not ship the template's artwork", () => {
		// The template's name is written in two halves on purpose: scripts/customize.mjs renames that
		// word everywhere it appears as text, and a guard renamed along with the site would compare
		// the new name to itself and never fire.
		if (site.name === ['Nebula', 'Kit'].join('')) return;
		for (const [path, stock] of Object.entries(STOCK)) {
			expect(
				sha256(path),
				`${path} is still the stock NebulaKit artwork, so every link to ${site.name} shares as NebulaKit. ` +
					'Run: bun run og:generate'
			).not.toBe(stock);
		}
	});
});

// Every page someone can share must be shared with an image. SharingMeta supplies the default,
// so the rule is just that a public page renders it, directly or through a component.
describe('every public page emits share tags', () => {
	const routes = join(root, 'src/routes');
	const components = join(root, 'src/lib/components');

	/** Routes that need no share tags, and why. A prefix of the route's path under src/routes. */
	const EXEMPT: Record<string, string> = {
		admin: 'Private: behind sign-in, and a crawler only ever sees the redirect.',
		setup: 'One-time install wizard; meaningless once the site is live.',
		reset: 'Destructive maintenance route; never shared.'
	};

	function pages(dir: string): string[] {
		return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) return pages(full);
			return entry.name === '+page.svelte' || entry.name === '+error.svelte' ? [full] : [];
		});
	}

	function emitsShareTags(file: string): boolean {
		const source = readFileSync(file, 'utf8');
		if (source.includes('<SharingMeta')) return true;
		// One level down: a page that renders a component which renders SharingMeta.
		for (const match of source.matchAll(
			/import\s+(\w+)\s+from\s+'\$lib\/components\/([^']+\.svelte)'/g
		)) {
			const inner = readFileSync(join(components, match[2]), 'utf8');
			if (inner.includes('<SharingMeta') && source.includes(`<${match[1]}`)) return true;
		}
		return false;
	}

	const all = pages(routes).map((file) => ({
		file,
		route: relative(routes, file).replace(/\/?\+(page|error)\.svelte$/, '')
	}));
	const exempt = (route: string) =>
		Object.keys(EXEMPT).some((p) => route === p || route.startsWith(`${p}/`));

	it('finds the pages', () => {
		expect(all.length).toBeGreaterThan(20);
	});

	it.each(all.filter((p) => !exempt(p.route)).map((p) => [p.route || '/', p.file]))(
		'%s renders SharingMeta',
		(_route, file) => {
			expect(emitsShareTags(file), `${relative(root, file)} has no share tags`).toBe(true);
		}
	);

	it('keeps no exemption for a route that no longer exists', () => {
		for (const prefix of Object.keys(EXEMPT)) {
			expect(
				all.some((p) => exempt(p.route) && (p.route === prefix || p.route.startsWith(`${prefix}/`)))
			).toBe(true);
		}
	});
});
