import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/admin/+page.svelte';

const traffic = (classes: unknown) => ({
	daily: [{ day: '2026-11-17', views: 70, signedIn: 3 }],
	hourly: [],
	byPath: [{ pathKey: '/', views: 70, signedIn: 3 }],
	topContent: [],
	classes,
	referrers: [],
	countries: [],
	audience: { os: [], browsers: [], devices: [], languages: [], viewports: [] }
});

const data = (classes: unknown) =>
	({
		stats: {
			totalUsers: 1,
			totalAdmins: 1,
			totalContent: 0,
			totalContactSubmissions: 0,
			totalChatMessages: 0,
			contentByStatus: { draft: 0, published: 0, archived: 0 },
			usersByMonth: [],
			contentByMonth: []
		},
		traffic: traffic(classes),
		trafficWindow: 30,
		trafficNowHour: '2026-11-17T09',
		canViewStats: true,
		usage: null
	}) as any;

describe('admin dashboard: who is visiting', () => {
	it('splits page loads into probably real, likely bots and known bots', () => {
		render(Page, { props: { data: data({ human: 70, likelyBot: 20, bot: 10 }) } });
		const card = screen.getByLabelText('Who is visiting');
		expect(within(card).getByText('100 page loads', { exact: false })).toBeInTheDocument();
		expect(within(card).getByText('Probably real').parentElement).toHaveTextContent('70 70%');
		expect(within(card).getByText('Likely bots').parentElement).toHaveTextContent('20 20%');
		expect(within(card).getByText('Known bots').parentElement).toHaveTextContent('10 10%');
		expect(within(card).getByText(/probably real/i, { selector: 'strong' })).toBeInTheDocument();
	});

	it('shows no card before there is a split to show (older database, or nothing counted yet)', () => {
		const { unmount } = render(Page, { props: { data: data(null) } });
		expect(screen.queryByLabelText('Who is visiting')).toBeNull();
		unmount();
		render(Page, { props: { data: data({ human: 0, likelyBot: 0, bot: 0 }) } });
		expect(screen.queryByLabelText('Who is visiting')).toBeNull();
	});
});
