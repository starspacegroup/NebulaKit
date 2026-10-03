import { render, screen, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../tests/fixtures/UiKitHarness.svelte';
import ChecklistWidget from './ChecklistWidget.svelte';
import ClockWidget from './ClockWidget.svelte';
import LinksWidget from './LinksWidget.svelte';
import MeterWidget from './MeterWidget.svelte';
import NotesWidget from './NotesWidget.svelte';
import StatWidget from './StatWidget.svelte';

afterEach(() => {
	vi.useRealTimers();
});

describe('NotesWidget', () => {
	it('invites the first note', () => {
		render(NotesWidget);

		expect(screen.getByLabelText('Notes')).toHaveAttribute(
			'placeholder',
			'Type anything. It stays here.'
		);
	});

	it('starts from the text it was given', () => {
		render(NotesWidget, { props: { text: 'remember the milk' } });

		expect(screen.getByLabelText('Notes')).toHaveValue('remember the milk');
	});

	it('takes an edit', async () => {
		render(NotesWidget);
		const field = screen.getByLabelText('Notes');

		await fireEvent.input(field, { target: { value: 'typed' } });

		expect(field).toHaveValue('typed');
	});
});

describe('StatWidget', () => {
	it('shows the label and the number', () => {
		render(StatWidget, { props: { label: 'Deploys', value: '128' } });

		expect(screen.getByText('Deploys')).toBeInTheDocument();
		expect(screen.getByText('128')).toBeInTheDocument();
	});

	it('marks a rise and a fall differently', () => {
		const { unmount } = render(StatWidget, { props: { delta: 12 } });

		expect(screen.getByText('+12%')).toHaveAttribute('data-direction', 'up');
		unmount();

		render(StatWidget, { props: { delta: -4 } });

		expect(screen.getByText('-4%')).toHaveAttribute('data-direction', 'down');
	});

	it('treats no movement as flat rather than as a fall', () => {
		const { container } = render(StatWidget, { props: { delta: 0 } });
		const badge = container.querySelector('.stat__delta');

		expect(badge?.textContent?.trim()).toBe('0%');
		expect(badge).toHaveAttribute('data-direction', 'flat');
	});

	it('hides the badge when there is no change to report', () => {
		const { container } = render(StatWidget, { props: { delta: null } });

		expect(container.querySelector('.stat__delta')).toBeNull();
	});

	it('draws a sparkline once there are two readings', () => {
		const { container } = render(StatWidget, { props: { series: [1, 4, 2] } });

		expect(container.querySelector('polyline')?.getAttribute('points')).toBeTruthy();
	});

	it('draws no sparkline for a series with no shape', () => {
		const { container } = render(StatWidget, { props: { series: [1] } });

		expect(container.querySelector('svg')).toBeNull();
	});

	it('colours itself from the chart palette', () => {
		const { container } = render(StatWidget, { props: { accent: 'users', series: [1, 2] } });

		expect(container.querySelector('.stat')?.getAttribute('style')).toContain('var(--chart-users)');
	});
});

describe('ClockWidget', () => {
	it('shows a time and the day it belongs to', () => {
		render(ClockWidget, { props: { timeZone: 'UTC', label: 'UTC' } });

		expect(screen.getByTestId('clock-time').textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
		expect(screen.getByText(/UTC$/)).toBeInTheDocument();
	});

	it('reports a live title instead of writing one to state', async () => {
		vi.useFakeTimers();
		const live = vi.fn();
		render(Harness, {
			props: {
				which: 'clock',
				props: { timeZone: 'UTC' },
				onEvent: (_: string, d: string) => live(d)
			}
		});

		await vi.advanceTimersByTimeAsync(1000);

		expect(live).toHaveBeenCalled();
		expect(live.mock.lastCall?.[0]).toMatch(/\d{1,2}:\d{2}:\d{2}/);
		expect(screen.getByTestId('clock-time').textContent).toBe(live.mock.lastCall?.[0]);
	});

	it('keeps ticking rather than blanking on an unusable time zone', () => {
		render(ClockWidget, { props: { timeZone: 'Not/AZone' } });

		expect(screen.getByTestId('clock-time').textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
	});

	it('stops its timer when it goes away', () => {
		vi.useFakeTimers();
		const clear = vi.spyOn(globalThis, 'clearInterval');
		const { unmount } = render(ClockWidget);

		unmount();

		expect(clear).toHaveBeenCalled();
	});
});

describe('ChecklistWidget', () => {
	const items = [
		{ id: 'a', text: 'Write tests', done: true },
		{ id: 'b', text: 'Ship it' }
	];

	it('counts what is done, and ticks an item', async () => {
		render(ChecklistWidget, { props: { items: items.map((i) => ({ ...i })) } });
		expect(screen.getByText('1 of 2 done')).toBeInTheDocument();
		await fireEvent.click(screen.getByLabelText('Ship it'));
		expect(screen.getByText('2 of 2 done')).toBeInTheDocument();
	});

	it('says so when empty', () => {
		render(ChecklistWidget);
		expect(screen.getByText('Nothing to do.')).toBeInTheDocument();
	});
});

describe('MeterWidget', () => {
	const toneOf = (props: Record<string, unknown>) => {
		const { container, unmount } = render(MeterWidget, { props });
		const tone = container.querySelector('.meter')?.getAttribute('data-tone');
		unmount();
		return tone;
	};

	it('shows the value against the goal, with a unit', () => {
		render(MeterWidget, { props: { label: 'Storage', value: 1200, goal: 2000, unit: ' MB' } });
		expect(screen.getByText(/1,200 MB/)).toBeInTheDocument();
		expect(screen.getByRole('progressbar', { name: 'Storage' })).toHaveAttribute(
			'aria-valuenow',
			'1200'
		);
	});

	it('goes green on reaching a target', () => {
		expect(toneOf({ value: 50, goal: 100 })).toBe('primary');
		expect(toneOf({ value: 100, goal: 100 })).toBe('success');
	});

	it('warns near a limit and turns red past it', () => {
		expect(toneOf({ value: 10, goal: 100, limit: true })).toBe('success');
		expect(toneOf({ value: 85, goal: 100, limit: true })).toBe('warning');
		expect(toneOf({ value: 120, goal: 100, limit: true })).toBe('danger');
		expect(toneOf({ value: 5, goal: 0 })).toBe('primary');
	});
});

describe('LinksWidget', () => {
	it('opens external links in a new tab and says so', () => {
		render(LinksWidget, {
			props: {
				links: [
					{ label: 'Docs', href: '/documentation' },
					{ label: 'GitHub', href: 'https://github.com' }
				]
			}
		});
		const external = screen.getByRole('link', { name: /GitHub/ });
		expect(external).toHaveAttribute('target', '_blank');
		expect(external.textContent).toContain('opens in a new tab');
		expect(screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('target');
	});

	it('says so when empty', () => {
		render(LinksWidget);
		expect(screen.getByText('No links yet.')).toBeInTheDocument();
	});
});
