import { site } from '$lib/site.config';

/**
 * Per-site prefix for form field `id` and `name` attributes.
 *
 * Every site built from this template ships the same auth forms. If they also
 * ship the same field identifiers, password managers that match on host rather
 * than on origin — `localhost` across two local projects, or sibling subdomains
 * of one registrable domain — read those forms as the same login and offer the
 * wrong credentials. `site.slug` is unique per site and `bun run customize`
 * rewrites it, so prefixing with it keeps each deployment's fields distinct
 * with no extra step for the person who used the template.
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
