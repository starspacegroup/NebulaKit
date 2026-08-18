/**
 * Pure geometry for a drag in progress: which zone is under the pointer, and
 * where in that zone the item would land.
 *
 * Split out of the `draggable` action deliberately. Hit-testing is where
 * off-by-one and wrong-column bugs live, and this is the layer where they can
 * be tested exhaustively against plain numbers instead of a real layout engine.
 *
 * Two rules are baked in here:
 *
 * - **Hit-test in the space you mutate.** The rects handed to
 *   {@link insertionIndex} must exclude the item being dragged. During a drag
 *   the source element stays in the DOM (only a ghost moves), so counting it
 *   makes every downward move land a slot too high, and "drop just after
 *   myself" reads as a no-op. The returned index is then exactly the index
 *   `reorder()` splices into.
 * - **Geometry only, never identity.** Nothing here knows about ids. The DOM
 *   may be consulted for where things are, never for what they are.
 */

export interface Rect {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface Point {
	x: number;
	y: number;
}

/** Whether a zone stacks its items top-to-bottom or left-to-right. */
export type Orientation = 'vertical' | 'horizontal';

/** Point-in-rect, edges inclusive. */
export function contains(rect: Rect, point: Point): boolean {
	return (
		point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
	);
}

/**
 * Index the dragged item would take among `rects`, which must be in visual
 * order and **must not include the dragged item itself**.
 *
 * An item lands before the first sibling whose midpoint is past the pointer, so
 * crossing half of a sibling is what commits the swap — the same threshold the
 * drop indicator is drawn at.
 */
export function insertionIndex(
	rects: Rect[],
	point: Point,
	orientation: Orientation = 'vertical'
): number {
	for (let i = 0; i < rects.length; i++) {
		const rect = rects[i];
		const midpoint =
			orientation === 'vertical'
				? rect.top + (rect.bottom - rect.top) / 2
				: rect.left + (rect.right - rect.left) / 2;
		if ((orientation === 'vertical' ? point.y : point.x) < midpoint) return i;
	}
	return rects.length;
}

/**
 * Zone under the pointer, or the most plausible one when the pointer is in a
 * gap.
 *
 * Direct containment wins, and the last containing zone wins a tie so an inner
 * zone beats the outer one it sits in. Failing that, a pointer in a column's
 * horizontal band belongs to that column even when it is past the end of the
 * content — dropping below the last card in a short column is a normal thing to
 * do, and refusing it feels broken. A pointer outside every band resolves to
 * nothing; the caller should keep whatever position it last showed the user
 * rather than guess.
 */
export function pickZone<T extends { rect: Rect }>(zones: T[], point: Point): T | null {
	let hit: T | null = null;
	for (const zone of zones) if (contains(zone.rect, point)) hit = zone;
	if (hit) return hit;

	let nearest: T | null = null;
	let nearestDistance = Infinity;
	for (const zone of zones) {
		if (point.x < zone.rect.left || point.x > zone.rect.right) continue;
		const distance = point.y < zone.rect.top ? zone.rect.top - point.y : point.y - zone.rect.bottom;
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearest = zone;
		}
	}
	return nearest;
}
