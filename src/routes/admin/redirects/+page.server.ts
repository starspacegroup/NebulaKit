import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/auth-guards';
import {
	allowedRedirectHosts,
	createRedirect,
	deleteRedirect,
	listRedirects,
	updateRedirect,
	validateRedirect,
	wouldLoop
} from '$lib/server/redirects';
import type { Actions, PageServerLoad } from './$types';

/** /admin/redirects: old addresses that send visitors to new ones. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	requirePermission(locals, 'pages');
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return { redirects: await listRedirects(db) };
};

async function check(form: FormData, platform: App.Platform | undefined, ignoreId?: number) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const values = {
		fromPath: String(form.get('from_path') ?? ''),
		toPath: String(form.get('to_path') ?? ''),
		status: Number(form.get('status') ?? 301)
	};
	const checked = validateRedirect(
		values,
		allowedRedirectHosts(platform?.env?.REDIRECT_ALLOWED_HOSTS)
	);
	if (!checked.ok) return { db, values, problem: checked.error };
	if (await wouldLoop(db, checked.value.fromPath, checked.value.toPath, ignoreId)) {
		return { db, values, problem: 'That would send visitors in a circle through other redirects.' };
	}
	return { db, values, value: checked.value };
}

export const actions: Actions = {
	create: async ({ locals, platform, request }) => {
		requirePermission(locals, 'pages');
		const result = await check(await request.formData(), platform);
		if (!result.value)
			return fail(400, { action: 'create', problem: result.problem, values: result.values });
		try {
			await createRedirect(result.db, result.value);
		} catch {
			return fail(409, {
				action: 'create',
				problem: 'A redirect for that old address already exists.',
				values: result.values
			});
		}
		return { action: 'create', message: 'Redirect added.' };
	},

	update: async ({ locals, platform, request }) => {
		requirePermission(locals, 'pages');
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id)) return fail(400, { action: 'update', problem: 'Missing redirect.' });
		const result = await check(form, platform, id);
		if (!result.value) {
			return fail(400, { action: 'update', id, problem: result.problem, values: result.values });
		}
		try {
			await updateRedirect(result.db, id, result.value);
		} catch {
			return fail(409, {
				action: 'update',
				id,
				problem: 'Another redirect already uses that old address.',
				values: result.values
			});
		}
		return { action: 'update', message: 'Redirect saved.' };
	},

	delete: async ({ locals, platform, request }) => {
		requirePermission(locals, 'pages');
		const db = platform?.env?.DB;
		if (!db) throw error(503, 'The site database is not available');
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { action: 'delete', problem: 'Missing redirect.' });
		await deleteRedirect(db, id);
		return { action: 'delete', message: 'Redirect removed.' };
	}
};
