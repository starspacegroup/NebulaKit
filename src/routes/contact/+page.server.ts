import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createContactFormSubmission } from '$lib/services/contact';
import { validateContactInput } from '$lib/utils/contact-validation';
import { getTurnstileConfig, verifyTurnstile } from '$lib/server/turnstile';

export const load: PageServerLoad = async ({ platform }) => {
	const config = getTurnstileConfig(
		platform?.env?.TURNSTILE_SITE_KEY,
		platform?.env?.TURNSTILE_SECRET_KEY
	);
	if ('error' in config) throw error(500, config.error);
	return {
		turnstileSiteKey: config.enabled ? config.siteKey : null
	};
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const db = platform?.env?.DB;
		if (!db) return fail(500, { error: 'Unable to send your message right now.' });

		const form = await request.formData();
		const result = validateContactInput({
			name: form.get('name'),
			email: form.get('email'),
			message: form.get('message')
		});
		if (!result.ok) return fail(400, { error: result.error });

		const config = getTurnstileConfig(
			platform?.env?.TURNSTILE_SITE_KEY,
			platform?.env?.TURNSTILE_SECRET_KEY
		);
		if ('error' in config) return fail(503, { error: config.error });
		if (config.enabled) {
			const token = form.get('cf-turnstile-response');
			const ok = await verifyTurnstile({
				secretKey: config.secretKey,
				token: typeof token === 'string' ? token : null,
				remoteIp: request.headers.get('CF-Connecting-IP')
			});
			if (!ok) return fail(400, { error: 'Verification failed. Please try again.' });
		}

		await createContactFormSubmission(db, result.value);
		return { success: true, message: 'Your message has been sent successfully.' };
	}
};
