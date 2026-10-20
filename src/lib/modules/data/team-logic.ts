/** Team management: roles, invite validation and the member and invite lists. */

export interface TeamMember {
	id: string;
	name: string;
	email: string;
	role: string;
	avatar?: string;
	joinedAt?: string;
}

export interface TeamInvite {
	id: string;
	email: string;
	role: string;
	sentAt: string;
	resends?: number;
}

export interface RoleOption {
	value: string;
	label: string;
}

export const DEFAULT_ROLES: RoleOption[] = [
	{ value: 'owner', label: 'Owner' },
	{ value: 'admin', label: 'Admin' },
	{ value: 'member', label: 'Member' },
	{ value: 'viewer', label: 'Viewer' }
];

const EMAIL = /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\".]{2,}$/;

export function isEmail(value: string): boolean {
	return value.length <= 254 && EMAIL.test(value.trim());
}

/** Split pasted text ("a@x.com, b@y.com; c@z.com") into trimmed, non-empty addresses. */
export function parseEmails(raw: string): string[] {
	return raw
		.split(/[\s,;]+/)
		.map((e) => e.trim())
		.filter(Boolean);
}

export interface InviteIssue {
	email: string;
	reason: 'invalid' | 'member' | 'pending' | 'duplicate';
}

export interface InviteCheck {
	valid: string[];
	issues: InviteIssue[];
}

/** Sort a list of addresses into the ones to invite and the ones to turn away, with reasons. */
export function checkInvites(
	emails: readonly string[],
	members: readonly TeamMember[],
	invites: readonly TeamInvite[]
): InviteCheck {
	const valid: string[] = [];
	const issues: InviteIssue[] = [];
	const lower = (s: string) => s.trim().toLocaleLowerCase();
	const seen = new Set<string>();
	for (const email of emails) {
		const key = lower(email);
		if (!isEmail(email)) issues.push({ email, reason: 'invalid' });
		else if (seen.has(key)) issues.push({ email, reason: 'duplicate' });
		else if (members.some((m) => lower(m.email) === key)) issues.push({ email, reason: 'member' });
		else if (invites.some((i) => lower(i.email) === key)) issues.push({ email, reason: 'pending' });
		else {
			seen.add(key);
			valid.push(email.trim());
		}
	}
	return { valid, issues };
}

export const INVITE_MESSAGES = {
	invalid: (e: string) => `"${e}" is not a valid email address.`,
	member: (e: string) => `${e} is already on the team.`,
	pending: (e: string) => `${e} already has an invite waiting.`,
	duplicate: (e: string) => `${e} is listed twice.`
};

export function issueMessage(issue: InviteIssue, messages = INVITE_MESSAGES): string {
	return messages[issue.reason](issue.email);
}

/** A `validate` function for TagInput: returns a message to refuse an address. */
export function inviteValidator(
	members: readonly TeamMember[],
	invites: readonly TeamInvite[],
	messages = INVITE_MESSAGES
): (tag: string) => string | undefined {
	return (tag) => {
		const { issues } = checkInvites([tag], members, invites);
		return issues[0] ? issueMessage(issues[0], messages) : undefined;
	};
}

export function ownerCount(members: readonly TeamMember[]): number {
	return members.filter((m) => m.role === 'owner').length;
}

/** The last owner cannot be demoted or removed: a team with no owner cannot be managed. */
export function isLastOwner(members: readonly TeamMember[], id: string): boolean {
	const member = members.find((m) => m.id === id);
	return member?.role === 'owner' && ownerCount(members) === 1;
}

export function canChangeRole(members: readonly TeamMember[], id: string): boolean {
	return !isLastOwner(members, id);
}

export function canRemoveMember(members: readonly TeamMember[], id: string): boolean {
	return !isLastOwner(members, id);
}

export function changeRole(members: readonly TeamMember[], id: string, role: string): TeamMember[] {
	if (isLastOwner(members, id) && role !== 'owner') return members.slice();
	return members.map((m) => (m.id === id ? { ...m, role } : m));
}

export function removeMember(members: readonly TeamMember[], id: string): TeamMember[] {
	return canRemoveMember(members, id) ? members.filter((m) => m.id !== id) : members.slice();
}

export function addInvites(
	invites: readonly TeamInvite[],
	emails: readonly string[],
	role: string,
	now: string,
	makeId: (email: string, index: number) => string
): TeamInvite[] {
	return [
		...invites,
		...emails.map((email, i) => ({ id: makeId(email, i), email, role, sentAt: now, resends: 0 }))
	];
}

export function resendInvite(
	invites: readonly TeamInvite[],
	id: string,
	now: string
): TeamInvite[] {
	return invites.map((i) =>
		i.id === id ? { ...i, sentAt: now, resends: (i.resends ?? 0) + 1 } : i
	);
}

export function revokeInvite(invites: readonly TeamInvite[], id: string): TeamInvite[] {
	return invites.filter((i) => i.id !== id);
}

/** An invite is expired once it is older than `days` days. */
export function inviteStatus(
	invite: TeamInvite,
	now: string | number | Date,
	days = 14
): 'pending' | 'expired' {
	const age = new Date(now).getTime() - new Date(invite.sentAt).getTime();
	return age > days * 86_400_000 ? 'expired' : 'pending';
}

export function roleLabel(roles: readonly RoleOption[], value: string): string {
	return roles.find((r) => r.value === value)?.label ?? value;
}

/** "Invited 2 people as Member." */
export function inviteSummary(count: number, roleName: string): string {
	return `Invited ${count} ${count === 1 ? 'person' : 'people'} as ${roleName}.`;
}
