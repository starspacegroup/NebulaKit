const PASSWORD_ITERATIONS = 310000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
	if (value.length % 2 !== 0) {
		throw new Error('Invalid hex string length');
	}

	const bytes = new Uint8Array(value.length / 2);
	for (let index = 0; index < value.length; index += 2) {
		bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
	}

	return bytes;
}

async function derivePasswordHash(
	password: string,
	salt: Uint8Array,
	iterations: number
): Promise<Uint8Array> {
	const passwordKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt,
			iterations
		},
		passwordKey,
		PASSWORD_HASH_BYTES * 8
	);

	return new Uint8Array(derivedBits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left[index] ^ right[index];
	}

	return difference === 0;
}

export function validatePassword(password: string): string | null {
	if (password.length < 10) {
		return 'Password must be at least 10 characters long.';
	}

	return null;
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
	const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);

	return ['pbkdf2_sha256', String(PASSWORD_ITERATIONS), bytesToHex(salt), bytesToHex(hash)].join(
		'$'
	);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [algorithm, iterationsValue, saltHex, hashHex] = storedHash.split('$');

	if (algorithm !== 'pbkdf2_sha256' || !iterationsValue || !saltHex || !hashHex) {
		return false;
	}

	const iterations = Number.parseInt(iterationsValue, 10);
	if (!Number.isFinite(iterations) || iterations <= 0) {
		return false;
	}

	const salt = hexToBytes(saltHex);
	const expectedHash = hexToBytes(hashHex);
	const actualHash = await derivePasswordHash(password, salt, iterations);

	return timingSafeEqual(actualHash, expectedHash);
}
