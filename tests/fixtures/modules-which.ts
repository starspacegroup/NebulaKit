// The harness switches. Kept here, not in the .svelte files, because Prettier 3.8 (the site) and
// 3.9 (the template) lay long unions out differently and `// prettier-ignore` does not hold in a
// Svelte script block.

// prettier-ignore
export type AccountWhich = 'sign-in' | 'sign-up' | 'reset' | 'profile' | 'sessions' | 'danger' | 'two-factor' | 'switcher';

// prettier-ignore
export type MarketingWhich = 'hero' | 'cta' | 'pricing' | 'carousel' | 'faq' | 'newsletter' | 'contact' | 'announcement';

// prettier-ignore
export type ShellWhich = 'shell' | 'header' | 'notifications' | 'search' | 'user' | 'checklist' | 'wizard' | 'error' | 'empty' | 'confirm' | 'tabs' | 'toolbar' | 'bottom';
