import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createContactFormSubmission } from '$lib/services/contact';
import { validateContactInput } from '$lib/utils/contact-validation';
import { verifyTurnstile, turnstileEnabled } from '$lib/server/turnstile';

export const load: PageServerLoad = async ({ platform }) => {
	// Surface the public Turnstile site key so the widget only renders when
	// Turnstile is configured. Null => no widget, no verification (optional).
	return {
		turnstileSiteKey: platform?.env?.TURNSTILE_SITE_KEY ?? null
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

		const secretKey = platform?.env?.TURNSTILE_SECRET_KEY;
		if (turnstileEnabled(secretKey)) {
			const token = form.get('cf-turnstile-response');
			const ok = await verifyTurnstile({
				secretKey: secretKey as string,
				token: typeof token === 'string' ? token : null,
				remoteIp: request.headers.get('CF-Connecting-IP')
			});
			if (!ok) return fail(400, { error: 'Verification failed. Please try again.' });
		}

		await createContactFormSubmission(db, result.value);
		return { success: true, message: 'Your message has been sent successfully.' };
	}
};
