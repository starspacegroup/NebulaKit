import type { FamilyKey, LandingFamily } from './types';

/**
 * Starting labels for the five families. A site overrides any field with
 * `defineFamilies`, and leaves out the families it does not use.
 *
 * The hub copy here is deliberately generic and short; replace it with the
 * site's own words before going live.
 */
export const DEFAULT_FAMILIES: Readonly<Record<FamilyKey, LandingFamily>> = {
	who: {
		key: 'who',
		prefix: 'who',
		label: 'Who we work with',
		hubTitle: 'Who we work with',
		hubDescription: 'The kinds of customers we work with, and what each one needs.',
		hubH1: 'Who we work with',
		hubIntro: 'Each page says what that kind of customer needs, in their terms.'
	},
	where: {
		key: 'where',
		prefix: 'where',
		label: 'Where we work',
		hubTitle: 'Where we work',
		hubDescription: 'The places we have a real tie to, and what matters there.',
		hubH1: 'Where we work',
		hubIntro: 'Only places we have a real tie to. Each page says what is different there.',
		region: true
	},
	what: {
		key: 'what',
		prefix: 'what',
		label: 'What we do',
		hubTitle: 'What we do',
		hubDescription: 'The services we offer, one page each.',
		hubH1: 'What we do',
		hubIntro: 'One page per service: what it is, who it is for, and what it costs.'
	},
	when: {
		key: 'when',
		prefix: 'when',
		label: 'When to call us',
		hubTitle: 'When to call us',
		hubDescription: 'Situations we help with, and what to do first in each.',
		hubH1: 'When to call us',
		hubIntro: 'One page per situation: what is going on and what to do first.'
	},
	why: {
		key: 'why',
		prefix: 'why',
		label: 'Why work with us',
		hubTitle: 'Why work with us',
		hubDescription: 'The reasons to choose us, each one something you can check.',
		hubH1: 'Why work with us',
		hubIntro: 'Each reason is something you can check for yourself.'
	}
};

/** Pick families in order, overriding fields per family. */
export function defineFamilies(
	overrides: Partial<Record<FamilyKey, Partial<Omit<LandingFamily, 'key'>>>>
): LandingFamily[] {
	return (Object.keys(overrides) as FamilyKey[]).map((key) => ({
		...DEFAULT_FAMILIES[key],
		...overrides[key],
		key
	}));
}
