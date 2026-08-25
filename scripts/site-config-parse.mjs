/**
 * Pull the config values out of site.config.ts as text.
 *
 * String literals are read in either quote style. Prettier switches a value to
 * double quotes as soon as it contains an apostrophe — "Cloudflare's full
 * stack" is exactly that — and a single-quote-only reader silently returned
 * `undefined`, which then got written straight back into the config as the
 * literal string "undefined". Exported so tests can hold that behaviour down.
 *
 * @param {string} src Contents of src/lib/site.config.ts.
 */
export function parseSiteConfig(src) {
	/** @param {string} key */
	const str = (key) => {
		const match = src.match(new RegExp(`${key}:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`));
		return match ? match[2].replace(/\\(['"\\\\])/g, '$1') : undefined;
	};
	/** @param {string} key */
	const num = (key) => Number(src.match(new RegExp(`${key}:\\s*(\\d+)`))?.[1]);
	return {
		name: str('name'),
		shortName: str('shortName'),
		tagline: str('tagline'),
		description: str('description'),
		slug: str('slug'),
		devPort: num('devPort'),
		url: str('url'),
		repo: str('repo'),
		author: str('author'),
		authorUrl: str('authorUrl')
	};
}
