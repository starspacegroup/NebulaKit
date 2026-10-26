import { describe, expect, it } from 'vitest';
import {
	addInvites,
	canChangeRole,
	canRemoveMember,
	changeRole,
	checkInvites,
	DEFAULT_ROLES,
	inviteStatus,
	inviteSummary,
	inviteValidator,
	isEmail,
	isLastOwner,
	issueMessage,
	ownerCount,
	parseEmails,
	removeMember,
	resendInvite,
	revokeInvite,
	roleLabel,
	type TeamInvite,
	type TeamMember
} from './team-logic';

const members: TeamMember[] = [
	{ id: '1', name: 'Ada', email: 'ada@example.com', role: 'owner' },
	{ id: '2', name: 'Alan', email: 'Alan@Example.com', role: 'member' }
];
const invites: TeamInvite[] = [
	{ id: 'i1', email: 'grace@example.com', role: 'member', sentAt: '2026-10-01T00:00:00Z' }
];

describe('emails', () => {
	it('validates', () => {
		for (const ok of ['a@b.co', 'first.last+tag@sub.example.org', ' a@b.io '])
			expect(isEmail(ok)).toBe(true);
		for (const bad of ['', 'a', 'a@b', 'a@@b.co', 'a b@c.co', 'a@b.c', `${'x'.repeat(250)}@b.co`]) {
			expect(isEmail(bad)).toBe(false);
		}
	});
	it('parses pasted lists', () => {
		expect(parseEmails('a@x.co, b@y.co;c@z.co\nd@w.co  ')).toEqual([
			'a@x.co',
			'b@y.co',
			'c@z.co',
			'd@w.co'
		]);
		expect(parseEmails('  ')).toEqual([]);
	});
});

describe('checkInvites', () => {
	it('sorts valid from each kind of refusal', () => {
		const r = checkInvites(
			[
				'new@example.com',
				'nope',
				'ada@EXAMPLE.com',
				'grace@example.com',
				'new@example.com',
				' two@example.com '
			],
			members,
			invites
		);
		expect(r.valid).toEqual(['new@example.com', 'two@example.com']);
		expect(r.issues.map((i) => i.reason)).toEqual(['invalid', 'member', 'pending', 'duplicate']);
	});
	it('words each issue, with translatable messages', () => {
		const r = checkInvites(['x', 'ada@example.com', 'grace@example.com'], members, invites);
		expect(r.issues.map((i) => issueMessage(i))).toEqual([
			'"x" is not a valid email address.',
			'ada@example.com is already on the team.',
			'grace@example.com already has an invite waiting.'
		]);
		const dup = checkInvites(['a@b.co', 'a@b.co'], [], []);
		expect(issueMessage(dup.issues[0])).toBe('a@b.co is listed twice.');
		expect(
			issueMessage(dup.issues[0], {
				...{ invalid: () => '', member: () => '', pending: () => '' },
				duplicate: () => 'dup'
			})
		).toBe('dup');
	});
	it('makes a TagInput validator', () => {
		const v = inviteValidator(members, invites);
		expect(v('fresh@example.com')).toBeUndefined();
		expect(v('ada@example.com')).toContain('already on the team');
	});
});

describe('roles and owners', () => {
	it('protects the last owner', () => {
		expect(ownerCount(members)).toBe(1);
		expect(isLastOwner(members, '1')).toBe(true);
		expect(isLastOwner(members, '2')).toBe(false);
		expect(isLastOwner(members, 'zz')).toBe(false);
		expect(canChangeRole(members, '1')).toBe(false);
		expect(canRemoveMember(members, '1')).toBe(false);
		expect(canRemoveMember(members, '2')).toBe(true);
	});
	it('changes roles', () => {
		expect(changeRole(members, '2', 'admin')[1].role).toBe('admin');
		expect(changeRole(members, '1', 'viewer')[0].role).toBe('owner');
		expect(changeRole(members, '1', 'owner')[0].role).toBe('owner');
		const two = [...members, { id: '3', name: 'G', email: 'g@x.co', role: 'owner' }];
		expect(changeRole(two, '1', 'admin')[0].role).toBe('admin');
	});
	it('removes members except the last owner', () => {
		expect(removeMember(members, '2')).toHaveLength(1);
		expect(removeMember(members, '1')).toHaveLength(2);
	});
	it('labels roles', () => {
		expect(roleLabel(DEFAULT_ROLES, 'admin')).toBe('Admin');
		expect(roleLabel(DEFAULT_ROLES, 'custom')).toBe('custom');
	});
});

describe('invites', () => {
	it('adds, resends, revokes', () => {
		const added = addInvites(invites, ['a@b.co', 'c@d.co'], 'viewer', 'NOW', (e, i) => `${e}-${i}`);
		expect(added).toHaveLength(3);
		expect(added[2]).toEqual({
			id: 'c@d.co-1',
			email: 'c@d.co',
			role: 'viewer',
			sentAt: 'NOW',
			resends: 0
		});
		const again = resendInvite(added, 'i1', 'LATER');
		expect(again[0]).toMatchObject({ sentAt: 'LATER', resends: 1 });
		expect(resendInvite(again, 'i1', 'L2')[0].resends).toBe(2);
		expect(again[1]).toBe(added[1]);
		expect(revokeInvite(added, 'i1')).toHaveLength(2);
	});
	it('expires after the window', () => {
		expect(inviteStatus(invites[0], '2026-10-10T00:00:00Z')).toBe('pending');
		expect(inviteStatus(invites[0], '2026-10-20T00:00:00Z')).toBe('expired');
		expect(inviteStatus(invites[0], '2026-10-10T00:00:00Z', 5)).toBe('expired');
	});
	it('summarises', () => {
		expect(inviteSummary(1, 'Member')).toBe('Invited 1 person as Member.');
		expect(inviteSummary(3, 'Admin')).toBe('Invited 3 people as Admin.');
	});
});
