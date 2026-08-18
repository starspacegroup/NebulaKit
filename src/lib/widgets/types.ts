/**
 * Layout data for a widget board.
 *
 * Deliberately free of Svelte and DOM imports: a Worker persisting a layout, a
 * migration repairing one, and a test asserting on one all need these shapes,
 * and none of them can import a component.
 */

import type { Orderable } from '$lib/utils/reorder';

/**
 * One widget's placement and configuration.
 *
 * Everything here is **persisted state**, so nothing in it may change on a
 * timer. A widget showing a live price, a clock, or a connection count renders
 * that through the board's `live` map instead. The predecessor of this board
 * wrote live values into `title`, which made every 30-second tick a write of
 * the whole layout: ~650 writes/day against a 1,000/day account-wide quota,
 * from a single open tab.
 */
export interface BoardWidget extends Orderable {
	/** Stable id, unique across the board. */
	id: string;
	/** Registered widget type — a `name` from the widget manifest. */
	type: string;
	/** Column id this widget sits in. */
	group: string;
	/** Position within the column, contiguous from 0. */
	order: number;
	/** Overrides the manifest's label. A deliberate user rename, never live data. */
	title?: string;
	/** Merged over the manifest's `defaultProps` and spread into the component. */
	props?: Record<string, unknown>;
}

/** One column of a board. */
export interface BoardColumn {
	/** Stable id. Referenced by `BoardWidget.group`; never a positional index. */
	id: string;
	/** Optional heading rendered above the column. */
	title?: string;
}
