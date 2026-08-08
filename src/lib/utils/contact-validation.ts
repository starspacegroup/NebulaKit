/**
 * Shared validation for contact-form input.
 *
 * Both entry points — the public page action (`/contact`) and the public API
 * endpoint (`POST /api/contact-form-submissions`) — run this so the two can
 * never drift apart (in the downstream original the API skipped validation).
 * Pure and dependency-free so it's trivially unit-testable.
 */

export interface ContactInput {
	name: string;
	email: string;
	message: string;
}

export type ContactValidationResult =
	{ ok: true; value: ContactInput } | { ok: false; error: string };

/** Minimum trimmed message length — blocks empty/one-word noise submissions. */
export const CONTACT_MESSAGE_MIN_LENGTH = 8;

// Deliberately permissive: one `@`, at least one `.` in the domain. Real
// deliverability is Turnstile + downstream, not a regex's job.
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/**
 * Validate + normalize raw contact input (trims all fields). Returns a
 * discriminated result so callers can map `error` straight to a 400 message.
 */
export function validateContactInput(raw: {
	name?: unknown;
	email?: unknown;
	message?: unknown;
}): ContactValidationResult {
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	const email = typeof raw.email === 'string' ? raw.email.trim() : '';
	const message = typeof raw.message === 'string' ? raw.message.trim() : '';

	if (!name || !email || !message) {
		return { ok: false, error: 'Please fill in all required fields.' };
	}
	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, error: 'Please provide a valid email address.' };
	}
	if (message.length < CONTACT_MESSAGE_MIN_LENGTH) {
		return { ok: false, error: 'Message is too short.' };
	}

	return { ok: true, value: { name, email, message } };
}
