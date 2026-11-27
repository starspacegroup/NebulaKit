/**
 * The message catalogue: every user-facing string that has moved off a
 * component and onto a key. English only for now. There is no locale routing
 * and no negotiation here; see issue #12 for the later slices.
 *
 * Keep this file dependency-free and in `.ts`, so the 95% coverage floor
 * measures it (`.svelte` files are excluded from coverage).
 */
export const en = {
	'nav.pretendBadge': 'PRETEND',
	'nav.pretendSession': 'Pretend login session',
	'nav.openCommandPalette': 'Open command palette,',
	'nav.toggleMenu': 'Toggle menu',
	'nav.closeMenu': 'Close menu',
	'nav.searchAndCommands': 'Search & commands',
	'nav.admin': 'Admin',
	'nav.profile': 'Profile',
	'nav.logout': 'Logout',
	'nav.signIn': 'Sign In',
	'nav.userMenu': 'User menu'
} as const;

/** Every key the catalogue defines. A misspelt key fails type-checking. */
export type MessageKey = keyof typeof en;

/**
 * Look up a message by key. Returns the English text today. Components call
 * this instead of holding string literals, so a later locale layer has one
 * place to change.
 */
export function t(key: MessageKey): string {
	return en[key];
}
