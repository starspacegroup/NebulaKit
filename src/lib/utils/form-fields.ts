import { site } from '$lib/site.config';

/**
 * Per-deployment prefix for form field `id` and `name` attributes.
 *
 * Deployments that share this codebase ship identical auth forms. If they also
 * ship identical field identifiers, a password manager that matches on host
 * rather than on origin — `localhost` across two local checkouts, or sibling
 * subdomains of one registrable domain — reads those forms as the same login
 * and offers the wrong credentials. `site.slug` already differs per deployment,
 * so prefixing with it keeps the fields distinct with no extra step.
 *
 * Prefix the identifiers only. `autocomplete` tokens (`email`,
 * `current-password`, `new-password`, `name`) are the standard signal that
 * makes autofill work correctly — keep them exactly as the spec defines them.
 */
export const fieldPrefix = site.slug;

/** Site-unique `id`/`name` for a form field, e.g. `nebulakit-password`. */
export function fieldName(base: string): string {
	return `${fieldPrefix}-${base}`;
}
