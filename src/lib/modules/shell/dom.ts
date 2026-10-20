/**
 * DOM helpers shared by the shell modules. Kept out of the `.svelte` files so
 * they are tested and counted, and out of `logic.ts` so that stays DOM-free.
 */

/**
 * A Svelte action that reports an element's width in pixels now and whenever
 * it changes. Where `ResizeObserver` is missing it reports once.
 */
export function trackWidth(node: HTMLElement, onWidth: (width: number) => void) {
	onWidth(node.clientWidth);
	if (typeof ResizeObserver === 'undefined') return {};
	const observer = new ResizeObserver(() => onWidth(node.clientWidth));
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}
