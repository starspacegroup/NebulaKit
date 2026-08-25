import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TestLiveWidget from '../../../tests/fixtures/TestLiveWidget.svelte';
import TestWidget from '../../../tests/fixtures/TestWidget.svelte';
import { widgetManifest } from '$lib/widgets/manifest';
import type { BoardColumn, BoardWidget } from '$lib/widgets/types';
import WidgetBoard from './WidgetBoard.svelte';

// The component registry is a project's own file, so tests stand one in.
vi.mock('$lib/widgets', () => ({
	getWidgetComponent: (name: string) => {
		if (name === 'demo') return TestWidget;
		if (name === 'ticker') return TestLiveWidget;
		return null;
	}
}));

const columns: BoardColumn[] = [
	{ id: 'left', title: 'Left' },
	{ id: 'right', title: 'Right' }
];

function layout(): BoardWidget[] {
	return [
		{ id: 'c', type: 'demo', group: 'left', order: 2, title: 'Third' },
		{ id: 'a', type: 'demo', group: 'left', order: 0, title: 'First' },
		{ id: 'b', type: 'demo', group: 'left', order: 1, title: 'Second' }
	];
}

function boardWith(widgets: BoardWidget[], props: Record<string, unknown> = {}) {
	const changes: BoardWidget[][] = [];
	// Svelte 5 removed `component.$on`; legacy dispatched events come in through
	// mount's `events` option, which testing-library forwards.
	const view = render(WidgetBoard, {
		props: { widgets, columns, ...props },
		events: {
			change: (event: CustomEvent<{ widgets: BoardWidget[] }>) => changes.push(event.detail.widgets)
		}
	});
	return { ...view, changes };
}

/** Titles in the order they are rendered inside one column. */
function titlesIn(group: string): string[] {
	const zone = document.querySelector(`[data-drag-group="${group}"]`) as HTMLElement;
	return Array.from(zone.querySelectorAll('[data-drag-item] h3')).map((el) => el.textContent ?? '');
}

function handleFor(title: string): HTMLElement {
	return screen.getByRole('button', { name: `Move ${title}` });
}

afterEach(() => {
	widgetManifest.length = 0;
});

describe('WidgetBoard rendering', () => {
	it('renders one column per entry, with its heading', () => {
		boardWith(layout());

		expect(screen.getByRole('heading', { name: 'Left' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Right' })).toBeInTheDocument();
	});

	it('renders each column in order, not in array order', () => {
		boardWith(layout());

		expect(titlesIn('left')).toEqual(['First', 'Second', 'Third']);
	});

	it('renders the registered component for a widget type', () => {
		boardWith([{ id: 'a', type: 'demo', group: 'left', order: 0, props: { text: 'hello' } }]);

		expect(screen.getByTestId('test-widget')).toHaveTextContent('hello');
	});

	it('merges the manifest default props under the widget props', () => {
		widgetManifest.push({
			name: 'demo',
			label: 'Demo',
			description: 'test',
			defaultProps: { text: 'from the manifest' }
		});

		boardWith([{ id: 'a', type: 'demo', group: 'left', order: 0 }]);

		expect(screen.getByTestId('test-widget')).toHaveTextContent('from the manifest');
	});

	it('falls back to the manifest label when a widget has no title', () => {
		widgetManifest.push({
			name: 'demo',
			label: 'Demo',
			description: 'test',
			defaultProps: {}
		});

		boardWith([{ id: 'a', type: 'demo', group: 'left', order: 0 }]);

		expect(screen.getByRole('heading', { name: 'Demo' })).toBeInTheDocument();
	});

	it('says so plainly when a widget type is not registered', () => {
		boardWith([{ id: 'a', type: 'ghost', group: 'left', order: 0, title: 'Ghost' }]);

		expect(screen.getByText(/not registered/i)).toBeInTheDocument();
	});

	it('invites a drop into an empty column', () => {
		boardWith(layout(), { emptyMessage: 'Nothing here yet' });

		const zone = document.querySelector('[data-drag-group="right"]') as HTMLElement;
		expect(within(zone).getByText('Nothing here yet')).toBeInTheDocument();
	});

	it('shows a live value in place of the stored title, without touching state', () => {
		const widgets = layout();

		boardWith(widgets, { live: { a: '$64,201' } });

		expect(titlesIn('left')).toEqual(['$64,201', 'Second', 'Third']);
		expect(widgets.find((w) => w.id === 'a')?.title).toBe('First');
	});

	it('drops the handles when the board is not editable', () => {
		boardWith(layout(), { editable: false });

		expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
	});
});

describe('WidgetBoard reordering', () => {
	it('emits a contiguous layout when a widget is moved down', async () => {
		const board = boardWith(layout());

		await fireEvent.keyDown(handleFor('First'), { key: ' ' });
		await fireEvent.keyDown(handleFor('First'), { key: 'ArrowDown' });

		expect(board.changes).toHaveLength(1);
		expect(
			board.changes[0]
				.filter((w) => w.group === 'left')
				.map((w) => w.order)
				.sort()
		).toEqual([0, 1, 2]);
		expect(titlesIn('left')).toEqual(['Second', 'First', 'Third']);
	});

	it('moves a widget into another column', async () => {
		const board = boardWith(layout());

		await fireEvent.keyDown(handleFor('First'), { key: ' ' });
		await fireEvent.keyDown(handleFor('First'), { key: 'ArrowRight' });

		expect(titlesIn('left')).toEqual(['Second', 'Third']);
		expect(titlesIn('right')).toEqual(['First']);
		expect(board.changes[0].find((w) => w.id === 'a')?.group).toBe('right');
	});

	it('keeps the grab alive across a column change', async () => {
		const board = boardWith(layout());

		await fireEvent.keyDown(handleFor('First'), { key: ' ' });
		await fireEvent.keyDown(handleFor('First'), { key: 'ArrowRight' });
		await fireEvent.keyDown(handleFor('First'), { key: 'ArrowLeft' });

		expect(board.changes).toHaveLength(2);
		expect(titlesIn('left')).toEqual(['First', 'Second', 'Third']);
	});

	it('says nothing when the layout did not actually change', async () => {
		const board = boardWith(layout());

		await fireEvent.keyDown(handleFor('First'), { key: ' ' });
		await fireEvent.keyDown(handleFor('First'), { key: 'ArrowUp' });
		await fireEvent.keyDown(handleFor('First'), { key: 'Enter' });

		expect(board.changes).toEqual([]);
	});
});

describe('WidgetBoard live values', () => {
	it('forwards a widget’s live value without touching the layout', async () => {
		const widgets: BoardWidget[] = [
			{ id: 'clock', type: 'ticker', group: 'left', order: 0, props: { value: 'tick' } }
		];
		const live: Array<{ id: string; value: string }> = [];
		const view = render(WidgetBoard, {
			props: { widgets, columns, live: { clock: '12:00:00' } },
			events: {
				live: (event: CustomEvent<{ id: string; value: string }>) => live.push(event.detail)
			}
		});

		// A tick is a prop change on the widget, never a change to the layout.
		await view.rerender({
			widgets: [{ ...widgets[0], props: { value: 'tock' } }]
		});
		await tick();

		expect(live).toContainEqual({ id: 'clock', value: 'tock' });
		expect(widgets[0].title).toBeUndefined();
		expect(titlesIn('left')).toEqual(['12:00:00']);
	});
});
