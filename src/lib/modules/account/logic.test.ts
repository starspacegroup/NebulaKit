import { describe, expect, it } from 'vitest';
import {
	AVATAR_MAX_BYTES,
	accountByInitial,
	avatarFileError,
	changedFields,
	charsLeft,
	confirmMatches,
	currentIndex,
	defaultPasswordRules,
	disabledIndexes,
	errorCount,
	fillMessage,
	firstErrorField,
	formatBytes,
	formatCountdown,
	formatRecoveryCode,
	formatSecret,
	generateRecoveryCodes,
	isCommonPassword,
	isoTime,
	isDirty,
	isRepetitive,
	isValidEmail,
	maskEmail,
	meetsAllRequirements,
	nextResetStep,
	normaliseCode,
	otherSessions,
	passwordRequirements,
	passwordStrength,
	pluralise,
	recoveryCodesFile,
	recoveryCodesText,
	recoveryFilename,
	relativeTime,
	secondsRemaining,
	sortSessions,
	validateCode,
	validateEmail,
	validateName,
	validatePassword,
	validatePasswordMatch,
	validateProfile,
	validateSignIn,
	validateSignUp,
	type AccountSession,
	type SwitcherAccount
} from './logic';

describe('fillMessage', () => {
	it('fills known placeholders and leaves unknown ones', () => {
		expect(fillMessage('Use {min} of {max} {nope}', { min: 8, max: 'ten' })).toBe(
			'Use 8 of ten {nope}'
		);
	});
});

describe('email and name', () => {
	it('accepts ordinary addresses', () => {
		for (const ok of ['a@b.co', ' ada@example.com ', 'first.last+tag@sub.example.org']) {
			expect(isValidEmail(ok)).toBe(true);
		}
	});
	it('rejects malformed addresses', () => {
		for (const bad of [
			'',
			'   ',
			'ada',
			'ada@',
			'@x.com',
			'a@b',
			'a b@c.com',
			'a@b..com',
			'a@@b.com'
		]) {
			expect(isValidEmail(bad)).toBe(false);
		}
		expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false);
	});
	it('gives the right message', () => {
		expect(validateEmail('')).toMatch(/Enter your email/);
		expect(validateEmail('nope')).toMatch(/like name@example/);
		expect(validateEmail('a@b.co')).toBe('');
		expect(validateEmail('', { emailRequired: 'Falta' })).toBe('Falta');
	});
	it('validates names', () => {
		expect(validateName('  ')).toMatch(/Enter your name/);
		expect(validateName('Ada')).toBe('');
		expect(validateName('x'.repeat(81))).toBe('Use 80 characters or fewer.');
		expect(validateName('xxxx', undefined, 3)).toBe('Use 3 characters or fewer.');
	});
});

describe('password rules and strength', () => {
	it('lists each requirement with whether it is met', () => {
		const reqs = passwordRequirements('abc');
		expect(reqs.map((r) => r.id)).toEqual(['length', 'lower', 'upper', 'number', 'symbol']);
		expect(reqs.map((r) => r.met)).toEqual([false, true, false, false, false]);
		const full = passwordRequirements('Abcdef1!');
		expect(full.every((r) => r.met)).toBe(true);
	});
	it('uses the minimum in the length rule', () => {
		const rules = defaultPasswordRules(12);
		expect(rules[0].label).toBe('At least 12 characters');
		expect(meetsAllRequirements('Abcdef1!', rules)).toBe(false);
		expect(meetsAllRequirements('Abcdefghij1!', rules)).toBe(true);
		expect(meetsAllRequirements('')).toBe(false);
	});
	it('counts non-English letters as letters, not symbols', () => {
		const sym = passwordRequirements('ÄÖÜäöü12')[4];
		expect(sym.met).toBe(false);
		expect(passwordRequirements('Éa1')[1].met).toBe(true);
	});
	it('detects repetition and common passwords', () => {
		expect(isRepetitive('aaaaaaaa')).toBe(true);
		expect(isRepetitive('abababab')).toBe(true);
		expect(isRepetitive('abcabcabc')).toBe(true);
		expect(isRepetitive('abc')).toBe(false);
		expect(isRepetitive('abcdefgh')).toBe(false);
		expect(isCommonPassword('MyPassword9')).toBe(true);
		expect(isCommonPassword('x7!rT#zQ')).toBe(false);
	});
	it('scores from empty to strong', () => {
		expect(passwordStrength('')).toEqual({ score: 0, level: 'empty', percent: 0 });
		expect(passwordStrength('abc').level).toBe('weak');
		expect(passwordStrength('Ab1!').score).toBe(2);
		expect(passwordStrength('Abcdefg1').level).toBe('fair');
		expect(passwordStrength('Abcdefg1!').level).toBe('good');
		expect(passwordStrength('Abcdefghij1!')).toEqual({ score: 4, level: 'strong', percent: 100 });
		expect(passwordStrength('correcthorsebatterystaple').level).toBe('fair');
	});
	it('caps repetitive and common passwords at weak', () => {
		expect(passwordStrength('aaaaaaaaaaaaaaaaaaaa').level).toBe('weak');
		expect(passwordStrength('Password1!xyz').level).toBe('weak');
	});
	it('is monotonic with length for one class of characters', () => {
		let last = 0;
		for (const p of ['a', 'abcdefgh', 'abcdefghijkl', 'abcdefghijklmnop'].map((x) =>
			x.replace(/./g, (c, i) => String.fromCharCode(97 + ((i * 7) % 26)))
		)) {
			const s = passwordStrength(p).score;
			expect(s).toBeGreaterThanOrEqual(last);
			last = s;
		}
	});
});

describe('validatePassword', () => {
	it('walks required, too short, weak, ok', () => {
		expect(validatePassword('')).toMatch(/Enter your password/);
		expect(validatePassword('Ab1!')).toBe('Use at least 8 characters.');
		expect(validatePassword('abcdefgh')).toMatch(/stronger/);
		expect(validatePassword('Abcdef1!')).toBe('');
	});
	it('takes custom rules, min and messages', () => {
		const rules = [{ id: 'x', label: 'has x', test: (p: string) => p.includes('x') }];
		expect(validatePassword('abcdefgh', { rules })).toMatch(/stronger/);
		expect(validatePassword('abcdefgx', { rules })).toBe('');
		expect(validatePassword('abc', { min: 4, messages: { passwordTooShort: '{min} min' } })).toBe(
			'4 min'
		);
	});
	it('matches repeats', () => {
		expect(validatePasswordMatch('a', 'a')).toBe('');
		expect(validatePasswordMatch('a', 'b')).toMatch(/do not match/);
		expect(validatePasswordMatch('a', 'b', { passwordMismatch: 'No' })).toBe('No');
	});
});

describe('form validation', () => {
	it('sign in', () => {
		expect(validateSignIn({ email: '', password: '' })).toEqual({
			email: 'Enter your email address.',
			password: 'Enter your password.'
		});
		expect(validateSignIn({ email: 'a@b.co', password: 'x' })).toEqual({});
	});
	it('sign up', () => {
		const errors = validateSignUp({ name: '', email: 'x', password: 'a', terms: false });
		expect(Object.keys(errors)).toEqual(['name', 'email', 'password', 'terms']);
		expect(
			validateSignUp({ name: 'Ada', email: 'a@b.co', password: 'Abcdef1!', terms: true })
		).toEqual({});
		expect(
			validateSignUp(
				{ name: 'Ada', email: 'a@b.co', password: 'Abcdef1!', terms: false },
				{ messages: { termsRequired: 'T' } }
			).terms
		).toBe('T');
	});
	it('profile', () => {
		expect(validateProfile({ name: '', email: '', bio: 'x'.repeat(161) })).toEqual({
			name: 'Enter your name.',
			email: 'Enter your email address.',
			bio: 'Use 160 characters or fewer.'
		});
		expect(validateProfile({ name: 'A', email: 'a@b.co', bio: 'abc' }, { bioMax: 3 })).toEqual({});
		expect(validateProfile({ name: 'A', email: 'a@b.co', bio: 'abcd' }, { bioMax: 3 }).bio).toBe(
			'Use 3 characters or fewer.'
		);
	});
	it('summarises errors', () => {
		const errors = { a: 'x', b: '', c: 'y' };
		expect(firstErrorField(errors, ['b', 'c', 'a'])).toBe('c');
		expect(firstErrorField({}, ['a'])).toBeNull();
		expect(errorCount(errors)).toBe(2);
		expect(pluralise(1, 'problem', 'problems')).toBe('problem');
		expect(pluralise(0, 'problem', 'problems')).toBe('problems');
	});
});

describe('reset flow', () => {
	it('moves forward only from the matching step', () => {
		expect(nextResetStep(0, 'sent')).toBe(1);
		expect(nextResetStep(1, 'sent')).toBe(1);
		expect(nextResetStep(1, 'verified')).toBe(2);
		expect(nextResetStep(0, 'verified')).toBe(0);
		expect(nextResetStep(2, 'changed')).toBe(3);
		expect(nextResetStep(1, 'changed')).toBe(1);
	});
	it('goes back and restarts', () => {
		expect(nextResetStep(2, 'back')).toBe(1);
		expect(nextResetStep(1, 'back')).toBe(0);
		expect(nextResetStep(0, 'back')).toBe(0);
		expect(nextResetStep(3, 'back')).toBe(3);
		expect(nextResetStep(3, 'restart')).toBe(0);
	});
	it('counts down', () => {
		expect(secondsRemaining(10_000, 0)).toBe(10);
		expect(secondsRemaining(10_000, 9_500)).toBe(1);
		expect(secondsRemaining(10_000, 10_000)).toBe(0);
		expect(secondsRemaining(10_000, 20_000)).toBe(0);
	});
	it('formats a countdown', () => {
		expect(formatCountdown(7)).toBe('0:07');
		expect(formatCountdown(90)).toBe('1:30');
		expect(formatCountdown(600)).toBe('10:00');
		expect(formatCountdown(-5)).toBe('0:00');
		expect(formatCountdown(6.2)).toBe('0:07');
	});
	it('masks emails', () => {
		expect(maskEmail('ada@example.com')).toBe('a*a@example.com');
		expect(maskEmail('adalovelace@example.com')).toBe('a*********e@example.com');
		expect(maskEmail('ab@example.com')).toBe('a*@example.com');
		expect(maskEmail('nope')).toBe('nope');
		expect(maskEmail('@x.com')).toBe('@x.com');
	});
	it('normalises and validates codes', () => {
		expect(normaliseCode('12-34 5a6789', 6)).toBe('12345A');
		expect(normaliseCode('', 6)).toBe('');
		expect(validateCode('123456', 6)).toBe('');
		expect(validateCode('123', 6)).toBe('Enter all 6 characters of the code.');
		expect(validateCode('1', 6, { codeIncomplete: 'Faltan' })).toBe('Faltan');
	});
});

describe('profile helpers', () => {
	const base = { name: 'Ada', email: 'a@b.co', bio: '' };
	it('tracks changes', () => {
		expect(changedFields(base, base)).toEqual([]);
		expect(changedFields(base, { ...base, bio: 'hi', name: 'Bo' })).toEqual(['name', 'bio']);
		expect(isDirty(base, base)).toBe(false);
		expect(isDirty(base, { ...base, bio: 'x' })).toBe(true);
		expect(isDirty(base, base, true)).toBe(true);
	});
	it('counts characters', () => {
		expect(charsLeft('abc', 10)).toBe(7);
		expect(charsLeft('abc', 2)).toBe(-1);
	});
	it('formats byte sizes', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(-4)).toBe('0 B');
		expect(formatBytes(850)).toBe('850 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(2048)).toBe('2 KB');
		expect(formatBytes(20 * 1024)).toBe('20 KB');
		expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB');
		expect(formatBytes(5 * 1024 ** 3)).toBe('5 GB');
		expect(formatBytes(5000 * 1024 ** 3)).toBe('5000 GB');
	});
	it('checks avatar files', () => {
		expect(avatarFileError({ type: 'image/png', size: 100 })).toBe('');
		expect(avatarFileError({ type: 'application/pdf', size: 100 })).toMatch(/PNG, JPEG/);
		expect(avatarFileError({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toBe(
			'Choose an image under 2 MB.'
		);
		expect(avatarFileError({ type: 'image/svg+xml', size: 1 }, { types: ['image/svg+xml'] })).toBe(
			''
		);
		expect(avatarFileError({ type: 'image/png', size: 11 }, { maxBytes: 10 })).toMatch(/10 B/);
	});
});

describe('sessions', () => {
	const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
	const ago = (s: number) => NOW - s * 1000;
	it('says just now under a minute and for the future', () => {
		expect(relativeTime(ago(5), NOW)).toBe('Just now');
		expect(relativeTime(ago(59), NOW)).toBe('Just now');
		expect(relativeTime(ago(-500), NOW)).toBe('Just now');
		expect(relativeTime(ago(5), NOW, { justNow: 'Ahora' })).toBe('Ahora');
	});
	it('scales units', () => {
		expect(relativeTime(ago(60), NOW)).toBe('1 minute ago');
		expect(relativeTime(ago(5 * 60), NOW)).toBe('5 minutes ago');
		expect(relativeTime(ago(3600), NOW)).toBe('1 hour ago');
		expect(relativeTime(ago(3 * 3600 + 100), NOW)).toBe('3 hours ago');
		expect(relativeTime(ago(86400), NOW)).toBe('yesterday');
		expect(relativeTime(ago(3 * 86400), NOW)).toBe('3 days ago');
		expect(relativeTime(ago(14 * 86400), NOW)).toBe('2 weeks ago');
		expect(relativeTime(ago(60 * 86400), NOW)).toBe('2 months ago');
		expect(relativeTime(ago(800 * 86400), NOW)).toBe('2 years ago');
	});
	it('accepts ISO strings, dates and a Date for now, and a locale', () => {
		expect(relativeTime(new Date(ago(120)).toISOString(), new Date(NOW))).toBe('2 minutes ago');
		expect(relativeTime(new Date(ago(120)), NOW)).toBe('2 minutes ago');
		expect(relativeTime(ago(2 * 86400), NOW, { locale: 'de' })).toBe('vorgestern');
	});
	it('handles unparseable times', () => {
		expect(relativeTime('not a date', NOW)).toBe('Unknown');
		expect(relativeTime('not a date', NOW, { unknown: '?' })).toBe('?');
	});
	const sessions: AccountSession[] = [
		{ id: 'a', device: 'A', lastActive: ago(5000) },
		{ id: 'b', device: 'B', lastActive: ago(100), current: true },
		{ id: 'c', device: 'C', lastActive: new Date(ago(60)).toISOString() }
	];
	it('sorts current first, then by recency, without mutating', () => {
		const copy = [...sessions];
		expect(sortSessions(sessions).map((s) => s.id)).toEqual(['b', 'c', 'a']);
		expect(sessions).toEqual(copy);
		expect(sortSessions([sessions[0], sessions[1]]).map((s) => s.id)).toEqual(['b', 'a']);
		expect(sortSessions([sessions[1], sessions[0]]).map((s) => s.id)).toEqual(['b', 'a']);
	});
	it('lists the others', () => {
		expect(otherSessions(sessions).map((s) => s.id)).toEqual(['a', 'c']);
		expect(otherSessions([])).toEqual([]);
	});
});

describe('isoTime', () => {
	it('formats dates and blanks bad ones', () => {
		expect(isoTime(0)).toBe('1970-01-01T00:00:00.000Z');
		expect(isoTime('2026-01-02T03:04:05Z')).toBe('2026-01-02T03:04:05.000Z');
		expect(isoTime(new Date(1000))).toBe('1970-01-01T00:00:01.000Z');
		expect(isoTime('nope')).toBe('');
	});
});

describe('confirmMatches', () => {
	it('compares trimmed text', () => {
		expect(confirmMatches('DELETE', 'DELETE')).toBe(true);
		expect(confirmMatches('  DELETE ', 'DELETE')).toBe(true);
		expect(confirmMatches('delete', 'DELETE')).toBe(false);
		expect(confirmMatches('delete', 'DELETE', false)).toBe(true);
		expect(confirmMatches('DELET', 'DELETE')).toBe(false);
	});
	it('never matches an empty phrase', () => {
		expect(confirmMatches('', '')).toBe(false);
		expect(confirmMatches('x', '  ')).toBe(false);
	});
});

describe('two-factor helpers', () => {
	it('groups the secret', () => {
		expect(formatSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
		expect(formatSecret('abc def ghij')).toBe('abcd efgh ij');
		expect(formatSecret('')).toBe('');
		expect(formatSecret('abcdef', 3)).toBe('abc def');
	});
	it('formats recovery codes', () => {
		expect(formatRecoveryCode('ABCDE12345')).toBe('abcde-12345');
		expect(formatRecoveryCode('abcde-12345')).toBe('abcde-12345');
		expect(formatRecoveryCode('abcde 1234')).toBe('abcde-1234');
		expect(formatRecoveryCode('abc')).toBe('abc');
		expect(formatRecoveryCode('abcdefg')).toBe('abcd-efg');
	});
	it('generates codes from injected randomness', () => {
		const counter = () => {
			let n = 0;
			return (len: number) => Array.from({ length: len }, () => n++);
		};
		const codes = generateRecoveryCodes(counter(), 3, 10);
		expect(codes).toHaveLength(3);
		for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
		expect(new Set(codes).size).toBe(3);
		expect(generateRecoveryCodes(() => [], 0)).toEqual([]);
		expect(generateRecoveryCodes(counter())).toHaveLength(10);
	});
	it('builds the text and the file', () => {
		expect(recoveryCodesText(['ABCDE12345', 'fghij-67890'])).toBe('abcde-12345\nfghij-67890');
		const file = recoveryCodesFile(['abcde12345']);
		expect(file).toBe(
			'Recovery codes\n==============\n\nabcde-12345\n\nEach code works once. Keep them somewhere safe.\n'
		);
		expect(recoveryCodesFile(['abcde12345'], { title: 'T', note: 'N' })).toBe(
			'T\n=\n\nabcde-12345\n\nN\n'
		);
	});
	it('names the download', () => {
		expect(recoveryFilename('Nebula Kit!')).toBe('nebula-kit-recovery-codes.txt');
		expect(recoveryFilename('***')).toBe('account-recovery-codes.txt');
	});
});

describe('account switcher helpers', () => {
	const accounts: SwitcherAccount[] = [
		{ id: 'p', name: 'Personal' },
		{ id: 'a', name: 'Acme Inc', disabled: true },
		{ id: 'b', name: 'Beta Labs' },
		{ id: 'c', name: 'Acorn' }
	];
	it('finds the current index', () => {
		expect(currentIndex(accounts, 'b')).toBe(2);
		expect(currentIndex(accounts, 'zzz')).toBe(0);
		expect(currentIndex([], 'x')).toBe(0);
	});
	it('lists disabled indexes', () => {
		expect(disabledIndexes(accounts)).toEqual([1]);
		expect(disabledIndexes([])).toEqual([]);
	});
	it('jumps by initial, skipping disabled and wrapping', () => {
		expect(accountByInitial(accounts, 0, 'a')).toBe(3);
		expect(accountByInitial(accounts, 3, 'a')).toBe(3);
		expect(accountByInitial(accounts, 0, 'B')).toBe(2);
		expect(accountByInitial(accounts, 2, 'p')).toBe(0);
		expect(accountByInitial(accounts, 0, 'z')).toBeNull();
		expect(accountByInitial(accounts, 0, 'ab')).toBeNull();
		expect(accountByInitial([], 0, 'a')).toBeNull();
	});
});
