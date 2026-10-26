/**
 * HTTP byte ranges for /media. Safari and iOS will not play a <video> whose
 * server ignores `Range`, so the media route answers ranges with a 206.
 * Only a single range is honoured; a multi-range or malformed header is
 * treated as absent and the whole object is served, which RFC 9110 allows.
 */

export interface ByteRange {
	offset: number;
	length: number;
}

/**
 * Resolve a `Range` header against an object of `size` bytes.
 * Returns the range to serve, `null` to serve the whole object, or
 * `'unsatisfiable'` when the range starts past the end (a 416).
 */
export function parseByteRange(
	header: string | null,
	size: number
): ByteRange | null | 'unsatisfiable' {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;
	const [, startRaw, endRaw] = match;
	if (startRaw === '' && endRaw === '') return null;

	if (startRaw === '') {
		// bytes=-N: the last N bytes
		const suffix = Number(endRaw);
		if (suffix === 0) return 'unsatisfiable';
		const length = Math.min(suffix, size);
		return { offset: size - length, length };
	}

	const start = Number(startRaw);
	if (start >= size) return 'unsatisfiable';
	const end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1);
	if (end < start) return null;
	return { offset: start, length: end - start + 1 };
}
