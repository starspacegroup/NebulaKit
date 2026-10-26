import { definePage } from '../../../define';

/** Example content. Example Co. is not a real business; replace this page. */
export default definePage({
	family: 'when',
	slug: 'flat-tire',
	name: 'A flat tire',
	title: 'Flat tire? What to do first | Example Co.',
	description:
		'Example Co. placeholder situation page: what to do about a flat tire, and when to bring it in. Not a real business.',
	h1: 'You have a flat tire',
	lede: 'Placeholder text from Example Co. A situation page starts with what the reader should do right now, before it mentions the shop.',
	blurb: 'What to do first, and when to bring it in.',
	sectionsHeading: 'What to do',
	sections: [
		{
			heading: 'Look for the cause',
			body: 'Explain how to find the thorn or glass so the new tube does not go flat too.'
		},
		{
			heading: 'Patch or replace',
			body: 'Say when a patch is fine and when the tube or tire should be replaced.'
		},
		{
			heading: 'When to bring it in',
			body: 'Say which signs mean the rim or tire is damaged and needs the shop.'
		}
	],
	faq: [
		{
			question: 'Why do I keep getting flats?',
			answer: 'Example answer. List the common causes the shop really sees.'
		},
		{
			question: 'Can you fix it while I wait?',
			answer: 'Example answer. Say whether walk-in flat repair is offered.'
		},
		{
			question: 'Are tubeless tires worth it?',
			answer: 'Example answer. Give an honest view, including the downsides.'
		}
	]
});
