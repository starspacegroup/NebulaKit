import { describe, expect, it } from 'vitest';
import { readJsonObject } from '../../src/lib/server/request-body';
import { POST as login } from '../../src/routes/api/auth/login/+server';
import { POST as signup } from '../../src/routes/api/auth/signup/+server';
import { POST as merge } from '../../src/routes/api/auth/merge/+server';
import { POST as password } from '../../src/routes/api/auth/password/+server';

const post = (body: string) => new Request('http://localhost/x', { method: 'POST', body });

describe('readJsonObject', () => {
	it('returns a JSON object', async () => {
		await expect(readJsonObject(post('{"a":1}'))).resolves.toEqual({ a: 1 });
	});

	it.each(['', '{not json', 'null', '[]', '"text"', '42'])('answers 400 for %j', async (raw) => {
		await expect(readJsonObject(post(raw))).rejects.toMatchObject({ status: 400 });
	});
});

describe('auth endpoints with a bad body', () => {
	const db = {
		prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) })
	};
	const event = (raw: string) =>
		({
			platform: { env: { DB: db } },
			request: post(raw),
			url: new URL('http://localhost/x'),
			locals: { user: { id: 'u1', email: 'a@b.c' } }
		}) as never;

	it.each([
		['login', login],
		['signup', signup],
		['merge', merge],
		['password', password]
	] as const)('%s answers 400, not 500, for malformed and null bodies', async (_n, handler) => {
		for (const raw of ['', '{oops', 'null']) {
			await expect(handler(event(raw))).rejects.toMatchObject({ status: 400 });
		}
	});
});
