import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	AUDIT_DETAIL_MAX_CHARS,
	AUDIT_RETENTION_DAYS,
	AUDIT_RULES,
	allowedBodyFields,
	auditAround,
	auditSeverity,
	formActionName,
	formActionSucceeded,
	isSecretKey,
	listAudit,
	listAuditActions,
	pruneAudit,
	recordAudit,
	recordRule,
	ruleFor,
	scrubDetail,
	toAuditEvent
} from '../../src/lib/server/audit';
import { siteApi } from '../../src/lib/server/site-api';
import { mergeAccounts } from '../../src/lib/services/account-merge';
import { POST as pruneRoute } from '../../src/routes/api/cron/prune-audit/+server';
import * as auditPage from '../../src/routes/admin/audit/+page.server';

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1();
	vi.restoreAllMocks();
});

const rows = async () =>
	(await db.prepare('SELECT * FROM admin_actions ORDER BY rowid').all<Record<string, unknown>>())
		.results;

describe('scrubDetail', () => {
	it('redacts secret-looking keys at any depth but keeps identifiers', () => {
		const out = JSON.parse(
			scrubDetail({
				name: 'Mobile app',
				apiKey: 'sk-live-123',
				nested: { client_secret: 'abc', password: 'p', authCode: 'z', keyId: 'k1', user_id: 'u' },
				list: [{ token: 't' }]
			}) as string
		);
		expect(out.name).toBe('Mobile app');
		expect(out.apiKey).toBe('[redacted]');
		expect(out.nested).toEqual({
			client_secret: '[redacted]',
			password: '[redacted]',
			authCode: '[redacted]',
			keyId: 'k1',
			user_id: 'u'
		});
		expect(out.list[0].token).toBe('[redacted]');
		expect(isSecretKey('Authorization')).toBe(true);
		expect(isSecretKey('title')).toBe(false);
	});

	it('bounds strings, arrays, depth and total size', () => {
		const out = JSON.parse(
			scrubDetail({
				text: 'x'.repeat(500),
				many: Array.from({ length: 50 }, (_, i) => i)
			}) as string
		);
		expect(out.text.length).toBeLessThan(250);
		expect(out.many).toHaveLength(20);
		const deep = JSON.parse(scrubDetail({ a: { b: { c: { d: { e: 1 } } } } }) as string);
		expect(deep.a.b.c.d).toBe('[too deep]');
		const huge = scrubDetail(
			Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`field${i}`, 'y'.repeat(100)]))
		) as string;
		expect(huge.length).toBeLessThanOrEqual(AUDIT_DETAIL_MAX_CHARS);
		expect(JSON.parse(huge)).toEqual({ truncated: true });
	});

	it('handles empty, scalar and unserializable detail', () => {
		expect(scrubDetail(undefined)).toBeNull();
		expect(scrubDetail(null)).toBeNull();
		expect(scrubDetail('plain')).toBe('"plain"');
		expect(scrubDetail({ n: 1, b: true, nil: undefined, s: Symbol('x') })).toContain('"n":1');
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(scrubDetail(circular)).toContain('[too deep]');
		const evil = { toJSON: () => Promise.reject() } as never;
		expect(
			scrubDetail({
				get x() {
					throw new Error('no');
				}
			})
		).toContain('could not be serialized');
		expect(evil).toBeTruthy();
	});
});

describe('recordAudit', () => {
	it('stores a scrubbed row', async () => {
		const ok = await recordAudit(db, {
			actorId: 'u1',
			actorLogin: 'ada',
			action: 'settings.analytics',
			targetType: 'setting',
			summary: 'Changed it',
			detail: { enabled: true, token: 'super-secret' }
		});
		expect(ok).toBe(true);
		const [row] = await rows();
		expect(row.actor_login).toBe('ada');
		expect(String(row.detail_json)).not.toContain('super-secret');
		expect(String(row.created_at)).toMatch(/^\d{4}-\d\d-\d\dT/);
	});

	it('never throws: no database, a failing database, a missing table', async () => {
		const entry = { actorLogin: 'ada', action: 'x', summary: 's' };
		expect(await recordAudit(undefined, entry)).toBe(false);
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = {
			prepare: () => {
				throw new Error('D1 is down');
			}
		} as unknown as D1Database;
		expect(await recordAudit(broken, entry)).toBe(false);
		expect(spy).toHaveBeenCalled();
		const bare = createSqliteD1(['0001_initial_schema.sql']);
		expect(await recordAudit(bare, entry)).toBe(false);
	});

	it('clips oversized fields and tolerates a missing actor or action', async () => {
		await recordAudit(db, {
			actorLogin: '',
			action: '',
			summary: 'z'.repeat(1000),
			targetId: 't'.repeat(500)
		});
		const [row] = await rows();
		expect(row.actor_login).toBe('unknown');
		expect(row.action).toBe('unknown');
		expect(String(row.summary)).toHaveLength(300);
		expect(String(row.target_id)).toHaveLength(200);
		expect(row.actor_id).toBeNull();
	});
});

describe('listAudit / prune', () => {
	it('lists newest first, filters by actor and action, and parses detail', async () => {
		await recordAudit(db, { actorLogin: 'ada', action: 'a.one', summary: '1', detail: { x: 1 } });
		await recordAudit(db, { actorLogin: 'bob', action: 'a.two', summary: '2' });
		await recordAudit(db, { actorLogin: 'ada', action: 'a.two', summary: '3' });
		expect((await listAudit(db)).map((r) => r.summary)).toEqual(['3', '2', '1']);
		expect((await listAudit(db, { actor: 'ada' })).map((r) => r.summary)).toEqual(['3', '1']);
		expect((await listAudit(db, { action: 'a.two', actor: 'bob' })).map((r) => r.summary)).toEqual([
			'2'
		]);
		expect((await listAudit(db, { limit: 1 })).length).toBe(1);
		expect((await listAudit(db, { limit: 99999 })).length).toBe(3);
		const first = (await listAudit(db, { action: 'a.one' }))[0];
		expect(first.detail).toEqual({ x: 1 });
		expect(await listAuditActions(db)).toEqual(['a.one', 'a.two']);
	});

	it('survives a corrupt detail value and a missing table', async () => {
		await db
			.prepare(
				`INSERT INTO admin_actions (id, actor_login, action, summary, detail_json) VALUES ('1','a','x','s','{bad')`
			)
			.run();
		expect((await listAudit(db))[0].detail).toBeUndefined();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const bare = createSqliteD1(['0001_initial_schema.sql']);
		expect(await listAudit(bare)).toEqual([]);
		expect(await listAuditActions(bare)).toEqual([]);
	});

	it('prunes only rows past the retention window', async () => {
		expect(AUDIT_RETENTION_DAYS).toBe(365);
		const insert = (id: string, stamp: string) =>
			db
				.prepare(
					`INSERT INTO admin_actions (id, actor_login, action, summary, created_at) VALUES (?, 'a', 'x', 's', ?)`
				)
				.bind(id, stamp)
				.run();
		const day = (n: number) =>
			new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 19) + 'Z';
		await insert('old', day(400));
		await insert('edge', day(364));
		await insert('new', day(1));
		expect(await pruneAudit(db)).toBe(1);
		expect((await listAudit(db)).map((r) => r.id).sort()).toEqual(['edge', 'new']);
		await insert('today', day(0));
		expect(await pruneAudit(db, 0)).toBeLessThanOrEqual(2); // clamps to a day: today survives
		expect((await listAudit(db)).map((r) => r.id)).toContain('today');
	});
});

describe('rules and the request hook', () => {
	const admin = { id: 'a1', login: 'admin', isAdmin: true };
	function event(over: Record<string, unknown> = {}) {
		return {
			route: { id: '/api/admin/users/[id]' },
			params: { id: 'victim' },
			url: new URL('https://x.test/api/admin/users/victim'),
			request: new Request('https://x.test/api/admin/users/victim', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isAdmin: true, password: 'hunter2' })
			}),
			locals: { user: admin },
			platform: { env: { DB: db } },
			...over
		} as never;
	}

	it('matches rules by method and route, ignores reads and unknown routes', () => {
		expect(ruleFor('PATCH', '/api/admin/users/[id]')?.action).toBe('user.role_change');
		expect(ruleFor('GET', '/api/admin/users/[id]')).toBeNull();
		expect(ruleFor('POST', '/somewhere/else')).toBeNull();
		expect(ruleFor('POST', null)).toBeNull();
		expect(ruleFor('POST', '/admin/api-keys', 'create')?.action).toBe('api_key.create');
		expect(ruleFor('POST', '/admin/api-keys', 'nope')).toBeNull();
		expect(formActionName(new URL('https://x/admin/api-keys?/revoke'))).toBe('revoke');
		expect(formActionName(new URL('https://x/admin?plain=1'))).toBeNull();
	});

	it('records a role change with only the allowlisted body field', async () => {
		const res = await auditAround(event(), async () => new Response('{}', { status: 200 }));
		expect(res.status).toBe(200);
		const [row] = await rows();
		expect(row.action).toBe('user.role_change');
		expect(row.target_id).toBe('victim');
		expect(row.actor_login).toBe('admin');
		expect(JSON.parse(String(row.detail_json))).toEqual({ isAdmin: true });
		expect(String(row.detail_json)).not.toContain('hunter2');
	});

	it('leaves the body readable by the handler', async () => {
		const e = event();
		let seen: unknown;
		await auditAround(e, async (ev) => {
			seen = await ev.request.json();
			return new Response(null, { status: 204 });
		});
		expect(seen).toEqual({ isAdmin: true, password: 'hunter2' });
	});

	it('records nothing for failures, non-admins, anonymous callers, v1 or unmatched routes', async () => {
		await auditAround(event(), async () => new Response('no', { status: 403 }));
		await auditAround(
			event({ locals: { user: { id: 'u', login: 'u' } } }),
			async () => new Response('ok')
		);
		await auditAround(event({ locals: {} }), async () => new Response('ok'));
		await auditAround(
			event({ route: { id: '/api/v1/pages/[slug]' } }),
			async () => new Response('ok')
		);
		await auditAround(event({ route: { id: '/blog' } }), async () => new Response('ok'));
		await auditAround(event({ route: undefined }), async () => new Response('ok'));
		expect(await rows()).toHaveLength(0);
	});

	it('does not let a recording failure touch the response', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await auditAround(
			event({ platform: { env: {} } }),
			async () => new Response('fine')
		);
		expect(await res.text()).toBe('fine');
		const boom = await auditAround(
			event({ locals: undefined }),
			async () => new Response('still fine')
		);
		expect(await boom.text()).toBe('still fine');
	});

	it('judges a form action by its result, not just the status', async () => {
		const form = (headers: Record<string, string> = {}) =>
			event({
				route: { id: '/admin/api-keys' },
				params: {},
				url: new URL('https://x.test/admin/api-keys?/revoke'),
				request: new Request('https://x.test/admin/api-keys?/revoke', { method: 'POST', headers })
			});
		const json = (type: string) => new Response(JSON.stringify({ type }), { status: 200 });
		await auditAround(form({ 'x-sveltekit-action': 'true' }), async () => json('failure'));
		expect(await rows()).toHaveLength(0);
		await auditAround(form({ 'x-sveltekit-action': 'true' }), async () => json('success'));
		await auditAround(form(), async () => new Response(null, { status: 303 }));
		expect(await rows()).toHaveLength(2);
		expect(
			await formActionSucceeded(new Response('not json'), form({ 'x-sveltekit-action': '1' }))
		).toBe(false);
		expect(await formActionSucceeded(new Response('x', { status: 500 }), form())).toBe(false);
	});

	it('reads body fields only from small JSON requests', async () => {
		const mk = (type: string, body: string, length?: string) =>
			new Request('https://x.test/', {
				method: 'POST',
				headers: { 'content-type': type, ...(length ? { 'content-length': length } : {}) },
				body
			});
		expect(
			await allowedBodyFields(mk('application/json', '{"status":"published","x":1}'), ['status'])
		).toEqual({ status: 'published' });
		expect(await allowedBodyFields(mk('text/plain', '{"status":"a"}'), ['status'])).toEqual({});
		const big = {
			headers: new Headers({ 'content-type': 'application/json', 'content-length': '999999' }),
			clone: () => {
				throw new Error('must not be read');
			}
		} as unknown as Request;
		expect(await allowedBodyFields(big, ['status'])).toEqual({});
		expect(await allowedBodyFields(mk('application/json', 'not json'), ['status'])).toEqual({});
		expect(await allowedBodyFields(mk('application/json', '{}'), undefined)).toEqual({});
		expect(await allowedBodyFields(mk('application/json', 'null'), ['status'])).toEqual({});
	});

	it('records a target-less rule', async () => {
		await recordRule(db, AUDIT_RULES['POST /api/reset'], { id: null, login: 'x' }, { params: {} });
		expect((await rows())[0].target_id).toBeNull();
	});

	it('never audits a rule whose summary could carry a secret value', () => {
		for (const rule of Object.values(AUDIT_RULES)) {
			for (const field of rule.body ?? []) expect(isSecretKey(field)).toBe(false);
		}
	});
});

describe('presentation', () => {
	it('maps severity and shapes events for the module', () => {
		expect(auditSeverity('site.reset')).toBe('critical');
		expect(auditSeverity('user.delete')).toBe('warning');
		expect(auditSeverity('user.merge')).toBe('warning');
		expect(auditSeverity('settings.analytics')).toBe('notice');
		expect(auditSeverity('page.save')).toBe('info');
		const event = toAuditEvent({
			id: '1',
			at: '2026-01-01T00:00:00Z',
			actor: 'ada',
			actorId: 'u',
			action: 'user.delete',
			targetType: 'user',
			targetId: 'u2',
			summary: 'Deleted a user',
			detail: { a: 1 }
		});
		expect(event.target).toBe('user: u2');
		expect(event.details).toEqual({ summary: 'Deleted a user', detail: { a: 1 } });
		const bareRow = {
			id: '2',
			at: 'x',
			actor: 'a',
			actorId: null,
			action: 'x',
			targetType: null,
			targetId: null,
			summary: 's',
			detail: undefined
		};
		expect(toAuditEvent(bareRow).target).toBeUndefined();
		expect(toAuditEvent({ ...bareRow, targetType: 'page' }).target).toBe('page');
	});
});

describe('siteApi writes', () => {
	function apiEvent(method: string, routeId: string, params: Record<string, string> = {}) {
		return {
			request: new Request('https://x.test/api/v1/thing', {
				method,
				headers: { 'content-type': 'application/json' }
			}),
			route: { id: routeId },
			params,
			url: new URL('https://x.test/api/v1/thing'),
			locals: { user: { id: 'o1', login: 'owner', isOwner: true } },
			platform: { env: { DB: db } }
		} as never;
	}

	it('records a successful write by a signed-in owner, with the rule metadata', async () => {
		const handler = siteApi('pages:write', async () => new Response('{}', { status: 200 }));
		await handler(apiEvent('PUT', '/api/v1/pages/[slug]', { slug: 'home' }));
		const [row] = await rows();
		expect(row).toMatchObject({
			actor_id: 'o1',
			actor_login: 'owner',
			action: 'page.save',
			target_type: 'page',
			target_id: 'home'
		});
	});

	it('does not record reads, failures or public endpoints, and names unknown writes generically', async () => {
		await siteApi(
			'pages:write',
			async () => new Response('{}')
		)(apiEvent('GET', '/api/v1/pages/[slug]'));
		await siteApi(
			'pages:write',
			async () => new Response('no', { status: 422 })
		)(apiEvent('PUT', '/api/v1/pages/[slug]'));
		await siteApi(null, async () => new Response('{}'))(apiEvent('POST', '/api/v1/checkout'));
		expect(await rows()).toHaveLength(0);
		await siteApi(
			'site:admin',
			async () => new Response('{}')
		)(apiEvent('POST', '/api/v1/unlisted'));
		const [row] = await rows();
		expect(row.action).toBe('api.post');
		expect(row.target_type).toBe('api');
	});
});

describe('siteApi audit resilience', () => {
	it('survives an event it cannot describe, and an unwritable table', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const handler = siteApi('site:admin', async () => new Response('{}'));
		const odd = {
			request: new Request('https://x.test/api/v1/x', {
				method: 'POST',
				headers: { 'content-type': 'application/json' }
			}),
			locals: { user: { id: 'o', login: 'owner', isOwner: true } },
			platform: { env: { DB: db } }
		} as never; // no url, no route, no params
		expect((await handler(odd)).status).toBe(200);
		await db.exec('DROP TABLE admin_actions');
		const ok = apiEventFor(db);
		expect((await handler(ok)).status).toBe(200);
	});
});

function apiEventFor(database: D1Database) {
	return {
		request: new Request('https://x.test/api/v1/x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' }
		}),
		route: { id: '/api/v1/x' },
		params: {},
		url: new URL('https://x.test/api/v1/x'),
		locals: { user: { id: 'o', login: 'owner', isOwner: true } },
		platform: { env: { DB: database } }
	} as never;
}

describe('account merge', () => {
	it('leaves an audit row that survives the deleted user', async () => {
		const user = (id: string, email: string) =>
			db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)').bind(id, email, id).run();
		await user('src', 'src@x.test');
		await user('dst', 'dst@x.test');
		await mergeAccounts(db as never, 'src', 'dst');
		expect(await db.prepare("SELECT id FROM users WHERE id = 'src'").first()).toBeNull();
		const [row] = await rows();
		expect(row).toMatchObject({ action: 'user.merge', target_id: 'src', actor_id: 'dst' });
	});
});

describe('cron and page', () => {
	const call = (env: Record<string, unknown>, auth?: string) =>
		pruneRoute({
			request: new Request('https://x.test/api/cron/prune-audit', {
				method: 'POST',
				headers: auth ? { authorization: auth } : {}
			}),
			url: new URL('https://x.test/api/cron/prune-audit'),
			platform: { env }
		} as never);

	// The job runs through the shared scheduler (src/lib/server/scheduler), which
	// owns authorization, claims and run history; its own tests cover those.
	it('prunes with the shared secret and refuses everything else', async () => {
		await expect(call({ DB: db })).rejects.toMatchObject({ status: 503 });
		await expect(call({ DB: db, CRON_SECRET: 's' })).rejects.toMatchObject({ status: 401 });
		await expect(call({ DB: db, CRON_SECRET: 's' }, 'Bearer wrong')).rejects.toMatchObject({
			status: 401
		});
		await db
			.prepare(
				`INSERT INTO admin_actions (id, actor_login, action, summary, created_at) VALUES ('o','a','x','s','2000-01-01T00:00:00Z')`
			)
			.run();
		const res = await call({ DB: db, CRON_SECRET: 's' }, 'Bearer s');
		const body = await res.json();
		expect(body.outcome).toBe('succeeded');
		expect(body.detail).toEqual({ retentionDays: 365, pruned: 1, prunedSignIns: 0 });
	});

	it('serves the page to owners and superadmins only', async () => {
		await recordAudit(db, { actorLogin: 'ada', action: 'user.delete', summary: 's' });
		const load = (user: unknown, search = '', env: Record<string, unknown> = { DB: db }) =>
			auditPage.load({
				locals: { user },
				platform: { env },
				url: new URL(`https://x.test/admin/audit${search}`)
			} as never);
		await expect(load(undefined)).rejects.toMatchObject({ status: 401 });
		await expect(load({ id: 'u' })).rejects.toMatchObject({ status: 403 });
		// An ordinary admin cannot read what every admin did.
		await expect(load({ isAdmin: true })).rejects.toMatchObject({ status: 403 });
		await expect(load({ isSuperAdmin: true }, '', {})).rejects.toMatchObject({ status: 503 });
		const data = (await load({ isSuperAdmin: true }, '?actor=ada&action=user.delete')) as never as {
			events: unknown[];
			actions: string[];
			actor: string;
		};
		expect(data.events).toHaveLength(1);
		expect(data.actions).toEqual(['user.delete']);
		expect(data.actor).toBe('ada');
		const none = (await load({ isOwner: true })) as never as { actor: string; action: string };
		expect(none).toMatchObject({ actor: '', action: '' });
	});
});
