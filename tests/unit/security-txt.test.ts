import { describe, expect, it } from 'vitest';
import { SECURITY_TXT_PATH } from '../../src/lib/agent-discovery';
import {
	SECURITY_TXT_VALID_DAYS,
	buildSecurityTxt,
	parseSecurityContacts
} from '../../src/lib/server/security-txt';
import { GET } from '../../src/routes/[x+2e]well-known/security.txt/+server';
import { site } from '../../src/lib/site.config';

const NOW = new Date('2026-10-25T12:34:56.789Z');
const get = (contact?: string) =>
	(GET as (e: never) => Response)({
		platform: contact === undefined ? undefined : { env: { SECURITY_CONTACT: contact } }
	} as never);

describe('parseSecurityContacts', () => {
	it('turns emails into mailto and keeps https URLs', () => {
		expect(parseSecurityContacts('security@example.com, https://example.com/report')).toEqual([
			'mailto:security@example.com',
			'https://example.com/report'
		]);
	});
	it('drops everything that is not a usable contact', () => {
		for (const bad of [
			'',
			'  ',
			'http://example.com/report',
			'javascript:alert(1)',
			'tel:+15555550100',
			'not an email',
			'a@b',
			'a@b.c\nContact: mailto:evil@example.com',
			'https://user:pw@example.com/',
			'https://',
			'https://exa mple.com'
		]) {
			expect(parseSecurityContacts(bad), bad).toEqual([]);
		}
		expect(parseSecurityContacts(undefined)).toEqual([]);
		expect(parseSecurityContacts(null)).toEqual([]);
	});
});

describe('buildSecurityTxt', () => {
	it('is null without a usable contact: nothing is invented', () => {
		expect(buildSecurityTxt(undefined, NOW)).toBeNull();
		expect(buildSecurityTxt('nonsense', NOW)).toBeNull();
	});
	it('has every field RFC 9116 requires, one Contact per address', () => {
		const body = buildSecurityTxt('a@example.com,https://example.com/r', NOW)!;
		const lines = body.split('\n');
		expect(lines).toContain('Contact: mailto:a@example.com');
		expect(lines).toContain('Contact: https://example.com/r');
		expect(lines).toContain(`Canonical: ${site.url}${SECURITY_TXT_PATH}`);
		expect(body.endsWith('\n')).toBe(true);
		expect(lines.filter((l) => l.startsWith('Expires:'))).toHaveLength(1);
	});
	it('computes a rolling Expires under one year, in ISO 8601 UTC', () => {
		const expires = buildSecurityTxt('a@example.com', NOW)!
			.split('\n')
			.find((l) => l.startsWith('Expires: '))!
			.slice('Expires: '.length);
		expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
		const days = (Date.parse(expires) - NOW.getTime()) / 86_400_000;
		expect(days).toBeGreaterThan(SECURITY_TXT_VALID_DAYS - 1);
		expect(days).toBeLessThan(365);
		const later = buildSecurityTxt('a@example.com', new Date(NOW.getTime() + 86_400_000))!;
		expect(later).not.toBe(buildSecurityTxt('a@example.com', NOW));
	});
});

describe('GET /.well-known/security.txt', () => {
	it('is a 404 when no contact is configured', () => {
		expect(() => get()).toThrowError(expect.objectContaining({ status: 404 }));
		expect(() => get('garbage')).toThrowError(expect.objectContaining({ status: 404 }));
	});
	it('serves text/plain when a contact is configured', async () => {
		const response = get('security@example.com');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
		expect(await response.text()).toContain('Contact: mailto:security@example.com');
	});
});
