/**
 * Undo and redo, as a value.
 *
 * `History` holds whole documents, which is safe and cheap here because every
 * edit in `ops.ts` returns a new document that shares everything it did not
 * touch with the old one — a snapshot is a pointer, not a deep copy. (The
 * predecessor JSON-cloned the page on every keystroke and capped the stack at
 * 50.)
 *
 * Edits that arrive in a burst under the same `key` — typing in one field,
 * nudging one slider — are folded into one undo step, so Undo takes back a
 * whole phrase, not one letter.
 */

export interface History<T> {
	past: T[];
	present: T;
	future: T[];
	/** What the last commit was about, for folding a burst into one step. */
	lastKey: string | null;
	lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export function createHistory<T>(present: T): History<T> {
	return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(
	history: History<T>,
	next: T,
	options: { key?: string; now?: number } = {}
): History<T> {
	if (Object.is(next, history.present)) return history;
	const now = options.now ?? Date.now();
	const key = options.key ?? null;
	const folds = key !== null && key === history.lastKey && now - history.lastAt < COALESCE_MS;
	return {
		past: folds ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
		present: next,
		future: [],
		lastKey: key,
		lastAt: now
	};
}

export const canUndo = (history: History<unknown>): boolean => history.past.length > 0;
export const canRedo = (history: History<unknown>): boolean => history.future.length > 0;

export function undo<T>(history: History<T>): History<T> {
	if (!canUndo(history)) return history;
	const past = history.past.slice(0, -1);
	return {
		past,
		present: history.past[history.past.length - 1],
		future: [history.present, ...history.future],
		lastKey: null,
		lastAt: 0
	};
}

export function redo<T>(history: History<T>): History<T> {
	if (!canRedo(history)) return history;
	const [present, ...future] = history.future;
	return {
		past: [...history.past, history.present],
		present,
		future,
		lastKey: null,
		lastAt: 0
	};
}

/** Replace the present without touching undo — loading a saved page, say. */
export function reset<T>(present: T): History<T> {
	return createHistory(present);
}
