import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../tests/fixtures/UiKitDataHarness.svelte';
import AvatarGroup from './AvatarGroup.svelte';
import BarChart from './BarChart.svelte';
import CodeBlock from './CodeBlock.svelte';
import DonutChart from './DonutChart.svelte';
import LineChart from './LineChart.svelte';
import Stat from './Stat.svelte';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const names = () =>
	[...document.querySelectorAll('tbody tr')].map((tr) =>
		tr.querySelectorAll('td')[1]?.textContent?.trim()
	);

describe('DataTable', () => {
	it('pages, formats and counts its rows', async () => {
		render(Harness, { props: { which: 'datatable' } });
		expect(screen.getByRole('region', { name: 'People' })).toBeTruthy();
		expect(names()).toEqual(['Ada Lovelace', 'Alan Turing']);
		expect(screen.getByText('1200 commits')).toBeTruthy();
		expect(screen.getByText('1–2 of 5')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
		expect(names()).toEqual(['Barbara Liskov']);
		await fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '0' } });
		expect(names()).toHaveLength(5);
		expect(screen.queryByRole('navigation')).toBeNull();
	});

	it('searches across columns, including formatted text, and says when nothing matches', async () => {
		render(Harness, { props: { which: 'datatable' } });
		const search = screen.getByRole('searchbox', { name: 'Search People' });
		await fireEvent.input(search, { target: { value: 'grace york' } });
		expect(names()).toEqual(['Grace Hopper']);
		await fireEvent.input(search, { target: { value: '98 commits' } });
		expect(names()).toEqual(['Edsger Dijkstra']);
		await fireEvent.input(search, { target: { value: 'zzz' } });
		expect(screen.getByText('No rows match your search.')).toBeTruthy();
		expect(screen.getByText('No results')).toBeTruthy();
	});

	it('sorts with aria-sort and reports it', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'datatable', props: { pageSize: 0 }, onEvent } });
		const header = screen.getByRole('button', { name: /Commits/ });
		await fireEvent.click(header);
		expect(header.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
		expect(names()[0]).toBe('Edsger Dijkstra');
		await fireEvent.click(header);
		expect(header.closest('th')?.getAttribute('aria-sort')).toBe('descending');
		expect(names()[0]).toBe('Grace Hopper');
		expect(onEvent).toHaveBeenLastCalledWith('sort', { key: 'commits', direction: 'descending' });
	});

	it('selects rows, with a select-all that goes mixed', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'datatable', onEvent } });
		const all = screen.getByRole('checkbox', {
			name: 'Select all rows on this page'
		}) as HTMLInputElement;
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' }));
		expect(onEvent).toHaveBeenLastCalledWith('selection', { selected: [1] });
		expect(all.indeterminate).toBe(true);
		expect(screen.getByTestId('toolbar').textContent).toBe('1 picked');
		expect(screen.getByText(/1 selected/)).toBeTruthy();
		await fireEvent.click(all);
		expect(onEvent).toHaveBeenLastCalledWith('selection', { selected: [1, 2] });
		expect(all.indeterminate).toBe(false);
		expect(all.checked).toBe(true);
		await fireEvent.click(all);
		expect(onEvent).toHaveBeenLastCalledWith('selection', { selected: [] });
	});

	it('shows its empty state', () => {
		render(Harness, { props: { which: 'datatable', props: { rows: [], searchable: false } } });
		expect(screen.getByText('Nothing here yet.')).toBeTruthy();
		expect(screen.queryByRole('searchbox')).toBeNull();
		expect(
			(screen.getByRole('checkbox', { name: 'Select all rows on this page' }) as HTMLInputElement)
				.disabled
		).toBe(true);
	});

	it('pulls a page past the end back into range', async () => {
		render(Harness, { props: { which: 'datatable', props: { page: 9 } } });
		await tick();
		expect(names()).toEqual(['Barbara Liskov']);
		expect(screen.getByRole('button', { name: 'Page 3' }).getAttribute('aria-current')).toBe(
			'page'
		);
	});
});

describe('charts', () => {
	const labels = ['Mon', 'Tue', 'Wed'];
	const series = [
		{ name: 'Web', values: [4, null, 9] },
		{ name: 'App', values: [2, 3, 5] }
	];

	it('BarChart is an image with a summary, a legend, and the numbers as a table', async () => {
		const { container } = render(BarChart, { props: { title: 'Visits', labels, series } });
		const img = screen.getByRole('img');
		expect(img.getAttribute('aria-label')).toBe(
			'Visits: bar chart of 2 series across 3 points, ranging from 2 to 9.'
		);
		expect(img.getAttribute('tabindex')).toBe('0');
		expect(container.querySelectorAll('.chart__bar')).toHaveLength(6);
		expect(container.querySelector('.chart__legend')?.textContent).toContain('App');
		const table = screen.getByRole('table');
		expect(within(table).getAllByRole('row')).toHaveLength(4);
		expect(within(table).getByText('—')).toBeTruthy();

		await fireEvent.keyDown(img, { key: 'ArrowRight' });
		const tip = container.querySelector('.chart__tooltip')!;
		expect(tip.getAttribute('aria-hidden')).toBe('true');
		expect(tip.textContent).toContain('Mon');
		expect(tip.textContent).toContain('Web: 4');
		await fireEvent.keyDown(img, { key: 'Escape' });
		expect(container.querySelector('.chart__tooltip')).toBeNull();

		await fireEvent.pointerMove(img, { clientX: 0 });
		expect(container.querySelector('.chart__tooltip')?.textContent).toContain('Mon');
		await fireEvent.pointerLeave(img);
		expect(container.querySelector('.chart__tooltip')).toBeNull();
	});

	it('BarChart with one series has no legend, and handles negatives', () => {
		const { container } = render(BarChart, {
			props: {
				title: 'P&L',
				labels: ['Q1', 'Q2'],
				series: [{ name: 'Net', values: [-3, 5] }],
				showTitle: false
			}
		});
		expect(container.querySelector('.chart__legend')).toBeNull();
		expect(container.querySelector('figcaption')).toBeNull();
		expect(container.querySelector('.chart__zero')).toBeTruthy();
	});

	it('LineChart draws a line per series, breaks at gaps, and fills an area', async () => {
		const { container } = render(LineChart, {
			props: { title: 'Visits', labels, series, area: true, dots: true }
		});
		expect(screen.getByRole('img').getAttribute('aria-label')).toContain('line chart of 2 series');
		const lines = container.querySelectorAll('.chart__line');
		expect(lines).toHaveLength(2);
		expect(lines[0].getAttribute('d')!.match(/M/g)).toHaveLength(2);
		expect(container.querySelectorAll('.chart__area')).toHaveLength(2);
		expect(container.querySelectorAll('.chart__dot')).toHaveLength(5);
		await fireEvent.keyDown(screen.getByRole('img'), { key: 'End' });
		expect(container.querySelector('.chart__tooltip')?.textContent).toContain('Wed');
		expect(container.querySelector('.chart__cursor')).toBeTruthy();
		await fireEvent.pointerMove(screen.getByRole('img'), { clientX: 0 });
		expect(container.querySelector('.chart__tooltip')?.textContent).toContain('Mon');
	});

	it('LineChart without fill or dots draws only the line, and a single point as a dot', () => {
		const { container } = render(LineChart, {
			props: { title: 'One', labels: ['A'], series: [{ name: 'S', values: [3] }], zero: true }
		});
		expect(container.querySelector('.chart__area')).toBeNull();
		expect(container.querySelectorAll('.chart__dot')).toHaveLength(1);
		expect(container.querySelector('.chart__legend')).toBeNull();
	});

	it('DonutChart shows shares, the total, and a tooltip per slice', async () => {
		const data = [
			{ label: 'Search', value: 60 },
			{ label: 'Direct', value: 40 }
		];
		const { container } = render(DonutChart, { props: { title: 'Traffic', data } });
		const img = screen.getByRole('img');
		expect(img.getAttribute('aria-label')).toBe('Traffic: donut chart. Search 60%, Direct 40%.');
		expect(container.querySelectorAll('.donut__slice')).toHaveLength(2);
		expect(container.querySelector('.donut__value')?.textContent).toBe('100');
		expect(container.querySelector('.donut__legend')?.textContent).toContain('40%');
		await fireEvent.keyDown(img, { key: 'ArrowLeft' });
		expect(container.querySelector('.donut__tooltip')?.textContent).toContain('Direct');
		await fireEvent.pointerMove(container.querySelector('[data-index="0"]')!);
		expect(container.querySelector('.donut__tooltip')?.textContent).toContain('Search');
		await fireEvent.pointerMove(img);
		expect(container.querySelector('.donut__tooltip')).toBeNull();
	});

	it('DonutChart as a pie hides the centre figure', () => {
		const { container } = render(DonutChart, {
			props: { title: 'Pie', data: [{ label: 'All', value: 1 }], thickness: 1, centerValue: '1' }
		});
		expect(container.querySelector('.donut__value')).toBeNull();
	});
});

describe('Carousel', () => {
	it('labels the carousel, its slides and its dots after the APG pattern', () => {
		render(Harness, { props: { which: 'carousel' } });
		const region = screen.getByRole('region', { name: 'Highlights' });
		expect(region.getAttribute('aria-roledescription')).toBe('carousel');
		const panels = document.querySelectorAll('[role="tabpanel"]');
		expect(panels[0].getAttribute('aria-roledescription')).toBe('slide');
		expect(panels[0].getAttribute('aria-label')).toBe('1 of 3');
		expect(panels[1].hasAttribute('inert')).toBe(true);
		expect(panels[1].getAttribute('aria-hidden')).toBe('true');
		const dot = screen.getByRole('tab', { name: 'Slide 1 of 3' });
		expect(dot.getAttribute('aria-selected')).toBe('true');
		expect(screen.getByRole('button', { name: 'Previous slide' })).toHaveProperty('disabled', true);
		expect(screen.queryByRole('button', { name: /automatic/ })).toBeNull();
	});

	it('lets the scrolling track take focus and step with the arrow keys', async () => {
		render(Harness, { props: { which: 'carousel' } });
		const track = screen.getByRole('group', { name: 'Slides' });
		expect(track.getAttribute('tabindex')).toBe('0');
		await fireEvent.keyDown(track, { key: 'ArrowRight' });
		expect(screen.getByTestId('index').textContent).toBe('1');
		await fireEvent.keyDown(track, { key: 'ArrowLeft' });
		expect(screen.getByTestId('index').textContent).toBe('0');
		await fireEvent.keyDown(track, { key: 'Enter' });
		expect(screen.getByTestId('index').textContent).toBe('0');
	});

	it('moves with the buttons, the dots and the arrow keys', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'carousel', onEvent } });
		await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
		expect(screen.getByTestId('index').textContent).toBe('1');
		expect(onEvent).toHaveBeenLastCalledWith('change', { index: 1 });
		expect(document.querySelectorAll('[role="tabpanel"]')[1].hasAttribute('inert')).toBe(false);

		const second = screen.getByRole('tab', { name: 'Slide 2 of 3' });
		await fireEvent.keyDown(second, { key: 'End' });
		await tick();
		expect(screen.getByTestId('index').textContent).toBe('2');
		expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Slide 3 of 3' }));
		expect(screen.getByRole('button', { name: 'Next slide' })).toHaveProperty('disabled', true);
		await fireEvent.keyDown(second, { key: 'x' });
		await fireEvent.click(screen.getByRole('tab', { name: 'Slide 1 of 3' }));
		expect(screen.getByTestId('index').textContent).toBe('0');
		await fireEvent.click(screen.getByRole('tab', { name: 'Slide 1 of 3' }));
		expect(onEvent).toHaveBeenCalledTimes(3);
	});

	it('loops when asked', async () => {
		render(Harness, { props: { which: 'carousel', props: { loop: true } } });
		await fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
		expect(screen.getByTestId('index').textContent).toBe('2');
	});

	it('autoplays, pauses on hover and focus, and has a pause button', async () => {
		vi.useFakeTimers();
		render(Harness, { props: { which: 'carousel', props: { autoplay: 1000 } } });
		const region = screen.getByRole('region', { name: 'Highlights' });
		const track = region.querySelector('.carousel__track')!;
		expect(track.getAttribute('aria-live')).toBe('off');
		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByTestId('index').textContent).toBe('1');

		await fireEvent.mouseEnter(region);
		await vi.advanceTimersByTimeAsync(3000);
		expect(screen.getByTestId('index').textContent).toBe('1');
		expect(track.getAttribute('aria-live')).toBe('polite');
		await fireEvent.mouseLeave(region);

		const pause = screen.getByRole('button', { name: 'Stop automatic slide show' });
		await fireEvent.focusIn(pause);
		await vi.advanceTimersByTimeAsync(3000);
		expect(screen.getByTestId('index').textContent).toBe('1');
		await fireEvent.focusOut(pause, { relatedTarget: document.body });
		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByTestId('index').textContent).toBe('2');

		await fireEvent.click(pause);
		expect(screen.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
		await fireEvent.focusOut(pause, { relatedTarget: document.body });
		await vi.advanceTimersByTimeAsync(5000);
		expect(screen.getByTestId('index').textContent).toBe('2');
	});

	it('never autoplays under reduced motion', async () => {
		vi.stubGlobal('matchMedia', () => ({
			matches: true,
			addEventListener: () => {},
			removeEventListener: () => {}
		}));
		vi.useFakeTimers();
		render(Harness, { props: { which: 'carousel', props: { autoplay: 1000 } } });
		await tick();
		await vi.advanceTimersByTimeAsync(3000);
		expect(screen.getByTestId('index').textContent).toBe('0');
		expect(screen.queryByRole('button', { name: /automatic/ })).toBeNull();
	});

	it('follows a swipe once the track comes to rest', async () => {
		vi.useFakeTimers();
		render(Harness, { props: { which: 'carousel' } });
		const track = document.querySelector('.carousel__track') as HTMLElement;
		await fireEvent.scroll(track);
		await vi.advanceTimersByTimeAsync(200);
		expect(screen.getByTestId('index').textContent).toBe('0');
		Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
		track.scrollLeft = 600;
		await fireEvent.scroll(track);
		await vi.advanceTimersByTimeAsync(200);
		expect(screen.getByTestId('index').textContent).toBe('2');
	});
});

describe('lists and text', () => {
	it('Item makes its title the link and keeps actions separate', () => {
		render(Harness, { props: { which: 'item' } });
		const link = screen.getByRole('link', { name: 'Ada Lovelace' });
		expect(link.getAttribute('href')).toBe('/ada');
		expect(link.contains(screen.getByRole('button', { name: 'Message' }))).toBe(false);
		expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeTruthy();
		expect(screen.getByText('2h')).toBeTruthy();
		expect(document.querySelector('.item--outline')).toBeTruthy();
		expect(screen.getByText('Slotted title')).toBeTruthy();
		expect(screen.getByText('Slotted description')).toBeTruthy();
	});

	it('Timeline is an ordered list with real times', () => {
		render(Harness, { props: { which: 'timeline' } });
		const list = screen.getByRole('list', { name: 'History' });
		expect(list.tagName).toBe('OL');
		expect(within(list).getAllByRole('listitem')).toHaveLength(2);
		expect(document.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-03');
		expect(document.querySelector('.timeline__event--success')).toBeTruthy();
		expect(screen.getByText('Two approvals')).toBeTruthy();
		expect(screen.getByText('✓')).toBeTruthy();
	});

	it('Prose wraps raw content at a size', () => {
		render(Harness, { props: { which: 'prose' } });
		expect(document.querySelector('.prose--lg h2')?.textContent).toBe('Heading');
	});

	it('Stat signs its change, reads it in words, and colours it by what is good', () => {
		const { container, unmount } = render(Stat, {
			props: {
				label: 'Errors',
				value: '12',
				delta: -8,
				invert: true,
				series: [3, 2, 1],
				help: 'vs last week'
			}
		});
		expect(container.querySelector('.stat--success')).toBeTruthy();
		expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('−8%');
		expect(screen.getByText('Down 8%')).toBeTruthy();
		expect(screen.getByText('vs last week')).toBeTruthy();
		expect(container.querySelector('.stat__spark path')?.getAttribute('d')).toMatch(/^M/);
		unmount();

		const flat = render(Stat, { props: { label: 'Users', value: 40, delta: 0 } });
		expect(flat.container.querySelector('.stat--neutral')).toBeTruthy();
		expect(screen.getByText('No change')).toBeTruthy();
		expect(flat.container.querySelector('svg')).toBeNull();
		flat.unmount();

		const bare = render(Stat, { props: { label: 'Up', value: 1, delta: 5 } });
		expect(bare.container.querySelector('.stat--success')).toBeTruthy();
		bare.unmount();
		const none = render(Stat, { props: { label: 'Plain', value: 1 } });
		expect(none.container.querySelector('.stat__foot')).toBeNull();
	});

	it('AvatarGroup lists people and folds the rest into a named +N', () => {
		render(AvatarGroup, {
			props: {
				label: 'Reviewers',
				max: 2,
				size: 'sm',
				people: [
					{ name: 'Ada Lovelace' },
					{ name: 'Alan Turing' },
					{ name: 'Grace Hopper' },
					{ name: 'Edsger Dijkstra' }
				]
			}
		});
		const list = screen.getByRole('list', { name: 'Reviewers' });
		expect(within(list).getAllByRole('listitem')).toHaveLength(3);
		expect(
			screen.getByRole('img', { name: '2 more: Grace Hopper, Edsger Dijkstra' }).textContent
		).toBe('+2');
	});

	it('AvatarGroup under its max draws everyone', () => {
		render(AvatarGroup, { props: { people: [{ name: 'Ada Lovelace' }] } });
		expect(screen.queryByText(/^\+/)).toBeNull();
	});
});

describe('CodeBlock', () => {
	it('labels the block, numbers lines without changing the text, and copies', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		vi.useFakeTimers();
		const code = 'const a = 1;\nconst b = 2;\n';
		const { container } = render(CodeBlock, {
			props: { code, filename: 'a.ts', language: 'ts', lineNumbers: true }
		});
		const region = screen.getByRole('region', { name: 'a.ts' });
		expect(region.getAttribute('tabindex')).toBe('0');
		expect(container.querySelectorAll('.code__line')).toHaveLength(2);
		expect(container.querySelector('code')?.textContent).toBe('const a = 1;\nconst b = 2;');
		expect(container.querySelector('code')?.className).toContain('language-ts');
		expect(screen.getByText('ts')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
		await vi.advanceTimersByTimeAsync(0);
		expect(writeText).toHaveBeenCalledWith(code);
		expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
		expect(screen.getByText('Copied to clipboard')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(2000);
		expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
	});

	it('says when copying fails, and can go without a bar', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('no')) } });
		const exec = vi.fn(() => false);
		const doc = document as Document & { execCommand: typeof exec };
		const original = doc.execCommand;
		doc.execCommand = exec;
		try {
			const { unmount } = render(CodeBlock, { props: { code: 'x' } });
			expect(screen.getByRole('region', { name: 'Code' })).toBeTruthy();
			await fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
			await vi.waitFor(() => expect(screen.getByText('Could not copy')).toBeTruthy());
			expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy();
			unmount();
		} finally {
			doc.execCommand = original;
		}
		const { container } = render(CodeBlock, { props: { code: 'y', copyable: false } });
		expect(container.querySelector('.code__bar')).toBeNull();
		expect(container.querySelector('code')?.textContent).toBe('y');
	});
});
