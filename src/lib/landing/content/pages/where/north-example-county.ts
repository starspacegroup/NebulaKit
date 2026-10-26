import { definePage } from '../../../define';

/** Example content. North Example County is not a real place; replace this page. */
export default definePage({
	family: 'where',
	slug: 'north-example-county',
	name: 'North Example County',
	title: 'Bike repair across North Example County | Example Co.',
	description:
		'Example Co. placeholder region page for an invented county. A second region needs its own tie and its own facts.',
	h1: 'Bike repair for the rest of North Example County',
	lede: 'Placeholder text from Example Co. If the shop serves the wider county, this page says how, and what rural riders need that town riders do not.',
	blurb: 'The wider county, by appointment.',
	sectionsHeading: 'What rural riders need',
	sections: [
		{
			heading: 'Long rides between towns',
			body: 'Describe what the shop checks before a long rural ride, written for these riders.'
		},
		{
			heading: 'Gravel and dirt roads',
			body: 'If the county has gravel roads, say what tires and setup the shop suggests.'
		},
		{
			heading: 'Booking ahead',
			body: 'Say how a rider far from the shop books a time so the trip is not wasted.'
		}
	],
	faq: [
		{
			question: 'Will you come to me?',
			answer: 'Example answer. Describe a mobile service only if the shop has one.'
		},
		{
			question: 'Can I mail a wheel for truing?',
			answer: 'Example answer. Say whether you accept mailed parts and how to pack them.'
		},
		{
			question: 'Which towns do you cover?',
			answer: 'Example answer. List only towns you really serve.'
		}
	],
	areaServed: 'North Example County',
	tie: {
		kind: 'worked-here',
		note: 'Example Co. runs a weekly repair stand in the county (invented for the example).'
	}
});
