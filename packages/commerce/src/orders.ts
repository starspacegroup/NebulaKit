import { ORDER_STATUSES, type OrderStatus } from './types';

/**
 * The moves an order may make. Anything not listed is refused, so an order
 * cannot be "un-shipped" or a cancelled order revived by an API call.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
	pending: ['paid', 'cancelled'],
	paid: ['fulfilling', 'cancelled'],
	fulfilling: ['shipped', 'cancelled'],
	shipped: ['delivered'],
	delivered: [],
	cancelled: []
};

export function isOrderStatus(value: unknown): value is OrderStatus {
	return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
	return TRANSITIONS[from];
}
