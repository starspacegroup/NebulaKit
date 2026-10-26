import { definePage } from '../../../define';

/** Example content. Example Co. is not a real business; replace this page. */
export default definePage({
	family: 'why',
	slug: 'plain-prices',
	name: 'Prices you see first',
	title: 'Prices you see before the work starts | Example Co.',
	description:
		'Example Co. placeholder reason page: a reason to choose a shop that a customer can check. Not a real business.',
	h1: 'You see the price before we start',
	lede: 'Placeholder text from Example Co. A reason page makes one claim the reader can check, and shows how.',
	blurb: 'A written quote before any work.',
	sectionsHeading: 'How it works',
	sections: [
		{
			heading: 'A written quote',
			body: 'Describe the quote the customer gets: on paper, by text, or by email.'
		},
		{
			heading: 'Nothing added without asking',
			body: 'Say what happens when the shop finds more work: it stops and asks.'
		},
		{
			heading: 'How to check this',
			body: 'Point to the published price list, so the reader can see it is true.'
		}
	],
	faq: [
		{
			question: 'What if the repair costs more than the quote?',
			answer: 'Example answer. State the real policy in one sentence.'
		},
		{
			question: 'Do you charge to look at a bike?',
			answer: 'Example answer. Say whether there is an inspection fee.'
		},
		{
			question: 'Where is the price list?',
			answer: 'Example answer. Link the real price list page.'
		}
	]
});
