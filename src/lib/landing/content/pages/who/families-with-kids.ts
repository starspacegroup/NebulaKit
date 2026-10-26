import { definePage } from '../../../define';

/** Example content. Example Co. is not a real business; replace this page. */
export default definePage({
	family: 'who',
	slug: 'families-with-kids',
	name: 'Families with kids',
	title: 'Kids bikes: fitting, repair and hand-me-downs | Example Co.',
	description:
		'Example Co. placeholder page: what a family with growing kids might need from a bike shop. Not a real business.',
	h1: 'Kids bikes that fit, and keep fitting',
	lede: 'Placeholder text from Example Co. Kids grow out of bikes fast, so this page would talk about fit and about passing bikes down.',
	blurb: 'Fitting, small repairs and getting a hand-me-down ready.',
	sectionsHeading: 'What a family needs from a bike shop',
	sections: [
		{
			heading: 'A bike that fits now',
			body: 'This section would explain how the shop checks fit, in words a parent can follow.'
		},
		{
			heading: 'Hand-me-downs made safe',
			body: 'An older sibling’s bike often needs new tires and brake pads. Describe what the shop would check.'
		},
		{
			heading: 'Helmets',
			body: 'If the shop fits helmets, say how. If it sells none, do not imply that it does.'
		}
	],
	faq: [
		{
			question: 'Should my child come to the fitting?',
			answer: 'Example answer. Say whether the child needs to be there and what to bring.'
		},
		{
			question: 'Do you take trade-ins?',
			answer: 'Example answer. Only describe a trade-in program that really exists.'
		},
		{
			question: 'Can you add training wheels?',
			answer: 'Example answer. Say yes or no, and what you suggest instead if no.'
		}
	]
});
