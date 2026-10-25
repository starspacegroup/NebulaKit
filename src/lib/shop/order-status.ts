/**
 * Waiting for an order to be paid, from the browser.
 *
 * Stripe sends the shopper back to `/cart?order=ID` and, separately, tells the
 * server the payment succeeded. The webhook usually lands a moment after the
 * redirect, so believing the first answer shows "not paid" to someone who just
 * paid. This asks again every `intervalMs` until the order is settled or
 * `timeoutMs` passes.
 */

export type OrderWait =
	/** Paid (or already past paid: fulfilling, shipped, delivered). */
	| 'paid'
	| 'cancelled'
	/** Still `pending` when the wait ran out. A bank debit can take a day. */
	| 'pending'
	/** The status could not be read: unknown id, or the shop was unreachable. */
	| 'unknown';

export interface PollOptions {
	fetchImpl?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	intervalMs?: number;
	timeoutMs?: number;
	/** Called with each reading, so the page can show progress. */
	onReading?: (status: string) => void;
	signal?: AbortSignal;
}

export const POLL_INTERVAL_MS = 1500;
export const POLL_TIMEOUT_MS = 20000;

export async function waitForOrderPaid(
	orderId: string,
	options: PollOptions = {}
): Promise<OrderWait> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
	const now = options.now ?? Date.now;
	const interval = options.intervalMs ?? POLL_INTERVAL_MS;
	const timeout = options.timeoutMs ?? POLL_TIMEOUT_MS;
	const started = now();
	for (;;) {
		if (options.signal?.aborted) return 'unknown';
		let status: unknown;
		try {
			const response = await fetchImpl(`/api/v1/orders/${encodeURIComponent(orderId)}/status`);
			if (!response.ok) return 'unknown';
			status = ((await response.json()) as { status?: unknown }).status;
		} catch {
			return 'unknown';
		}
		if (typeof status !== 'string') return 'unknown';
		options.onReading?.(status);
		if (status === 'cancelled') return 'cancelled';
		if (status !== 'pending') return 'paid';
		if (now() - started >= timeout) return 'pending';
		await sleep(interval);
	}
}
