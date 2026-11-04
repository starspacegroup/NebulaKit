import { describe, expect, it } from 'vitest';
import { GET } from '../../src/routes/robots.txt/+server';
import { CRAWLER_DISALLOW, LINK_PREVIEW_BOTS } from '../../src/lib/agent-discovery';

async function robots(): Promise<string> {
	const res = await GET({ url: new URL('https://example.test/robots.txt') } as any);
	return res.text();
}

/** The rule lines of the group that names `agent`. */
function groupFor(body: string, agent: string): string[] {
	const blocks = body.split(/\n\n+/);
	const block = blocks.find((b) => b.split('\n').includes(`User-agent: ${agent}`));
	return block ? block.split('\n') : [];
}

describe('robots.txt and link previews', () => {
	it('keeps /media/ closed to ordinary crawlers', async () => {
		const rules = groupFor(await robots(), '*');
		expect(rules).toContain('Disallow: /media/');
	});

	it('opens /media/ to every link-preview bot, so share images load', async () => {
		const body = await robots();
		for (const bot of LINK_PREVIEW_BOTS) {
			const rules = groupFor(body, bot);
			expect(rules.length, bot).toBeGreaterThan(0);
			expect(rules, bot).not.toContain('Disallow: /media/');
			expect(rules, bot).toContain('Allow: /');
		}
	});

	it('still keeps the private surfaces closed to link-preview bots', async () => {
		const rules = groupFor(await robots(), 'Twitterbot');
		for (const path of CRAWLER_DISALLOW.filter((p) => p !== '/media/')) {
			expect(rules).toContain(`Disallow: ${path}`);
		}
	});
});
