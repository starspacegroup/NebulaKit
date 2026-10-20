/**
 * The decisions the account modules make, apart from the markup that shows
 * them: validation, password strength, countdowns, relative time, confirm
 * matching and recovery-code formatting. Pure functions, no DOM, no clock
 * (every time is passed in), so they are tested exhaustively.
 */

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

/** Validation messages. Pass your own to translate them. */
export interface AccountMessages {
	emailRequired: string;
	emailInvalid: string;
	passwordRequired: string;
	passwordTooShort: string;
	passwordWeak: string;
	passwordMismatch: string;
	nameRequired: string;
	nameTooLong: string;
	termsRequired: string;
	codeIncomplete: string;
	bioTooLong: string;
}

export const DEFAULT_ACCOUNT_MESSAGES: AccountMessages = {
	emailRequired: 'Enter your email address.',
	emailInvalid: 'Enter an email address like name@example.com.',
	passwordRequired: 'Enter your password.',
	passwordTooShort: 'Use at least {min} characters.',
	passwordWeak: 'Choose a stronger password that meets every requirement.',
	passwordMismatch: 'The passwords do not match.',
	nameRequired: 'Enter your name.',
	nameTooLong: 'Use {max} characters or fewer.',
	termsRequired: 'Accept the terms to continue.',
	codeIncomplete: 'Enter all {length} characters of the code.',
	bioTooLong: 'Use {max} characters or fewer.'
};

/** Fill `{name}` placeholders in a message. Unknown placeholders are left as written. */
export function fillMessage(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
		key in values ? String(values[key]) : whole
	);
}

function messages(custom?: Partial<AccountMessages>): AccountMessages {
	return { ...DEFAULT_ACCOUNT_MESSAGES, ...custom };
}

/* ------------------------------------------------------------------ */
/* Email, name                                                         */
/* ------------------------------------------------------------------ */

/** A pragmatic email check: one @, something either side, a dot in the domain, no spaces. */
export function isValidEmail(value: string): boolean {
	const email = value.trim();
	if (email.length === 0 || email.length > 254) return false;
	return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** The error for an email field, or '' when it is fine. */
export function validateEmail(value: string, custom?: Partial<AccountMessages>): string {
	const m = messages(custom);
	if (value.trim() === '') return m.emailRequired;
	return isValidEmail(value) ? '' : m.emailInvalid;
}

export const NAME_MAX = 80;

/** The error for a name field, or '' when it is fine. */
export function validateName(
	value: string,
	custom?: Partial<AccountMessages>,
	max: number = NAME_MAX
): string {
	const m = messages(custom);
	const name = value.trim();
	if (name === '') return m.nameRequired;
	return name.length > max ? fillMessage(m.nameTooLong, { max }) : '';
}

/* ------------------------------------------------------------------ */
/* Password strength                                                   */
/* ------------------------------------------------------------------ */

export interface PasswordRule {
	id: string;
	label: string;
	test: (password: string) => boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

/** The default requirements, in the order they are listed. */
export function defaultPasswordRules(min: number = MIN_PASSWORD_LENGTH): PasswordRule[] {
	return [
		{ id: 'length', label: `At least ${min} characters`, test: (p) => p.length >= min },
		{ id: 'lower', label: 'A lowercase letter', test: (p) => /\p{Ll}/u.test(p) },
		{ id: 'upper', label: 'An uppercase letter', test: (p) => /\p{Lu}/u.test(p) },
		{ id: 'number', label: 'A number', test: (p) => /\d/.test(p) },
		{ id: 'symbol', label: 'A symbol', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) }
	];
}

export interface PasswordRequirement {
	id: string;
	label: string;
	met: boolean;
}

/** Each rule with whether the password meets it. */
export function passwordRequirements(
	password: string,
	rules: PasswordRule[] = defaultPasswordRules()
): PasswordRequirement[] {
	return rules.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password) }));
}

/** True when every rule is met. */
export function meetsAllRequirements(
	password: string,
	rules: PasswordRule[] = defaultPasswordRules()
): boolean {
	return rules.every((rule) => rule.test(password));
}

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
	/** 0 (nothing typed) to 4. */
	score: 0 | 1 | 2 | 3 | 4;
	level: StrengthLevel;
	/** 0 to 100, for a meter. */
	percent: number;
}

const COMMON_PASSWORDS = [
	'password',
	'passw0rd',
	'qwerty',
	'letmein',
	'welcome',
	'admin',
	'iloveyou',
	'abc123',
	'123456',
	'111111'
];

/** True for passwords that are only a few characters repeated ("aaaaaaaa", "abababab"). */
export function isRepetitive(password: string): boolean {
	if (password.length < 4) return false;
	return /^(.{1,3})\1+$/su.test(password);
}

/** True when the password contains one of a short list of very common passwords. */
export function isCommonPassword(password: string): boolean {
	const lower = password.toLowerCase();
	return COMMON_PASSWORDS.some((common) => lower.includes(common));
}

const LEVELS: StrengthLevel[] = ['empty', 'weak', 'fair', 'good', 'strong'];

/**
 * How strong a password is, from 0 to 4. Length counts most, then variety of
 * character classes; repetition and common words cap the score at "weak".
 */
export function passwordStrength(password: string): PasswordStrength {
	if (password.length === 0) return { score: 0, level: 'empty', percent: 0 };

	const classes = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\p{N}]/u].filter((re) =>
		re.test(password)
	).length;
	let points = classes;
	if (password.length >= 8) points += 1;
	if (password.length >= 12) points += 1;
	if (password.length >= 16) points += 1;
	// points is 1..7. Under 8 characters can never be better than "fair".
	let score = points <= 2 ? 1 : points <= 4 ? 2 : points <= 5 ? 3 : 4;
	if (password.length < 8) score = Math.min(score, 2);
	if (isRepetitive(password) || isCommonPassword(password)) score = 1;

	const clamped = score as 1 | 2 | 3 | 4;
	return { score: clamped, level: LEVELS[clamped], percent: clamped * 25 };
}

/** The error for a new password, or '' when it is acceptable. */
export function validatePassword(
	password: string,
	opts: { rules?: PasswordRule[]; min?: number; messages?: Partial<AccountMessages> } = {}
): string {
	const m = messages(opts.messages);
	const min = opts.min ?? MIN_PASSWORD_LENGTH;
	if (password === '') return m.passwordRequired;
	if (password.length < min) return fillMessage(m.passwordTooShort, { min });
	return meetsAllRequirements(password, opts.rules ?? defaultPasswordRules(min))
		? ''
		: m.passwordWeak;
}

/** The error for a "repeat the password" field, or ''. */
export function validatePasswordMatch(
	password: string,
	repeat: string,
	custom?: Partial<AccountMessages>
): string {
	return password === repeat ? '' : messages(custom).passwordMismatch;
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

export type FieldErrors = Record<string, string>;

export interface SignInValues {
	email: string;
	password: string;
}

/** Errors for the sign-in form, keyed by field. Empty when valid. */
export function validateSignIn(
	values: SignInValues,
	custom?: Partial<AccountMessages>
): FieldErrors {
	const errors: FieldErrors = {};
	const email = validateEmail(values.email, custom);
	if (email) errors.email = email;
	if (values.password === '') errors.password = messages(custom).passwordRequired;
	return errors;
}

export interface SignUpValues {
	name: string;
	email: string;
	password: string;
	terms: boolean;
}

/** Errors for the sign-up form, keyed by field. Empty when valid. */
export function validateSignUp(
	values: SignUpValues,
	opts: { rules?: PasswordRule[]; min?: number; messages?: Partial<AccountMessages> } = {}
): FieldErrors {
	const errors: FieldErrors = {};
	const name = validateName(values.name, opts.messages);
	if (name) errors.name = name;
	const email = validateEmail(values.email, opts.messages);
	if (email) errors.email = email;
	const password = validatePassword(values.password, opts);
	if (password) errors.password = password;
	if (!values.terms) errors.terms = messages(opts.messages).termsRequired;
	return errors;
}

/** The first field with an error, following the order of `order`. */
export function firstErrorField(errors: FieldErrors, order: string[]): string | null {
	return order.find((field) => Boolean(errors[field])) ?? null;
}

/** Number of errors, for a summary heading. */
export function errorCount(errors: FieldErrors): number {
	return Object.values(errors).filter(Boolean).length;
}

/** "1 problem" / "3 problems" style count, with the noun passed in for translation. */
export function pluralise(count: number, one: string, other: string): string {
	return count === 1 ? one : other;
}

/* ------------------------------------------------------------------ */
/* Password reset flow                                                 */
/* ------------------------------------------------------------------ */

export type ResetStep = 0 | 1 | 2 | 3;

/** Step 3 is the "done" screen. */
export const RESET_DONE: ResetStep = 3;

export type ResetEvent = 'sent' | 'verified' | 'changed' | 'back' | 'restart';

/** The step after an event. `back` stops at the first step; `done` is final until `restart`. */
export function nextResetStep(step: ResetStep, event: ResetEvent): ResetStep {
	switch (event) {
		case 'sent':
			return step === 0 ? 1 : step;
		case 'verified':
			return step === 1 ? 2 : step;
		case 'changed':
			return step === 2 ? 3 : step;
		case 'back':
			return step === 1 || step === 2 ? ((step - 1) as ResetStep) : step;
		case 'restart':
			return 0;
	}
}

/** Whole seconds left until `endsAt` (ms since epoch), never negative. */
export function secondsRemaining(endsAt: number, now: number): number {
	return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** "0:07", "1:30": seconds as m:ss. Negative or fractional values are clamped and rounded up. */
export function formatCountdown(seconds: number): string {
	const total = Math.max(0, Math.ceil(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

/** Hide the middle of an email for display: "ada@example.com" becomes "a*a@example.com". */
export function maskEmail(email: string): string {
	const at = email.lastIndexOf('@');
	if (at < 1) return email;
	const local = email.slice(0, at);
	const domain = email.slice(at);
	if (local.length <= 2) return `${local[0]}*${domain}`;
	return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
}

/** Keep only the characters of a one-time code, upper-cased, up to `length`. */
export function normaliseCode(value: string, length: number): string {
	return value
		.replace(/[^A-Za-z0-9]/g, '')
		.toUpperCase()
		.slice(0, length);
}

/** The error for a code field, or '' when it is complete. */
export function validateCode(
	value: string,
	length: number,
	custom?: Partial<AccountMessages>
): string {
	return value.length === length ? '' : fillMessage(messages(custom).codeIncomplete, { length });
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export interface ProfileValues {
	name: string;
	email: string;
	bio: string;
}

export const BIO_MAX = 160;

/** Errors for the profile form, keyed by field. */
export function validateProfile(
	values: ProfileValues,
	opts: { bioMax?: number; messages?: Partial<AccountMessages> } = {}
): FieldErrors {
	const errors: FieldErrors = {};
	const name = validateName(values.name, opts.messages);
	if (name) errors.name = name;
	const email = validateEmail(values.email, opts.messages);
	if (email) errors.email = email;
	const bioMax = opts.bioMax ?? BIO_MAX;
	if (values.bio.length > bioMax) {
		errors.bio = fillMessage(messages(opts.messages).bioTooLong, { max: bioMax });
	}
	return errors;
}

/** Which of the given fields differ between two records. */
export function changedFields<T extends Record<string, unknown>>(
	initial: T,
	current: T
): (keyof T)[] {
	return (Object.keys(current) as (keyof T)[]).filter((key) => initial[key] !== current[key]);
}

/** True when any field differs, or a new avatar was picked or removed. */
export function isDirty<T extends Record<string, unknown>>(
	initial: T,
	current: T,
	avatarChanged = false
): boolean {
	return avatarChanged || changedFields(initial, current).length > 0;
}

/** Characters left in a limited field. Negative when over. */
export function charsLeft(value: string, max: number): number {
	return max - value.length;
}

export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** "850 B", "1.5 KB", "2 MB". */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
	const units = ['KB', 'MB', 'GB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	const text =
		value >= 10 || Number.isInteger(value) ? String(Math.round(value)) : value.toFixed(1);
	return `${text} ${units[unit]}`;
}

/** The reason a picked file cannot be an avatar, or '' when it can. */
export function avatarFileError(
	file: { type: string; size: number },
	opts: { types?: string[]; maxBytes?: number } = {}
): string {
	const types = opts.types ?? AVATAR_TYPES;
	const maxBytes = opts.maxBytes ?? AVATAR_MAX_BYTES;
	if (!types.includes(file.type)) return 'Choose a PNG, JPEG, WebP or GIF image.';
	if (file.size > maxBytes) return `Choose an image under ${formatBytes(maxBytes)}.`;
	return '';
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export interface AccountSession {
	id: string;
	/** "Firefox on Linux". */
	device: string;
	location?: string;
	/** ISO string, ms since epoch or Date. */
	lastActive: string | number | Date;
	current?: boolean;
}

function toMillis(value: string | number | Date): number {
	return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** An ISO string for a `<time datetime>`, or '' when the value is not a date. */
export function isoTime(value: string | number | Date): string {
	const ms = toMillis(value);
	return Number.isNaN(ms) ? '' : new Date(ms).toISOString();
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['week', 7 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600]
];

/**
 * "5 minutes ago", "yesterday", "2 weeks ago". Under a minute is `justNow`.
 * A time in the future (clock skew) also reads as `justNow`. An unparseable
 * time returns `unknown`.
 */
export function relativeTime(
	value: string | number | Date,
	now: number | Date,
	opts: { locale?: string; justNow?: string; unknown?: string } = {}
): string {
	const then = toMillis(value);
	if (Number.isNaN(then)) return opts.unknown ?? 'Unknown';
	const seconds = Math.floor(((now instanceof Date ? now.getTime() : now) - then) / 1000);
	if (seconds < 60) return opts.justNow ?? 'Just now';
	const rtf = new Intl.RelativeTimeFormat(opts.locale ?? 'en', { numeric: 'auto' });
	for (const [unit, size] of RELATIVE_UNITS) {
		if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
	}
	return rtf.format(-Math.floor(seconds / 60), 'minute');
}

/** Current session first, then most recently active. Does not change the input. */
export function sortSessions(sessions: AccountSession[]): AccountSession[] {
	return [...sessions].sort((a, b) => {
		if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1;
		return toMillis(b.lastActive) - toMillis(a.lastActive);
	});
}

/** The sessions that "sign out everywhere else" would end. */
export function otherSessions(sessions: AccountSession[]): AccountSession[] {
	return sessions.filter((s) => !s.current);
}

/* ------------------------------------------------------------------ */
/* Confirm matching (danger zone)                                      */
/* ------------------------------------------------------------------ */

/** Whether what was typed matches the phrase. Surrounding space is ignored; case is not unless asked. */
export function confirmMatches(typed: string, expected: string, caseSensitive = true): boolean {
	const a = typed.trim();
	const b = expected.trim();
	if (b === '') return false;
	return caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Two-factor: secret and recovery codes                               */
/* ------------------------------------------------------------------ */

/** Group a setup secret for reading aloud and typing: "JBSWY3DPEHPK3PXP" becomes "JBSW Y3DP EHPK 3PXP". */
export function formatSecret(secret: string, group = 4): string {
	const clean = secret.replace(/\s+/g, '');
	const parts: string[] = [];
	for (let i = 0; i < clean.length; i += group) parts.push(clean.slice(i, i + group));
	return parts.join(' ');
}

/** A recovery code as "abcde-fghij": split in the middle with a dash. Already-dashed codes are normalised. */
export function formatRecoveryCode(code: string): string {
	const clean = code.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
	if (clean.length < 4) return clean;
	const half = Math.ceil(clean.length / 2);
	return `${clean.slice(0, half)}-${clean.slice(half)}`;
}

/** Build recovery codes from a source of random bytes (injectable so it is testable). */
export function generateRecoveryCodes(
	random: (n: number) => number[],
	count = 10,
	length = 10
): string[] {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	const codes: string[] = [];
	for (let i = 0; i < count; i++) {
		const bytes = random(length);
		let raw = '';
		for (let j = 0; j < length; j++) raw += alphabet[bytes[j] % alphabet.length];
		codes.push(formatRecoveryCode(raw));
	}
	return codes;
}

/** All codes as text: one per line, for copying. */
export function recoveryCodesText(codes: string[]): string {
	return codes.map(formatRecoveryCode).join('\n');
}

/** The text file a user downloads: a title, the codes, and a reminder. */
export function recoveryCodesFile(
	codes: string[],
	opts: { title?: string; note?: string } = {}
): string {
	const title = opts.title ?? 'Recovery codes';
	const note = opts.note ?? 'Each code works once. Keep them somewhere safe.';
	return `${title}\n${'='.repeat(title.length)}\n\n${recoveryCodesText(codes)}\n\n${note}\n`;
}

/** A filename-safe name for the download. */
export function recoveryFilename(appName: string): string {
	const slug = appName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `${slug || 'account'}-recovery-codes.txt`;
}

/* ------------------------------------------------------------------ */
/* Account switcher                                                    */
/* ------------------------------------------------------------------ */

export interface SwitcherAccount {
	id: string;
	name: string;
	/** "Personal", "Owner of Acme", an email. */
	description?: string;
	avatarUrl?: string;
	disabled?: boolean;
}

/** Index of the current account in the list, or 0 when it is not found. */
export function currentIndex(accounts: SwitcherAccount[], currentId: string): number {
	return Math.max(
		0,
		accounts.findIndex((a) => a.id === currentId)
	);
}

/** Indexes of accounts that cannot be chosen. */
export function disabledIndexes(accounts: SwitcherAccount[]): number[] {
	return accounts.flatMap((a, i) => (a.disabled ? [i] : []));
}

/**
 * The index typing a character jumps to: the next account after `from` whose
 * name starts with it (case-insensitive), wrapping round; null if none.
 */
export function accountByInitial(
	accounts: SwitcherAccount[],
	from: number,
	char: string
): number | null {
	if (char.length !== 1) return null;
	const c = char.toLowerCase();
	for (let n = 1; n <= accounts.length; n++) {
		const i = (from + n) % accounts.length;
		if (!accounts[i].disabled && accounts[i].name.toLowerCase().startsWith(c)) return i;
	}
	return null;
}
