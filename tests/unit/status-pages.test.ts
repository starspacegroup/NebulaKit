import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
// happy-dom reports no form method, which SvelteKit's enhance refuses; the actions are not under test.
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import Status from '../../src/routes/status/+page.svelte';
import Admin from '../../src/routes/admin/status/+page.svelte';

const days = (level = 'operational') =>
	Array.from({ length: 90 }, (_, i) => ({
		day: `2026-08-${String(i + 1).padStart(2, '0')}`,
		level
	}));
const component = (over: Record<string, unknown> = {}) => ({
	id: 'website',
	name: 'Website',
	description: 'The public pages, the admin area and the API.',
	status: 'operational',
	since: '2026-11-17 00:00:00',
	detail: 'Responding normally.',
	latencyMs: 90,
	uptimePercent: 99.98,
	days: days(),
	...over
});
const update = (over: Record<string, unknown> = {}) => ({
	id: 1,
	status: 'investigating',
	body: 'We are looking into this.',
	createdAt: '2026-11-17 10:03:00',
	byPerson: false,
	...over
});
const incident = (over: Record<string, unknown> = {}) => ({
	id: 1,
	title: 'Website is unavailable',
	impact: 'major',
	status: 'investigating',
	components: ['website'],
	auto: true,
	startedAt: '2026-11-17 10:03:00',
	resolvedAt: null,
	updates: [update()],
	...over
});
const snapshot = (over: Record<string, unknown> = {}) => ({
	generatedAt: '2026-11-17 10:05:00',
	overall: 'operational',
	headline: 'All systems operational',
	stale: false,
	lastChecked: '2026-11-17 10:04:00',
	components: [
		component(),
		component({ id: 'database', name: 'Database', description: 'Where it is stored.' })
	],
	openIncidents: [],
	recentIncidents: [],
	...over
});
const page = (snap: unknown) => ({ data: { snapshot: snap } as never });

describe('/status', () => {
	it('shows all systems operational, each system with its bars and uptime', () => {
		render(Status, page(snapshot()));
		expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/status$/);
		expect(screen.getByRole('heading', { name: 'All systems operational' })).toBeTruthy();
		expect(screen.getByText(/Last checked 17 Nov, 10:04 UTC/)).toBeTruthy();
		const systems = screen.getAllByRole('img', { name: /Last 90 days\. 99\.98% uptime\./ });
		expect(systems).toHaveLength(2);
		expect(systems[0].querySelectorAll('.bar')).toHaveLength(90);
		expect(screen.getAllByText('Operational')).toHaveLength(2);
		expect(screen.getByText('Nothing in the last 30 days.')).toBeTruthy();
	});

	it('does not claim all is well when the checks stopped', () => {
		render(
			Status,
			page(snapshot({ stale: true, headline: 'Status checks are delayed', lastChecked: null }))
		);
		expect(screen.getByRole('heading', { name: 'Status checks are delayed' })).toBeTruthy();
		expect(screen.getByText(/We will not say all is well until checks resume/)).toBeTruthy();
		expect(screen.queryByText('All systems operational')).toBeNull();
	});

	it('says it cannot read the data, as a non-answer', () => {
		render(Status, page(null));
		expect(screen.getByRole('heading', { name: 'Status is not available right now' })).toBeTruthy();
		expect(screen.getByText(/This is not an all-clear/)).toBeTruthy();
		expect(screen.queryByText('All systems operational')).toBeNull();
	});

	it('shows a down system with its reason, and the open incident with its updates', () => {
		render(
			Status,
			page(
				snapshot({
					overall: 'down',
					headline: 'Some systems are down',
					components: [
						component({
							status: 'down',
							detail: 'The website did not answer a check from outside.'
						}),
						component({ id: 'database', name: 'Database' })
					],
					openIncidents: [incident()]
				})
			)
		);
		expect(screen.getByRole('heading', { name: 'Some systems are down' })).toBeTruthy();
		expect(screen.getByText('Down')).toBeTruthy();
		expect(screen.getByText('The website did not answer a check from outside.')).toBeTruthy();
		const open = screen.getByRole('region', { name: 'Open incidents' });
		expect(within(open).getByRole('heading', { name: 'Website is unavailable' })).toBeTruthy();
		expect(within(open).getByText('Major')).toBeTruthy();
		expect(within(open).getByText(/Affects Website/)).toBeTruthy();
		expect(within(open).getByText('We are looking into this.')).toBeTruthy();
	});

	it('shows a slow system, and no reason line for a healthy one', () => {
		render(
			Status,
			page(
				snapshot({
					overall: 'degraded',
					headline: 'Some systems are slow',
					components: [
						component({ status: 'degraded', detail: 'The website is responding slowly.' }),
						component({ id: 'database', name: 'Database' })
					]
				})
			)
		);
		expect(screen.getByText('Slow')).toBeTruthy();
		expect(screen.getByText('The website is responding slowly.')).toBeTruthy();
		expect(screen.queryByText('Responding normally.')).toBeNull();
	});

	it('lists resolved incidents from the last 30 days', () => {
		render(
			Status,
			page(
				snapshot({
					recentIncidents: [
						incident({
							status: 'resolved',
							resolvedAt: '2026-11-17 10:20:00',
							updates: [update({ status: 'resolved', body: 'Passing again.' })]
						})
					]
				})
			)
		);
		expect(screen.queryByText('Nothing in the last 30 days.')).toBeNull();
		expect(screen.getByText(/17 Nov, 10:03 UTC to 17 Nov, 10:20 UTC/)).toBeTruthy();
		expect(screen.getByText('Passing again.')).toBeTruthy();
	});

	it('says there is no history yet rather than inventing an uptime figure', () => {
		render(
			Status,
			page(snapshot({ components: [component({ uptimePercent: null, days: days('none') })] }))
		);
		expect(screen.getByRole('img', { name: 'Last 90 days. No history yet.' })).toBeTruthy();
		expect(screen.getByText('No history yet')).toBeTruthy();
	});

	it('links the JSON feed', () => {
		render(Status, page(snapshot()));
		expect(screen.getByRole('link', { name: '/api/status' }).getAttribute('href')).toBe(
			'/api/status'
		);
	});
});

describe('/admin/status', () => {
	const data = (snap: unknown = snapshot()) =>
		({
			snapshot: snap,
			components: [
				{ id: 'website', name: 'Website' },
				{ id: 'database', name: 'Database' }
			],
			impacts: ['minor', 'major', 'critical', 'maintenance'],
			statuses: ['investigating', 'identified', 'monitoring', 'resolved']
		}) as never;

	it('shows how each component is doing and the form to post an incident', () => {
		render(Admin, { data: data(), form: null });
		expect(screen.getByRole('heading', { name: 'Status page' })).toBeTruthy();
		const now = screen.getByRole('list', { name: 'Component status' });
		expect(within(now).getAllByText('Operational')).toHaveLength(2);
		expect(screen.getByLabelText('Title')).toBeTruthy();
		expect(screen.getByRole('checkbox', { name: 'Website' })).toBeTruthy();
		expect(screen.getByRole('checkbox', { name: 'Database' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Post to the status page' })).toBeTruthy();
		expect(screen.getByText('None open.')).toBeTruthy();
	});

	it('warns when the checks have stopped, and points at the setup doc', () => {
		render(Admin, { data: data(snapshot({ stale: true, lastChecked: null })), form: null });
		expect(screen.getByText(/The newest check is missing/)).toBeTruthy();
		expect(screen.getByText(/docs\/STATUS_PAGE\.md/)).toBeTruthy();
	});

	it('lists open incidents with an update form, marking the ones the checks opened', () => {
		render(Admin, { data: data(snapshot({ openIncidents: [incident()] })), form: null });
		const list = screen.getByRole('list', { name: 'Open incidents' });
		expect(within(list).getByText('Opened by the checks')).toBeTruthy();
		expect(within(list).getByRole('button', { name: 'Post update' })).toBeTruthy();
		expect(within(list).getByLabelText('Add an update')).toBeTruthy();
	});

	it('shows a refused post and a success message', () => {
		const { unmount } = render(Admin, {
			data: data(),
			form: { action: 'create', problems: ['Give the incident a title.'] } as never
		});
		expect(screen.getByRole('alert').textContent).toContain('Give the incident a title.');
		unmount();
		render(Admin, {
			data: data(),
			form: { action: 'create', message: 'Posted. It is on the public status page now.' } as never
		});
		expect(screen.getByText(/It is on the public status page now/)).toBeTruthy();
	});

	it('shows an update problem only on the incident it belongs to', () => {
		render(Admin, {
			data: data(snapshot({ openIncidents: [incident(), incident({ id: 2, title: 'Other' })] })),
			form: { action: 'update', incident: 2, problems: ['Write what changed.'] } as never
		});
		expect(screen.getAllByRole('alert')).toHaveLength(1);
	});
});
