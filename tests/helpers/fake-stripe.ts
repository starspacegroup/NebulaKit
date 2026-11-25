/**
 * A small in-memory Stripe for the checkout tests: PaymentIntents and Checkout Sessions, with
 * Stripe's idempotency rule (a repeated key with the same body returns the first answer; with a
 * different body it is refused). Every request is recorded so a test can assert on the calls.
 * No network: this replaces `fetch` for the duration of a test.
 */
export interface FakeIntent {
	id: string;
	status: string;
	amount: number;
	currency: string;
	client_secret: string;
	metadata: Record<string, string>;
}

export interface StripeCall {
	method: string;
	path: string;
	idempotencyKey: string | null;
	form: Record<string, string>;
}

export function fakeStripe() {
	const intents = new Map<string, FakeIntent>();
	const sessions = new Map<string, { id: string; status: string; url: string }>();
	const idempotent = new Map<
		string,
		{ body: string; response: { status: number; json: unknown } }
	>();
	const calls: StripeCall[] = [];
	let counter = 0;

	const json = (status: number, body: unknown) =>
		new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});

	function handle(method: string, path: string, form: Record<string, string>) {
		let m: RegExpMatchArray | null;
		if (method === 'POST' && path === '/v1/payment_intents') {
			const id = `pi_test_${++counter}`;
			const meta: Record<string, string> = {};
			for (const [k, v] of Object.entries(form)) {
				const mk = /^metadata\[(.+)\]$/.exec(k);
				if (mk) meta[mk[1]] = v;
			}
			const intent: FakeIntent = {
				id,
				status: 'requires_payment_method',
				amount: Number(form.amount),
				currency: form.currency,
				client_secret: `${id}_secret_x`,
				metadata: meta
			};
			intents.set(id, intent);
			return { status: 200, json: intent };
		}
		if ((m = /^\/v1\/payment_intents\/(pi_[A-Za-z0-9_]+)$/.exec(path))) {
			const intent = intents.get(m[1]);
			if (!intent) return { status: 404, json: { error: { code: 'resource_missing' } } };
			if (method === 'GET') return { status: 200, json: intent };
			if (['succeeded', 'processing', 'canceled'].includes(intent.status)) {
				return { status: 400, json: { error: { code: 'payment_intent_unexpected_state' } } };
			}
			if (form.amount) intent.amount = Number(form.amount);
			if (form.currency) intent.currency = form.currency;
			if (form['metadata[revision]']) intent.metadata.revision = form['metadata[revision]'];
			return { status: 200, json: intent };
		}
		if ((m = /^\/v1\/payment_intents\/(pi_[A-Za-z0-9_]+)\/cancel$/.exec(path))) {
			const intent = intents.get(m[1]);
			if (!intent) return { status: 404, json: {} };
			if (['succeeded', 'processing', 'canceled'].includes(intent.status)) {
				return { status: 400, json: { error: { code: 'payment_intent_unexpected_state' } } };
			}
			intent.status = 'canceled';
			return { status: 200, json: intent };
		}
		if (method === 'POST' && path === '/v1/checkout/sessions') {
			const id = `cs_test_${++counter}`;
			const session = { id, status: 'open', url: `https://checkout.stripe.test/${id}` };
			sessions.set(id, session);
			return { status: 200, json: session };
		}
		if ((m = /^\/v1\/checkout\/sessions\/(cs_[A-Za-z0-9_]+)(\/expire)?$/.exec(path))) {
			const session = sessions.get(m[1]);
			if (!session) return { status: 404, json: {} };
			if (method === 'GET') return { status: 200, json: session };
			if (session.status !== 'open') return { status: 400, json: {} };
			session.status = 'expired';
			return { status: 200, json: session };
		}
		return { status: 404, json: { error: { message: `unhandled ${method} ${path}` } } };
	}

	const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url = new URL(typeof input === 'string' ? input : input.toString());
		if (url.hostname !== 'api.stripe.com') throw new Error(`unexpected fetch to ${url.hostname}`);
		const method = (init.method ?? 'GET').toUpperCase();
		const headers = new Headers(init.headers);
		const body = typeof init.body === 'string' ? init.body : '';
		const form = Object.fromEntries(new URLSearchParams(body));
		const idempotencyKey = headers.get('idempotency-key');
		calls.push({ method, path: url.pathname, idempotencyKey, form });
		if (method === 'POST' && idempotencyKey) {
			const seen = idempotent.get(idempotencyKey);
			if (seen) {
				if (seen.body !== body) return json(400, { error: { type: 'idempotency_error' } });
				return json(seen.response.status, seen.response.json);
			}
			const response = handle(method, url.pathname, form);
			idempotent.set(idempotencyKey, { body, response: structuredClone(response) });
			return json(response.status, response.json);
		}
		const response = handle(method, url.pathname, form);
		return json(response.status, response.json);
	};

	return {
		fetch: fetchImpl,
		intents,
		sessions,
		calls,
		posts: () => calls.filter((c) => c.method === 'POST'),
		created: () => calls.filter((c) => c.method === 'POST' && c.path === '/v1/payment_intents')
	};
}
