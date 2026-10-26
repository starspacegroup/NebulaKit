import { definePage } from '../../../define';

/** Example content. Exampleton is not a real place; replace this page. */
export default definePage({
	family: 'where',
	slug: 'exampleton',
	name: 'Exampleton',
	title: 'Bike shop in Exampleton | Example Co.',
	description:
		'Example Co. placeholder region page for the made-up town of Exampleton. Shows the shape of a page for a place with a real tie.',
	h1: 'A bike shop in Exampleton, for Exampleton riders',
	lede: 'Placeholder text from Example Co. A region page says what is different about riding here, not the same page with the town name changed.',
	blurb: 'The town the shop is in.',
	sectionsHeading: 'What matters for riding in Exampleton',
	sections: [
		{
			heading: 'The hills on the east side',
			body: 'A real page would name a local fact a customer recognizes. This one is invented for the example.'
		},
		{
			heading: 'Winter salt on the roads',
			body: 'Describe what local conditions do to a bike and what the shop does about it.'
		},
		{
			heading: 'Getting to the shop',
			body: 'Say how to reach the shop by bike or bus, only if the shop has a public address on the site.'
		}
	],
	faq: [
		{
			question: 'Do you pick up bikes in Exampleton?',
			answer: 'Example answer. Describe a pickup service only if it really exists.'
		},
		{
			question: 'Do you sponsor local rides?',
			answer: 'Example answer. Name only events the shop really takes part in.'
		},
		{
			question: 'Is there parking at the shop?',
			answer: 'Example answer. Describe the parking as it is.'
		}
	],
	areaServed: 'Exampleton',
	tie: {
		kind: 'based-here',
		note: 'Example Co. is based in Exampleton (invented for the example).'
	}
});
