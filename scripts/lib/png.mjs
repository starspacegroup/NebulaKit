// @ts-nocheck -- a plain Node script, covered by tests/unit/og-card.test.ts rather than by types.
/**
 * Just enough PNG to flatten a screenshot to opaque RGB and to read a file's header, with no
 * dependencies (zlib is Node's).
 *
 * Why RGB: a browser screenshot is RGBA. Share-image crawlers draw transparency on whatever
 * they like (white, black, a checkerboard), so a card meant to be dark can arrive white. An
 * opaque RGB card looks the same everywhere. `tests/unit/share-images.test.ts` requires it.
 *
 * Reads 8-bit, non-interlaced, truecolour (2) or truecolour with alpha (6): what Chromium writes.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buffer) {
	let c = 0xffffffff;
	for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const out = Buffer.alloc(8 + data.length + 4);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body), 8 + data.length);
	return out;
}

/** `{ width, height, bitDepth, colorType, interlace }` from the IHDR, or throws if it is not a PNG. */
export function pngInfo(buffer) {
	if (buffer.length < 33 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
		throw new Error('Not a PNG file');
	}
	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
		bitDepth: buffer[24],
		colorType: buffer[25],
		interlace: buffer[28]
	};
}

const CHANNELS = { 2: 3, 6: 4 };

function paeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** The pixels as raw rows (filter bytes removed), plus the header. */
export function decodePng(buffer) {
	const info = pngInfo(buffer);
	const channels = CHANNELS[info.colorType];
	if (info.bitDepth !== 8 || !channels || info.interlace !== 0) {
		throw new Error(
			`Unsupported PNG (bit depth ${info.bitDepth}, colour type ${info.colorType}, interlace ${info.interlace})`
		);
	}
	const idat = [];
	for (let offset = 8; offset < buffer.length;) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.toString('ascii', offset + 4, offset + 8);
		if (type === 'IDAT') idat.push(buffer.subarray(offset + 8, offset + 8 + length));
		if (type === 'IEND') break;
		offset += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const stride = info.width * channels;
	const out = Buffer.alloc(stride * info.height);
	for (let y = 0; y < info.height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const left = x >= channels ? out[y * stride + x - channels] : 0;
			const up = y > 0 ? out[(y - 1) * stride + x] : 0;
			const upLeft = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels] : 0;
			let value = line[x];
			if (filter === 1) value += left;
			else if (filter === 2) value += up;
			else if (filter === 3) value += (left + up) >> 1;
			else if (filter === 4) value += paeth(left, up, upLeft);
			else if (filter !== 0) throw new Error(`Bad PNG filter type ${filter}`);
			out[y * stride + x] = value & 0xff;
		}
	}
	return { ...info, channels, pixels: out };
}

/**
 * Encode raw rows as a PNG. `filter` applies one filter type to every row (0 none, 1 sub,
 * 2 up); it exists so tests can round-trip the decoder through more than the plain case.
 */
export function encodePng({ width, height, colorType, pixels, filter = 0 }) {
	const channels = CHANNELS[colorType];
	if (!channels) throw new Error(`Unsupported colour type ${colorType}`);
	const stride = width * channels;
	const rows = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		rows[y * (stride + 1)] = filter;
		for (let x = 0; x < stride; x++) {
			const value = pixels[y * stride + x];
			const left = x >= channels ? pixels[y * stride + x - channels] : 0;
			const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
			const predicted = filter === 1 ? left : filter === 2 ? up : 0;
			rows[y * (stride + 1) + 1 + x] = (value - predicted) & 0xff;
		}
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = colorType;
	return Buffer.concat([
		SIGNATURE,
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/**
 * An opaque RGB copy of a PNG. A pixel with alpha is blended onto `background` (white by
 * default), so nothing is left for a crawler to draw its own colour behind.
 */
export function toRgbPng(buffer, background = [255, 255, 255]) {
	const png = decodePng(buffer);
	if (png.colorType === 2) return encodePng({ ...png, pixels: png.pixels });
	const pixels = Buffer.alloc(png.width * png.height * 3);
	for (let i = 0, o = 0; i < png.pixels.length; i += 4, o += 3) {
		const alpha = png.pixels[i + 3] / 255;
		for (let c = 0; c < 3; c++) {
			pixels[o + c] = Math.round(png.pixels[i + c] * alpha + background[c] * (1 - alpha));
		}
	}
	return encodePng({ width: png.width, height: png.height, colorType: 2, pixels });
}
