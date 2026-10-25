import { describe, expect, it, vi } from 'vitest';
import { waitForOrderPaid } from '../../src/lib/shop/order-status';

function statuses(...seq: Array<string | Response | Error>) {
	let i = 0;
	return vi.fn(async () => {
		const next = seq[Math.min(i++, seq.length - 1)];
		if (next instanceof Error) throw next;
		if (next instanceof Response) return next;
		return new Response(JSON.stringify({ status: next }), { status: 200 });
	});
}
function clock() {
	let t = 0;
	return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

describe('waitForOrderPaid', () => {
	it('keeps asking until the webhook has landed', async () => {
		const fetchImpl = statuses('pending', 'pending', 'paid');
		const seen: string[] = [];
		const result = await waitForOrderPaid('abc', {
			fetchImpl,
			...clock(),
			onReading: (s) => seen.push(s)
		});
		expect(result).toBe('paid');
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		expect(seen).toEqual(['pending', 'pending', 'paid']);
		expect(fetchImpl.mock.calls[0]).toEqual(['/api/v1/orders/abc/status']);
	});

	it('counts later states as paid and cancelled as final', async () => {
		expect(await waitForOrderPaid('a', { fetchImpl: statuses('shipped'), ...clock() })).toBe(
			'paid'
		);
		expect(await waitForOrderPaid('a', { fetchImpl: statuses('cancelled'), ...clock() })).toBe(
			'cancelled'
		);
	});

	it('gives an honest "still pending" after the timeout, polling every interval', async () => {
		const fetchImpl = statuses('pending');
		const result = await waitForOrderPaid('a', {
			fetchImpl,
			...clock(),
			intervalMs: 1500,
			timeoutMs: 20000
		});
		expect(result).toBe('pending');
		expect(fetchImpl.mock.calls.length).toBe(15);
	});

	it('is unknown when the id is unknown, the shop is down or the answer is odd', async () => {
		const miss = statuses(new Response('{}', { status: 404 }));
		expect(await waitForOrderPaid('a', { fetchImpl: miss, ...clock() })).toBe('unknown');
		expect(
			await waitForOrderPaid('a', { fetchImpl: statuses(new Error('offline')), ...clock() })
		).toBe('unknown');
		expect(
			await waitForOrderPaid('a', { fetchImpl: statuses(new Response('{}')), ...clock() })
		).toBe('unknown');
	});

	it('stops when aborted, and escapes the id in the URL', async () => {
		const controller = new AbortController();
		controller.abort();
		const fetchImpl = statuses('paid');
		expect(await waitForOrderPaid('a', { fetchImpl, signal: controller.signal })).toBe('unknown');
		expect(fetchImpl).not.toHaveBeenCalled();
		await waitForOrderPaid('a/b?c', { fetchImpl, ...clock() });
		expect(fetchImpl.mock.calls[0]).toEqual(['/api/v1/orders/a%2Fb%3Fc/status']);
	});

	it('uses real timers and fetch by default', async () => {
		vi.useFakeTimers();
		const spy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'pending' })))
			.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'paid' })));
		const promise = waitForOrderPaid('a');
		await vi.advanceTimersByTimeAsync(1600);
		expect(await promise).toBe('paid');
		expect(spy).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
		spy.mockRestore();
	});
});
