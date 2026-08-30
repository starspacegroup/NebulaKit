import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Writable } from 'svelte/store';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// The factory is hoisted above the imports, so the store is created inside it
// and read back through the mocked module below.
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({ url: new URL('http://localhost/'), params: {}, status: 200, error: null }),
		navigating: writable(null),
		updated: { check: () => Promise.resolve(false), subscribe: writable(false).subscribe }
	};
});

// The component's job is wiring, not DOM insertion: spy on the two helpers it
// calls and leave the parser real, so the admin page's preview assertions still
// run against the real `parseMeasurementId`. This also keeps a live
// `<script src>` out of the test DOM, which the environment would try to fetch.
vi.mock('$lib/utils/analytics', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/analytics')>();
	return { ...actual, installGtag: vi.fn(), sendPageView: vi.fn() };
});

import { page } from '$app/stores';

const pageStore = page as unknown as Writable<{
	url: URL;
	params: Record<string, string>;
	status: number;
	error: null;
}>;

import GoogleAnalytics from '../../src/lib/components/GoogleAnalytics.svelte';
import AdminLayout from '../../src/routes/admin/+layout.svelte';
import AnalyticsPage from '../../src/routes/admin/analytics/+page.svelte';
import { load } from '../../src/routes/admin/analytics/+page.server';
import { installGtag, sendPageView } from '../../src/lib/utils/analytics';

const OWNER = { id: 'u1', login: 'owner', email: 'owner@test.com', isOwner: true };
const STATS_ADMIN = {
	id: 'u2',
	login: 'admin',
	email: 'admin@test.com',
	isOwner: false,
	isAdmin: true,
	canViewStats: true
};

const CONNECTED = {
	provider: 'ga4' as const,
	measurementId: 'G-ABCD123456',
	enabled: true,
	updatedAt: '2026-08-01T12:00:00.000Z'
};

/** The admin page reads only `config`; the rest is the layout payload the
 *  generated `PageData` type folds in. */
const pageData = (config: typeof CONNECTED | null) => ({
	config,
	user: OWNER,
	hasAIProviders: false,
	cmsPaletteItems: [],
	gaMeasurementId: null,
	canRevealPii: true,
	piiRevealed: false,
	canViewStats: true,
	canManageAnalytics: true
});

function kvWith(value: string | null) {
	return { env: { KV: { get: vi.fn(async () => value) } } } as never;
}

describe('/admin/analytics load', () => {
	it('hands the saved connection to the owner', async () => {
		const data = await load({
			locals: { user: OWNER },
			platform: kvWith(JSON.stringify(CONNECTED))
		} as never);

		expect(data).toEqual({ config: CONNECTED });
	});

	it('reports no connection when nothing is saved', async () => {
		const data = await load({ locals: { user: OWNER }, platform: kvWith(null) } as never);
		expect(data).toEqual({ config: null });
	});

	// Hidden UI is not authorization, but the route should still not 403 an admin
	// who merely followed a stale link.
	it('redirects an admin who cannot manage the connection', async () => {
		await expect(
			load({ locals: { user: STATS_ADMIN }, platform: kvWith(null) } as never)
		).rejects.toMatchObject({ status: 302, location: '/admin' });
	});
});

describe('Admin analytics page', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		mockFetch.mockReset();
		vi.stubGlobal('fetch', mockFetch);
	});

	it('shows the disconnected state and no third-party claim', () => {
		render(AnalyticsPage, { props: { data: pageData(null) } });

		expect(screen.getByRole('heading', { name: 'Analytics', level: 1 })).toBeInTheDocument();
		expect(screen.getByText('Not connected')).toBeInTheDocument();
		expect(screen.getByText(/No third-party tag loads on this site/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Disconnect/i })).not.toBeInTheDocument();
	});

	it('shows the saved measurement ID once connected', () => {
		render(AnalyticsPage, { props: { data: pageData(CONNECTED) } });

		expect(screen.getByText('G-ABCD123456')).toBeInTheDocument();
		expect(screen.getByText('Connected')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
	});

	it('previews the ID it will save out of a pasted snippet', async () => {
		render(AnalyticsPage, { props: { data: pageData(null) } });

		await fireEvent.input(screen.getByLabelText(/Measurement ID/i), {
			target: {
				value: '<script src="https://www.googletagmanager.com/gtag/js?id=G-PASTE12345"></script>'
			}
		});

		expect(await screen.findByText(/Will save/i)).toHaveTextContent('G-PASTE12345');
	});

	it('explains a Tag Manager container ID and keeps Connect disabled', async () => {
		render(AnalyticsPage, { props: { data: pageData(null) } });
		const connect = screen.getByRole('button', { name: /Connect/i });
		expect(connect).toBeDisabled();

		await fireEvent.input(screen.getByLabelText(/Measurement ID/i), {
			target: { value: 'GTM-ABC1234' }
		});

		expect(await screen.findByText(/Tag Manager/i)).toBeInTheDocument();
		expect(connect).toBeDisabled();
	});

	it('saves a measurement ID and reports success', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, config: CONNECTED })
		});
		render(AnalyticsPage, { props: { data: pageData(null) } });

		await fireEvent.input(screen.getByLabelText(/Measurement ID/i), {
			target: { value: 'G-ABCD123456' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

		await waitFor(() =>
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/settings/analytics',
				expect.objectContaining({ method: 'POST' })
			)
		);
		expect(await screen.findByText(/Google Analytics connected/i)).toBeInTheDocument();
	});

	it('surfaces the reason the server gives when a save is refused', async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			json: async () => ({ message: 'That is a Universal Analytics ID.' })
		});
		render(AnalyticsPage, { props: { data: pageData(null) } });

		await fireEvent.input(screen.getByLabelText(/Measurement ID/i), {
			target: { value: 'G-ABCD123456' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

		expect(await screen.findByText(/Universal Analytics ID/i)).toBeInTheDocument();
	});

	it('pauses the tag without retyping the ID', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, config: { ...CONNECTED, enabled: false } })
		});
		render(AnalyticsPage, { props: { data: pageData(CONNECTED) } });

		await fireEvent.click(screen.getByRole('button', { name: /Pause Google Analytics/i }));

		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
		expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ enabled: false });
		expect(await screen.findByText('Connected, paused')).toBeInTheDocument();
	});

	it('disconnects with a DELETE', async () => {
		mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, config: null }) });
		render(AnalyticsPage, { props: { data: pageData(CONNECTED) } });

		await fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));

		await waitFor(() =>
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/admin/settings/analytics',
				expect.objectContaining({ method: 'DELETE' })
			)
		);
		expect(await screen.findByText(/no longer loads on any page/i)).toBeInTheDocument();
	});
});

describe('Admin sidebar', () => {
	const layoutData = (canManageAnalytics: boolean) => ({
		user: OWNER,
		hasAIProviders: false,
		cmsPaletteItems: [],
		gaMeasurementId: null,
		canRevealPii: true,
		piiRevealed: false,
		canViewStats: true,
		canManageAnalytics
	});

	it('offers Analytics to whoever may manage the connection', () => {
		render(AdminLayout, { props: { data: layoutData(true) } });
		expect(screen.getByRole('link', { name: /Analytics/i })).toHaveAttribute(
			'href',
			'/admin/analytics'
		);
	});

	it('hides it from an admin who may not', () => {
		render(AdminLayout, { props: { data: layoutData(false) } });
		expect(screen.queryByRole('link', { name: /Analytics/i })).not.toBeInTheDocument();
	});
});

describe('GoogleAnalytics component', () => {
	beforeEach(() => {
		vi.mocked(installGtag).mockClear();
		vi.mocked(sendPageView).mockClear();
		pageStore.set({ url: new URL('http://localhost/'), params: {}, status: 200, error: null });
	});

	it('makes no third-party request when nothing is connected', async () => {
		render(GoogleAnalytics, { props: { measurementId: null } });
		await waitFor(() => expect(installGtag).not.toHaveBeenCalled());
		expect(sendPageView).not.toHaveBeenCalled();
	});

	it('loads the tag on a public page and reports the view', async () => {
		render(GoogleAnalytics, { props: { measurementId: 'G-ABCD123456' } });
		await waitFor(() => expect(installGtag).toHaveBeenCalledTimes(1));

		// Compare `window`/`document` by identity. A deep equality check walks
		// them, and walking `window` reaches Svelte's internals, which throw
		// `rune_outside_svelte` when read outside a component.
		const [installWin, installDoc, installId] = vi.mocked(installGtag).mock.calls[0];
		expect(installWin).toBe(window);
		expect(installDoc).toBe(document);
		expect(installId).toBe('G-ABCD123456');

		const [viewWin, viewId, fields] = vi.mocked(sendPageView).mock.calls[0];
		expect(viewWin).toBe(window);
		expect(viewId).toBe('G-ABCD123456');
		expect(fields).toMatchObject({ path: '/', location: 'http://localhost/' });
	});

	// Admin traffic is the owner's own; counting it would skew every number.
	it('stays off the admin surface', async () => {
		pageStore.set({
			url: new URL('http://localhost/admin/stats'),
			params: {},
			status: 200,
			error: null
		});
		render(GoogleAnalytics, { props: { measurementId: 'G-ABCD123456' } });

		await waitFor(() => expect(installGtag).not.toHaveBeenCalled());
		expect(sendPageView).not.toHaveBeenCalled();
	});

	// SvelteKit routes on the client, so gtag's own page_view would count the
	// first document only.
	it('reports each client-side navigation', async () => {
		render(GoogleAnalytics, { props: { measurementId: 'G-ABCD123456' } });
		await waitFor(() => expect(sendPageView).toHaveBeenCalledTimes(1));

		pageStore.set({
			url: new URL('http://localhost/blog?page=2'),
			params: {},
			status: 200,
			error: null
		});

		await waitFor(() => expect(sendPageView).toHaveBeenCalledTimes(2));
		expect(vi.mocked(sendPageView).mock.calls[1][2].path).toBe('/blog?page=2');
	});
});
