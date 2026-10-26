import { describe, expect, it } from 'vitest';
import { load as statsLoad } from '../../src/routes/admin/stats/+page.server';
import { load as authKeysLoad } from '../../src/routes/admin/auth-keys/+page.server';

/** Stats moved onto the /admin dashboard and auth keys onto /admin/settings.
 *  The old URLs stay alive as permanent redirects so bookmarks keep working. */
describe('moved admin routes', () => {
	it('redirects /admin/stats to the dashboard and keeps the query', async () => {
		await expect(
			(async () => statsLoad({ url: new URL('https://example.com/admin/stats?window=7') } as any))()
		).rejects.toMatchObject({ status: 308, location: '/admin?window=7' });
	});

	it('redirects /admin/auth-keys to settings', async () => {
		await expect((async () => authKeysLoad({} as any))()).rejects.toMatchObject({
			status: 308,
			location: '/admin/settings'
		});
	});
});
