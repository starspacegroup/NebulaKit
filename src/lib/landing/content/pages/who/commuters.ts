import { definePage } from '../../../define';

/** Example content. Example Co. is not a real business; replace this page. */
export default definePage({
	family: 'who',
	slug: 'commuters',
	name: 'Commuters',
	title: 'Bike repair for people who ride to work | Example Co.',
	description:
		'Example Co. placeholder page: how a bike shop might describe its work for daily commuters. Not a real business.',
	h1: 'Bike repair for people who ride to work',
	lede: 'Placeholder text from Example Co. A commuter needs the bike back the same day, so this page would say how the shop makes that happen.',
	blurb: 'Same-day fixes and drop-off before work.',
	sectionsHeading: 'What a commuter needs from a bike shop',
	sections: [
		{
			heading: 'Drop off before work',
			body: 'Example Co. would describe its early drop-off here, in its own words, and only if it is true.'
		},
		{
			heading: 'Lights and brakes first',
			body: 'A commuter rides in the dark and in the rain. This section would say what the shop checks on every commuter bike.'
		},
		{
			heading: 'A loaner, if there is one',
			body: 'If the shop lends bikes during a repair, say so here. If it does not, leave this section out.'
		}
	],
	faq: [
		{
			question: 'Can I pick the bike up after work?',
			answer:
				'Example answer. Write the real pickup hours, matching the hours on your contact page.'
		},
		{
			question: 'Do you fix e-bikes?',
			answer: 'Example answer. Say plainly which e-bike brands and parts you work on.'
		},
		{
			question: 'What if a part has to be ordered?',
			answer: 'Example answer. Say how you tell the customer and how long an order usually takes.'
		}
	]
});
