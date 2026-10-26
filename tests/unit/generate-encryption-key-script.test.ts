import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generateKey } from '../../scripts/generate-encryption-key.mjs';
import { parseEncryptionKey } from '../../src/lib/server/secret-box';

const script = 'scripts/generate-encryption-key.mjs';

describe('generate-encryption-key', () => {
	it('produces keys the secret box accepts, and a different one each time', () => {
		const a = generateKey();
		expect(parseEncryptionKey(a)).toHaveLength(32);
		expect(generateKey()).not.toBe(a);
	});

	it('prints the bare key by default and an assignment with --env', () => {
		const bare = execFileSync('node', [script], { encoding: 'utf8' }).trim();
		expect(parseEncryptionKey(bare)).toHaveLength(32);
		const env = execFileSync('node', [script, '--env'], { encoding: 'utf8' }).trim();
		expect(env).toMatch(/^ENCRYPTION_KEY=/);
		expect(parseEncryptionKey(env.slice('ENCRYPTION_KEY='.length))).toHaveLength(32);
	});
});
