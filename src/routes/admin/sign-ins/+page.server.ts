import { error, fail } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/auth-guards';
import { isPiiRevealed, maskEmail, PII_REVEAL_COOKIE } from '$lib/server/pii-mask';
import {
	SIGN_IN_RETENTION_DAYS,
	clearSignIns,
	listSessions,
	listSignIns,
	maskIp,
	readTracking,
	revokeSession,
	signInSummary,
	writeTracking
} from '$lib/server/sign-ins';
import type { Actions, PageServerLoad } from './$types';

/**
 * /admin/sign-ins — OWNER-ONLY (docs/SIGN_IN_TRACKING.md). The switch for
 * opt-in sign-in tracking, the live sessions (any of which can be revoked) and
 * the recorded attempts. IP addresses and emails are masked until the owner
 * reveals PII, the same toggle the users list uses.
 */
function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

export const load: PageServerLoad = async ({ locals, platform, cookies }) => {
	const owner = requireOwner(locals);
	const db = database(platform);
	const revealed = isPiiRevealed(owner, cookies.get(PII_REVEAL_COOKIE));
	const [tracking, sessions, events, summary] = await Promise.all([
		readTracking(platform?.env?.KV),
		listSessions(db),
		listSignIns(db),
		signInSummary(db)
	]);
	const email = (value: string | null) => (revealed ? value : value ? maskEmail(value) : null);
	return {
		tracking,
		revealed,
		retentionDays: SIGN_IN_RETENTION_DAYS,
		summary,
		sessions: sessions.map((s) => ({ ...s, email: email(s.email), own: s.userId === owner.id })),
		events: events.map((e) => ({
			...e,
			email: email(e.email),
			ip: revealed ? e.ip : e.ip ? maskIp(e.ip) : null
		}))
	};
};

export const actions: Actions = {
	/** Turn tracking on or off. Turning it off stops new writes; history stays until cleared or aged out. */
	tracking: async ({ locals, platform, request }) => {
		requireOwner(locals);
		const kv = platform?.env?.KV;
		if (!kv)
			return fail(503, { error: 'KV storage is not available, so the setting cannot be saved.' });
		const enabled = (await request.formData()).get('enabled') === 'on';
		await writeTracking(kv, enabled);
		return { saved: enabled ? 'on' : 'off' };
	},
	/** Sign one session out. */
	revoke: async ({ locals, platform, request }) => {
		requireOwner(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id || !(await revokeSession(database(platform), id))) {
			return fail(404, { error: 'That session is already gone.' });
		}
		return { revoked: true };
	},
	/** Delete every recorded attempt and every last-seen time. */
	clear: async ({ locals, platform }) => {
		requireOwner(locals);
		return { cleared: await clearSignIns(database(platform)) };
	}
};
